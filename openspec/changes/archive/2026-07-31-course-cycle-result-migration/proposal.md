# Proposal — course-cycle-result-migration

> SDD proposal. Store: hybrid. Follow-up consumer of the archived `app-error-model` foundation.
> Pedagogical level affected: **N/A** (transversal architecture concern; enum value = ALL).

## Executive summary

Migrate the last throw-based holdout in the `course-cycle` area to the settled `Result` +
`ApplicationError`/`DomainError` pattern from `app-error-model`. Everything here classifies as
**`DomainError`** (verified call-site by call-site) — **zero `ApplicationError`, zero new error
classes**. Along the way we correct **three real HTTP 500 bugs** where a valid `ValidationError` is
discarded and a bare `Error` leaks to the filter's 500 fallback. One PR, ~200-260 lines, additive.

## Intent

- **Problem**: `course-cycle.use-cases.ts` is a half-finished migration. 4 of 7 use-cases already
  return `Result` correctly; the remaining 3 (`Delete`, `ListStudents`, `Generate`) are throw-based,
  and two shared helpers (`buildLevel`, `buildBimonthPeriod`) plus `Level.fromParts` in the domain
  package throw **bare `Error`** — which the global filter maps to **HTTP 500** instead of a proper
  4xx. A user sending an invalid level or a bimonth period with `end ≤ start` gets a 500 today.
- **Why now**: the foundation (`ApplicationError` base, filter branch, `if (isErr) throw unwrapErr()`
  idiom) is archived and proven. This area is the cleanest remaining consumer — no new classes, a
  self-contained file + its controller — so it is the natural first migration to lock the pattern in
  before tackling the larger `AlumnosXCurso` slice.
- **Success looks like**:
  1. The 3 remaining use-cases return `Result`; the controller uses `if (isErr) throw unwrapErr()`
     for `delete` / `listStudents` / `generate`.
  2. The 3 bare-`Error` sites propagate the existing `ValidationError` → invalid input responds
     **4xx (400/422 per `DOMAIN_STATUS`)**, not 500.
  3. Regression tests prove each 500→4xx fix (RED before, GREEN after); mechanical rewrites keep
     their current status codes.
  4. `Level.fromParts` keeps its `: Level` signature — non-breaking for its 6+ callers.

## Scope

### In scope (Option A — locked)

| Target | What changes |
|---|---|
| `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` | 7 throws migrated; `buildLevel`/`buildBimonthPeriod` return `Result`; `Delete`/`ListStudents`/`Generate` return `Result` |
| `api/src/presentation/course-cycle/course-cycle.controller.ts` | `delete` / `listStudents` / `generate` adopt `if (isErr) throw unwrapErr()` (9/12 endpoints already do) |
| `packages/domain/src/institution/value-objects/level.ts` | `Level.fromParts` throws `ValidationError` instead of bare `Error` — **non-breaking**, `: Level` signature kept |

Estimated size: **~200-260 lines, ONE PR**.

### Out of scope (explicit follow-ups — do NOT touch here)

1. **`AlumnosXCurso` slice** — 10 more throws across 5 use-cases (`registrar-pase`,
   `add/remove-student-from-course-cycle`, `cascade-student-materias-competencias`,
   `toggle-printable`) + full retrofit of `AlumnosXCursoXCicloController` (0% of the idiom).
   ~550-700 lines → chained PRs. **Separate change.**
2. **`GenerateCourseCyclesUseCase` batch semantics** — the naked `.unwrap()` calls inside the loop
   (`CourseName.create`, `PassingGrade.create(6)`) are all-or-nothing (one bad course aborts the
   batch). Migrating to partial-success is a **product decision**. **Preserve current behavior**;
   migrate only the 3 top-level guards (lines 315, 318, 327).

## Throw classification (verified, settled)

Rule (from the pilot): caller-context / authorization → `ApplicationError`; intrinsic data invariant
→ `DomainError`. Everything here is the second. **Reuse only — zero new classes.**

| Line | Site | Condition | Class (reused) | HTTP | Bug 500? |
|---|---|---|---|---|---|
| 38 | `buildLevel()` | invalid level | `ValidationError` (discarded today) | 400/422 | **YES → fix** |
| 45 | `buildBimonthPeriod()` | `end ≤ start` | `ValidationError` (discarded today) | 400/422 | **YES → fix** |
| 229 | `DeleteCourseCycleUC` | not found | `CourseCycleNotFoundError` | 404 | no |
| 232 | `DeleteCourseCycleUC` (`cc.ensureActive()`) | inactive cycle | `CourseCycleClosedError` | 409 | no |
| 283 | `ListStudentsByCourseCycleUC` | not found | `CourseCycleNotFoundError` | 404 | no |
| 315 | `GenerateCourseCyclesUC` | AcademicCycle not found | `NotFoundError` | 404 | no |
| 318 | `GenerateCourseCyclesUC` | AcademicCycle inactive | `AcademicCycleClosedError` | 409 | no |
| 327 | `GenerateCourseCyclesUC` | StudyPlan not found | `NotFoundError` | 404 | no |
| 223 | `Level.fromParts` (domain) | invalid composite | `ValidationError` (bare `Error` today) | 400/422 | **YES → fix** |

Catalog reused: `ValidationError`, `CourseCycleNotFoundError`, `CourseCycleClosedError`,
`AcademicCycleClosedError`, `NotFoundError`.

## The three 500→4xx corrections (deliberate behavior change)

These are **behavior corrections, not cosmetics**. Today each discards a real `ValidationError`
(or, for `fromParts`, never builds one) and throws bare `Error`, which lands in the filter's
`instanceof Error` fallback → **HTTP 500**. Target: propagate the existing/proper `ValidationError`
so `DOMAIN_STATUS` maps it to **400/422**.

| # | Site | Fix | Contract impact |
|---|---|---|---|
| 1 | `buildLevel` (l.38) | helper returns `Result`; propagate the `ValidationError` already produced by `Level.create`. Called from `Create`/`Update` (already `Result`) | invalid level: 500 → 4xx |
| 2 | `buildBimonthPeriod` (l.45) | helper returns `Result`; propagate `ValidationError` from `BimonthPeriod.create` (`end ≤ start`) | invalid period: 500 → 4xx |
| 3 | `Level.fromParts` (l.223, domain) | `throw new ValidationError(...)` keeping the `: Level` signature (6+ callers unaffected) | invalid composite on `generate` path: 500 → 4xx |

**Risk owned here**: any existing test that asserts **500** for these inputs MUST be updated to the
new 4xx. Per the exploration, no use-case test currently covers invalid level / `end ≤ start` /
invalid composite — this is a genuine coverage gap, so these become **RED-first regression tests**
rather than status-flip edits. Infra reconstruction of `Level.fromParts` normalizes the composite
before the call (`prisma-subject.repository.ts:66-72`), so the stricter throw should not fire there;
`design` verifies the `VALIDATION_ERROR` → `DOMAIN_STATUS` mapping.

## Test strategy (TDD strict — Vitest, `pnpm test`, coverage ≥ 80%)

Split into two work units, tests co-located with the behavior they verify:

1. **Bugfixes (RED first)** — write failing tests that assert **500 today**, then flip to **4xx**:
   - use-case test: `Create`/`Update` with invalid level → `ValidationError` / 4xx.
   - use-case test: `Create`/`Update` with bimonth `end ≤ start` → `ValidationError` / 4xx.
   - domain test: `Level.fromParts` invalid composite → `ValidationError` (extend
     `level.test.ts`); assert 6+ existing callers still compile against `: Level`.
   - `generate` path test where an invalid composite surfaces the `ValidationError`.
2. **Mechanical Result-idiom rewrites (refactor, status preserved)**:
   - `Delete` / `ListStudents` / `Generate` use-case tests: `.rejects.toThrow(...)` → assert on
     `Result` (`isErr`, error class, status).
   - New controller specs for `delete` / `generate` / `listStudents` (no dedicated spec today):
     `if (isErr) throw unwrapErr()` maps to the expected 404/409.

Batch semantics of `Generate` are unchanged, so its all-or-nothing loop tests stay green as-is.

## Size, delivery, rollback

- **Size**: ~200-260 lines, **< 400** → **single PR**. No chained PRs, no `size:exception`.
- **Rollback**: additive/idiom-swap. Reverting the PR restores prior behavior. The only externally
  observable change is the 3 intended 500→4xx corrections; no schema, no migration, no API surface
  removed. `Level.fromParts` signature preserved → domain package retrocompatible.

## Follow-ups (tracked, not here)

1. `course-cycle` `AlumnosXCurso` slice migration (separate change, chained PRs).
2. `GenerateCourseCyclesUseCase` partial-success batch semantics (product decision).

## Recommendation

Proceed to `sdd-spec` and `sdd-design` (parallelizable). Scope Option A, zero new classes, three
500→4xx corrections, five safe mechanical migrations.
