import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GovernanceService } from './governance.service';

@Controller('governance')
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  /** List stored proposals (all spaces). Must be registered before `/:spaceId`. */
  @Get('proposals')
  async listProposals(@Query('limit') limit?: string) {
    const n = limit ? Number.parseInt(limit, 10) : 100;
    return this.governance.getStoredProposals(
      Number.isFinite(n) && n > 0 ? n : 100,
    );
  }

  /** Snapshot sync for one DAO space, then returns persisted proposals for that space. */
  @Get(':spaceId')
  async getGovernanceForSpace(@Param('spaceId') spaceId: string) {
    const synced = await this.governance.syncActiveProposalsForSpace(spaceId);
    const proposals = await this.governance.getStoredProposalsForSpace(spaceId);
    return {
      spaceId,
      syncedCount: synced,
      proposals,
    };
  }

  /**
   * Pull active proposals from Snapshot for configured spaces (or override list).
   */
  @Post('sync-active')
  async syncActive(@Body() body?: { spaceIds?: string[] }): Promise<{
    upserted: number;
  }> {
    const upserted = await this.governance.fetchAndStoreActiveProposals(
      body?.spaceIds,
    );
    return { upserted };
  }
}
