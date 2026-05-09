import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiController } from './ai.controller';
import { AIService } from './ai.service';
import { TreasuryAnalysisService } from './treasury-analysis.service';
import { VirtualsTreasuryAgentService } from './virtuals-treasury-agent.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [AIService, VirtualsTreasuryAgentService, TreasuryAnalysisService],
  exports: [AIService, TreasuryAnalysisService, VirtualsTreasuryAgentService],
})
export class AiModule {}
