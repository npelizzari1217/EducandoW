# Tasks: retiro-homeroom-column-s3b0

> Phase: sdd-tasks · Store: hybrid · 2026-06-17
> Delivery: auto-chain (single PR) · Strict TDD adapted (removal + migration, no new behavior)

---

## Summary

14 tasks across 5 sequential dependency groups. Batch A (T1–T4) is fully parallel. T5 is a mandatory gate (prisma:generate). Batch B (T6–T9) is parallel. T10 is a sweep gate. Batch C (T11–T12) is parallel. T13 gates on C. T14 is an informational artifact (PR deploy note).

Acceptance = removals complete + sweep clean + test green (excluding ~6 known Pool-mock failures) + typecheck 0 new errors vs 11-error baseline + build passes + migration SQL present and well-formed.

---

## Dependency Groups

```
[A: T1 T2 T3 T4] → [T5: prisma:generate] → [B: T6 T7 T8 T9] → [T10: sweep] → [C: T11 T12] → [T13: build] → [T14: PR note]
```

---

## Batch A — Code removals + migration creation (parallel)

### T1 — Remove both relation sides from schema.prisma

**Spec refs:** REQ-SCHEMA-1, REQ-SCHEMA-2
**Design refs:** AD-1; "Schema — 4 sitios, AMBOS lados"
**File:** `api/prisma_tenant/schema.prisma`

Remove exactly these 5 lines (verified line numbers in design):

| Line | Content | Action |
|-----:|---------|--------|
| 113 | `courseCyclesHomeroom CourseCycle[]` (back-relation in `Teacher`) | delete |
| 350 | `/// @deprecated — migrado a AsignacionCursoXCiclo…` (comment on homeroomTeacherId) | delete |
| 351 | `homeroomTeacherId String? @map("homeroom_teacher_id")` | delete |
| 358 | `homeroomTeacher Teacher? @relation(fields: [homeroomTeacherId], references: [id], onDelete: SetNull)` | delete |
| 373 | `@@index([homeroomTeacherId])` | delete |

Constraint: do NOT touch the `generator erd` block (lines 6–9).
Constraint: both sides must be removed together — an orphaned back-relation causes `prisma generate` to fail.

---

### T2 — Remove homeroomTeacherId from domain entity

**Spec refs:** REQ-ENTITY-1, REQ-ENTITY-2, REQ-ENTITY-3
**Design refs:** "Entidad — 3 sitios"
**File:** `packages/domain/src/course-cycle/entities/course-cycle.ts`

Remove exactly these ranges (verified in design):

| Lines | Content | Action |
|------:|---------|--------|
| 26–27 | `/** FK → Teacher.id … */` comment + `homeroomTeacherId?: string;` in `CourseCycleProps` | delete |
| 148–150 | getter `get homeroomTeacherId(): string \| undefined { … }` | delete |
| 152–155 | comment + method `assignHomeroomTeacher(teacherId: string): void { … }` | delete |

Constraint: `create()` and `reconstruct()` do NOT set this field explicitly (optional prop) — no changes needed there.
Constraint: all other public properties and methods must remain intact (REQ-ENTITY-4).

---

### T3 — Remove homeroom passthrough from mapper

**Spec refs:** REQ-MAPPER-1, REQ-MAPPER-2
**Design refs:** "Mapper — 2 sitios"
**File:** `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts`

Remove exactly:

| Line | Content | Action |
|-----:|---------|--------|
| 251 | `homeroomTeacherId: record.homeroomTeacherId ?? undefined,` (in `toDomain`) | delete |
| 277 | `homeroomTeacherId: courseCycle.homeroomTeacherId ?? null,` (in `toPersistence`) | delete |

Note: after T5 (prisma:generate), `CourseCycleRow` will no longer expose `homeroomTeacherId` — these lines would become type errors if left in. T3 preemptively removes them before the type regeneration.

---

### T4 — Create hand-written migration SQL file

**Spec refs:** REQ-DB-1, REQ-DB-2, REQ-DB-3, REQ-DB-4, REQ-DB-5, REQ-DB-6
**Design refs:** AD-2; "Migración — contenido y convención"

Create new directory and file:
`api/prisma_tenant/migrations/20260617120000_drop_homeroom_teacher_id/migration.sql`

Content (exact, per design — constraint/index names verified against `20260609140000_grading_primario_add_teacher_user_and_homeroom`):

```sql
-- Migration: drop_homeroom_teacher_id
-- S3b-0 (retiro de Teacher): CourseCycle.homeroomTeacherId quedó sin lectores
-- funcionales tras S3a (nav homeroom migrada a AsignacionCursoXCiclo rol=TITULAR, Fase 4).
-- Drop del FK → teachers.id (SetNull), su índice, y la columna.
-- PRECONDICIÓN: backfill Fase 4 TITULAR completo en todos los tenants (data ya en
--   AsignacionCursoXCiclo). CCs skippeados pierden la data de esta columna de forma permanente.
-- Reversibilidad: re-crear vía ALTER TABLE ADD COLUMN + ADD CONSTRAINT + CREATE INDEX
--   (ver 20260609140000_grading_primario_add_teacher_user_and_homeroom). La DATA no es
--   recuperable desde aquí — vive en AsignacionCursoXCiclo(TITULAR).

-- DropForeignKey
ALTER TABLE "course_cycles" DROP CONSTRAINT IF EXISTS "course_cycles_homeroom_teacher_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "course_cycles_homeroom_teacher_id_idx";

-- DropColumn
ALTER TABLE "course_cycles" DROP COLUMN IF EXISTS "homeroom_teacher_id";
```

Constraint: do NOT create a `migration_lock.toml` inside this folder. The single lock lives at `api/prisma_tenant/migrations/migration_lock.toml` (root of migrations).

---

## Gate: T5 — Run prisma:generate

**Spec refs:** REQ-SCHEMA-3
**Design refs:** "Flujo de datos / integración"; AD-1
**Depends on:** T1 (schema must be edited); T2, T3 logically complete by this point

Command:
```
pnpm --filter api prisma:generate
```

This regenerates both master and tenant Prisma clients. Success criteria:
- Exit code 0
- Zero schema validation errors
- Generated `CourseCycle` type must NOT expose `homeroomTeacherId` or `homeroomTeacher`
- Generated `Teacher` type must NOT expose `courseCyclesHomeroom`

This is the mandatory compile-correctness gate before file deletions. Do NOT proceed to Batch B if this fails.

---

## Batch B — File deletions + test cleanup (parallel, after T5)

### T6 — Delete backfill-asignacion-curso script and its test

**Spec refs:** REQ-BACKFILL-1
**Design refs:** AD-3; "Archivos eliminados (exactos)" items 1 & 3
**Depends on:** T5

Delete these 2 files:
- `api/scripts/backfill-asignacion-curso.ts`
- `api/src/application/asignacion-curso/__tests__/backfill-asignacion-curso.test.ts`

The `__tests__/` directory retains other specs (`assign-docente-to-curso`, `list-asignaciones-curso`, `remove-asignacion-curso`) — it will not be empty after this deletion.

---

### T7 — Delete backfill-docente-x-ciclo script and its test

**Spec refs:** REQ-BACKFILL-1
**Design refs:** AD-3; "Archivos eliminados (exactos)" items 2 & 4
**Depends on:** T5

Delete these 2 files:
- `api/scripts/backfill-docente-x-ciclo.ts`
- `api/src/application/docente-ciclo/__tests__/backfill-docente-x-ciclo.test.ts`

The `__tests__/` directory retains `docente-x-ciclo.service.test.ts` — it will not be empty after this deletion.

---

### T8 — Delete entity spec file entirely

**Spec refs:** REQ-TEST-1
**Design refs:** AD-4
**Depends on:** T5

Delete:
- `packages/domain/src/course-cycle/entities/course-cycle.spec.ts`

Rationale: the file contains a single `describe('CourseCycle — homeroomTeacherId', ...)` block (lines 1–93) — exclusively about the removed feature. No residual tests to preserve.

---

### T9 — Remove homeroomTeacherId from repo spec factory

**Spec refs:** REQ-TEST-2
**Design refs:** "Limpieza de tests" table
**Depends on:** T5

Edit:
- `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.spec.ts`

Remove line 40:
```typescript
homeroomTeacherId: null,
```

This is the only change to this file — no other lines touched.

---

## T10 — Dangling reference sweep

**Spec refs:** REQ-FUNC-2 (no unintended consumers modified)
**Design refs:** "Sin lectores ocultos"; "Riesgos — Sin lectores ocultos"
**Depends on:** T6, T7, T8, T9

Run a repo-wide grep for `homeroomTeacher` (covers both camelCase variants):

```
rg "homeroomTeacher" --type ts
rg "homeroom_teacher" --type sql
```

Acceptance: zero matches in `src/`, `packages/`, or `web/`. The ONLY permitted matches are:
- `api/prisma_tenant/migrations/20260617120000_drop_homeroom_teacher_id/migration.sql` (the new migration — contains reversibility comment)
- `api/prisma_tenant/migrations/20260609140000_grading_primario_add_teacher_user_and_homeroom/migration.sql` (historic creation — read-only)
- Archived change docs under `openspec/changes/archive/` or `openspec/changes/retiro-homeroom-column-s3b0/` (this change's own spec/design)

Any match outside these paths = STOP, investigate, add a task to fix before proceeding.

---

## Batch C — Verification gates (parallel, after T10)

### T11 — Test suite

**Spec refs:** REQ-TEST-1, REQ-TEST-2, REQ-FUNC-1
**Depends on:** T10

Command:
```
pnpm --filter api test
```

Acceptance:
- All homeroom-related specs are gone (deleted in T6, T7, T8) — no failures from them
- The ~6 pre-existing Pool-mock failures are expected and do NOT block (pre-change baseline)
- Zero NEW failures compared to the pre-change baseline
- `prisma-course-cycle.repository.spec.ts` passes (T9 cleaned the factory)

---

### T12 — Typecheck

**Spec refs:** REQ-BACKFILL-1, Scenario 8
**Depends on:** T10

Command:
```
pnpm --filter api typecheck
```

Acceptance:
- Exit code 0
- Zero new TypeScript errors relative to the 11-error pre-change baseline
- Specifically: no errors from deleted backfill scripts (T6, T7 removed the test files that pulled scripts into tsc graph)
- No mapper errors from removed `homeroomTeacherId` references (T3 removed lines; T5 regenerated types)

---

## T13 — Build

**Spec refs:** REQ-FUNC-1
**Depends on:** T11 (green), T12 (0 new errors)

Command:
```
pnpm build
```

Acceptance: exit code 0, no build errors.

---

## T14 — PR deploy note (informational artifact)

**Spec refs:** REQ-DEPLOY-1, REQ-DEPLOY-2
**Design refs:** AD-5
**Depends on:** T13 (include after build passes; part of PR description)

Include in the PR description:

```
## Deploy runbook — S3b-0 drop homeroom_teacher_id

### Precondition (MANDATORY before migrate-tenants)
Verify Fase 4 TITULAR backfill is complete (skip_count = 0) for every active tenant:

```sql
-- Run per tenant DB (or via your multi-tenant query runner):
SELECT
  cc.id,
  cc.homeroom_teacher_id,
  COUNT(acxc.id) AS titular_asignaciones
FROM course_cycles cc
LEFT JOIN asignaciones_curso_x_ciclo acxc
  ON acxc.course_cycle_id = cc.id AND acxc.role = 'TITULAR'
WHERE cc.homeroom_teacher_id IS NOT NULL
GROUP BY cc.id, cc.homeroom_teacher_id
HAVING COUNT(acxc.id) = 0;
```

**Go/no-go gate:** if any rows are returned, the TITULAR backfill is incomplete for that tenant.
DO NOT run migrate-tenants until this query returns 0 rows for all tenants.

**Consequence of skipping gate:** CCs with homeroom_teacher_id not yet migrated will
permanently lose that value. Recovery script (`backfill-asignacion-curso.ts`) is removed
from the codebase in this PR — recovery requires git history checkout.

### Deploy sequence (after code is merged and gate is green)
```
pnpm --filter api migrate-tenants
```

This runs `prisma migrate deploy` per active tenant via `scripts/migrate-all-tenants.ts`.
No manual per-tenant SQL required.
```

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated changed lines | ~725 total (40 removed prod + 25 new migration + 659 deleted backfills/specs + 1 edited repo-spec) |
| New/modified lines (review burden) | ~35 (migration SQL ~25 + schema/entity/mapper edits ~10) |
| Lines deleted | ~659 (backfill scripts ~414 + backfill tests ~152 + entity spec ~93) |
| 400-line budget risk | **LOW** — bulk of diff is deletions; actual new code ≈ 35 lines |
| Chained PRs recommended | **No** — single atomic drop, low review burden |
| Decision needed before apply | **No** — auto-chain delivery strategy + risk confirmed low |

---

## Task Index

| ID | Description | Parallel group | Depends on | Spec refs |
|----|-------------|---------------|-----------|-----------|
| [x] T1 | Edit schema.prisma (5 removals, both relation sides) | A | — | REQ-SCHEMA-1, REQ-SCHEMA-2 |
| [x] T2 | Edit course-cycle.ts (field + getter + method) | A | — | REQ-ENTITY-1, REQ-ENTITY-2, REQ-ENTITY-3 |
| [x] T3 | Edit mapper (toDomain + toPersistence lines) | A | — | REQ-MAPPER-1, REQ-MAPPER-2 |
| [x] T4 | Create migration SQL file (20260617120000) | A | — | REQ-DB-1 to REQ-DB-6 |
| [x] T5 | Run prisma:generate (gate) | sequential | T1 | REQ-SCHEMA-3 |
| [x] T6 | Delete backfill-asignacion-curso + test | B | T5 | REQ-BACKFILL-1 |
| [x] T7 | Delete backfill-docente-x-ciclo + test | B | T5 | REQ-BACKFILL-1 |
| [x] T8 | Delete course-cycle.spec.ts | B | T5 | REQ-TEST-1 |
| [x] T9 | Remove homeroomTeacherId from repo spec factory | B | T5 | REQ-TEST-2 |
| [x] T10 | Dangling reference sweep (rg homeroomTeacher) | sequential | T6,T7,T8,T9 | REQ-FUNC-2 |
| [x] T11 | pnpm --filter api test (green, note Pool-mock baseline) | C | T10 | REQ-FUNC-1 |
| [x] T12 | pnpm --filter api typecheck (0 new errors vs 11 baseline) | C | T10 | REQ-BACKFILL-1 |
| [x] T13 | pnpm build (full build gate) | sequential | T11,T12 | REQ-FUNC-1 |
| [x] T14 | Write PR deploy note with skip-count query + gate | informational | T13 | REQ-DEPLOY-1, REQ-DEPLOY-2 |
