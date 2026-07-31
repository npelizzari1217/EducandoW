# Archive Report — course-cycle-result-migration

**Date Archived**: 2026-07-31  
**Change Name**: `course-cycle-result-migration`  
**Storage Mode**: hybrid (engram + openspec)

## Executive Summary

Migrated the named-file slice of `course-cycle` error handling from throw-based to `Result` + `ApplicationError`/`DomainError` pattern. The change archived PASS with 0 CRITICAL, 0 WARNING, and 2 SUGGESTION (both pre-existing, out-of-scope). All 7 spec requirements (CCRM-R1..R7) verified. Remediated three real HTTP 500→400 bug corrections. No new error classes introduced. `AlumnosXCurso` slice (10 throws) deferred as separate follow-up change.

## Verification Verdict

**Status**: PASS  
**Critical Issues**: 0  
**Warnings**: 0  
**Suggestions**: 2 (pre-existing environment issues, not defects introduced by this change)

## Branch and Commits

**Branch**: `refactor/course-cycle-result-migration` (7 commits on main, not pushed)

| # | Hash | Message |
|---|------|---------|
| 1 | `e384391` | `test(domain): RED fromParts invalid composite -> ValidationError` |
| 2 | `248e811` | `fix(domain): Level.fromParts throws ValidationError not bare Error` |
| 3 | `0cc1f86` | `test(course-cycle): RED invalid level / bimonth end<=start -> 4xx` |
| 4 | `167722c` | `fix(course-cycle): buildLevel/buildBimonthPeriod return Result (500->400)` |
| 5 | `87a470a` | `refactor(course-cycle): Delete/ListStudents/Generate return Result` |
| 6 | `4ca631d` | `refactor(course-cycle): controller adopts if(isErr) throw unwrapErr for delete/listStudents/generate` |
| 7 | `5ab136e` | `test(course-cycle): controller specs for delete/generate/listStudents` |

## Test Results (Verified Independently)

| Command | Result |
|---|---|
| `pnpm --filter @educandow/domain test` | 111 files, 1285 tests — **all GREEN** |
| `pnpm --filter api test` (course-cycle scoped) | 24 files, 256 tests — **all GREEN** |
| `pnpm --filter api test` (full suite) | 211/212 files, 2163/2164 tests — **GREEN**; 1 failure in `scripts/__tests__/archive-legacy-grading-data.spec.ts` (pre-existing Windows path-separator assertion, zero files in this change's diff) |
| `pnpm --filter api typecheck` | **clean, 0 issues** — proves `Level.fromParts(...): Level` signature unchanged and all 6+ call sites compile |
| `pnpm --filter api build` | **GREEN** — TSC 0 issues, SWC compiled 512 files |

## Diff Statistics

```
git diff main..refactor/course-cycle-result-migration --stat
7 files changed, 306 insertions(+), 67 deletions(-)
```

**Total changed lines**: 373 (< 400 review budget, single PR)

**Files touched**:
- `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts`
- `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts`
- `api/src/presentation/course-cycle/__tests__/course-cycle.controller.spec.ts` (new)
- `api/src/presentation/course-cycle/__tests__/course-cycle.dto.test.ts`
- `api/src/presentation/course-cycle/course-cycle.controller.ts`
- `packages/domain/src/institution/__tests__/value-objects/level.test.ts`
- `packages/domain/src/institution/value-objects/level.ts`

**Zero files under** `api/src/application/shared/errors/`, `packages/domain/src/**/errors/`, or any `auth` module (CCRM-R7 verified).

## Three HTTP 500→400 Bug Corrections

| # | Site | Condition | Fix | HTTP Impact |
|---|---|---|---|---|
| 1 | `buildLevel()` (l.38) | invalid level | Helper returns `Result`; propagate existing `ValidationError` from `Level.create` | invalid level: **500 → 400/422** |
| 2 | `buildBimonthPeriod()` (l.45) | `end ≤ start` | Helper returns `Result`; propagate `ValidationError` from `BimonthPeriod.create` | invalid period: **500 → 400/422** |
| 3 | `Level.fromParts()` (domain, l.223) | invalid composite | `throw new ValidationError(...)` instead of bare `Error`; signature unchanged | invalid composite on `generate`: **500 → 400/422** |

All three corrections follow the established `ValidationError` → `DOMAIN_STATUS` → 400/422 mapping. Regression tests added (RED-first) for each; all now pass.

## What Was Migrated

### Delete/ListStudents/Generate — Top-Level Guards (WU1, WU5)
- All three use-cases now return `Result` instead of throwing
- Controller endpoints adopt `if (isErr) throw unwrapErr()` idiom (now 12/12 endpoints consistent)
- Status codes preserved: 404 (`CourseCycleNotFoundError`, `NotFoundError`), 409 (`CourseCycleClosedError`, `AcademicCycleClosedError`)

### buildLevel / buildBimonthPeriod Helpers (WU3-4)
- Both return `Result<_, ValidationError>` instead of throwing
- All call sites propagate the error via `Result`
- Invalid inputs now respond 4xx, not 500

### Level.fromParts (WU1-2)
- Throws `ValidationError` instead of bare `Error`
- Signature unchanged: `static fromParts(levelCode, modalityCode): Level`
- All 6+ existing callers still compile

## What Remains as Follow-Up

**Change**: `course-cycle` — `AlumnosXCurso` slice (separate change, not in this archive)

- **Scope**: 10 throws across 5 use-cases (`registrar-pase`, `add/remove-student-from-course-cycle`, `cascade-student-materias-competencias`, `toggle-printable`) plus full retrofit of `AlumnosXCursoXCicloController`
- **Size**: ~550-700 lines → chained PRs recommended
- **Status**: Tracked as a separate SDD change (not archived here)

**Decision Deferred**: `GenerateCourseCyclesUseCase` batch semantics (partial-success vs all-or-nothing) — product decision. Current behavior preserved (all-or-nothing loop).

## Requirement-by-Requirement Verification

| Req | Status | Evidence |
|---|---|---|
| CCRM-R1 (no throw in Delete/ListStudents/Generate top-level) | ✅ PASS | Zero `throw` statements remain in `course-cycle.use-cases.ts` (WU5); all three use-cases return `Result` |
| CCRM-R2 (buildLevel/buildBimonthPeriod → Result, 500→4xx) | ✅ PASS | Both helpers return `Result<_, ValidationError>`; RED-first tests committed; all call sites propagate (WU3-4) |
| CCRM-R3 (`Level.fromParts` → `ValidationError`, signature unchanged) | ✅ PASS | 1-line fix; `: Level` signature preserved; 6+ callers compile clean; domain/generate-path tests verify the throw (WU1-2) |
| CCRM-R4 (controller `if (isErr) throw unwrapErr()`) | ✅ PASS | All 3 migrated endpoints (`delete`, `listStudents`, `generate`) + 9 pre-existing = 12/12 endpoints consistent (WU6-7) |
| CCRM-R5 (status codes preserved) | ✅ PASS | All rewritten tests assert same error types; 256 course-cycle tests pass |
| CCRM-R6 (Generate all-or-nothing preserved) | ✅ PASS | Loop internals (l.375-445) untouched; one invalid `Level.fromParts` still aborts batch via uncaught throw |
| CCRM-R7 (no new error classes, auth untouched) | ✅ PASS | Zero new files under `errors/`; zero files under any `auth` module; `git diff --name-only \| grep -iE "errors/\|/auth/"` → no matches |

## Scope-Creep Scrutiny

Two reported divergences — both resolved as non-scope-creep:

1. **`course-cycle.dto.test.ts` mock rewrite** (commit 4ca631d)
   - Only the mock shape changed: `vi.fn().mockResolvedValue(students)` → `vi.fn().mockResolvedValue({ isOk: ..., unwrap: () => students })`
   - expect() assertions byte-identical before/after
   - Forced compatibility fix (mock had to match new `Result` contract), not scope expansion

2. **Added `Delete` not-found test** (Unit 5)
   - Additive coverage using existing `Promise<Result<void, Error>>` signature
   - No new production code path introduced

## TDD Discipline

### RED-First Commits
| Commit | File(s) | Tests only? |
|---|---|---|
| `e384391` | `level.test.ts` only, +5 lines | ✅ Yes |
| `0cc1f86` | `course-cycle.use-cases.test.ts` only, +35 lines | ✅ Yes |

### GREEN/Fix Commits
| Commit | File(s) | Fix only? |
|---|---|---|
| `248e811` | `level.ts`, 1 line changed | ✅ Yes |
| `167722c` | `course-cycle.use-cases.ts`, +42/-20 | ✅ Yes |

Both RED-GREEN pairs cleanly separated. Remaining work units (5, 6, 7) are mechanical status-preserving refactors, not bugfixes.

## Coverage (Scoped to course-cycle files touched by this change)

| File | Statements | Branch | Functions | Lines |
|---|---|---|---|---|
| `course-cycle.use-cases.ts` | 82.48% | 72.95% | 95.65% | 88.05% |
| `course-cycle.controller.ts` | 72.52% | 85.41% | 70.00% | 75.32% |

Uncovered lines belong to pre-existing, untouched use cases in the same file (e.g., `ListCourseCyclesUseCase`, `GetCourseCycleUseCase`, `ToggleCourseCycleActiveUseCase`, grading-period/grading-phase endpoints) — out of this change's scope.

## Environment Notes (Pre-Existing)

1. **Prisma tenant client missing** — Resolved by `pnpm --filter api prisma:generate`. Pure codegen, no schema/config changes. Zero Prisma files in this change's diff.
2. **web#build stale path** — Pre-existing absolute Linux path in `web/src/pages/dashboard/__tests__/students.test.tsx`. Zero web/ files in this change's diff — confirmed unrelated.
3. **archive-legacy-grading-data.spec.ts failure** — Pre-existing Windows path-separator assertion. Verified via empty diff on that file.

## Engram Artifact Traceability

All upstream SDD phase artifacts referenced by observation ID for cross-session recovery:

| Artifact | Observation ID | Topic Key |
|---|---|---|
| Explore | 1885 | `sdd/course-cycle-result-migration/explore` |
| Proposal | 1886 | `sdd/course-cycle-result-migration/proposal` |
| Spec | 1889 | `sdd/course-cycle-result-migration/spec` |
| Design | 1890 | `sdd/course-cycle-result-migration/design` |
| Tasks | 1891 | `sdd/course-cycle-result-migration/tasks` |
| Apply Progress | 1894 | `sdd/course-cycle-result-migration/apply-progress` |
| Verify Report | 1895 | `sdd/course-cycle-result-migration/verify-report` |

This archive report: **`sdd/course-cycle-result-migration/archive-report`** (to be persisted to engram after archiving)

## Canonical Capability Updated

The capability spec `openspec/specs/application-error-handling/spec.md` (section "Out of Scope / Follow-up") has been updated to reflect the named-file slice as DONE and track the remaining `AlumnosXCurso` slice as a separate follow-up change.

**Updated line**: `course-cycle` entry now documents that the named-file slice (7 throws in `course-cycle.use-cases.ts` + controller + `Level.fromParts` fix) was migrated and archived on 2026-07-31, with the `AlumnosXCurso` slice (10 throws) remaining as a separate change.

## Archive Closure

- **Change folder moved**: `openspec/changes/course-cycle-result-migration/` → `openspec/changes/archive/2026-07-31-course-cycle-result-migration/`
- **SDD cycle complete**: Proposal → Spec → Design → Tasks → Apply → Verify → Archive
- **Next step**: Ready for the next change. No blocking issues.
