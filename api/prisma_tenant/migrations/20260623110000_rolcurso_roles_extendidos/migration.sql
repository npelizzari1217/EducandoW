-- AddValue migration: extend RolCurso enum in tenant DB
-- SPEC-6: additive only — no DROP TYPE, no data changes, no existing rows touched.
-- Postgres gotcha: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- These 4 statements are intentionally bare (no BEGIN/COMMIT wrapper).
-- Deploy order (ADR-4): apply to ALL tenant DBs BEFORE the frontend with 6 options goes live.
-- Command: pnpm --filter api prisma:migrate:deploy:tenant (run on the server, not locally).

ALTER TYPE "RolCurso" ADD VALUE 'SECRETARIO';
ALTER TYPE "RolCurso" ADD VALUE 'DIRECTOR';
ALTER TYPE "RolCurso" ADD VALUE 'EOE';
ALTER TYPE "RolCurso" ADD VALUE 'DOCENTE_AUXILIAR';
