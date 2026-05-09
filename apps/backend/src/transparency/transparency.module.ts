import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TransparencyController } from './transparency.controller';
import { TransparencyService } from './transparency.service';

@Module({
  imports: [PrismaModule],
  controllers: [TransparencyController],
  providers: [TransparencyService],
  exports: [TransparencyService],
})
export class TransparencyModule {}
