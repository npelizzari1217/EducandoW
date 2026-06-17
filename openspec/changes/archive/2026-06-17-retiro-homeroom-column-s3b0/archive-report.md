# Archive Report: retiro-homeroom-column-s3b0

> Phase: sdd-archive · 2026-06-17
> Branch: feat/drop-homeroom-teacher-id-s3b0
> Commits on branch: 3 (f47bee4, 7b89460, 9e3deb3)

---

## Summary

S3b-0 of the Teacher retirement epic. Surgical drop of the dead `CourseCycle.homeroomTeacherId` column (FK SetNull → teachers, index), plus deletion of 2 obsolete backfill scripts, after S3a migrated homeroom resolution to `AsignacionCursoXCiclo(rol=TITULAR)`.

---

## What Changed

### Database (tenant schema)
- **Dropped**: column `course_cycles.homeroom_teacher_id`
- **Dropped**: FK constraint `course_cycles_homeroom_teacher_id_fkey`
- **Dropped**: index `course_cycles_homeroom_teacher_id_idx`
- Migration: `api/prisma_tenant/migrations/20260617120000_drop_homeroom_teacher_id/migration.sql` (hand-written, IF EXISTS, with self-contained inline rollback DDL)

### Prisma Schema (`api/prisma_tenant/schema.prisma`)
- Removed `homeroomTeacherId` field, `homeroomTeacher` relation, `@@index([homeroomTeacherId])` from `CourseCycle` model
- Removed back-relation `courseCyclesHomeroom CourseCycle[]` from `Teacher` model
- `prisma:generate` passes with exit 0

### Domain Entity (`packages/domain/src/course-cycle/entities/course-cycle.ts`)
- Removed property `homeroomTeacherId` (L26-27)
- Removed getter `homeroomTeacherId` (L148-150)
- Removed method `assignHomeroomTeacher()` (L152-155)

### Repository Mapper (`api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts`)
- Removed `homeroomTeacherId` from `toDomain()` (L251)
- Removed `homeroomTeacherId` from `toPersistence()` (L277)

### 5 Deletions
1. `api/scripts/backfill-asignacion-curso.ts` — obsolete one-shot Fase 4 TITULAR backfill
2. `api/src/application/asignacion-curso/__tests__/backfill-asignacion-curso.test.ts` — test for above
3. `api/scripts/backfill-docente-x-ciclo.ts` — obsolete one-shot Fase 2 DocenteXCiclo backfill
4. `api/src/application/docente-ciclo/__tests__/backfill-docente-x-ciclo.test.ts` — test for above
5. `packages/domain/src/course-cycle/entities/course-cycle.spec.ts` — entire spec was a single homeroom describe

### Test Cleanup
- `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.spec.ts` L40: removed `homeroomTeacherId: null` from factory

---

## Verify Result

**VERDICT: PASS WITH WARNINGS — 0 CRITICAL / 2 WARNINGS / 1 SUGGESTION**

| Check | Result |
|-------|--------|
| prisma:generate | EXIT 0 (master + tenant) |
| pnpm --filter api test | 1204/1204 GREEN |
| pnpm --filter api typecheck | Exit 2 — 11 errors, ALL pre-existing (pedagogy/study-plan/competency/dto) — ZERO new errors |
| pnpm build (turbo) | EXIT 0 — 3/3 packages |
| Dangling sweep (rg homeroomTeacher --type ts) | ZERO matches in src/packages/web |

**WARNING-1** (pre-existing): `tsc --noEmit` exits non-zero with 11 errors in pedagogy/study-plan/competency DTOs. These are a pre-existing baseline unrelated to this change. Scenario 8 acceptance criterion was "zero NEW errors" — met.

**WARNING-2** (FIXED): Initial rollback DDL block in the migration file referenced the creation migration by name rather than including standalone executable DDL. Fixed in commit `9e3deb3`: rollback DDL is now fully self-contained inline (ADD COLUMN, ADD CONSTRAINT, CREATE INDEX) per REQ-DB-5 / Scenario 2.

**SUGGESTION-1**: Ensure PR description includes the deploy runbook with skip-count SQL query and go/no-go gate (REQ-DEPLOY-2). Cannot be verified from code. PR #14 referenced in branch history.

---

## Deploy Precondition (CRITICAL)

Before running `pnpm --filter api migrate-tenants`:

1. Verify skip count = 0 for the Fase 4 TITULAR backfill on EVERY active tenant:
   ```sql
   SELECT COUNT(*) FROM course_cycles WHERE homeroom_teacher_id IS NOT NULL;
   ```
   (Run this BEFORE applying the migration. If > 0, data will be permanently lost after drop.)

2. The backfill recovery script (`backfill-asignacion-curso.ts`) no longer exists in the active codebase. It is recoverable from git history (`7b89460^:api/scripts/backfill-asignacion-curso.ts`).

3. If skip > 0 exists: re-run the recovery script from git history FIRST, re-verify, then apply migration.

---

## Canonical Spec Merges

| Target spec | What was merged |
|-------------|-----------------|
| `openspec/specs/course-cycle/spec.md` | Added S3b-0 removal note under Data Model: `homeroomTeacherId` column, FK, index are absent; homeroom now via `AsignacionCursoXCiclo(TITULAR)`. Archive reference added. |
| `openspec/specs/teacher-identity-authz/spec.md` | Updated TIA-R5: removed "column remains, deferred to S3b" clause; replaced with confirmation that column and FK/index are dropped by migration `20260617120000_drop_homeroom_teacher_id`. |

---

## Umbrella Roadmap Update

`openspec/changes/retiro-teacher-legacy/explore.md` updated:
- S3b-0 marked DONE (2026-06-17) with verify result, commit hash, and list of 5 deletions
- "Siguiente paso" updated: S3b-0 now in DONE list; next slice is S3b-1 (Sala/Grado/Curso exploration)
- Remaining Teacher consumers noted: (a) `/teachers` admin, (b) `Sala/Grado/Curso.teacherId`, (c) `MesaExamen/ActaExamen.presidente`
- Umbrella remains ACTIVE

---

## Engram Artifact IDs

| Artifact | ID |
|----------|----|
| proposal | #1079 |
| spec | #1080 |
| design | #1081 |
| tasks | #1082 |
| verify-report | #1084 |

---

## Remaining Roadmap (Teacher Retirement Epic)

| Slice | Status | Notes |
|-------|--------|-------|
| S3b-1 | PENDING | Sala/Grado/Curso.teacherId → DocenteXCiclo/User; needs own exploration |
| S3b-2 | PENDING | Retire /teachers admin CRUD |
| S3b-3 | PENDING | MesaExamen/ActaExamen.presidenteId → User/DocenteXCiclo + backfill (Restrict FK) |
| S3-pre | PENDING | Migrate Inicial/Terciario grading out of NotaTrimestral (Decision #1 pending) |
| S3b-final | PENDING | Drop Teacher table + domain entity + repo (requires S3b-1 through S3-pre complete) |
