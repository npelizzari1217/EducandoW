# Apply Progress: tenant-migration-drift-baseline

> Batch: 1 (only batch) · Date: 2026-06-22 · Status: done

## Tasks

- [x] T1 — Add 7 FK `map:` annotations to `@relation` directives
- [x] T2 — Add 13 index/unique `map:` annotations to `@@index`/`@@unique`
- [x] T3 — Add 18 `@db.Timestamptz(6)` type annotations (8 models; +deletedAt on docentes_x_ciclo & planificaciones_curso)
- [x] T4 [GATE] — Migrate diff = exactly 11 DDL statements (no RENAME/SET DATA TYPE). PASSED.
- [ ] T5 (opt) — TDD `.db.test.ts` for CV-R9 — DEFERRED: integration harness requires disproportionate setup (Student, SubjectCompetency, CourseCycle fixtures). Correctness proven via T4/T7 gates.
- [x] T6 — Created `api/prisma_tenant/migrations/20260623000000_reconcile_tenant_drift_baseline/migration.sql` with exactly 11 DDL statements.
- [x] T7 [GATE] — Deployed migration to `educandow_tenant_dev` sandbox; `prisma migrate diff --script` output: `-- This is an empty migration.` PASSED.
- [ ] T8 (opt) — DEFERRED (depends on T5)
- [x] T9 — `pnpm --filter api prisma:generate` — exit 0, both master and tenant clients regenerated.
- [x] T10 — `pnpm --filter api typecheck` — exit 0, no type errors.
- [x] T11 — `pnpm --filter api test` — 160 test files, 1539 tests, all passed.

## Gate outputs

### T4 gate (pre-migration diff — exactly 11 statements)

```sql
-- DropIndex
DROP INDEX "competency_valuations_studentId_competencyId_key";

-- AlterTable
ALTER TABLE "alumnos_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "alumnos_x_grupo_x_curso_x_materia_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "alumnos_x_materia_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "asignaciones_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "asistencia_x_alumno_x_curso_x_ciclo" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "asistencia_x_materia_x_alumno_x_curso_x_ciclo" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "docentes_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "grupos_x_curso_x_materia_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "materias_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "planificaciones_curso" ALTER COLUMN "updated_at" DROP DEFAULT;
```

### T7 gate (post-migration diff — empty)

```
-- This is an empty migration.
```

## Files changed

- `api/prisma_tenant/schema.prisma` — 38 annotation edits (7 FK map:, 13 index/unique map:, 18 @db.Timestamptz(6))
- `api/prisma_tenant/migrations/20260623000000_reconcile_tenant_drift_baseline/migration.sql` — new file, 11 DDL statements

## Deferred tasks note

T5/T8 (integration `.db.test.ts` for CV-R9 competency uniqueness) were not implemented. The correctness of the DROP INDEX is proven by:
1. T4 gate: the 2-col stranded index `competency_valuations_studentId_competencyId_key` appeared in the pre-migration diff, confirming it exists in the DB.
2. T7 gate: after applying the migration, the diff is empty, confirming the DROP INDEX executed successfully.
3. The 3-col unique `competency_valuations_studentId_competencyId_course_cycle_id_ke` is annotated in the schema and verified clean.

If a regression test is desired, it should be added in a separate follow-up (requires spinning up a full integration test DB with seeded fixtures for Student, SubjectCompetency, and CourseCycle).
