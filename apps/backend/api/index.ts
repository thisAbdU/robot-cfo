/**
 * Vercel serverless entry: all HTTP routes are rewritten here (see ../vercel.json).
 * Compiled separately by Vercel; loads Nest output from dist after monorepo build.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Express } from 'express';
import serverless from 'serverless-http';

let cachedHandler: ReturnType<typeof serverless> | undefined;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<unknown> {
  if (!cachedHandler) {
    const mod = (await import('../dist/src/bootstrap.js')) as {
      createApplication: () => Promise<NestExpressApplication>;
    };
    const nestApp = await mod.createApplication();
    const expressApp = nestApp.getHttpAdapter().getInstance() as Express;
    cachedHandler = serverless(expressApp);
  }
  return cachedHandler(req, res);
}
