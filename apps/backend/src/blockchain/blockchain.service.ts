import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import type { Route, RoutesRequest } from '@lifi/types';
import {
  ChainId,
  createConfig,
  getChains,
  getRoutes,
  getStepTransaction,
  getStatus,
  getWalletBalances,
  type WalletTokenExtended,
} from '@lifi/sdk';
import {
  getPrimaryExecutionStep,
  inferBridgeToolForStatus,
  serializeForJson,
} from './lifi-route.helpers';
import { PrismaService } from '../prisma/prisma.service';

/** Ethereum mainnet, Base, and Solana (LI.FI internal chain id — see `ChainId.SOL`). */
const BASELINE_CHAIN_IDS = new Set<number>([
  ChainId.ETH,
  ChainId.BAS,
  ChainId.SOL,
]);

export type TreasuryBalanceRow = {
  chainId: bigint;
  address: string;
  symbol: string;
  decimals: number;
  balance: bigint;
  balanceUSD: Prisma.Decimal;
  priceUSD: Prisma.Decimal;
};

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const integrator =
      this.config.get<string>('LIFI_INTEGRATOR') ?? 'robot-cfo';
    const apiKey = this.config.get<string>('LIFI_API_KEY');
    createConfig({
      integrator,
      apiKey: apiKey || undefined,
      preloadChains: true,
    });
    await getChains();
    this.logger.log(`LI.FI SDK configured (integrator=${integrator})`);
  }

  /**
   * Wallet-centric balances from LI.FI (REST), filtered to Ethereum, Base, and Solana.
   * Amounts stay as integer strings from the API until normalized to `bigint` here.
   */
  async fetchTreasuryBalances(
    walletAddress: string,
  ): Promise<TreasuryBalanceRow[]> {
    const byChain = await getWalletBalances(walletAddress);
    const rows: TreasuryBalanceRow[] = [];

    for (const [chainKey, tokens] of Object.entries(byChain)) {
      const chainNumeric = Number(chainKey);
      if (!BASELINE_CHAIN_IDS.has(chainNumeric)) {
        continue;
      }
      const chainId = BigInt(chainKey);
      for (const token of tokens) {
        rows.push(this.normalizeToken(chainId, token));
      }
    }

    return rows;
  }

  /** Upserts `TokenBalance` rows for one treasury from LI.FI data. */
  async persistBalancesForTreasury(
    treasuryId: string,
    walletAddress: string,
  ): Promise<number> {
    const rows = await this.fetchTreasuryBalances(walletAddress);
    const now = new Date();

    for (const row of rows) {
      await this.prisma.tokenBalance.upsert({
        where: {
          treasuryId_chainId_address: {
            treasuryId,
            chainId: row.chainId,
            address: row.address,
          },
        },
        create: {
          treasuryId,
          chainId: row.chainId,
          address: row.address,
          symbol: row.symbol,
          decimals: row.decimals,
          balance: row.balance,
          balanceUSD: row.balanceUSD,
          priceUSD: row.priceUSD,
          lastUpdated: now,
        },
        update: {
          symbol: row.symbol,
          decimals: row.decimals,
          balance: row.balance,
          balanceUSD: row.balanceUSD,
          priceUSD: row.priceUSD,
          lastUpdated: now,
        },
      });
    }

    return rows.length;
  }

  async syncAllTreasuryBalances(): Promise<void> {
    const treasuries = await this.prisma.treasury.findMany();
    if (!treasuries.length) {
      this.logger.debug('No treasuries registered; skipping balance sync');
      return;
    }

    for (const t of treasuries) {
      try {
        const n = await this.persistBalancesForTreasury(t.id, t.address);
        this.logger.log(
          `Synced ${n} token balance row(s) for treasury ${t.id} (${t.address})`,
        );
      } catch (err) {
        this.logger.warn(
          `Balance sync failed for treasury ${t.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  @Cron('*/15 * * * *')
  async scheduledTreasuryBalanceSync(): Promise<void> {
    await this.syncAllTreasuryBalances();
  }

  private normalizeToken(
    chainId: bigint,
    token: WalletTokenExtended,
  ): TreasuryBalanceRow {
    const balance = BigInt(token.amount);
    const priceUSD = new Prisma.Decimal(token.priceUSD ?? '0');
    const balanceUSD = this.computeUsdBalance(
      token.amount,
      token.decimals,
      token.priceUSD ?? '0',
    );

    return {
      chainId,
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      balance,
      balanceUSD,
      priceUSD,
    };
  }

  private computeUsdBalance(
    rawAmount: string,
    decimals: number,
    priceUSD: string,
  ): Prisma.Decimal {
    const amt = new Prisma.Decimal(rawAmount);
    const divisor = new Prisma.Decimal(10).pow(decimals);
    const human = divisor.isZero() ? new Prisma.Decimal(0) : amt.div(divisor);
    return human.mul(new Prisma.Decimal(priceUSD));
  }

  /**
   * Best LI.FI route for a treasury move (swap + bridge steps returned on `Route.steps`).
   */
  async getExecutionRoute(params: RoutesRequest): Promise<Route> {
    const res = await getRoutes(params);
    const route = res.routes[0];
    if (!route) {
      throw new Error(
        'No executable route returned by LI.FI for the given parameters',
      );
    }
    return route;
  }

  /**
   * Simulation summary derived from LI.FI route estimates (amounts, slippage bounds, gas costs).
   * Uses route + step `estimate` objects — no on-chain `eth_call` simulation here.
   */
  simulateRoute(route: Route) {
    const primary = getPrimaryExecutionStep(route);
    const est = primary.estimate;
    const slip =
      primary.action.slippage ??
      (route.toAmount !== '0' && route.toAmountMin !== '0'
        ? 1 - Number(route.toAmountMin) / Number(route.toAmount)
        : 0);

    let gasUsd = route.gasCostUSD ?? '0';
    if (
      (!route.gasCostUSD || route.gasCostUSD === '0') &&
      est?.gasCosts?.length
    ) {
      const sum = est.gasCosts.reduce(
        (acc, g) => acc + Number(g.amountUSD ?? '0'),
        0,
      );
      gasUsd = String(sum);
    }

    const leafSteps = route.steps.flatMap((s) =>
      s.includedSteps?.length ? s.includedSteps : [],
    );

    const steps = serializeForJson(
      leafSteps.map((st) => ({
        id: st.id,
        type: st.type,
        tool: st.tool,
        fromChainId: st.action.fromChainId,
        toChainId: st.action.toChainId,
        fromToken: st.action.fromToken.symbol,
        toToken: st.action.toToken.symbol,
        estimate: st.estimate
          ? {
              fromAmount: st.estimate.fromAmount,
              toAmount: st.estimate.toAmount,
              toAmountMin: st.estimate.toAmountMin,
              executionDuration: st.estimate.executionDuration,
              gasCosts: st.estimate.gasCosts?.map((g) => ({
                type: g.type,
                amountUSD: g.amountUSD,
                token: g.token.symbol,
              })),
            }
          : undefined,
      })),
    );

    return serializeForJson({
      before: {
        chainId: route.fromChainId,
        tokenAddress: route.fromToken.address,
        symbol: route.fromToken.symbol,
        amountRaw: route.fromAmount,
        amountUsd: route.fromAmountUSD,
      },
      after: {
        chainId: route.toChainId,
        tokenAddress: route.toToken.address,
        symbol: route.toToken.symbol,
        amountExpectedRaw: route.toAmount,
        amountMinRaw: route.toAmountMin,
        amountUsd: route.toAmountUSD,
      },
      slippage: Number.isFinite(slip) ? slip : 0,
      gasFeesUsd: gasUsd,
      routeGasCostUsd: route.gasCostUSD ?? null,
      bridgeTool: inferBridgeToolForStatus(route),
      steps,
    });
  }

  /** Hydrates the first execution step with calldata via LI.FI `getStepTransaction`. */
  async populateFirstStepTransaction(route: Route): Promise<Route> {
    const step = route.steps[0];
    if (!step) {
      throw new Error('Route has no steps');
    }
    const populated = await getStepTransaction(
      step as Parameters<typeof getStepTransaction>[0],
    );
    return {
      ...route,
      steps: [populated],
    };
  }

  async checkRouteBridgeStatus(params: { txHash: string; route: Route }) {
    const bridge = inferBridgeToolForStatus(params.route);
    return getStatus({
      txHash: params.txHash,
      fromChain: params.route.fromChainId,
      toChain: params.route.toChainId,
      bridge,
    });
  }
}
