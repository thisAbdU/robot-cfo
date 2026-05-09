import { Module } from '@nestjs/common';
import { AiDecisionExecutionGuard } from '../common/ai-decision-execution.guard';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SafeModule } from '../safe/safe.module';
import { ExecutionMonitorService } from './execution-monitor.service';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';

@Module({
  imports: [PrismaModule, BlockchainModule, SafeModule],
  controllers: [ExecutionController],
  providers: [ExecutionService, ExecutionMonitorService, AiDecisionExecutionGuard],
  exports: [ExecutionService],
})
export class ExecutionModule {}
