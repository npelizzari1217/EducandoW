# Archive Report: tenant-migration-drift-baseline

> Archived: 2026-06-22
> Verdict: PASS WITH WARNINGS — 0 CRITICAL · 2 WARNING · 2 SUGGESTION
> Branch origin: fix/tenant-migration-drift-baseline
> PR: #65 merged to main
> Archive branch: chore/archive-tenant-migration-drift-baseline

---

## Summary

Change `tenant-migration-drift-baseline` eliminates a 5-axis schema/DB drift that caused
`prisma migrate dev` to emit ~31 spurious DDL lines on every run (confirmed via
`prisma migrate diff` on sandbox `educandow_tenant_dev`). The approach was
SCHEMA-FOLLOWS-DB: the DB is treated as the source of truth and the schema is aligned to it.

**Two disjoint operation groups**:
- **Group A — Schema annotations (no DDL):** 20 additive annotation edits to
  `api/prisma_tenant/schema.prisma`: 7 FK `map:`, 13 index/unique `map:`, 18
  `@db.Timestamptz(6)`. All 7 PG-63-char-truncated names verified verbatim against
  `drift-snapshot.sql`.
- **Group B — Forward migration (11 instant DDL):**
  `api/prisma_tenant/migrations/20260623000000_reconcile_tenant_drift_baseline/migration.sql`
  - 1× `DROP INDEX "competency_valuations_studentId_competencyId_key"` (stranded 2-col unique)
  - 8× `ALTER TABLE "<t>" ALTER COLUMN "updated_at" DROP DEFAULT` (unreachable DB defaults)
  - 2× `ALTER TABLE "<asistencia_t>" ALTER COLUMN "id" DROP DEFAULT` (asistencia tables)

The `DROP INDEX` also resolves a behavioral correctness bug: the stranded 2-col unique index
was more restrictive than the intended 3-col unique constraint, effectively blocking
multi-cycle competency valuations for the same student+competency pair.

Empty diff verified on sandbox `educandow_tenant_dev`. 1539/1539 tests green, typecheck exit 0.

---

## PRs and Verify Verdicts

| PR | GitHub | Scope | Verdict | CRITICAL | WARNING | SUGGESTION |
|----|--------|-------|---------|----------|---------|------------|
| PR1 | #65 | Schema annotations (20) + migration.sql (11 DDL) | PASS WITH WARNINGS | 0 | 2 | 2 |

### PR findings

- **WARNING W1 (resolved during archive):** `openspec/specs/migration-integrity/spec.md` did
  not exist. File created during this archive phase — seeded from the delta content (MI-11 /
  MI-S11). See Spec Merge Results.
- **WARNING W2 (deferred):** CV-S21 and CV-S22 have no automated integration test. T5/T8
  (optional TDD) deferred. DB-level correctness proven via empty-diff gate (MI-S11) and
  `DROP INDEX` in migration. See Remaining Debt.
- **SUGGESTION S1:** Changes committed and PR #65 opened. Resolved.
- **SUGGESTION S2:** Fleet rollout via `migrate-tenants` required. See Deploy Debt.

---

## Approach

**Design strategy**: SCHEMA-FOLLOWS-DB — the DB is the source of truth; schema was aligned
to it via pure annotations for inferrable renames, plus a forward migration for structural
DB-state deltas that annotations cannot represent.

**Correctness note (CV-R9 / uniqueness bug)**: PostgreSQL distinguishes between a named
CONSTRAINT and an INDEX created via `CREATE UNIQUE INDEX`. `DROP CONSTRAINT IF EXISTS` does
NOT act on indexes — it silently no-ops. The Fase 3 migration
(`20260608210000_competency_instantiation_fase3`) attempted to drop the 2-col unique via
`DROP CONSTRAINT IF EXISTS`, which no-op'd. The 2-col index persisted alongside the correct
3-col UNIQUE CONSTRAINT, with the 2-col being the effective (more-restrictive) enforcer.
`DROP INDEX` in the forward migration resolves both the drift and the logical bug.

---

## Spec Merge Results

| Delta | Canonical target | Action | Requirements merged | Scenarios merged |
|-------|-----------------|--------|---------------------|-----------------|
| `specs/competency-valuations/delta.md` | `openspec/specs/competency-valuations/spec.md` | APPENDED new requirement section | "CourseCycle-Scoped Uniqueness Constraint Correctness" (no CV-R label — canonical uses prose headings) | None — CV-S21 superseded by existing MVM-3; CV-S22 superseded by existing MVM-2 |
| `specs/migration-integrity/delta.md` | `openspec/specs/migration-integrity/spec.md` | CREATED (file did not exist) | MI-11 "Tenant Schema Zero-Drift Invariant" | MI-S11 "Empty diff on a fully-migrated tenant DB" |

**Renumbering decision — competency-valuations**: The delta assumed CV-R9/CV-S21/CV-S22
numbering. The canonical spec uses prose requirement headings and scenario prefixes (MVM, ACT,
GPE, BVR) — no CV-R/CV-S numbering exists in the canonical. The new requirement was merged
following the canonical's naming convention. Scenarios CV-S21 and CV-S22 are superseded by
the already-present MVM-3 (different cycles accepted) and MVM-2 (same triple rejected)
respectively; no new scenario IDs were added to avoid duplication. The instruction to
"continue the canonical's real sequence" resolves to: use prose requirement name, reference
existing MVM scenarios.

**Numbering decision — migration-integrity**: The delta used MI-11, consistent with a
migration comment referencing "MI-1..MI-10". The canonical starts at MI-11 with a History
note explaining that MI-1..MI-10 predate the SDD file system and are referenced only in
migration comments. Starting at MI-11 preserves historical continuity.

---

## Deploy Debt

| Item | Command | Target | Validation step |
|------|---------|--------|-----------------|
| Forward migration `20260623000000_reconcile_tenant_drift_baseline` not yet applied fleet-wide | Step 8b of `deploy.ps1` (`migrate-tenants`) | All tenant DBs | Validate on `educandow_ccaeff` first |

Migration file:
`api/prisma_tenant/migrations/20260623000000_reconcile_tenant_drift_baseline/migration.sql`

All 11 DDL statements are instant (no data rewrite, no lock escalation):
- `DROP INDEX` — removes a non-unique-constraint index; no FK dependency
- `ALTER COLUMN ... DROP DEFAULT` — removes unreachable DB-level defaults; no data touched

> Recommended rollout sequence:
> 1. Apply on `educandow_ccaeff` staging tenant and confirm zero errors
> 2. Run `migrate-tenants` fleet command across all tenants
> 3. Confirm no rollout errors before closing this deploy debt item

---

## Remaining Debt (carried forward)

| # | Item | Source | Status |
|---|------|--------|--------|
| 1 | Timestamp type unification: `@db.Timestamptz(6)` annotations are in place but the underlying column types remain `TIMESTAMP(3)` in the DB. A full `timestamptz` column-type migration would require `SET DATA TYPE` which is a non-instant DDL on large tables. This is explicitly deferred. | design / verify | DEFERRED — annotated in schema; full type migration is a separate change |
| 2 | CV-S21 and CV-S22 automated integration tests (T5/T8): DB integration test for CV-R9 scenarios (cross-CourseCycle insert accepted; same-triple rejected). Deferred because integration harness requires disproportionate fixture setup (Student, SubjectCompetency, CourseCycle). | verify W2 | DEFERRED — DB correctness proven by empty-diff gate; behavioral test to be added in a future change |

---

## Artifact Traceability

| Artifact | Location | Engram ID |
|----------|----------|-----------|
| Proposal | `openspec/changes/archive/2026-06-22-tenant-migration-drift-baseline/proposal.md` | #1342 |
| Explore | `openspec/changes/archive/2026-06-22-tenant-migration-drift-baseline/explore.md` | — |
| Design | `openspec/changes/archive/2026-06-22-tenant-migration-drift-baseline/design.md` | #1343 |
| Spec | `openspec/changes/archive/2026-06-22-tenant-migration-drift-baseline/specs/` | #1344 |
| Tasks | `openspec/changes/archive/2026-06-22-tenant-migration-drift-baseline/tasks.md` | #1345 |
| Apply progress | `openspec/changes/archive/2026-06-22-tenant-migration-drift-baseline/apply-progress.md` | #1346 |
| Verify report | `openspec/changes/archive/2026-06-22-tenant-migration-drift-baseline/verify-report.md` | #1347 |
| Drift snapshot | `openspec/changes/archive/2026-06-22-tenant-migration-drift-baseline/drift-snapshot.sql` | — |
| Delta: competency-valuations | `openspec/changes/archive/2026-06-22-tenant-migration-drift-baseline/specs/competency-valuations/delta.md` | — |
| Delta: migration-integrity | `openspec/changes/archive/2026-06-22-tenant-migration-drift-baseline/specs/migration-integrity/delta.md` | — |
| Canonical: competency-valuations | `openspec/specs/competency-valuations/spec.md` (new requirement section appended) | — |
| Canonical: migration-integrity | `openspec/specs/migration-integrity/spec.md` (CREATED — MI-11 / MI-S11) | — |
| Archive report (engram) | topic_key `sdd/tenant-migration-drift-baseline/archive-report` | (this save) |
