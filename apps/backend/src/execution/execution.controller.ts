import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { SafeTransactionData } from '@safe-global/types-kit';
import { AiDecisionExecutionGuard } from '../common/ai-decision-execution.guard';
import { ExecutionService } from './execution.service';
import type { ExecutionRouteParams } from './execution.types';

@UseGuards(AiDecisionExecutionGuard)
@Controller('execution')
export class ExecutionController {
  constructor(private readonly execution: ExecutionService) {}

  @Post('prepare')
  async prepare(
    @Body()
    body: {
      aiDecisionId: string;
      execution?: ExecutionRouteParams;
    },
  ) {
    return this.execution.prepareExecution(body);
  }

  @Post('propose')
  async propose(@Body() body: { aiDecisionId: string }) {
    return this.execution.proposeExecution(body.aiDecisionId);
  }

  /**
   * Queues a Safe tx via Transaction Service using a wallet signature (no server private key).
   */
  @Post('submit-wallet-proposal')
  async submitWalletProposal(
    @Body()
    body: {
      aiDecisionId: string;
      safeTxHash: string;
      safeTransactionData: SafeTransactionData;
      senderAddress: string;
      senderSignature: string;
    },
  ) {
    return this.execution.submitWalletProposal(body);
  }

  /** After the source-chain tx is mined (Safe exec or EOA), register its hash for LI.FI status polling. */
  @Post('register-bridge-tx')
  async registerBridgeTx(
    @Body() body: { aiDecisionId: string; txHash: string },
  ) {
    return this.execution.registerBridgeTx(body.aiDecisionId, body.txHash);
  }
}
