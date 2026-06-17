# Archive Report: retiro-examenes-presidente-s3b3

> Phase: sdd-archive · Store: hybrid · 2026-06-17
> Branch: feat/retiro-examenes-presidente-s3b3
> Status: DONE — Verify PASS (0 CRITICAL, 0 WARNING, 1 SUGGESTION)

## Summary

S3b-3 of the Teacher table retirement epic (`retiro-teacher-legacy`). Migrated
`MesaExamen.presidenteId` and `ActaExamen.presidenteId` from `Teacher.id` (FK Restrict) to
`User.id` (AD-6 cross-database reference, no FK). Zero code changes — schema + migration +
2 spec text lines only. R-GAP from S3b-2 is now CLOSED.

## What Changed

| File | Change |
|------|--------|
| `api/prisma_tenant/schema.prisma` | Removed 4 lines: Teacher back-relations (`mesasExamen MesaExamen[]`, `actasExamen ActaExamen[]`) and `@relation` fields on `MesaExamen.presidente` + `ActaExamen.presidente`. `presidenteId String @map("presidente_id")` and `@@index([presidenteId])` retained in both models. |
| `api/prisma_tenant/migrations/20260617140000_migrate_presidente_id_to_user/migration.sql` | Hand-written migration (+37 lines). Backfills `presidente_id` from `Teacher.id` to `Teacher.userId` (WHERE `user_id IS NOT NULL`) for both tables, then drops FK constraints via `DROP CONSTRAINT IF EXISTS`. Indexes retained. Rollback DDL included as comments. |
| `openspec/specs/nivel-secundario/spec.md` | `presidenteId` description updated to `User.id — AD-6 cross-DB ref, no FK`. |
| `openspec/specs/nivel-terciario/spec.md` | `presidenteId` and `vocales` descriptions updated: `presidenteId (User.id — AD-6 cross-DB ref, no FK)`, `vocales (free-form strings, no FK)`. |

**Total diff:** 4 files changed, 39 insertions(+), 6 deletions(-). Zero domain, application,
infrastructure, DTO, frontend, or test files modified (R-8 satisfied).

## Design Note

No `design.md` was produced for this change. The change is zero-behavior (schema + migration
only); all architectural decisions were embedded in the explore and proposal artifacts:
AD-6 (User.id as cross-DB reference, no FK) with Option B orphan handling (dangling UUIDs
accepted — `presidenteId` is never name-resolved anywhere in the application).

## Verify Result

**PASS** — 0 CRITICAL, 0 WARNING, 1 SUGGESTION

| Gate | Result |
|------|--------|
| G1 Dangling reads sweep | PASS — 0 matches |
| G2 `prisma:generate` | PASS — both schemas clean |
| G3 `tsc --noEmit` (typecheck) | PASS — 11 baseline errors, 0 new |
| G4 `pnpm test` | PASS — 1198 tests green |
| G5 `pnpm build` | PASS — 3 tasks successful |
| G6 Diff scope (exactly 4 files) | PASS |
| G7 Migration order (backfill before drop) | PASS — UPDATE×2 precede DROP CONSTRAINT×2 |
| G8 Rollback DDL present | PASS — commented block with both ADD CONSTRAINT |
| G9 No lock.toml | PASS |

**S-1 (SUGGESTION, left as-is):** Scenario 5 in `delta.md` states `tsc --noEmit exits code 0`;
the project carries 11 pre-existing baseline typecheck errors unrelated to this change. Wording
is cosmetic — intent is clear.

## R-GAP Closure

**S3b-2 R-GAP is CLOSED.** After this change:
- `MesaExamen.presidenteId` and `ActaExamen.presidenteId` are `TEXT NOT NULL` columns storing a `User.id`.
- No FK to the `teachers` table exists on either column.
- Any `User.id` can be used as `presidenteId` without requiring a corresponding `Teacher` row.
- Exam boards and exam records are fully decoupled from the `Teacher` table for the presidente relationship.

## Orphan Handling (Option B)

Teachers with `user_id IS NULL` at migration time retain their old `Teacher.id` as a dangling UUID
in `mesas_examen.presidente_id` / `actas_examen.presidente_id`. This is accepted: `presidenteId`
is never name-resolved in the application (no display, no lookup by name). If a future name-display
requirement appears, a cleanup migration (Option A) would be needed — tracked as a deferred risk.

## Deploy Preconditions

1. Apply per-tenant via `migrate-tenants` (multitenant deploy pattern).
2. Pre-deploy (informational, does NOT block): run orphan count per tenant:
   ```sql
   SELECT COUNT(*) FROM mesas_examen me JOIN teachers t ON me.presidente_id = t.id WHERE t.user_id IS NULL;
   SELECT COUNT(*) FROM actas_examen ae JOIN teachers t ON ae.presidente_id = t.id WHERE t.user_id IS NULL;
   ```
   Rows with count > 0 retain a dangling `Teacher.id` UUID (accepted under Option B).
3. Migration is single-file, backfill-before-drop — safe for per-tenant sequential apply with no gap.

## Remaining Teacher Table Consumer

After S3b-3, the ONLY remaining consumer of the `Teacher` table is:
- `SubjectAssignment.teacherId` (FK Cascade → `teachers.id`) — gated by **S3-pre**
  (Decision #1 PENDING: migrate Inicial/Terciario grading off `NotaTrimestral`).

## Remaining Roadmap

- **S3-pre** (PENDING): Migrate Inicial/Terciario grading from `NotaTrimestral` to
  SubjectPeriodGrade/SubjectFinalGrade. Blocked on Decision #1 (historial de notas legacy).
  Completion enables drop of `SubjectAssignment`.
- **S3b-final** (PENDING, gated by S3-pre): Drop `Teacher` table, domain entity, repository,
  and index exports. Requires S3-pre complete + Decision #1 resolved.
- Umbrella change `retiro-teacher-legacy` remains ACTIVE.

## Canonical Spec Merge

Canonical specs updated in-place by the apply phase (T4, T5):
- `openspec/specs/nivel-secundario/spec.md` — Requirement: Mesa de Examen, `presidenteId` field.
- `openspec/specs/nivel-terciario/spec.md` — Requirement: Acta de Examen, `presidenteId` + `vocales` fields.

No additional requirement notes added to canonical specs — the field-level description change is
sufficient and unambiguous.

## Engram Artifact Observation IDs

| Artifact | Topic Key | Observation ID |
|----------|-----------|----------------|
| explore | `sdd/retiro-examenes-presidente-s3b3/explore` | #1117 |
| proposal | `sdd/retiro-examenes-presidente-s3b3/proposal` | #1119 |
| spec | `sdd/retiro-examenes-presidente-s3b3/spec` | #1120 |
| tasks | `sdd/retiro-examenes-presidente-s3b3/tasks` | #1121 |
| apply-progress | `sdd/retiro-examenes-presidente-s3b3/apply-progress` | #1122 |
| verify-report | `sdd/retiro-examenes-presidente-s3b3/verify-report` | #1123 |
| archive-report | `sdd/retiro-examenes-presidente-s3b3/archive-report` | (this save) |

(No design artifact — design phase skipped for this zero-code migration.)
