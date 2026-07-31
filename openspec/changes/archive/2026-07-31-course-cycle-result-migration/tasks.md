# Tasks: course-cycle-result-migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~275 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units (all one PR)

| Unit | Goal | Req | ~Lines |
|------|------|-----|--------|
| 1 | RED: `fromParts` invalid composite | CCRM-R3 | 10 |
| 2 | Fix: `fromParts` throws `ValidationError` | CCRM-R3 | 1 |
| 3 | RED: invalid level / bimonth `end≤start` | CCRM-R2 | 40 |
| 4 | Fix: `buildLevel`/`buildBimonthPeriod` → Result | CCRM-R2 | 50 |
| 5 | Refactor: Delete/ListStudents/Generate → Result | CCRM-R1,R5,R6 | 70 |
| 6 | Refactor: controller idiom adoption | CCRM-R4,R5 | 15 |
| 7 | New controller spec | CCRM-R4 | 90 |
| 8 | Final verification | CCRM-R5,R6,R7 | — |

## Work Unit 1: RED — `Level.fromParts` invalid composite (CCRM-R3)

- [x] 1.1 `packages/domain/src/institution/__tests__/value-objects/level.test.ts`: add `expect(() => Level.fromParts(5, 0)).toThrow(ValidationError)` (import `ValidationError`). Run it and confirm it FAILS today (throws bare `Error`, not `ValidationError`).

## Work Unit 2: GREEN — `Level.fromParts` throws `ValidationError` (CCRM-R3)

- [x] 2.1 `packages/domain/src/institution/value-objects/level.ts` (~line 223): `throw new Error(...)` → `throw new ValidationError(...)`. Keep signature `static fromParts(...): Level` unchanged.
- [x] 2.2 Run `level.test.ts` — new test GREEN; existing `fromParts(PRIMARIO, TALLERES)` regression (~line 195-199) still passes unchanged (retrocompat for 6+ callers).

## Work Unit 3: RED — invalid level / bimonth `end≤start` (CCRM-R2)

- [x] 3.1 `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts`: add test — `Create` with unparseable/out-of-range `level` → expect `isErr()` + `instanceof ValidationError`; confirm FAILS today (throws, 500).
- [x] 3.2 Same file: add test — `Create` with bimonth `end ≤ start` → expect `isErr()` + `instanceof ValidationError`; confirm FAILS.
- [x] 3.3 Same file: add test — `Update` with bimonth `end ≤ start` → expect `isErr()` + `instanceof ValidationError`; confirm FAILS.

## Work Unit 4: GREEN — `buildLevel`/`buildBimonthPeriod` return `Result` (CCRM-R2)

- [x] 4.1 `course-cycle.use-cases.ts`: `buildLevel` → `Result<Level, ValidationError>`; on double-fail (string + numeric) return the original `err` from the string attempt.
- [x] 4.2 `course-cycle.use-cases.ts`: `buildBimonthPeriod` → `Result<BimonthPeriod | null, ValidationError>`; missing `start`/`end` → `ok(null)` (not an error).
- [x] 4.3 `CreateCourseCycleUseCase`: propagate `err(...)` at `buildLevel` and all 4 `buildBimonthPeriod` call sites instead of unguarded calls.
- [x] 4.4 `UpdateCourseCycleUseCase`: propagate `err(...)` in the 4 guarded (`if (start && end)`) bimonth blocks.
- [x] 4.5 Run the 3 RED tests from Unit 3 — confirm GREEN (500→400 corrected).

## Work Unit 5: Delete/ListStudents/Generate → `Result` (CCRM-R1, R5, R6)

- [x] 5.1 `course-cycle.use-cases.ts`: `DeleteCourseCycleUseCase.execute` → `Promise<Result<void, Error>>`; not-found → `err(CourseCycleNotFoundError)` (404, unchanged); `!cc.active` → `err(CourseCycleClosedError)` (409, unchanged, predicate check on `cc.active`, no try/catch); import `CourseCycleClosedError` from `@educandow/domain`.
- [x] 5.2 `course-cycle.use-cases.ts`: `ListStudentsByCourseCycleUC.execute` → `Promise<Result<EnrolledStudent[], Error>>`; not-found → `err(CourseCycleNotFoundError)`; rewrite JSDoc (drop "Throws").
- [x] 5.3 `course-cycle.use-cases.ts`: `GenerateCourseCyclesUseCase.execute` → `Promise<Result<CreateManyResult, Error>>`; migrate ONLY the 3 top-level guards (AcademicCycle not-found/inactive, StudyPlan not-found) to `err(...)`; loop internals (`Level.fromParts`, `CourseName`/`PassingGrade` `.unwrap()`) UNCHANGED (CCRM-R6 all-or-nothing preserved).
- [x] 5.4 `course-cycle.use-cases.test.ts`: rewrite `Delete` inactive-cycle test (`.rejects.toThrow(CourseCycleClosedError)` → `isErr()` + `instanceof`); rewrite `Delete` success test (assert `result.isOk()`, `softDelete` called). Added a `Delete` not-found rewrite too (`isErr()` + `instanceof CourseCycleNotFoundError`).
- [x] 5.5 `course-cycle.use-cases.test.ts`: rewrite `ListStudents` not-found test (`.rejects.toThrow` → `isErr()` + `instanceof`); rewrite success/empty tests (unwrap `Result` before length/equality asserts).
- [x] 5.6 `course-cycle.use-cases.test.ts`: rewrite `Generate` StudyPlan/AcademicCycle not-found and inactive tests (`.rejects.toThrow` → `isErr()` + `instanceof`); rewrite all-or-nothing/success-count tests (unwrap `Result`, e.g. `(await …).unwrap().created`).
- [x] 5.7 `course-cycle.use-cases.test.ts`: add RED-then-GREEN test — `Generate` with a plan level/modality composing an invalid code (e.g. level=5) → `execute` throws `ValidationError` (loop escape via Unit 2 fix); assert `.rejects.toThrow(ValidationError)` (CCRM-R3, generate path, 4xx not 500).

## Work Unit 6: Controller adopts `if (isErr) throw unwrapErr()` (CCRM-R4, R5)

- [x] 6.1 `api/src/presentation/course-cycle/course-cycle.controller.ts` `listStudents`: `if (result.isErr()) throw result.unwrapErr(); return { data: result.unwrap() };`
- [x] 6.2 Same file, `delete`: `if (result.isErr()) throw result.unwrapErr();` before the void 204 return; keep `@HttpCode(HttpStatus.NO_CONTENT)`.
- [x] 6.3 Same file, `generate`: `if (result.isErr()) throw result.unwrapErr(); return { data: result.unwrap() };`
- [x] 6.4 (Divergence, not in original plan) `api/src/presentation/course-cycle/__tests__/course-cycle.dto.test.ts` SBC-1/2/3 (`listStudents`) pre-existing tests mocked `listStudentsUC.execute` to resolve/reject a plain array/error — incompatible with the new `Result` contract. Rewrote them to mock `Result`-shaped resolves (`{ isOk, isErr, unwrap/unwrapErr }`), consistent with the existing CCM-1/CCM-2 pattern in the same file.

## Work Unit 7: New controller spec (CCRM-R4)

- [x] 7.1 Create `api/src/presentation/course-cycle/__tests__/course-cycle.controller.spec.ts`, modeled on the existing `__tests__/grading-phase.controller.spec.ts` (same directory, same idiom).
- [x] 7.2 Test `listStudents`: err result → controller rethrows `CourseCycleNotFoundError` (→404).
- [x] 7.3 Test `delete`: err result → rethrows `CourseCycleClosedError` (→409) / `CourseCycleNotFoundError` (→404); ok result → void (204).
- [x] 7.4 Test `generate`: err result → rethrows `NotFoundError`/`AcademicCycleClosedError`; ok result → `{ data }`.

## Work Unit 8: Final verification (CCRM-R5, R6, R7)

- [x] 8.1 Run `pnpm --filter api test` — full suite GREEN except 1 pre-existing unrelated failure (`archive-legacy-grading-data.spec.ts`, Windows path-separator issue, untouched by this diff, confirmed via `git diff main` = empty for that file). Course-cycle-scoped coverage 79-88% depending on metric (no enforced threshold in `vitest.config.ts`); gaps are in pre-existing untouched code paths.
- [x] 8.2 Run `pnpm --filter api typecheck` — clean (0 issues) after generating the missing `@prisma/tenant-client` (pre-existing environment gap, fixed via `pnpm --filter api prisma:generate`, unrelated to this change's code).
- [x] 8.3 Run `pnpm --filter api build` — GREEN (SWC compiled 512 files, 0 TSC issues). Root `pnpm build` fails only on `web#build` due to a pre-existing stale absolute Linux path in `web/src/pages/dashboard/__tests__/students.test.tsx` (`/home/usuario/proyectos/...`) — zero web/ files in this change's diff, confirmed unrelated.
- [x] 8.4 Inspect diff: no new file under `api/src/application/shared/errors/` or `packages/domain/src/**/errors/` (CCRM-R7 — no new error class). Verified via `git diff --name-only main..refactor/course-cycle-result-migration`.
- [x] 8.5 Inspect diff: no file under the `auth` module appears (CCRM-R7 — auth untouched). Verified via the same diff inspection.
