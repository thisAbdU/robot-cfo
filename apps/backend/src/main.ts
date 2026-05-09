import { createApplication } from './bootstrap';

async function bootstrap() {
  const app = await createApplication();
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
}
void bootstrap();
