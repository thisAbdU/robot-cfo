import {
  Controller,
  ForbiddenException,
  Headers,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialService } from './social.service';

@Controller('social')
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Triggers daily X post (cron / n8n). Requires {@link SOCIAL_POST_SECRET} and header `X-Robot-CFO-Secret`.
   */
  @Post('daily-post')
  async dailyPost(
    @Headers('x-robot-cfo-secret') headerSecret: string | undefined,
  ) {
    const expected = this.config.get<string>('SOCIAL_POST_SECRET')?.trim();
    if (!expected) {
      throw new ServiceUnavailableException(
        'SOCIAL_POST_SECRET is not configured; daily social post endpoint is disabled.',
      );
    }
    if (!headerSecret || headerSecret !== expected) {
      throw new ForbiddenException('Invalid or missing X-Robot-CFO-Secret.');
    }

    if (!this.config.get<string>('GEMINI_API_KEY')?.trim()) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY not configured; cannot compose tweet text.',
      );
    }

    return this.social.postDailySummaryToX();
  }
}
