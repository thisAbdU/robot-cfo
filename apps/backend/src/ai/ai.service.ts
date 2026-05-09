import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CFO_SYSTEM_PROMPT, CFO_USER_SCHEMA_PROMPT } from './cfo.constants';
import type { TreasuryStrategyPayload } from './ai.types';
import { VIRTUALS_ACTIONS } from './ai.types';

const GEMINI_OPENAI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getOpenAI(): OpenAI {
    if (this.client) {
      return this.client;
    }
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured; AI treasury analysis is disabled.',
      );
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: GEMINI_OPENAI_BASE_URL,
    });
    return this.client;
  }

  /**
   * Calls Gemini via the OpenAI-compatible endpoint with the Robot CFO system prompt.
   */
  async generateTreasuryStrategy(
    balances: unknown[],
    proposals: unknown[],
  ): Promise<TreasuryStrategyPayload> {
    const model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-1.5-flash';

    const userPayload = {
      treasuryBalances: balances,
      activeSnapshotProposals: proposals,
    };

    const userContent = `${CFO_USER_SCHEMA_PROMPT}\n\nContext JSON:\n${JSON.stringify(userPayload)}`;

    try {
      const openai = this.getOpenAI();
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.25,
        messages: [
          { role: 'system', content: CFO_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw?.trim()) {
        throw new BadGatewayException(
          'Gemini returned an empty strategy response.',
        );
      }

      return this.parseStrategyPayload(raw);
    } catch (err) {
      if (err instanceof BadGatewayException) {
        throw err;
      }
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      if (err instanceof OpenAI.APIError) {
        this.logger.warn(
          `Gemini/OpenAI-compatible API error: ${err.message}`,
          err.stack,
        );
        throw new BadGatewayException(
          `Gemini API error: ${err.message ?? 'unknown error'}`,
        );
      }
      this.logger.error(
        err instanceof Error ? err.message : String(err),
        err instanceof Error ? err.stack : undefined,
      );
      throw new BadGatewayException(
        `Failed to generate treasury strategy: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private parseStrategyPayload(raw: string): TreasuryStrategyPayload {
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '');
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped.trim());
    } catch {
      throw new BadGatewayException(
        'Gemini returned non-JSON strategy output; cannot parse.',
      );
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new BadGatewayException('Gemini strategy JSON must be an object.');
    }

    const obj = parsed as Record<string, unknown>;
    const action = obj.action;
    const reasoning = obj.reasoning;
    const data = obj.data;

    if (
      typeof action !== 'string' ||
      !(VIRTUALS_ACTIONS as readonly string[]).includes(action)
    ) {
      throw new BadGatewayException(
        `Invalid or missing strategy action: ${String(action)}`,
      );
    }

    if (typeof reasoning !== 'string' || !reasoning.trim()) {
      throw new BadGatewayException(
        'Strategy response must include a non-empty reasoning string.',
      );
    }

    if (data !== undefined && (typeof data !== 'object' || data === null)) {
      throw new BadGatewayException(
        'Strategy "data" field must be a JSON object when present.',
      );
    }

    return {
      action: action as TreasuryStrategyPayload['action'],
      reasoning: reasoning.trim(),
      data:
        data !== undefined && typeof data === 'object' && data !== null
          ? (data as Record<string, unknown>)
          : {},
    };
  }
}
