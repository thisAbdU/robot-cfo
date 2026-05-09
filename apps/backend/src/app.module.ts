import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { GovernanceModule } from './governance/governance.module';
import { PrismaModule } from './prisma/prisma.module';
import { TreasuryModule } from './treasury/treasury.module';

const backendEnvFiles = [join(__dirname, '..', '.env'), '.env'];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: backendEnvFiles,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AiModule,
    BlockchainModule,
    GovernanceModule,
    TreasuryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
