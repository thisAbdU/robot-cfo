import { Controller, Param, Post } from '@nestjs/common';
import { TreasuryAnalysisService } from './treasury-analysis.service';

@Controller('ai')
export class AiController {
  constructor(private readonly treasuryAnalysis: TreasuryAnalysisService) {}

  /**
   * Runs Robot CFO analysis for one treasury: DB balances + active proposals → Gemini → Virtuals shell → AIDecision row.
   */
  @Post('analyze/:treasuryId')
  async analyze(@Param('treasuryId') treasuryId: string) {
    return this.treasuryAnalysis.analyzeTreasury(treasuryId);
  }
}
