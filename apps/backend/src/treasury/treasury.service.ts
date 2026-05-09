import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TreasuryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lists treasuries for UI selection (Robot CFO brain / dashboards). */
  async listTreasuries() {
    return this.prisma.treasury.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        address: true,
        chainId: true,
        orgId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { balances: true, aiDecisions: true },
        },
      },
    });
  }

  /** Recent AI decisions for a treasury (execution UI, audit). */
  async listAiDecisionsForTreasury(treasuryId: string) {
    const t = await this.prisma.treasury.findUnique({
      where: { id: treasuryId },
      select: { id: true },
    });
    if (!t) {
      throw new NotFoundException(`Treasury not found: ${treasuryId}`);
    }

    return this.prisma.aIDecision.findMany({
      where: { treasuryId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        treasuryId: true,
        type: true,
        reasoning: true,
        status: true,
        executionStatus: true,
        lifiRouteId: true,
        safeTxHash: true,
        txHash: true,
        createdAt: true,
      },
    });
  }
}
