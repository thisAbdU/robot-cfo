import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Route } from '@lifi/types';
import type { StatusResponse } from '@lifi/types';
import { BlockchainService } from '../blockchain/blockchain.service';
import { serializeForJson } from '../blockchain/lifi-route.helpers';
import { PrismaService } from '../prisma/prisma.service';

function isCompleted(status: StatusResponse): boolean {
  if (status.status !== 'DONE') {
    return false;
  }
  if (!('substatus' in status) || status.substatus === undefined) {
    return true;
  }
  return status.substatus === 'COMPLETED' || status.substatus === 'PARTIAL';
}

function isFailed(status: StatusResponse): boolean {
  return status.status === 'FAILED';
}

@Injectable()
export class ExecutionMonitorService {
  private readonly logger = new Logger(ExecutionMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollLiFiBridgeCompletion(): Promise<void> {
    const rows = await this.prisma.aIDecision.findMany({
      where: {
        lifiRouteId: { not: null },
        txHash: { not: null },
        executionStatus: 'BRIDGING',
      },
      take: 25,
    });

    for (const row of rows) {
      try {
        await this.processRow(row.id, row.data, row.txHash!);
      } catch (err) {
        this.logger.warn(
          `Execution poll failed for ${row.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  private async processRow(
    id: string,
    data: unknown,
    txHash: string,
  ): Promise<void> {
    const pending =
      data &&
      typeof data === 'object' &&
      'pendingRoute' in data &&
      (data as Record<string, unknown>).pendingRoute;
    if (!pending || typeof pending !== 'object') {
      return;
    }

    const route = pending as Route;
    const status = await this.blockchain.checkRouteBridgeStatus({
      txHash,
      route,
    });

    if (isCompleted(status)) {
      const merged = mergeDataJson(data, {
        lifiFinalStatus: serializeForJson(status),
        bridgedAt: new Date().toISOString(),
      });
      await this.prisma.aIDecision.update({
        where: { id },
        data: {
          executionStatus: 'COMPLETED',
          data: merged,
        },
      });
      this.logger.log(`Marked execution COMPLETED for decision ${id}`);
      return;
    }

    if (isFailed(status)) {
      const merged = mergeDataJson(data, {
        lifiFinalStatus: serializeForJson(status),
        failedAt: new Date().toISOString(),
      });
      await this.prisma.aIDecision.update({
        where: { id },
        data: {
          executionStatus: 'FAILED',
          data: merged,
        },
      });
      this.logger.warn(`Marked execution FAILED for decision ${id}`);
    }
  }
}

function mergeDataJson(
  existing: unknown,
  patch: Record<string, unknown>,
): object {
  const base =
    existing && typeof existing === 'object' && existing !== null
      ? { ...existing }
      : {};
  return { ...base, ...patch };
}
