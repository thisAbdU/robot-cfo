import { Controller, Post } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchain: BlockchainService) {}

  /** Manual trigger for the same job as the 15-minute cron (ops / debugging). */
  @Post('sync-balances')
  async syncBalances(): Promise<{ ok: true }> {
    await this.blockchain.syncAllTreasuryBalances();
    return { ok: true };
  }
}
