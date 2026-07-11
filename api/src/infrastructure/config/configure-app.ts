import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { EnvConfig } from './env.config';

/**
 * Applies bootstrap wiring that does not depend on real I/O (no `listen`,
 * no Swagger document generation) — pulled out of `main.ts` so it can be
 * tested with a double of `app`, per RPI-R6/RPI-S10.
 *
 * `main.ts` calls `bootstrap()` unconditionally at module top level (no
 * guard), so this function MUST live in its own file: importing it FROM
 * `main.ts` in a test would boot the real Nest application as a side
 * effect of the import. Same pattern as `env.config.ts` for testable
 * bootstrap logic kept outside `main.ts`.
 *
 * Order matters (ADR-04, design.md): global prefix → static assets → CORS
 * → cookie parser → shutdown hooks, applied last so it covers everything
 * registered before it. Swagger is intentionally NOT here — it has no
 * relation to shutdown hooks or any RPI-Sx and stays in `bootstrap()`.
 */
export function configureApp(app: NestExpressApplication, config: EnvConfig): void {
  app.setGlobalPrefix('v1');

  // ── Static files (uploaded logos, documents) ──
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

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

  // ── Shutdown hooks (RPI-R6) ──────────────────────────────────────────
  // Lets SIGTERM/SIGINT (and app.close()) drive Nest's onModuleDestroy
  // cycle, so ReportingModule's PdfGeneratorService.onModuleDestroy
  // actually runs in production (RPI-R3 pre-requisite).
  app.enableShutdownHooks();
}
