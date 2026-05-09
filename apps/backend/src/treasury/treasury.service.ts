import { Injectable } from '@nestjs/common';
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
}
