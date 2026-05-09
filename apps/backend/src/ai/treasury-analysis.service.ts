import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { AIDecision, TokenBalance } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from './ai.service';
import { mapVirtualsActionToDecisionType } from './ai.types';
import { VirtualsTreasuryAgentService } from './virtuals-treasury-agent.service';

function serializeBalance(row: TokenBalance) {
  return {
    chainId: row.chainId.toString(),
    address: row.address,
    symbol: row.symbol,
    decimals: row.decimals,
    balance: row.balance.toString(),
    balanceUSD: row.balanceUSD.toString(),
    priceUSD: row.priceUSD.toString(),
    lastUpdated: row.lastUpdated.toISOString(),
  };
}

function serializeProposal(p: {
  id: string;
  snapshotId: string;
  title: string;
  body: string;
  status: string;
  space: string;
  author: string;
  choices: unknown;
  scores: unknown;
  start: Date;
  end: Date;
  votes: unknown;
  aiSummary: string | null;
}) {
  return {
    id: p.id,
    snapshotId: p.snapshotId,
    title: p.title,
    body: p.body,
    status: p.status,
    space: p.space,
    author: p.author,
    choices: p.choices,
    scores: p.scores,
    start: p.start.toISOString(),
    end: p.end.toISOString(),
    votes: p.votes,
    aiSummary: p.aiSummary,
  };
}

export type AnalyzeTreasuryResult = {
  agentState: ReturnType<VirtualsTreasuryAgentService['buildAgentState']>;
  strategy: {
    action: string;
    reasoning: string;
    data: Record<string, unknown>;
  };
  virtualsFeedback: string;
  decision: AIDecision;
};

@Injectable()
export class TreasuryAnalysisService {
  private readonly logger = new Logger(TreasuryAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIService,
    private readonly virtualsAgent: VirtualsTreasuryAgentService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Loads DB balances and active proposals, runs Gemini + Virtuals shell, persists {@link AIDecision}.
   */
  async analyzeTreasury(treasuryId: string): Promise<AnalyzeTreasuryResult> {
    if (!this.config.get<string>('GEMINI_API_KEY')) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured; cannot run treasury analysis.',
      );
    }

    const treasury = await this.prisma.treasury.findUnique({
      where: { id: treasuryId },
      include: { balances: true },
    });

    if (!treasury) {
      throw new NotFoundException(`Treasury not found: ${treasuryId}`);
    }

    const proposals = await this.prisma.governanceProposal.findMany({
      where: { status: 'active' },
      orderBy: { end: 'asc' },
    });

    const balancesJson = treasury.balances.map(serializeBalance);
    const proposalsJson = proposals.map(serializeProposal);

    const strategy = await this.ai.generateTreasuryStrategy(
      balancesJson,
      proposalsJson,
    );

    const virtualsFeedback =
      await this.virtualsAgent.dispatchStrategyAction(strategy);

    const decisionType = mapVirtualsActionToDecisionType(strategy.action);

    const decision = await this.prisma.aIDecision.create({
      data: {
        treasuryId: treasury.id,
        type: decisionType,
        reasoning: strategy.reasoning,
        data: {
          action: strategy.action,
          ...strategy.data,
          virtualsFeedback,
        },
        status: 'PENDING',
      },
    });

    return {
      agentState: this.virtualsAgent.buildAgentState(
        balancesJson,
        proposalsJson,
      ),
      strategy: {
        action: strategy.action,
        reasoning: strategy.reasoning,
        data: strategy.data,
      },
      virtualsFeedback,
      decision,
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledTreasuryBrain(): Promise<void> {
    if (!this.config.get<string>('GEMINI_API_KEY')) {
      this.logger.debug(
        'Skipping hourly treasury AI run (GEMINI_API_KEY not set).',
      );
      return;
    }

    const treasuries = await this.prisma.treasury.findMany({
      select: { id: true, name: true },
    });

    for (const t of treasuries) {
      try {
        await this.analyzeTreasury(t.id);
        this.logger.log(
          `Hourly AI analysis completed for treasury "${t.name}" (${t.id})`,
        );
      } catch (err) {
        this.logger.error(
          `Hourly AI analysis failed for treasury ${t.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }
  }
}
