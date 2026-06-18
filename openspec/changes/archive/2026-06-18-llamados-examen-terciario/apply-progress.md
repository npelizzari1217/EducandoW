# Apply Progress — llamados-examen-terciario

> Date: 2026-06-18 · Branch: feat/llamados-examen-terciario · Batch: 1/1 (all tasks)
> Status: DONE — 16/16 tasks + 4 verify gates

## Tasks Completed

- [x] T01 — RangoFechas VO failing tests (RED)
- [x] T02 — Domain errors: InvalidLlamadoRangeError + LlamadoOverlapError
- [x] T03 — RangoFechas VO (GREEN)
- [x] T04 — LlamadoExamen entity failing tests (RED)
- [x] T05 — LlamadoExamen entity (GREEN)
- [x] T06 — Repository port LlamadoExamenRepository
- [x] T07 — Update terciario domain barrel
- [x] [VERIFY A] — Domain green gate: 99 files, 1107 tests (all pass, 15 new)
- [x] T08 — Add LlamadoExamen model to tenant Prisma schema
- [x] T09 — Prisma migration file created (DB not available in non-interactive env)
- [x] T10 — PrismaLlamadoExamenRepository
- [x] T11 — All 4 use case failing tests (RED)
- [x] T12 — 4 use cases (GREEN)
- [x] [VERIFY B] — Application green gate: 133 files, 1301 tests (all pass, 18 new)
- [x] T13 — Zod DTO schemas
- [x] T14 — Register error codes in exception filter
- [x] T15 — LlamadoExamenController
- [x] T16 — DI wiring in nivel-terciario.module.ts
- [x] [VERIFY C] — Full suite: 133 api + 99 domain tests, all pass
- [x] [VERIFY D] — Typecheck: no NEW errors (pre-existing study-plan/competency/course-cycle errors unchanged)

## Test Counts

- domain: 99 test files, 1107 tests (incl. 15 new: 8 rango-fechas + 7 llamado-examen)
- api: 133 test files, 1301 tests (incl. 18 new use case tests)
- Boundary test (T18 — adjacent dates NOT overlapping): PASS

## Files Changed

### Created
- `packages/domain/src/terciario/__tests__/value-objects/rango-fechas.test.ts`
- `packages/domain/src/terciario/__tests__/entities/llamado-examen.test.ts`
- `packages/domain/src/terciario/value-objects/rango-fechas.ts`
- `packages/domain/src/terciario/entities/llamado-examen.ts`
- `packages/domain/src/terciario/errors/invalid-llamado-range.error.ts`
- `packages/domain/src/terciario/errors/llamado-overlap.error.ts`
- `packages/domain/src/terciario/repositories/llamado-examen-repository.ts`
- `api/src/application/nivel-terciario/__tests__/llamado-examen.use-cases.test.ts`
- `api/src/application/nivel-terciario/use-cases/llamado-examen.use-cases.ts`
- `api/src/infrastructure/persistence/prisma/repositories/prisma-llamado-examen.repository.ts`
- `api/src/presentation/nivel-terciario/dto/llamado-examen.dto.ts`
- `api/src/presentation/nivel-terciario/llamado-examen.controller.ts`
- `api/prisma_tenant/migrations/20260618100000_llamados_examen/migration.sql`

### Modified
- `packages/domain/src/terciario/index.ts` — added new exports
- `packages/domain/src/index.ts` — added new terciario exports
- `api/prisma_tenant/schema.prisma` — added LlamadoExamen model
- `api/src/presentation/nivel-terciario/nivel-terciario.module.ts` — DI wiring
- `api/src/presentation/shared/filters/exception.filter.ts` — 2 new error codes

## Git

Branch: `feat/llamados-examen-terciario`
Commit: 204be1d — feat(llamados): add LlamadoExamen entity, use cases, controller and Prisma schema

## Deferred

- **DB migration apply**: `prisma migrate dev` is blocked in non-interactive CI environment.
  Migration SQL file is written at `api/prisma_tenant/migrations/20260618100000_llamados_examen/migration.sql`.
  Run `pnpm --filter api prisma:migrate:tenant` interactively in dev to apply.

## Non-obvious Discoveries

1. `overlaps()` boundary logic: `this.fin.getTime() >= other.inicio.getTime()` (strict >=). For adjacent
   day-granularity dates (`07-15` vs `07-16` midnight UTC), `07-15T00:00:00Z < 07-16T00:00:00Z` so
   `07-15 >= 07-16` is FALSE → correctly NOT overlapping.

2. `ListLlamadosExamenUC.execute` returns `Result<LlamadoExamen[], never>` — the `never` error type
   means the repo call can never fail from the use case perspective (it returns ok() always).

3. DeleteLlamadoExamenUC deviates from DeleteCarreraUC (which throws) — it returns Result<void, NotFoundError>
   as per spec and ADR-2. The controller awaits and throws `result.unwrapErr()` so the filter handles it.

4. `LLAMADO_EXAMEN_REPOSITORY` token is a string constant `'LlamadoExamenRepository'` exported from
   the domain — imported in the module to keep the token consistent across layers.
