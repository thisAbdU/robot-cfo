import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { patchLoggerRedaction } from './common/redacting-logger';

let loggerPatched = false;

function resolveCorsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ];
  }
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : true;
}

/**
 * Shared Nest bootstrap for long-running `main.ts` and Vercel serverless (`api/index.ts`).
 */
export async function createApplication(): Promise<NestExpressApplication> {
  if (!loggerPatched) {
    patchLoggerRedaction();
    loggerPatched = true;
  }

  const expressApp = express();
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressApp),
  );

  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number.parseInt(process.env.AI_RATE_LIMIT_MAX ?? '120', 10),
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/ai', aiLimiter);

  await app.init();
  return app;
}
