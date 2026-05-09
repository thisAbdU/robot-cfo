import { Controller, Get, Param } from '@nestjs/common';
import { TreasuryService } from './treasury.service';

@Controller('treasuries')
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get()
  async list() {
    return this.treasury.listTreasuries();
  }

  /** Must stay after `GET /` — lists AI + execution metadata for a treasury. */
  @Get(':treasuryId/ai-decisions')
  async listAiDecisions(@Param('treasuryId') treasuryId: string) {
    return this.treasury.listAiDecisionsForTreasury(treasuryId);
  }
}
