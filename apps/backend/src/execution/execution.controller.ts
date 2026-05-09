import { Body, Controller, Post } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import type { ExecutionRouteParams } from './execution.types';

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

  /** After the source-chain tx is mined (Safe exec or EOA), register its hash for LI.FI status polling. */
  @Post('register-bridge-tx')
  async registerBridgeTx(
    @Body() body: { aiDecisionId: string; txHash: string },
  ) {
    return this.execution.registerBridgeTx(body.aiDecisionId, body.txHash);
  }
}
