# Archive Report: optativa-plan-level

> Archived: 2026-06-22
> Verdict: PASS (0 CRITICAL across both PRs)
> Branch origin: feat/optativa-plan-level-pr1, feat/optativa-plan-level-pr2 (2 PRs merged to main)
> Archive branch: chore/archive-optativa-plan-level
> Closes: deferred `StudyPlanSubject.esOptativa` follow-up from `optativas-inscripcion` (2026-06-22)

---

## Summary

Change `optativa-plan-level` moves the optativa designation upstream from per-CC manual
toggling to the study plan definition. A new `esOptativa Boolean @default(false)` field on
`StudyPlanSubject` propagates through the full generation chain
(`StudyPlanCourseDto` → `GenerateCourseCyclesUseCase` → `MaterializeMateriasUseCase` →
`upsertMany`) so that each new `MateriaXCursoXCiclo` row inherits the plan-level designation
at materialization time. The per-CC PATCH override (MGC-R10) remains authoritative and is
never overwritten. Re-generation is additive (D2 LOCK): `skipDuplicates` ensures already-
materialized rows are never touched by a subsequent generation, preserving all manual
overrides. Both PRs pass with 0 CRITICAL and 0 WARNING findings.

This change formally closes the deferred `StudyPlanSubject.esOptativa` item that was
explicitly deferred during `optativas-inscripcion` design.

---

## PRs and Verify Verdicts

| PR | GitHub | Scope | Tasks | Verdict | CRITICAL | WARNING | SUGGESTION |
|----|--------|-------|-------|---------|----------|---------|------------|
| PR1 | #62 | Schema + migration + domain + infra + application + tests | T01–T13 | PASS | 0 | 0 | 1 |
| PR2 | #63 | Presentation (Zod schema + controller) + web toggle/badge | T14–T18 | PASS | 0 | 0 | 1 |

### PR1 findings

- **SUGGESTION (non-blocking):** Test B in `prisma-study-plan.repository.test.ts` checks
  `create.esOptativa` is undefined but does not re-check `update.esOptativa` for a fully
  omitted call. Test D (update path, hours-only) covers D5; gap is minor redundancy only.
- **INFORMATIONAL (pre-existing):** Schema-vs-migration-history drift (FK/index renames,
  `timestamptz→timestamp(3)`) was present in the dev baseline before this change. The
  migration file `20260622145831_add_es_optativa_to_study_plan_subject/migration.sql` is
  clean (one `ALTER TABLE` statement only) — drift lines were stripped before commit.
  This is NOT a PR1 issue; see Remaining Debt below.
- Test suite: 1535/1535 PASS. Typecheck: exit 0.

### PR2 findings

- **SUGGESTION (non-blocking):** `handleToggleOptativa` omits `hoursPerWeek` in the POST
  body. Behaviorally correct (D5 undefined-skip on existing subject), but worth a code
  comment noting that toggle only fires on already-persisted subjects.
- All 4 controller tests (T14) and 6 web tests (T17) verified as genuine assertions.
- Test suite: 1539/1539 PASS (160 API files + 441 Web tests). All typechecks: exit 0.

---

## Locked Decisions

| Decision | Description | Enforcement |
|----------|-------------|-------------|
| D2 LOCK | Re-generation is additive. `esOptativa` flows through `MaterializeMateriasUseCase` **create path only**. Step-2 `updateDescription` (re-sync) MUST NOT include `esOptativa`. Rationale: protects per-CC PATCH overrides from silent clobbering. | Asserted by Test D in materialize tests; explicit `D2 LOCK` comment in implementation. |
| D5 | Prisma `update:{}` receives `undefined` (skip) when `esOptativa` is omitted — MUST NOT be coerced to `false`. Rationale: a hoursPerWeek-only re-POST must not erase the existing flag. | Asserted by Test D in repo tests and Test B/C in UC tests. |
| Per-CC PATCH (MGC-R10) | The PATCH endpoint from `optativas-inscripcion` remains the authoritative post-generation override for `MateriaXCursoXCiclo.esOptativa`. Plan-level changes never retroactively update materialized rows. | MGC-R15 / MGC-S34–S35 / `skipDuplicates` strategy. |

---

## Spec Merge Results

| Delta | Canonical target | Requirements merged | Scenarios merged |
|-------|-----------------|---------------------|-----------------|
| `specs/materia-grupo-ciclo/delta.md` | `openspec/specs/materia-grupo-ciclo/spec.md` | MGC-R13, MGC-R14, MGC-R15, MGC-R16 | MGC-S28–S38 (11 scenarios) |
| `specs/smart-course-creation/delta.md` | `openspec/specs/smart-course-creation/spec.md` | Extended "CursoXCiclo Generation Materializes Plan Subjects" with esOptativa propagation chain | 3 new scenarios (propagation, all-obligatoria, skipDuplicates override) |

**Canonical materia-grupo-ciclo** now contains MGC-R1–R16 / MGC-S1–S38
(was R1–R12 / S1–S27 before this change).

**Canonical smart-course-creation** generation requirement now includes
the `esOptativa` propagation chain description and 3 additional scenarios.

---

## Deploy Debt

| Item | Command | Target schema |
|------|---------|---------------|
| Prisma migration NOT yet applied on production | Step 8b of `deploy.ps1` (`migrate-tenants`) | TENANT schema (all tenant DBs) |

Migration file: `api/prisma_tenant/migrations/20260622145831_add_es_optativa_to_study_plan_subject/migration.sql`

This adds `es_optativa BOOLEAN NOT NULL DEFAULT false` to the `study_plan_subject` table
in every tenant schema. Must be applied via the standard `migrate-tenants` step of the
production deploy script before the feature is live.

> Note: the migration file itself is clean (one `ALTER TABLE` statement only). The
> pre-existing dev-baseline drift was stripped before commit and is tracked separately
> under Remaining Debt below.

---

## Remaining Debt (carried forward)

| # | Item | Source | Status |
|---|------|--------|--------|
| — | Pre-existing schema-vs-migration-history drift: FK/index renames, `timestamptz→timestamp(3)` surface when running `prisma migrate dev` against the tenant schema | optativas-inscripcion INFORMATIONAL / PR1 verify INFORMATIONAL | **PENDIENTE** — needs a dedicated baseline-reconciliation change to align migration history with the actual schema. Does NOT block production deploys via `prisma migrate deploy`. |

---

## Closure Note

This change formally closes the deferred `StudyPlanSubject.esOptativa` follow-up that was
explicitly deferred during `optativas-inscripcion` (2026-06-22) design. The canonical
`openspec/specs/materia-grupo-ciclo/spec.md` debt note from that archive is now resolved.

---

## Artifact Traceability

| Artifact | Location | Engram ID |
|----------|----------|-----------|
| Proposal | `openspec/changes/archive/2026-06-22-optativa-plan-level/proposal.md` | #1331 |
| Explore | `openspec/changes/archive/2026-06-22-optativa-plan-level/explore.md` | — |
| Design | `openspec/changes/archive/2026-06-22-optativa-plan-level/design.md` | #1332 |
| Spec | `openspec/changes/archive/2026-06-22-optativa-plan-level/` (engram) | #1333 |
| Tasks | `openspec/changes/archive/2026-06-22-optativa-plan-level/tasks.md` | #1334 |
| Apply progress | `openspec/changes/archive/2026-06-22-optativa-plan-level/apply-progress.md` | — |
| Verify report PR1 | `openspec/changes/archive/2026-06-22-optativa-plan-level/verify-report-pr1.md` | #1336 |
| Verify report PR2 | `openspec/changes/archive/2026-06-22-optativa-plan-level/verify-report-pr2.md` | #1338 |
| Delta: materia-grupo-ciclo | `openspec/changes/archive/2026-06-22-optativa-plan-level/specs/materia-grupo-ciclo/delta.md` | — |
| Delta: smart-course-creation | `openspec/changes/archive/2026-06-22-optativa-plan-level/specs/smart-course-creation/delta.md` | — |
| Canonical: materia-grupo-ciclo | `openspec/specs/materia-grupo-ciclo/spec.md` (MGC-R13–R16, MGC-S28–S38 added) | — |
| Canonical: smart-course-creation | `openspec/specs/smart-course-creation/spec.md` (generation req extended) | — |
| Archive report (engram) | topic_key `sdd/optativa-plan-level/archive-report` | (this save) |
