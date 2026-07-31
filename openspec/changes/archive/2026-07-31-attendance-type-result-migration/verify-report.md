# Verify Report — attendance-type-result-migration

**Branch**: `refactor/attendance-type-result-migration` (6 commits on `main` @ `3e0d147`)
**Mode**: hybrid (openspec file + engram backfill noted)
**Verdict**: **PASS** (0 CRITICAL, 1 WARNING, 1 SUGGESTION)

## 1. Diff inspection

`git diff main..HEAD --stat`: **15 files changed, 134 insertions(+), 86 deletions(-)**. Matches apply-progress claim exactly.

- No `web/` files in diff (confirmed via `--name-only`).
- No `auth/` files in diff (confirmed via `--name-only | grep -i "auth/"` -> 0 hits).
- Class file confirmed **deleted** from `packages/domain/src/attendance-type/errors/attendance-type-level-out-of-scope-error.ts` (commit `8a19e91`; `git show HEAD:<path>` -> `fatal: does not exist`).
- Class file confirmed **created** at `api/src/application/shared/errors/attendance-type-level-out-of-scope-error.ts`, `extends ApplicationError`, `httpStatus = 403` (verified via `git show HEAD:<path>`).
- Repo-wide grep for `AttendanceTypeLevelOutOfScopeError` -> 20 hits, all under `api/` or `openspec/` (docs/history). Zero hits under `packages/domain` or `web/`.

## 2. Test re-run (independent, not trusting apply-progress numbers)

| Command | Result |
|---|---|
| `pnpm --filter @educandow/domain build` | green, 0 errors |
| `pnpm --filter @educandow/domain test` | 112/112 files, 1287/1287 tests passed |
| `pnpm --filter api typecheck` | 0 errors |
| `pnpm --filter api test` | 215/216 files, 2181/2182 tests passed |

The 1 failure: `scripts/__tests__/archive-legacy-grading-data.spec.ts > Scenario A > escribe los 5 archivos con paths {tenant-slug}/{tabla}.json` (Windows path-separator assertion). Proven pre-existing/unrelated: `git diff main -- scripts/__tests__/archive-legacy-grading-data.spec.ts` -> empty diff, 0 lines. Confirmed independently.

All numbers match apply-progress.md exactly - no discrepancy found.
## 3. Per-requirement verification (source-cited)

### ATRM-R1 - Classification - PASS
`api/src/application/shared/errors/attendance-type-level-out-of-scope-error.ts:3` -> `extends ApplicationError`; ctor passes `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE` and `403` to `super()`.
Test `api/src/application/shared/errors/__tests__/attendance-type-level-out-of-scope-error.test.ts:8-15` asserts `toBeInstanceOf(ApplicationError)`, `.not.toBeInstanceOf(DomainError)`, `code`, `httpStatus === 403`, both message branches (level given / omitted). Ran and passed as part of the full `api test` run.

### ATRM-R2 - Layering - PASS
- `git show HEAD:packages/domain/src/attendance-type/errors/attendance-type-level-out-of-scope-error.ts` -> file does not exist (deleted).
- Export lines removed from all 3 domain index files (`packages/domain/src/index.ts`, `src/attendance-type/index.ts`, `src/attendance-type/errors/index.ts`) - confirmed via `git diff`.
- `@educandow/domain` test suite (112/112, 1287/1287) green after the removal, proving no dangling reference inside domain.
- Zero hits under `packages/domain` in the repo-wide grep.

### ATRM-R3 - No throw for scope denials - PASS
`attendance-type.use-cases.ts`: read in full (211 lines) - zero `throw` statements remain. All 5 use cases (Create L46-69, Update L83-126, Delete L132-159, Get L191-211, List L165-185) return `err(new AttendanceTypeLevelOutOfScopeError(...))`. `List` signature is `Promise<Result<AttendanceType[], AttendanceTypeLevelOutOfScopeError>>` (L172), both success branches wrapped in `ok(...)` (L176, L183).
`generate-attendance-types-pdf.use-case.ts:103` -> `return err(new AttendanceTypeLevelOutOfScopeError(level));` (was `throw` - confirmed via `git diff`). Line 115 (`throw new Error('Template attendance-types.hbs no encontrado')`) is untouched - confirmed via `git diff` showing that hunk unchanged.

### ATRM-R4 - HTTP 403 preserved - PASS (highest-scrutiny item, independently verified)
- `exception.filter.ts`: `ApplicationError` branch (L91) precedes `DomainError` branch (L95) - confirmed via grep with line numbers.
- `unwrapResultOrThrow` (`api/src/presentation/shared/http/unwrap-result-or-throw.ts:24-36`) now special-cases `ApplicationError`: `if (error instanceof ApplicationError) { throw error; }` (re-thrown as-is, preserving `instanceof` + `code`); non-`ApplicationError` errors (`PdfError`) fall through to the unchanged original `HttpException` wrap (verified line-by-line against the described fix - matches apply-progress claim exactly, no additional undisclosed changes).
- End-to-end proof via REAL HTTP pipeline (not just unit mocks): `attendance-type.controller.e2e.test.ts:238-246` - `GET /attendance-types/print?level=<out-of-scope>` through `request(app.getHttpServer())` (real guards + real `AppExceptionFilter`) asserts `res.status === 403` and `res.body.error.code === 'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE'`. This test is part of the 2181 passing tests re-run above.
- Both contradictory pre-existing/new unit tests on the same `printList` path verified: `(PPR-S8) err(PdfError) -> HttpException(500)` (`attendance-type.controller.test.ts:392-407`) and `propagates AttendanceTypeLevelOutOfScopeError... mapped to 403` (`:378-388`) - both present and passing.
- Regression-risk check on other `unwrapResultOrThrow` consumers (the explicit high-risk item): grepped all callers - `asistencia-reporting.controller.ts` and `reportes.controller.ts` are the only other production consumers. Their use-case signatures: `generate-asistencia-mensual-pdf.use-case.ts` -> `Promise<Result<Buffer, PdfError>>`; `generate-boletin.use-case.ts` / `generate-constancia-regular.use-case.ts` -> `Promise<Result<Buffer, PdfError>>`. Their underlying `AsistenciaReportingError`/`ConstanciaError`/`BoletinError` classes all `extends Error` directly (not `ApplicationError`, not `PdfError`) - confirmed by reading their class declarations. Since these use cases' public return type never includes `ApplicationError`, the new `if (error instanceof ApplicationError)` branch is structurally unreachable for these two other consumers - it is dead code for them, and their behavior is byte-for-byte unchanged. The fix is minimal and correctly scoped.

### ATRM-R5 - Controller `list()` idiom - PASS
`attendance-type.controller.ts` diff shows only the `list()` method changed (`if (result.isErr()) throw result.unwrapErr(); return { data: result.unwrap().map(toResponse) };`). `create`, `getOne`, `update`, `remove` (already using the same idiom) and `printList` (still `unwrapResultOrThrow`) are untouched - confirmed via `git diff` showing a single hunk at L80-86.

### ATRM-R6 - No regression on other errors - PASS
`git diff` on `attendance-type.use-cases.test.ts` shows only Scope-error-related assertion rewrites; all `AttendanceTypeCodeDuplicateError`/`SystemAttendanceTypeError`/`AttendanceTypeNotFoundError` tests and production code paths are untouched (not present in the diff hunks at all).

### ATRM-R7 - Scope and guardrails - PASS
- `git diff --name-status -- api/src/application/shared/errors/` shows only 2 new files (the class + its test) - no other new base classes.
- `generate-attendance-types-pdf.use-case.ts:115` bare-Error guard confirmed untouched via diff.
- 0 `auth/` files in the diff.
- `openspec/specs/attendance-types/spec.md` L840-846 updated: prose now states the classification is materialized in code as `ApplicationError`, `DOMAIN_STATUS` entry removed, 403 identical before/after - confirmed via diff.

## 4. No AI attribution
`git log main..HEAD --format=%B | grep -iE 'co-authored|claude|anthropic'` -> 0 matches. Clean.

## 5. DOMAIN_STATUS removal
`exception.filter.ts` diff confirms the single-line removal of `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE: 403,` from `DOMAIN_STATUS`, with the `ApplicationError` branch (evaluated before `DomainError`) now supplying the 403 - confirmed structurally and via the passing e2e test.
## Issues

### WARNING - shared helper's own unit test suite doesn't directly cover the new branch
`unwrap-result-or-throw.test.ts` (the co-located unit test file for the modified shared helper) still only has 2 tests: `(PPR-S6) err(pdfError) -> HttpException(500)` and `(PPR-S7) ok(buffer)`. Running this file in isolation with coverage shows line 28 (`throw error;`, the new `ApplicationError` branch) is NOT covered (83.33% stmts / 75% branch, "Uncovered Line #s: 28"). The new branch is only exercised indirectly through the `attendance-type` controller/e2e tests (`printList` scope-denial cases), not by a direct unit test in the helper's own suite. This is a real (if currently harmless) gap: if the `attendance-type` feature tests are ever refactored/removed, a future regression in this shared, multi-consumer helper could go undetected by its own test file. Recommend adding a direct `(PPR-S10) err(ApplicationError subclass) -> re-thrown as-is, preserving instanceof + code` case to `unwrap-result-or-throw.test.ts` itself.

### SUGGESTION - coverage command was not completed in apply-progress
`pnpm --filter api test:coverage` reportedly aborted before printing a summary (same pre-existing unrelated failure). Verified independently via scoped `vitest run --coverage` on the touched directories: `attendance-type.controller.ts` 97.36% stmts/94.44% branch, `generate-attendance-types-pdf.use-case.ts` 97.56% stmts/80.76% branch (only uncovered line is the untouched `:115` infra guard, as expected), `use-cases` directory 99%/92.42%. All changed logic branches for this migration are covered; only the pre-existing full-suite coverage report is blocked by the unrelated Windows failure. No action required beyond fixing that unrelated bug in a separate change.

## Tasks vs code state
All 39 tracked sub-tasks in `tasks.md` are marked `[x]` and match the actual commits/diff (6 commits, matching the stated commit plan + 1 documented deviation). `apply-progress.md`'s D1 and D2 deviations were independently verified against the diff and are accurate, not overstated.

## Final Verdict: PASS
0 CRITICAL, 1 WARNING, 1 SUGGESTION. Safe to proceed to `sdd-archive`.
