import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnvConfig } from './infrastructure/config/env.config';

async function bootstrap() {
  const config = loadEnvConfig();

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1');

  const rawOrigin = config.corsOrigin;
  const corsOrigin =
    rawOrigin === '*'
      ? (origin: string | undefined, cb: (err: Error | null, allow?: boolean | string) => void) =>
          cb(null, origin ?? true)
      : rawOrigin.includes(',')
        ? rawOrigin.split(',').map((s) => s.trim())
        : rawOrigin;
  app.enableCors({ origin: corsOrigin, credentials: true });

  const cookieParser = require('cookie-parser');
  app.use(cookieParser());

  await app.listen(config.port);
  console.log(`🚀 EducandoW API running on http://localhost:${config.port}/v1`);
}

bootstrap();
