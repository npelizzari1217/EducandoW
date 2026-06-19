# Archive Report — retiro-grading-legacy-s3pre

> Archived: 2026-06-19
> Status: COMPLETE — all 3 PRs merged into main

---

## Summary

Retired the five legacy grading tables (`notas`, `evaluaciones`, `notas_trimestrales`,
`periodos_evaluacion`, `subject_assignments`) and removed all dead-code references to them.
Delivered in three chained PRs. The `teachers` table now has zero FK consumers in the
tenant schema, which is the gate prerequisite for S3b-final (drop `teachers`).

---

## Pull Requests

| PR | Branch | Content | Status |
|---|---|---|---|
| #30 | `feat/retiro-grading-legacy-s3pre-a1` | Archival script + 9 tests (4 scenarios) | Merged 2026-06-19 |
| #34 | `feat/retiro-grading-legacy-s3pre-a2` | Dead code removal (7 strategies, 5 entities, 5 repos, legacy path in generate-boletin) | Merged 2026-06-19 |
| #35 | `feat/retiro-grading-legacy-s3pre-b` | DROP migration for 5 tables + Prisma schema cleanup + backfill cleanup | Merged 2026-06-19 |

---

## Product Decision: Drop Without Backup

The archival gate (REQ-1.8, REQ-5) — which requires running the archival script before
applying the DROP migration — was **WAIVED by product decision**.

The legacy tables (`notas`, `evaluaciones`, `notas_trimestrales`, `periodos_evaluacion`,
`subject_assignments`) contained no data of importance. PR-b was applied directly without
running `api/scripts/archive-legacy-grading-data.ts` first.

The archival script remains in the codebase as a safety tool for future reference. The
rollback path documented in the migration is not expected to be exercised.

---

## Deploy Status

**The DROP migration has NOT been executed against any tenant DB as of archive date.**

The migration file `api/prisma_tenant/migrations/20260619200000_drop_grading_legacy/migration.sql`
is in the repository and will run automatically on the next `prisma migrate deploy` per tenant.

### Post-Deploy Verification (Task 12.4)

After the migration runs on each tenant, confirm REQ-3.1 (no FK children on `teachers`)
with this query:

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'teachers';
```

Expected result: **zero rows**.

**S3b-final (drop `teachers` table) MUST NOT start until REQ-3.1 is confirmed on all
active tenant databases.**

---

## Spec Changes

### Modified: `openspec/specs/report-cards/spec.md`

1. **RETIRED** — "Legacy NotaTrimestral Path in buildMaterias()" — removed from the
   TERCIARIO Boletín Data Source requirement. The positional clause "inserted BEFORE the
   legacy `else` that reads `NotaTrimestral`" was updated to: "last named branch in the
   dispatch chain; no legacy fallback branch MUST exist after this function."

2. **RETIRED** — "SubjectAssignment Must Remain Intact" paragraph in "Docente Name Source
   in Generated PDFs" — removed. The separate migration stage is now complete.

3. **RETIRED** — "NotaTrimestral-Based Boletín PDF Invalidation" — the invalidation
   clause referencing `postNotaTrimestral`/`deleteNotaTrimestral` was replaced with a
   deferred note. The "Stale PDF regenerated after grade change" scenario was removed.
   Broader caching invalidation policy remains in force.

4. **ADDED** — "No Legacy Table Reads in Boletín Generation (Post-Drop Regression Guard)"
   — new requirement with 5 scenarios (INICIAL/PRIMARIO/SECUNDARIO/TERCIARIO/no-else-branch).

### Added: `openspec/specs/grading-legacy-archival/spec.md`

New canonical capability spec covering the archival script (REQ-1), DROP migration
contract (REQ-2), post-drop schema state (REQ-3), code cleanliness (REQ-4), and delivery
gate (REQ-5). Includes the product decision note (archival gate WAIVED) in REQ-1.8 and
REQ-5.

---

## Verify Report Summary

Verify phase covered PR-a1 only (archival script). Verdict: **PASS WITH WARNINGS**.

- CRITICAL: 0
- WARNING (1): Coverage of `main()` in archival script below 80%. Accepted as by-design —
  same pattern as `cleanup-ingresantes-sin-ciclo.ts`. Business logic (shouldSkip,
  exportTableForTenant, archiveTenantTables) is covered at 100% in functions.
- SUGGESTION (1): Add test for `catch` branch in `shouldSkip` to close the one uncovered
  branch. Not blocking.

PR-a2 and PR-b: gates passed via build + test commands (pnpm build EXIT 0,
pnpm --filter api test 137 files / 1355 tests VERDE).

---

## Enables

**S3b-final** (change `retiro-teacher-legacy`): drop the `teachers` table.
Cannot start until REQ-3.1 is confirmed on all active tenant DBs post-deploy.

---

## Engram Observation IDs (Traceability)

| Artifact | Engram ID |
|---|---|
| apply-progress (all 3 PRs) | #1212 |
| verify-report (PR-a1) | #1214 |
| delivery-decision (3-PR split) | #1210 |
| archive-report | saved via mem_save after this file |
