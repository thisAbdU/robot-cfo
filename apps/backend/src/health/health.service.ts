import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getChains } from '@lifi/sdk';
import { PrismaService } from '../prisma/prisma.service';

export type HealthCheckResult = {
  status: 'ok' | 'degraded';
  checks: {
    database: { ok: boolean; error?: string };
    ai: { ok: boolean; configured: boolean };
    blockchain: { ok: boolean; error?: string };
  };
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const database = await this.checkDatabase();
    const ai = this.checkAiConfig();
    const blockchain = await this.checkBlockchain();

    const ok =
      database.ok && ai.ok && blockchain.ok;
    return {
      status: ok ? 'ok' : 'degraded',
      checks: {
        database,
        ai,
        blockchain,
      },
    };
  }

  private async checkDatabase(): Promise<{
    ok: boolean;
    error?: string;
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private checkAiConfig(): { ok: boolean; configured: boolean } {
    const configured = Boolean(this.config.get<string>('GEMINI_API_KEY')?.trim());
    return { ok: configured, configured };
  }

  private async checkBlockchain(): Promise<{
    ok: boolean;
    error?: string;
  }> {
    try {
      const chains = await getChains();
      if (!chains?.length) {
        return { ok: false, error: 'LI.FI chains list empty' };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
