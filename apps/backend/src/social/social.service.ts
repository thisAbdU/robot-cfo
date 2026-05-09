import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwitterApi } from 'twitter-api-v2';
import { AIService } from '../ai/ai.service';
import { VirtualsTreasuryAgentService } from '../ai/virtuals-treasury-agent.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ai: AIService,
    private readonly virtualsAgent: VirtualsTreasuryAgentService,
  ) {}

  /**
   * Deterministic portfolio-wide score from coverage across chains (no custody of keys).
   */
  async computeTreasuryHealthScore(): Promise<{
    score: number;
    chainCount: number;
  }> {
    const [balances, treasuries] = await Promise.all([
      this.prisma.tokenBalance.findMany({ select: { chainId: true } }),
      this.prisma.treasury.findMany({ select: { chainId: true } }),
    ]);
    const chainIds = new Set<number>();
    for (const b of balances) {
      chainIds.add(Number(b.chainId));
    }
    for (const t of treasuries) {
      chainIds.add(t.chainId);
    }
    const n = chainIds.size;
    const chainCount = Math.max(n, 1);
    const score = n === 0 ? 72 : Math.min(100, 52 + n * 12);
    return { score, chainCount };
  }

  async buildDailySummaryText(): Promise<string> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const decisions = await this.prisma.aIDecision.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { treasury: { select: { name: true } } },
    });
    if (!decisions.length) {
      const t = await this.prisma.treasury.count();
      return `No new AI decisions in the last 24h. Treasuries tracked: ${t}.`;
    }
    return decisions
      .map(
        (d) =>
          `[${d.treasury.name}] ${d.type}: ${d.reasoning.slice(0, 280)}${d.reasoning.length > 280 ? '…' : ''}`,
      )
      .join('\n---\n');
  }

  /**
   * Uses Virtuals GAME SDK audit hook + Gemini tweet copy + Twitter API v2 (OAuth 1.0a user context).
   */
  async postDailySummaryToX(): Promise<{ tweetId: string } | { skipped: true; reason: string }> {
    const key = this.config.get<string>('TWITTER_API_KEY')?.trim();
    const secret = this.config.get<string>('TWITTER_API_SECRET')?.trim();
    const accessToken = this.config.get<string>('TWITTER_ACCESS_TOKEN')?.trim();
    const accessSecret = this.config.get<string>('TWITTER_ACCESS_SECRET')?.trim();

    if (!key || !secret || !accessToken || !accessSecret) {
      throw new ServiceUnavailableException(
        'Twitter OAuth credentials not configured (TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET).',
      );
    }

    const dailySummary = await this.buildDailySummaryText();
    const { score, chainCount } = await this.computeTreasuryHealthScore();

    const tweet = await this.ai.generateRobotCfoTweet({
      dailySummary,
      treasuryHealthScore: score,
      chainCount,
    });

    await this.virtualsAgent.dispatchSocialDigest(tweet);

    const client = new TwitterApi({
      appKey: key,
      appSecret: secret,
      accessToken,
      accessSecret,
    });

    const posted = await client.v2.tweet(tweet);
    const tweetId = posted.data?.id;
    if (!tweetId) {
      this.logger.warn('Twitter API returned no tweet id in response.');
      return { skipped: true, reason: 'no_tweet_id' };
    }
    this.logger.log(`Posted daily Robot CFO digest to X: ${tweetId}`);

    return { tweetId };
  }
}
