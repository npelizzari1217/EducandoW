import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadEnvConfig } from './infrastructure/config/env.config';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const config = loadEnvConfig();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1');

  // ── Swagger / OpenAPI ─────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('EducandoW API')
    .setDescription('API de administración pedagógica para instituciones educativas')
    .setVersion('0.0.1')
    .addBearerAuth()
    .addTag('auth', 'Autenticación y usuarios')
    .addTag('nivel-inicial', 'Pedagogía Inicial')
    .addTag('nivel-primario', 'Pedagogía Primario')
    .addTag('nivel-secundario', 'Pedagogía Secundario')
    .addTag('nivel-terciario', 'Pedagogía Terciario')
    .addTag('institucion', 'Gestión institucional')
    .addTag('health', 'Health check')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // ── CORS ──────────────────────────────────────────────────────────────
  const rawOrigin = config.corsOrigin;
  const corsOrigin =
    rawOrigin === '*'
      ? (origin: string | undefined, cb: (err: Error | null, allow?: boolean | string) => void) =>
          cb(null, origin ?? true)
      : rawOrigin.includes(',')
        ? rawOrigin.split(',').map((s) => s.trim())
        : rawOrigin;
  app.enableCors({ origin: corsOrigin, credentials: true });

  // ── Cookie parser ─────────────────────────────────────────────────────
  app.use(cookieParser());

  await app.listen(config.port);
  logger.log(`🚀 EducandoW API running on http://localhost:${config.port}/v1`);
  logger.log(`📚 Swagger docs at http://localhost:${config.port}/docs`);
}

bootstrap();
