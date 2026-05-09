import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
