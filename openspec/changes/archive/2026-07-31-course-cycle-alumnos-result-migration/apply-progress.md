# Apply Progress — course-cycle-alumnos-result-migration

**Branch**: `refactor/course-cycle-alumnos-result-migration` (HEAD before this batch: `ad947ad`)
**Mode**: Strict TDD (RED-first for the bridge test S-4-B and the new `togglePrintable` controller-spec tests C-19..C-21; status-preserving rewrites for the rest)
**Batch**: first and only batch — all 7 phases / 27 tasks completed in this run.

## Status

27/27 tasks complete. All 6 code commits + verification landed. Ready for `sdd-verify`.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | `e7d7c69` | `refactor(course-cycle): AddStudent + Remove use-cases return Result` |
| 2 | `f8e97c1` | `refactor(course-cycle): TogglePrintable use-case returns Result` |
| 3 | `54cb4f1` | `refactor(course-cycle): RegistrarPase returns Result, bridge PaseFechaInvalidaError` |
| 4 | `a88e761` | `refactor(course-cycle): Cascade use-case returns Result` |
| 5 | `4ca1bee` | `test(course-cycle): RED - togglePrintable controller-spec coverage (C-19..C-21)` |
| 6 | `c6e90be` | `refactor(course-cycle): controller adopts isErr/unwrapErr on 5 endpoints` |

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 3.1/3.2/3.3 — RegistrarPase bridge (S-4-B) | Confirmed: rewrote S-4-B to `isErr()`/`unwrapErr()`, ran `pnpm --filter api test registrar-pase`, test failed with the entity's `PaseFechaInvalidaError` escaping as a rejected promise (production code still threw) | Implemented the `try/catch` bridge (D3/D4) in `registrar-pase.use-case.ts`; re-ran — S-4-B green, 6/7 other tests in the file still red (expected — task 3.4 rewrites those next) | Task 3.4 rewrote the remaining 4 NotFoundError assertions + added `isOk()`/`unwrap()` asserts to S-2-A/S-2-B; full file 7/7 green |
| 5.1/6.1-6.3 — togglePrintable controller-spec (C-19..C-21) | Confirmed: added the 3 new tests against `ok`/`err`-mocked UC before touching the controller; ran the file — C-20/C-21 failed (controller resolved `undefined` instead of rejecting; `isErr()`/`unwrapErr()` guard did not exist yet). C-19 passed coincidentally (happy path needs no guard) | Phase 6 controller retrofit added the guard to `togglePrintable`; re-ran — all 3 new tests +全 29 controller-spec tests green | No further refactor needed — idiom matches the 8 existing `course-cycle.controller.ts` call sites verbatim |

All other test rewrites (Phases 1, 2, 4, and the remainder of Phase 3/registrar-pase, plus the controller-spec mock migrations in Phase 6) are **status-preserving**: `.rejects.toBeInstanceOf(X)` → `isErr()`/`unwrapErr() instanceof X`, `.rejects` happy reads → `isOk()`/`unwrap()`. These were not RED-first because they re-express already-passing assertions against the same behavior — no new coverage, no new production logic to drive out. Each was verified GREEN immediately after rewriting, before moving to the next use-case.

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `api/src/application/course-cycle/add-student-to-course-cycle.use-case.ts` | Modified | `Promise<AlumnosXCursoXCiclo>` → `Promise<Result<AlumnosXCursoXCiclo, Error>>`; both `NotFoundError` throws → `err(...)`; success → `ok(enrollment)` |
| `api/src/application/course-cycle/__tests__/add-student-to-course-cycle.use-case.test.ts` | Modified | S-07, S-06, "validates cc before student" rewritten to `isErr()`/`unwrapErr()`; S-01/S-02 happy paths assert `isOk()`/`unwrap()` |
| `api/src/application/course-cycle/remove-student-from-course-cycle.use-case.ts` | Modified | `Promise<void>` → `Promise<Result<void, Error>>`; `NotFoundError`/`StudentHasPaseError` throws → `err(...)`; success → `ok(undefined)` |
| `api/src/application/course-cycle/__tests__/remove-student-from-course-cycle.use-case.test.ts` | Modified | "cc not found", S-08, S-08 IDOR, S-5-A rewritten to `isErr()`/`unwrapErr()`; S-05/S-5-B assert `isOk()` |
| `api/src/application/course-cycle/toggle-printable.use-case.ts` | Modified | `Promise<AlumnosXCursoXCiclo>` → `Promise<Result<AlumnosXCursoXCiclo, Error>>`; `NotFoundError` throw → `err(...)`; success → `ok(updated)` |
| `api/src/application/course-cycle/__tests__/toggle-printable.use-case.test.ts` | Modified | Scenario E IDOR + "row does not exist" rewritten to `isErr()`/`unwrapErr()`; Scenario D ×2 read `result.unwrap().printable` |
| `api/src/application/course-cycle/registrar-pase.use-case.ts` | Modified | `Promise<void>` → `Promise<Result<void, Error>>`; 3 `NotFoundError` guards → `err(...)`; the `student.registrarPase`/`revertirPase` call wrapped in `try/catch`, bridging the entity's `PaseFechaInvalidaError` throw to `err(e as PaseFechaInvalidaError)`; both success branches → `ok(undefined)` |
| `api/src/application/course-cycle/__tests__/registrar-pase.use-case.test.ts` | Modified | S-4-B rewritten RED-first to prove the bridge; S-2-C, S-3-D IDOR, S-3-D missing, S-4-A rewritten to `isErr()`/`unwrapErr()`; S-2-A/S-2-B add `isOk()`/`unwrap()` asserts |
| `api/src/application/course-cycle/cascade-student-materias-competencias.use-case.ts` | Modified | `Promise<CascadeResult>` → `Promise<Result<CascadeResult, Error>>`; 1 `NotFoundError` throw → `err(...)`; all 4 success return sites wrapped in `ok(...)` — `CascadeResult` shape unchanged |
| `api/src/application/course-cycle/__tests__/cascade-student-materias-competencias.use-case.test.ts` | Modified | UC-01/UC-02 rewritten to `isErr()`/`unwrapErr()`; 5 happy-path reads (UC-03, UC-04 first test, UC-05 both, MGC-S17) wrapped in `result.unwrap()` |
| `api/src/presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.controller.ts` | Modified | 5 in-scope endpoints (`addStudent`, `removeStudent`, `togglePrintable`, `registrarPase`, `cascade`) adopt `if (result.isErr()) throw result.unwrapErr();`, unwrapping after the guard. The 4 non-in-scope endpoints untouched. |
| `api/src/presentation/course-cycle-alumnos/__tests__/alumnos-x-curso-x-ciclo.controller.spec.ts` | Modified | Added `ok`/`err` import; migrated 12 mocks (C-01/02/03/06/07/10/11/14/15/16/17/18) to `mockResolvedValue(ok(...))`/`mockResolvedValue(err(...))`; added new `describe` block with C-19/C-20/C-21 (RED-first, now GREEN) |

## Deviations from Design

None — implementation matches design.md verbatim (D1-D8), including the `e as PaseFechaInvalidaError` bare cast (flagged in design as an optional hardening, kept for precedent consistency per the reviewer note in design.md §Risks/assumptions #2).

## Issues Found

None in the migrated code. Two **pre-existing, unrelated** issues surfaced by running the full suite/build (neither touched by this diff, both confirmed via `git diff` against `main`):

1. `api/scripts/__tests__/archive-legacy-grading-data.spec.ts` — 1 test fails on Windows due to a hardcoded POSIX path separator assertion (`/tmp/archival-test/...` vs the actual `\tmp\archival-test\...` written on this OS). Not part of this change's diff.
2. `web` package build fails via `pnpm build` (turbo) — `Cannot find module '/home/usuario/proyectos/educandow/web/src/hooks/use-api'`, a stale absolute path baked into a cache/reference from a different machine's environment. `web/` is untouched by this change (only the pre-existing dirty `EducandoW4_02.jpeg` in the working tree, unrelated to git history).

## Real Test / Typecheck / Build Results

```
pnpm --filter api test add-student-to-course-cycle remove-student-from-course-cycle
  → Test Files 2 passed | Tests 11 passed

pnpm --filter api test toggle-printable
  → Test Files 1 passed | Tests 4 passed

pnpm --filter api test registrar-pase
  → RED confirmed on S-4-B before the bridge (1 failed / 6 passed)
  → GREEN after bridge (7 passed)

pnpm --filter api test cascade-student-materias-competencias
  → Test Files 1 passed | Tests 12 passed

pnpm --filter api test alumnos-x-curso-x-ciclo.controller
  → RED confirmed on C-20/C-21 before controller retrofit (2 failed / 27 passed)
  → GREEN after retrofit (29 passed)

pnpm --filter api typecheck (tsc --noEmit)
  → Clean, 0 errors

pnpm --filter api test (full suite)
  → Test Files: 1 failed | 210 passed (211)
  → Tests: 1 failed | 2153 passed (2154)
  → The 1 failure is scripts/__tests__/archive-legacy-grading-data.spec.ts (pre-existing,
    Windows path-separator bug, file untouched by this diff — confirmed via
    `git diff main -- api/scripts/__tests__/archive-legacy-grading-data.spec.ts` = empty)

pnpm --filter api build (nest build + postbuild)
  → TSC: 0 issues. SWC: 511 files compiled. postbuild copied prisma_tenant/prisma_master. GREEN.

pnpm build (root, turbo, all 3 packages)
  → @educandow/domain: cache hit, 0 issues
  → api: cache miss, built clean (see above)
  → web: FAILS — pre-existing unrelated error (stale cross-machine absolute path in a
    web/ test file); web/ is untouched by this change's diff.
```

## Review Workload / PR Boundary

- Mode: single PR (per tasks.md forecast — Chained PRs recommended: No, 400-line budget risk: Low)
- Actual changed lines: 316 (192 insertions + 124 deletions across 12 files) — within the ~225-265 median forecast, still comfortably under the 400-line budget
- Boundary: this batch covers the entire change (Phases 1-7) — no further apply batches needed
- CCAM-R6/R3 spot-checks (tasks 7.4/7.5) confirmed clean: no new error classes, no auth-module files, `course-cycle.use-cases.ts` absent from diff, `exception.filter.ts` (`DOMAIN_STATUS`) absent from diff (zero changes)

## Engram Backfill Needed

Engram `mem_save` was not invoked in this session (openspec/hybrid persistence executed via file writes — `tasks.md` `[x]` marks + this `apply-progress.md`). Orchestrator should backfill:
- `topic_key: sdd/course-cycle-alumnos-result-migration/apply-progress`
- `type: architecture`
- `capture_prompt: false`
- content: this file's contents
