import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Route, RoutesRequest } from '@lifi/types';
import { BlockchainService } from '../blockchain/blockchain.service';
import { serializeForJson } from '../blockchain/lifi-route.helpers';
import { PrismaService } from '../prisma/prisma.service';
import { SafeService } from '../safe/safe.service';
import type { ExecutionRouteParams } from './execution.types';

function readExecutionPayload(data: unknown): ExecutionRouteParams | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const ex = (data as Record<string, unknown>).execution;
  if (!ex || typeof ex !== 'object') {
    return null;
  }
  const o = ex as Record<string, unknown>;
  if (
    typeof o.fromChainId !== 'number' ||
    typeof o.toChainId !== 'number' ||
    typeof o.fromTokenAddress !== 'string' ||
    typeof o.toTokenAddress !== 'string' ||
    typeof o.fromAmount !== 'string'
  ) {
    return null;
  }
  return {
    fromChainId: o.fromChainId,
    toChainId: o.toChainId,
    fromTokenAddress: o.fromTokenAddress,
    toTokenAddress: o.toTokenAddress,
    fromAmount: o.fromAmount,
    slippage: typeof o.slippage === 'number' ? o.slippage : undefined,
  };
}

@Injectable()
export class ExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly safe: SafeService,
  ) {}

  async prepareExecution(input: {
    aiDecisionId: string;
    execution?: ExecutionRouteParams;
  }) {
    const decision = await this.prisma.aIDecision.findUnique({
      where: { id: input.aiDecisionId },
      include: { treasury: true },
    });
    if (!decision) {
      throw new NotFoundException(
        `AIDecision not found: ${input.aiDecisionId}`,
      );
    }

    const params = input.execution ?? readExecutionPayload(decision.data);
    if (!params) {
      throw new BadRequestException(
        'Provide execution params in the body or store them under decision.data.execution',
      );
    }

    const routesRequest: RoutesRequest = {
      fromChainId: params.fromChainId,
      toChainId: params.toChainId,
      fromTokenAddress: params.fromTokenAddress,
      toTokenAddress: params.toTokenAddress,
      fromAmount: params.fromAmount,
      fromAddress: decision.treasury.address,
      toAddress: decision.treasury.address,
      options: {
        slippage: params.slippage ?? 0.03,
        order: 'CHEAPEST',
      },
    };

    const route = await this.blockchain.getExecutionRoute(routesRequest);
    const simulation = this.blockchain.simulateRoute(route);
    const routeJson = serializeForJson(route);

    const mergedData = {
      ...(typeof decision.data === 'object' && decision.data !== null
        ? (decision.data as object)
        : {}),
      execution: params,
      pendingRoute: routeJson,
      bridgeTool: simulation.bridgeTool,
    };

    await this.prisma.aIDecision.update({
      where: { id: decision.id },
      data: {
        lifiRouteId: route.id,
        executionStatus: 'PENDING',
        data: JSON.parse(JSON.stringify(mergedData)) as Prisma.InputJsonValue,
      },
    });

    return serializeForJson({
      aiDecisionId: decision.id,
      routeId: route.id,
      simulation,
      route: routeJson,
    });
  }

  async proposeExecution(aiDecisionId: string) {
    const decision = await this.prisma.aIDecision.findUnique({
      where: { id: aiDecisionId },
      include: { treasury: true },
    });
    if (!decision) {
      throw new NotFoundException(`AIDecision not found: ${aiDecisionId}`);
    }

    const data = decision.data;
    if (!data || typeof data !== 'object') {
      throw new BadRequestException('Decision has no prepared route data');
    }
    const pending = (data as Record<string, unknown>).pendingRoute;
    if (!pending || typeof pending !== 'object') {
      throw new BadRequestException(
        'Run POST /execution/prepare before proposing',
      );
    }

    const route = pending as Route;
    const populated = await this.blockchain.populateFirstStepTransaction(route);

    const { safeTxHash } = await this.safe.proposeSafeTransaction(
      decision.treasury.address,
      populated,
    );

    const merged = {
      ...(data as object),
      pendingRoutePopulated: serializeForJson(populated),
      proposedAt: new Date().toISOString(),
    };

    await this.prisma.aIDecision.update({
      where: { id: decision.id },
      data: {
        safeTxHash,
        executionStatus: 'SIGNING',
        data: JSON.parse(JSON.stringify(merged)) as Prisma.InputJsonValue,
      },
    });

    return serializeForJson({
      aiDecisionId: decision.id,
      safeTxHash,
      executionStatus: 'SIGNING',
    });
  }

  /** Call after the Safe / EOA submits the source-chain tx so bridge tracking can run. */
  async registerBridgeTx(aiDecisionId: string, txHash: string) {
    const decision = await this.prisma.aIDecision.findUnique({
      where: { id: aiDecisionId },
    });
    if (!decision) {
      throw new NotFoundException(`AIDecision not found: ${aiDecisionId}`);
    }
    await this.prisma.aIDecision.update({
      where: { id: aiDecisionId },
      data: {
        txHash,
        executionStatus: 'BRIDGING',
      },
    });
    return { ok: true as const, aiDecisionId, txHash };
  }
}
