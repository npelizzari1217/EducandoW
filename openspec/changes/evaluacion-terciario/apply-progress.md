# Apply Progress: evaluacion-terciario

> Updated: 2026-06-18 · Branch: feat/evaluacion-terciario · Single-pass (size:exception)

## Status

**35 / 35 tasks complete**

## Test Status

- Domain tests: **1092 passed** (`pnpm --filter @educandow/domain test`)
- API tests: **1255 passed** (`pnpm --filter api test`)
- TypeScript typecheck: **clean** for new code (pre-existing errors in study-plan/competency/course-cycle unrelated to this change)
- Domain build: **passes** (`pnpm --filter @educandow/domain build`)
- Prisma generate: **passes** (`pnpm --filter api prisma:generate`)

## Tasks Completed

| ID | Description | Files |
|---|---|---|
| T01 ✓ | VO SlotCursadaTerciario — tests | `packages/domain/src/terciario/__tests__/value-objects/slot-cursada-terciario.test.ts` |
| T02 ✓ | VO SlotCursadaTerciario — impl | `packages/domain/src/terciario/value-objects/slot-cursada-terciario.ts` |
| T03 ✓ | VO CondicionCursada — tests | `packages/domain/src/terciario/__tests__/value-objects/condicion-cursada.test.ts` |
| T04 ✓ | VO CondicionCursada — impl | `packages/domain/src/terciario/value-objects/condicion-cursada.ts` |
| T05 ✓ | VO IntentoFinal — tests | `packages/domain/src/terciario/__tests__/value-objects/intento-final.test.ts` |
| T06 ✓ | VO IntentoFinal — impl | `packages/domain/src/terciario/value-objects/intento-final.ts` |
| T07 ✓ | VO EstadoInscripcion — extended tests | `packages/domain/src/terciario/__tests__/value-objects/estado-inscripcion.test.ts` |
| T08 ✓ | VO EstadoInscripcion — PROMOCIONAL + helpers | `packages/domain/src/terciario/value-objects/estado-inscripcion.ts` |
| T09 ✓ | 9 Domain Error subclasses | `packages/domain/src/terciario/errors/*.ts` |
| T10 ✓ | Entity NotaCursadaTerciario — tests | `packages/domain/src/terciario/__tests__/entities/nota-cursada-terciario.test.ts` |
| T11 ✓ | Entity NotaCursadaTerciario — impl | `packages/domain/src/terciario/entities/nota-cursada-terciario.ts` |
| T12 ✓ | Entity ActaExamen — intento tests | `packages/domain/src/terciario/__tests__/entities/acta-examen.test.ts` |
| T13 ✓ | Entity ActaExamen — add intento field | `packages/domain/src/terciario/entities/acta-examen.ts` |
| T14 ✓ | Policy RecuperatorioPolicy — tests | `packages/domain/src/terciario/__tests__/policies/recuperatorio-policy.test.ts` |
| T15 ✓ | Policy RecuperatorioPolicy — impl | `packages/domain/src/terciario/policies/recuperatorio-policy.ts` |
| T16 ✓ | Policy FinalEligibilityPolicy — tests | `packages/domain/src/terciario/__tests__/policies/final-eligibility-policy.test.ts` |
| T17 ✓ | Policy FinalEligibilityPolicy — impl | `packages/domain/src/terciario/policies/final-eligibility-policy.ts` |
| T18 ✓ | Repo interface NotaCursadaTerciarioRepository | `packages/domain/src/terciario/repositories/nota-cursada-terciario-repository.ts` |
| T19 ✓ | Repo interface ActaExamenRepository — extended | `packages/domain/src/terciario/repositories/acta-examen-repository.ts` |
| T20 ✓ | Domain index.ts — new exports | `packages/domain/src/terciario/index.ts`, `packages/domain/src/index.ts` |
| T21 ✓ | Prisma tenant schema — new model + column | `api/prisma_tenant/schema.prisma` |
| T22 ✓ | Prisma migration SQL — written manually | `api/prisma_tenant/migrations/20260618000000_evaluacion_terciario/migration.sql` |
| T23 ✓ | PrismaNotaCursadaTerciarioRepository | `api/src/infrastructure/persistence/prisma/repositories/prisma-nota-cursada-terciario.repository.ts` |
| T24 ✓ | PrismaActaExamenRepository — extended | `api/src/infrastructure/persistence/prisma/repositories/prisma-acta-examen.repository.ts` |
| T25 ✓ | Nota cursada use cases — tests (4 UCs) | `api/src/application/nivel-terciario/__tests__/nota-cursada-terciario.use-cases.test.ts` |
| T26 ✓ | Nota cursada use cases — impl (4 UCs) | `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts` |
| T27 ✓ | RegistrarNotaFinalUC — tests | `api/src/application/nivel-terciario/__tests__/registrar-nota-final.use-cases.test.ts` |
| T28 ✓ | RegistrarNotaFinalUC — impl | `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts` |
| T29 ✓ | RegistrarPromocionalUC — tests [SUPUESTO] | `api/src/application/nivel-terciario/__tests__/registrar-nota-final.use-cases.test.ts` |
| T30 ✓ | RegistrarPromocionalUC — impl [SUPUESTO] | `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts` |
| T31 ✓ | AppExceptionFilter — 9 new error codes | `api/src/presentation/shared/filters/exception.filter.ts` |
| T32 ✓ | Zod DTO schemas — tests | `api/src/presentation/nivel-terciario/__tests__/nota-cursada-terciario.dto.test.ts` |
| T33 ✓ | NotaCursadaTerciarioController + Zod schemas | `api/src/presentation/nivel-terciario/nota-cursada-terciario.controller.ts` |
| T34 ✓ | ActaExamenController — use RegistrarNotaFinalUC | `api/src/presentation/nivel-terciario/acta-examen.controller.ts` |
| T35 ✓ | NivelTerciarioModule — register all providers | `api/src/presentation/nivel-terciario/nivel-terciario.module.ts` |

## Files Changed

### Domain Package
- `packages/domain/src/terciario/value-objects/slot-cursada-terciario.ts` (new)
- `packages/domain/src/terciario/value-objects/condicion-cursada.ts` (new)
- `packages/domain/src/terciario/value-objects/intento-final.ts` (new)
- `packages/domain/src/terciario/value-objects/estado-inscripcion.ts` (modified — PROMOCIONAL + helpers)
- `packages/domain/src/terciario/errors/*.ts` (9 new files)
- `packages/domain/src/terciario/entities/nota-cursada-terciario.ts` (new)
- `packages/domain/src/terciario/entities/acta-examen.ts` (modified — intento field)
- `packages/domain/src/terciario/policies/recuperatorio-policy.ts` (new)
- `packages/domain/src/terciario/policies/final-eligibility-policy.ts` (new)
- `packages/domain/src/terciario/repositories/nota-cursada-terciario-repository.ts` (new)
- `packages/domain/src/terciario/repositories/acta-examen-repository.ts` (modified — countIntentosFinal + intento param)
- `packages/domain/src/terciario/index.ts` (modified — new exports)
- `packages/domain/src/index.ts` (modified — new terciario exports)

### API Package
- `api/prisma_tenant/schema.prisma` (modified — NotaCursadaTerciario model, intento column, InscripcionMateria relation)
- `api/prisma_tenant/migrations/20260618000000_evaluacion_terciario/migration.sql` (new — manual)
- `api/src/infrastructure/persistence/prisma/repositories/prisma-nota-cursada-terciario.repository.ts` (new)
- `api/src/infrastructure/persistence/prisma/repositories/prisma-acta-examen.repository.ts` (modified — intento, countIntentosFinal)
- `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts` (new)
- `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts` (modified — RegistrarNotaFinalUC, RegistrarPromocionalUC)
- `api/src/presentation/shared/filters/exception.filter.ts` (modified — 9 new codes)
- `api/src/presentation/nivel-terciario/nota-cursada-terciario.controller.ts` (new)
- `api/src/presentation/nivel-terciario/acta-examen.controller.ts` (modified — uses RegistrarNotaFinalUC)
- `api/src/presentation/nivel-terciario/nivel-terciario.module.ts` (modified — new providers + controllers)

## Deferred Items

- **T22 (DB Migration)**: Migration SQL written manually at `api/prisma_tenant/migrations/20260618000000_evaluacion_terciario/migration.sql`. Could not be auto-generated via `prisma:migrate:tenant` because no DB is available locally. The SQL was written by hand based on design §6.4 and includes:
  1. `CREATE TABLE nota_cursada_terciario` with all columns, constraints, and indexes
  2. `ALTER TABLE acta_examen_notas ADD COLUMN intento INTEGER NOT NULL DEFAULT 1` (backfills existing rows atomically)
  3. `UPDATE ... SET intento = 1 WHERE intento IS NULL` (idempotent safety net)
  4. Foreign key constraint

  **Action required before deploy**: run `pnpm --filter api prisma:migrate:tenant` in an environment with DB access to apply the migration.

## Notes

- ADR-1 honored: `condicion` payload maps to `InscripcionMateria.estado`; `PROMOCIONAL` added to `EstadoInscripcionValue`
- ADR-2 honored: `intento` derived from count, not stored counter
- ADR-3 honored: guards as pure domain policies
- 3 `[SUPUESTO]` items marked in code: `RegistrarPromocionalUC`, TP bloquea final, PROMOCIONAL in ConfirmarNotaCursada
- Backward compat: existing `RegistrarNotaUC` passes `IntentoFinal.create(1)` as default
- Pre-existing typecheck errors in study-plan, competency, course-cycle tests are NOT from this change
