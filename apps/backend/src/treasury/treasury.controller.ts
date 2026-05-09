import { Controller, Get } from '@nestjs/common';
import { TreasuryService } from './treasury.service';

@Controller('treasuries')
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get()
  async list() {
    return this.treasury.listTreasuries();
  }
}
