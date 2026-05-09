import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransparencyService } from './transparency.service';

@Controller('transparency')
export class TransparencyController {
  constructor(
    private readonly transparency: TransparencyService,
    private readonly config: ConfigService,
  ) {}

  /** Public chronological feed: AI decisions + optional automation lines. */
  @Get('logs')
  async logs(@Query('limit') limit?: string) {
    const n = limit ? Number.parseInt(limit, 10) : 100;
    return this.transparency.listLogs(Number.isFinite(n) ? n : 100);
  }

  /**
   * Append a transparency line (n8n / operators). Requires {@link TRANSPARENCY_INGEST_SECRET}.
   */
  @Post('feed')
  async ingestFeed(
    @Headers('x-transparency-key') key: string | undefined,
    @Body()
    body: {
      message: string;
      source?: string;
      meta?: Record<string, unknown>;
    },
  ) {
    const secret = this.config.get<string>('TRANSPARENCY_INGEST_SECRET');
    if (!secret?.trim()) {
      throw new ServiceUnavailableException(
        'Transparency ingest is disabled (TRANSPARENCY_INGEST_SECRET not set).',
      );
    }
    if (!key || key !== secret) {
      throw new ForbiddenException('Invalid transparency ingest key.');
    }
    if (!body?.message?.trim()) {
      throw new BadRequestException('body.message is required.');
    }
    const row = await this.transparency.appendFeedLine({
      message: body.message.trim(),
      source: body.source,
      meta: body.meta,
    });
    return { ok: true as const, id: row.id, createdAt: row.createdAt };
  }
}
