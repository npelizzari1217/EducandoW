# Apply Progress — course-cycle-result-migration

Status: **All 8 work units complete.** 7/7 code work units committed on branch
`refactor/course-cycle-result-migration`, one commit each, in order. WU8 (verification) done,
no code changes needed.

## Branch

`refactor/course-cycle-result-migration` (created from `main`). Not pushed, no PR opened
(per instructions — stop after local commits + verification).

## Commits (in order)

| # | Hash | Message |
|---|------|---------|
| 1 | `e384391` | `test(domain): RED fromParts invalid composite -> ValidationError` |
| 2 | `248e811` | `fix(domain): Level.fromParts throws ValidationError not bare Error` |
| 3 | `0cc1f86` | `test(course-cycle): RED invalid level / bimonth end<=start -> 4xx` |
| 4 | `167722c` | `fix(course-cycle): buildLevel/buildBimonthPeriod return Result (500->400)` |
| 5 | `87a470a` | `refactor(course-cycle): Delete/ListStudents/Generate return Result` |
| 6 | `4ca631d` | `refactor(course-cycle): controller adopts if(isErr) throw unwrapErr for delete/listStudents/generate` |
| 7 | `5ab136e` | `test(course-cycle): controller specs for delete/generate/listStudents` |

No AI attribution in any commit message (per project rule).

## TDD Cycle Evidence

| Unit | Scenario | RED (confirmed fail) | GREEN (confirmed pass) | REFACTOR |
|---|---|---|---|---|
| 1-2 | `Level.fromParts(5,0)` → `ValidationError` | Yes — ran `vitest level.test.ts`, actual failure: `expected error to be instance of ValidationError` (got bare `Error`) | Yes — 64/64 tests pass after `throw new Error` → `throw new ValidationError` | N/A (1-line fix) |
| 3-4 | `Create` invalid level → `err(ValidationError)` | Yes — ran `vitest course-cycle.use-cases.test.ts`, actual failure: uncaught `Error: Invalid level: NIVEL_INEXISTENTE` (500) | Yes — 39/39 tests pass after `buildLevel`/call-site propagation | N/A |
| 3-4 | `Create` bimonth `end≤start` → `err(ValidationError)` | Yes — uncaught `Error: Invalid bimonth period: 2026-04-30 -> 2026-03-01` | Yes — same GREEN run | N/A |
| 3-4 | `Update` bimonth `end≤start` → `err(ValidationError)` | Yes — same uncaught-throw pattern in `UpdateCourseCycleUseCase` | Yes — same GREEN run | N/A |
| 5 | `Generate` invalid composite → `.rejects.toThrow(ValidationError)` | Not RED-first in the strict sense (WU2 fix already landed by the time this test was authored) — this test's purpose is to lock in the *new* error type on the loop-escape path; it was GREEN on first run because Unit 2 already fixed `Level.fromParts` | Yes — GREEN on first run, 41/41 tests pass | N/A |

Mechanical rewrites (Delete/ListStudents/Generate top-level guards, controller idiom adoption,
new controller spec) are status-preserving refactors, not RED-first bugfixes — confirmed
behavior-identical via the full course-cycle test suite (248 → 256 tests, all green) both before
and after each commit.

## Test Results (actual, not simulated)

- `packages/domain` (`@educandow/domain`): **111 files, 1285 tests — all GREEN.**
- `api`, course-cycle scope only (`vitest run course-cycle`): **24 files, 256 tests — all GREEN.**
- `api`, full suite (`vitest run`, after generating the missing `@prisma/tenant-client` —
  see "Environment note" below): **211/212 files, 2163/2164 tests — GREEN.**
  The 1 remaining failure is `scripts/__tests__/archive-legacy-grading-data.spec.ts`
  (Windows path-separator assertion, e.g. expects `/tmp/archival-test/alpha/notas.json`
  literally). Confirmed **pre-existing and unrelated**: `git diff main -- api/scripts/` for
  that file is empty (zero changes from this branch); it fails identically on `main`.

## Coverage

`vitest.config.ts` has `coverage.provider: v8` but **no enforced `thresholds`** — nothing fails
the build on a coverage floor. Scoped coverage run (all 24 course-cycle test files against the
2 touched application/presentation files):

| File | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| `course-cycle.use-cases.ts` | 82.48% | 72.95% | 95.65% | 88.05% |
| `course-cycle.controller.ts` | 72.52% | 85.41% | 70% | 75.32% |

Uncovered lines in both files belong to pre-existing, untouched use cases/endpoints in this
same file (e.g. `ListCourseCyclesUseCase`, `GetCourseCycleUseCase`, `ToggleCourseCycleActiveUseCase`,
grading-period/grading-phase endpoints) — out of this change's scope. All lines this change
actually modified are exercised by the RED-first and mechanical-rewrite tests above.

## Typecheck

`pnpm --filter api typecheck` → **clean (0 issues)**.

**Environment note**: on first run, typecheck/build/test all failed across ~37 unrelated files
with `Cannot find package '@prisma/tenant-client'`. This is a pre-existing environment gap —
the tenant Prisma client had never been generated in this sandbox. Ran
`pnpm --filter api prisma:generate` (pure codegen from schema, no DB connection required) to
fix it. Verified this was pre-existing and unrelated to this change by diffing the file list —
zero Prisma schema/config files are part of this change's diff.

## Build

- `pnpm --filter api build` → **GREEN** (SWC compiled 512 files, TSC 0 issues).
- `pnpm --filter @educandow/domain build` → **GREEN** (cached).
- Root `pnpm build` → fails only on `web#build`, with a **pre-existing, unrelated** error:
  a stale absolute Linux path baked into `web/src/pages/dashboard/__tests__/students.test.tsx`
  (`Cannot find module '/home/usuario/proyectos/educandow/web/src/hooks/use-api'`). Zero `web/`
  files appear in this change's diff — confirmed unrelated to course-cycle-result-migration.

## Diff Inspection (CCRM-R7)

```
git diff --stat main..refactor/course-cycle-result-migration
```

7 files changed, 306 insertions(+), 67 deletions(-):
- `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts`
- `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts`
- `api/src/presentation/course-cycle/__tests__/course-cycle.controller.spec.ts` (new)
- `api/src/presentation/course-cycle/__tests__/course-cycle.dto.test.ts`
- `api/src/presentation/course-cycle/course-cycle.controller.ts`
- `packages/domain/src/institution/__tests__/value-objects/level.test.ts`
- `packages/domain/src/institution/value-objects/level.ts`

Zero files under `api/src/application/shared/errors/`, `packages/domain/src/**/errors/`, or the
`auth` module — confirmed via `git diff --name-only ... | grep -iE "errors/|/auth/"` → no matches.

Total diff ≈ 373 changed lines — under the 400-line review budget (forecast said ~275; actual is
somewhat higher because of the new `course-cycle.controller.spec.ts`, the `Delete` not-found
regression test added in Unit 5, and the WU6 divergence below — still comfortably under budget,
no chaining/exception needed).

## Deviations from Design

1. **`course-cycle.dto.test.ts` needed rewriting (not anticipated in tasks.md).** The design's
   test plan (§9) only covers `course-cycle.use-cases.test.ts`, `level.test.ts`, and the NEW
   `course-cycle.controller.spec.ts`. It did not flag that the **pre-existing**
   `course-cycle.dto.test.ts` already had 3 tests (SBC-1/2/3) exercising `ctrl.listStudents(...)`
   with mocks that returned a plain array / a rejected promise — both incompatible with the new
   `Result`-returning `listStudentsUC`. Left unfixed, these would have been genuine regressions
   (violates CCRM-R5's "status codes preserved" spirit and just breaks the suite). Rewrote all 3
   to mock `Result`-shaped resolves, following the exact pattern already used for `getUC` in the
   same file (CCM-1/CCM-2). No scope expansion — purely a compatibility fix forced by the
   `Result` migration itself.
2. **Added a `Delete` not-found regression test** in Unit 5 (`course-cycle.use-cases.test.ts`)
   that tasks.md didn't explicitly list — the existing suite had `Delete`'s inactive-cycle case
   covered but not its not-found case as an explicit `Result` assertion. Added for completeness
   since the use case's `Promise<Result<void, Error>>` signature covers both paths.
3. **Environment fix (`prisma:generate`)**: not part of the design, but required to get a true
   signal from `typecheck`/`build`/full `test` — the tenant Prisma client was never generated in
   this sandbox. Pure codegen, no schema/migration change, zero effect on the diff.

None of these expand scope: no AlumnosXCurso, no batch partial-success, no new error classes,
`auth` untouched, `Generate` loop internals untouched.

## Requirements Coverage (spec.md cross-check)

| Req | Status |
|---|---|
| CCRM-R1 (no throw in Delete/ListStudents/Generate top-level) | Done — WU5 |
| CCRM-R2 (buildLevel/buildBimonthPeriod → Result, 500→4xx) | Done — WU3-4 |
| CCRM-R3 (`Level.fromParts` → `ValidationError`, signature unchanged) | Done — WU1-2; generate-path RED/GREEN in WU5.7 |
| CCRM-R4 (controller `if (isErr) throw unwrapErr()`) | Done — WU6-7 |
| CCRM-R5 (status codes preserved) | Done — verified in rewritten tests + new controller spec |
| CCRM-R6 (Generate all-or-nothing preserved) | Done — loop internals untouched, verified by design §5 coherence table |
| CCRM-R7 (no new error classes, auth untouched) | Done — verified by diff inspection (WU8.4-8.5) |

## Status

8/8 work units complete. Ready for `sdd-verify`.
