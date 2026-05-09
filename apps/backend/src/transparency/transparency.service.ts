import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TransparencyLogEntry =
  | {
      kind: 'decision';
      id: string;
      createdAt: string;
      treasuryId: string;
      treasuryName: string;
      type: string;
      reasoning: string;
      status: string;
      executionStatus: string | null;
      safeTxHash: string | null;
      txHash: string | null;
      data: unknown;
    }
  | {
      kind: 'feed';
      id: string;
      createdAt: string;
      source: string;
      message: string;
      meta: unknown;
    };

@Injectable()
export class TransparencyService {
  constructor(private readonly prisma: PrismaService) {}

  async listLogs(limit = 100): Promise<TransparencyLogEntry[]> {
    const take = Math.min(Math.max(limit, 1), 500);

    const [decisions, lines] = await Promise.all([
      this.prisma.aIDecision.findMany({
        take,
        orderBy: { createdAt: 'desc' },
        include: { treasury: { select: { name: true } } },
      }),
      this.prisma.transparencyFeedLine.findMany({
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const merged: TransparencyLogEntry[] = [];

    for (const d of decisions) {
      merged.push({
        kind: 'decision',
        id: d.id,
        createdAt: d.createdAt.toISOString(),
        treasuryId: d.treasuryId,
        treasuryName: d.treasury.name,
        type: d.type,
        reasoning: d.reasoning,
        status: d.status,
        executionStatus: d.executionStatus,
        safeTxHash: d.safeTxHash,
        txHash: d.txHash,
        data: d.data,
      });
    }

    for (const line of lines) {
      merged.push({
        kind: 'feed',
        id: line.id,
        createdAt: line.createdAt.toISOString(),
        source: line.source,
        message: line.message,
        meta: line.meta,
      });
    }

    merged.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return merged.slice(0, take);
  }

  async appendFeedLine(input: {
    message: string;
    source?: string;
    meta?: Record<string, unknown>;
  }) {
    return this.prisma.transparencyFeedLine.create({
      data: {
        message: input.message,
        source: input.source ?? 'automation',
        meta: input.meta
          ? (JSON.parse(JSON.stringify(input.meta)) as object)
          : undefined,
      },
    });
  }
}
