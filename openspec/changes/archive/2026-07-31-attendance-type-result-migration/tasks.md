# Tasks: attendance-type-result-migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~100-140 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Move + reclassify + all import fixes + DOMAIN_STATUS removal (compilation gate) | PR 1 (single) | Must land as one atomic slice — no partial-move state |
| 2 | Throw→Result migration (use-cases) | PR 1 (single) | Depends on Unit 1 |
| 3 | Controller `list()` retrofit | PR 1 (single) | Depends on Unit 2 |
| 4 | Test assertion rewrites (Result-shape) | PR 1 (single) | Depends on Unit 1-3 |
| 5 | Spec doc + verification | PR 1 (single) | Closing unit |

## Phase 1: Move, Reclassify, Import Fixes, DOMAIN_STATUS Removal (atomic compilation gate)

- [x] 1.1 Create `api/src/application/shared/errors/attendance-type-level-out-of-scope-error.ts` — `extends ApplicationError`, ctor `(level?: number)`, `code = 'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE'`, `httpStatus = 403` (ATRM-R1, ATRM-R2)
- [x] 1.2 Add `api/src/application/shared/errors/__tests__/attendance-type-level-out-of-scope-error.test.ts` — asserts `instanceof ApplicationError`, `not.toBeInstanceOf(DomainError)`, `code`, `httpStatus === 403`, both message branches (ATRM-R1)
- [x] 1.3 Delete `packages/domain/src/attendance-type/errors/attendance-type-level-out-of-scope-error.ts` (ATRM-R2)
- [x] 1.4 Remove export line in `packages/domain/src/index.ts` (~L141) (ATRM-R2)
- [x] 1.5 Remove export line in `packages/domain/src/attendance-type/index.ts` (~L8) (ATRM-R2)
- [x] 1.6 Remove export line in `packages/domain/src/attendance-type/errors/index.ts` (~L4) (ATRM-R2)
- [x] 1.7 `attendance-type.use-cases.ts` — split import: drop symbol from `@educandow/domain`, add local import from `../../shared/errors/attendance-type-level-out-of-scope-error` (ATRM-R2)
- [x] 1.8 `generate-attendance-types-pdf.use-case.ts` — split import (drop symbol, add local import); also add **value** import `err` from `@educandow/domain` (currently only `import type { Result }`) (ATRM-R2, ATRM-R3) — DEVIATION: the `err` value import was deferred to Phase 2 (same commit as its first usage), not landed in Phase 1, because `noUnusedLocals: true` in tsconfig.base.json makes an unused import a hard compile error, which would have broken the Phase 1 compilation gate. See apply-progress.md.
- [x] 1.9 `attendance-type.use-cases.test.ts` — split import: move Scope error to local path, keep other domain symbols (ATRM-R2)
- [x] 1.10 `generate-attendance-types-pdf.use-case.test.ts` — split import: keep `ok, err` from domain, move Scope error to local path (ATRM-R2)
- [x] 1.11 `attendance-type.controller.test.ts` — split import: keep `ok, err`, domain errors, move Scope error to local path (ATRM-R2)
- [x] 1.12 `attendance-type.controller.e2e.test.ts` — split import: keep `ok, err, AttendanceType`, move Scope error to local path (ATRM-R2)
- [x] 1.13 Delete `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE: 403` from `DOMAIN_STATUS` in `exception.filter.ts` — dead now that `ApplicationError` branch (L92) catches it before `DomainError` branch (L96) (ATRM-R4)
- [x] 1.14 Run `pnpm --filter @educandow/domain build` + `pnpm --filter api typecheck` — confirm green (compilation gate) before proceeding to Phase 2

## Phase 2: Migrate Scope Denials from Throw to Result (`attendance-type.use-cases.ts` + PDF UC)

- [x] 2.1 `Create` — widen return to `Promise<Result<AttendanceType, AttendanceTypeCodeDuplicateError | AttendanceTypeLevelOutOfScopeError>>`; `throw` → `return err(new AttendanceTypeLevelOutOfScopeError(input.level))` (ATRM-R3)
- [x] 2.2 `Update` — widen return with `AttendanceTypeLevelOutOfScopeError`; `throw` → `return err(...)` (ATRM-R3)
- [x] 2.3 `Delete` — widen return with `AttendanceTypeLevelOutOfScopeError`; `throw` → `return err(...)` (ATRM-R3)
- [x] 2.4 `Get` — widen return with `AttendanceTypeLevelOutOfScopeError`; `throw` → `return err(...)` (ATRM-R3)
- [x] 2.5 `List` — change signature `Promise<AttendanceType[]>` → `Promise<Result<AttendanceType[], AttendanceTypeLevelOutOfScopeError>>`; wrap both `return this.repo.list(...)` success sites in `ok(...)`; scope-denial branch `throw` → `return err(...)` (ATRM-R3)
- [x] 2.6 `generate-attendance-types-pdf.use-case.ts` — widen `execute` return to include `AttendanceTypeLevelOutOfScopeError`; scope `throw` (L100) → `return err(...)`; leave the `:112` bare-`Error` template guard **untouched** (ATRM-R3, ATRM-R7)

## Phase 3: Controller `list()` Retrofit

- [x] 3.1 `attendance-type.controller.ts` `list()` — replace direct array return with `if (result.isErr()) throw result.unwrapErr(); return { data: result.unwrap().map(toResponse) };`; leave `create`, `getOne`, `update`, `remove`, `printList` untouched (ATRM-R5)
- [x] 3.2 (DEVIATION, not in original task list) `unwrap-result-or-throw.ts` — root-cause fix: re-throw `ApplicationError` instances as-is instead of wrapping every `err(...)` in a generic `HttpException`, which was silently discarding `error.code` from the response envelope. Discovered via the Phase 4 RED run (`printList` out-of-scope e2e test failed: `res.body.error.code` was `undefined` instead of `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE`). Non-`ApplicationError` errors (`PdfError`) keep the prior `HttpException`-wrap behavior unchanged (preserves the pre-existing PPR-S8 contract). See apply-progress.md.

## Phase 4: Test Assertion Rewrites (Result-shape)

- [x] 4.1 `attendance-type.use-cases.test.ts` — Create/Update/Delete/Get scope tests: `rejects.toBeInstanceOf(...)` → `result.isErr()`/`result.unwrapErr()` form; keep side-effect assertions (ATRM-R3, ATRM-R6)
- [x] 4.2 `attendance-type.use-cases.test.ts` `List` describe — rewrite success assertions to `result.isOk()`/`result.unwrap()`; scope-denial test to `result.isErr()`/`unwrapErr()` (ATRM-R3)
- [x] 4.3 `generate-attendance-types-pdf.use-case.test.ts` — scope test: `rejects.toBeInstanceOf(...)` → `result.isErr()`/`result.unwrapErr()` form (ATRM-R3)
- [x] 4.4 `attendance-type.controller.test.ts` — swap 5 scope mocks (`create/getOne/update/delete/printList`) from `mockRejectedValue(...)` to `mockResolvedValue(err(...))`; `.rejects.toBeInstanceOf` assertions stay (ATRM-R3, ATRM-R6)
- [x] 4.5 `attendance-type.controller.test.ts` `list` describe — wrap all success mocks in `ok(...)`; scope mock `mockRejectedValue` → `mockResolvedValue(err(...))` (ATRM-R3, ATRM-R5)
- [x] 4.6 `attendance-type.controller.test.ts` default `listUC` factory mock (~L58, used by "HTTP status codes" describe) — wrap in `ok(...)` so `result.unwrap()` succeeds (ATRM-R5)
- [x] 4.7 `attendance-type.controller.e2e.test.ts` `list` — in-scope mock `mockResolvedValueOnce([])` → `mockResolvedValueOnce(ok([]))`; out-of-scope `mockRejectedValueOnce(...)` → `mockResolvedValueOnce(err(...))` (ATRM-R3, ATRM-R4)
- [x] 4.8 `attendance-type.controller.e2e.test.ts` — create/update/delete/get out-of-scope mocks: `mockRejectedValueOnce(...)` → `mockResolvedValueOnce(err(...))`; status assertions (403/200/201/204) unchanged (ATRM-R4, ATRM-R6) — also swapped the `printList` out-of-scope mock (not explicitly listed in design §7.5 but required for consistency with the real UC's new Result-returning behavior and to exercise the Phase 3.2 fix)

## Phase 5: Docs and Verification

- [x] 5.1 Update `openspec/specs/attendance-types/spec.md` (~L840-846) — replace prose to state classification is now materialized in code as `ApplicationError`, `DOMAIN_STATUS` entry removed, 403 unchanged (ATRM-R7)
- [x] 5.2 Run `pnpm --filter @educandow/domain test` — confirm domain still builds/tests green after export removal (ATRM-R2) — 112 files, 1287 tests passed
- [x] 5.3 Run `pnpm --filter api test` — confirm green, coverage ≥ 80% (ATRM-R3, ATRM-R6) — 215/216 files, 2181/2182 tests passed; the 1 failure is the pre-existing, unrelated `archive-legacy-grading-data.spec.ts` Windows path-separator issue (confirmed via empty git diff on that file)
- [x] 5.4 Run `pnpm --filter api typecheck` — confirm clean — 0 errors
- [x] 5.5 Run `pnpm build` — confirm green across workspace — `@educandow/domain` and `api` green; `web` build fails on a pre-existing, unrelated absolute-path error in `students.test.tsx` (0 `web/` files touched by this change, confirmed via grep)
- [x] 5.6 Inspect diff — no `@educandow/domain` export of the class remains; no `web/` or `auth/` files touched; PDF `:112` bare-`Error` guard unchanged; no new `ApplicationError` base classes (ATRM-R2, ATRM-R7)

## Commit Plan (conventional, no AI attribution)

1. `refactor(attendance-type): move AttendanceTypeLevelOutOfScopeError to api as ApplicationError` — Phase 1 (commit `8a19e91`)
2. `refactor(attendance-type): migrate scope denials from throw to Result` — Phase 2 (commit `f7aa106`)
3. `refactor(attendance-type): adopt Result idiom in controller list()` — Phase 3 (commit `9dfa1fa`)
4. `fix(api): preserve ApplicationError identity in unwrapResultOrThrow` — Phase 3.2, deviation (commit `adc2139`)
5. `test(attendance-type): migrate scope assertions to Result shape` — Phase 4 (commit `a73a9ca`)
6. `docs(spec): record AttendanceTypeLevelOutOfScopeError as ApplicationError` — Phase 5.1 (commit `868b38c`)
