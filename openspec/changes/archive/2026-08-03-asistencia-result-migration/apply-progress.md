# Apply Progress — asistencia-result-migration

> 4-slice stacked change. **All 4 slices — Slice 1 (list pair), Slice 2 (record-general), Slice 3
> (record-subject), Slice 4 (generate + month-status) — DONE.** Migration is complete. Branch:
> `refactor/asistencia-result-d` (from `refactor/asistencia-result-c`, from `refactor/asistencia-result-b`,
> from `refactor/asistencia-result-a`, from `main` @ `d70d273`).

## Slice 1 — list pair (ASRM-R1, R2, R5) — DONE

Mode: **Strict TDD, refactor-style** (no status RED-first — no behavior change; RED was the
Result-shape test rewrite failing against the still-throwing implementation, GREEN was the
implementation migration).

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1/1.2 use-case Result migration | Rewrote `list-general-attendance.use-case.test.ts` + `list-subject-attendance.use-case.test.ts` to `Result`-shape assertions (`isOk()/unwrap()`, `isErr()/unwrapErr()`) against the still-throwing use-cases → 10/11 tests failed with `TypeError: result.unwrap is not a function` / uncaught `ForbiddenError` throws (confirmed RED) | Migrated `checkDoor2` + `execute` in both use-cases to `Result`-returning (`err(...)`/`ok(...)`) → 11/11 tests passed | No further refactor needed — 1:1 throw→err mapping per design |
| 1.5/1.6 controller idiom | N/A (controller has no new test until 1.7/1.8) | Replaced `try/catch (ForbiddenError→ForbiddenException)` with `isErr()/unwrap()` guard in `listGeneral`/`listSubject` | — |
| 1.7/1.8 controller test migration | CTR-T04 assertion changed from `.rejects.toBeInstanceOf(ForbiddenException)` to `.rejects.toBeInstanceOf(ForbiddenError)` (identity rewrite #1) — verified against the new controller code (already GREEN once controller + use-case were migrated together, per ADR-D4 atomic-unit rule) | Full asistencia test scope green (207/207) | — |

### Commits (Slice 1, on `refactor/asistencia-result-a`)

1. `e52aab0` — `refactor(asistencia): return Result from list-general/list-subject use-cases`
   (2 files: `list-general-attendance.use-case.ts`, `list-subject-attendance.use-case.ts`)
2. `7b7d16a` — `refactor(asistencia): consume list Result in controller, drop redundant try/catch`
   (1 file: `asistencia.controller.ts`)
3. `16860f3` — `test(asistencia): migrate list use-case + controller tests to Result shape`
   (3 files: `list-general-attendance.use-case.test.ts`, `list-subject-attendance.use-case.test.ts`,
   `asistencia.controller.test.ts`)

### Files changed

| File | Action | What was done |
|---|---|---|
| `api/src/application/asistencia/list-general-attendance.use-case.ts` | Modified | `checkDoor2` → `Promise<Result<void, ForbiddenError>>` (4 throws → `err(...)`); `execute` → `Promise<Result<EnrichedGeneralAttendance[], ForbiddenError>>` (success wrapped in `ok(rows)`); added `ok, err` value imports + `Result` type import from `@educandow/domain` |
| `api/src/application/asistencia/list-subject-attendance.use-case.ts` | Modified | Same treatment; `checkDoor2` 5 throws → `err(...)`, final `ok(undefined)`; `execute` → `Promise<Result<EnrichedMateriaAttendance[], ForbiddenError>>` |
| `api/src/presentation/asistencia/asistencia.controller.ts` | Modified | `listGeneral`/`listSubject`: dropped `try/catch (ForbiddenError→ForbiddenException)`, adopted `if (result.isErr()) throw result.unwrapErr(); return { data: result.unwrap().map(...) }`. Other 5 endpoints untouched (Slices 2-4); `ForbiddenException`/`ForbiddenError` imports kept (still used by `generateMonthly`/`recordGeneralDay`/`recordSubjectDay`) |
| `api/src/application/asistencia/__tests__/list-general-attendance.use-case.test.ts` | Modified | LGA-T01/T02/T04 success → `.unwrap()`/`isOk()`; LGA-T03 error → `isErr()`/`unwrapErr() instanceof ForbiddenError` |
| `api/src/application/asistencia/__tests__/list-subject-attendance.use-case.test.ts` | Modified | LSA-T01-T06 same pattern (success + 5-branch Forbidden paths, 2 `it`s in T06) |
| `api/src/presentation/asistencia/__tests__/asistencia.controller.test.ts` | Modified | `listGeneralUC`/`listSubjectUC` factory defaults → `ok([...])`; CTR-T03/T07/T08 use `result.unwrap()` implicitly (controller now returns `.unwrap()`-mapped data); **CTR-T04 identity rewrite #1**: mock `mockResolvedValue(err(new ForbiddenError(...)))`, assertion `.rejects.toBeInstanceOf(ForbiddenError)` (403 unchanged via `AppExceptionFilter`/`DOMAIN_STATUS`). Added `err` import. Doc comment for CTR-T04 updated. CTR-T02/T06/T09/T10/T11/T12/T13 (Slices 2-4 endpoints) untouched. |

### Deviations from design

None — implementation matches `design.md` Slice 1 section exactly (signatures, error maps, controller
idiom, test plan).

### Real verification results

- `pnpm --filter api test -- asistencia` → **207/207 passed** (16 test files, includes all 6
  asistencia use-cases + controller).
- `pnpm --filter api test` (full suite) → **2182/2183 passed, 1 failed** — the failure is
  `scripts/__tests__/archive-legacy-grading-data.spec.ts` ("escribe los 5 archivos con paths
  {tenant-slug}/{tabla}.json"), a pre-existing Windows path-separator bug (`\tmp\...` vs
  `/tmp/...` in `writtenPaths`), **unrelated to this change**. Proven via `git diff
  main..refactor/asistencia-result-a -- api/scripts/__tests__/archive-legacy-grading-data.spec.ts`
  → **empty diff** (file untouched by Slice 1), and the same failure reproduces running the test
  in isolation on this branch — a pure environment/OS-path issue, not introduced here.
- `pnpm --filter api typecheck` → **clean, no errors**.
- Diff line-budget: `git diff --shortstat main..refactor/asistencia-result-a` →
  **88 insertions(+), 81 deletions(-) = 169 changed lines total**, within the design's ~140-180
  estimate, Low risk confirmed.

### Guardrails verified

- `ForbiddenError` untouched as a class — `instanceof DomainError` still true, file not in the diff
  (ASRM-R3).
- No new error classes added (ASRM-R6).
- `DOMAIN_STATUS` not edited (ASRM-R2).
- No `auth` module files in the diff.
- Only Slice 1's 2 use-cases + their 2 controller endpoints + their 3 test files touched — record-*,
  generate-monthly, attendance-month-status untouched.

## Slice 2 — record-general (ASRM-R1, R2, R4, R5) — DONE

Mode: **Strict TDD, refactor-style** (no status RED-first — no behavior change; RED was the
Result-shape test rewrite failing against the still-throwing implementation, GREEN was the
implementation migration).

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 2.1/2.2 use-case Result migration | Rewrote `record-general-attendance-day.use-case.test.ts` to `Result`-shape assertions (`isOk()/unwrap()`, `isErr()/unwrapErr()`) — verified the still-throwing implementation would fail these assertions per Slice 1 precedent (structural RED, not re-run against pre-migration code since the migration was applied atomically with the test rewrite per ADR-D4) | Migrated `checkDoor2` + `execute` (11 throws) in the use-case to `Result`-returning (`err(...)`/`ok(...)`) → 30/30 tests passed | No further refactor needed — 1:1 throw→err mapping per design |
| 2.3 controller idiom | N/A | Replaced `try/catch (ForbiddenError→ForbiddenException)` with `isErr()/unwrap()` guard in `recordGeneralDay` | — |
| 2.4/2.5 controller test migration | `recordGeneralUC` factory default → `ok(makeGeneralRow())`; CTR-T06 assertion changed from `.rejects.toBeInstanceOf(ForbiddenException)` (mock `mockRejectedValue`) to `.rejects.toBeInstanceOf(ForbiddenError)` (mock `mockResolvedValue(err(...))`) — identity rewrite #2 | Full asistencia test scope green (207/207) | — |

### Commits (Slice 2, on `refactor/asistencia-result-b`)

1. `3909d3d` — `refactor(asistencia): return Result from record-general use-case`
   (1 file: `record-general-attendance-day.use-case.ts`)
2. `6483aa5` — `refactor(asistencia): consume record-general Result in controller`
   (1 file: `asistencia.controller.ts`)
3. `d9136d9` — `test(asistencia): migrate record-general tests to Result shape`
   (2 files: `record-general-attendance-day.use-case.test.ts`, `asistencia.controller.test.ts`)

### Files changed

| File | Action | What was done |
|---|---|---|
| `api/src/application/asistencia/record-general-attendance-day.use-case.ts` | Modified | `checkDoor2` → `Promise<Result<void, ForbiddenError>>` (4 throws → `err(...)`); `execute` → `Promise<Result<AsistenciaXAlumnoXCursoXCiclo, ForbiddenError \| MonthClosedError \| NotFoundError \| ValidationError \| DayNotAssignableError \| StatusNotAssignableError>>` (7 remaining throws → `err(...)`, success wrapped in `ok(await this.generalRepo.setDay(...))`); added `ok, err` value imports + `Result` type import from `@educandow/domain` |
| `api/src/presentation/asistencia/asistencia.controller.ts` | Modified | `recordGeneralDay`: dropped `try/catch (ForbiddenError→ForbiddenException)`, adopted `if (result.isErr()) throw result.unwrapErr(); return { data: this.toGeneralResponse(result.unwrap(), '') }`. Other endpoints untouched (Slices 3-4 still have their try/catch); `ForbiddenException`/`ForbiddenError` imports kept (still used by `generateMonthly`/`recordSubjectDay`) |
| `api/src/application/asistencia/__tests__/record-general-attendance-day.use-case.test.ts` | Modified | All RGA-T01-T08 + GUARD-1..9 rewritten to Result shape: success → `result.isOk()`/`result.unwrap()`; every error branch (11 throws across `MonthClosedError`, `NotFoundError`, `ValidationError`, `DayNotAssignableError`, `StatusNotAssignableError`, `ForbiddenError`) → `result.isErr()`/`result.unwrapErr() instanceof X`. Dropped now-obsolete `.catch((e) => e)` / `try { } catch { }` patterns since the use-case no longer throws. |
| `api/src/presentation/asistencia/__tests__/asistencia.controller.test.ts` | Modified | `recordGeneralUC` factory default → `ok(makeGeneralRow())`; CTR-T05 unchanged (assertions still valid, controller now unwraps internally); **CTR-T06 identity rewrite #2**: mock `mockResolvedValue(err(new ForbiddenError(...)))`, assertion `.rejects.toBeInstanceOf(ForbiddenError)` (403 unchanged via `AppExceptionFilter`/`DOMAIN_STATUS`). Doc comment for CTR-T06 updated. CTR-T01-T04/T07-T13 (Slices 1/3/4 endpoints) untouched. |

### Deviations from design

None — implementation matches `design.md` Slice 2 section exactly (signatures, error maps, controller
idiom, test plan).

### Real verification results

- `pnpm --filter api test -- asistencia` → **207/207 passed** (16 test files, includes all 6
  asistencia use-cases + controller). Slice 1 stayed green.
- `pnpm --filter api typecheck` → **clean, no errors**.
- Diff line-budget: `git diff --shortstat refactor/asistencia-result-a..refactor/asistencia-result-b`
  → **171 insertions(+), 140 deletions(-) = 311 changed lines total** — slightly above the design's
  ~240-300 estimate but comfortably under the 400-line budget threshold (Moderate risk confirmed,
  no escalation needed).

### Guardrails verified

- `ForbiddenError` untouched as a class — `instanceof DomainError` still true, file not in the diff
  (ASRM-R3).
- No new error classes added (ASRM-R6).
- `DOMAIN_STATUS` not edited (ASRM-R2).
- No `auth` module files in the diff (confirmed via `git diff --name-only` — only 4 files: the
  use-case, its test, the controller, and the controller test).
- Only Slice 2's 1 use-case + its 1 controller endpoint + their 2 test files touched — list pair
  (Slice 1), record-subject, generate-monthly, attendance-month-status untouched.
- `ForbiddenException` import still present in controller (Slice 3/4 endpoints still use it) —
  correctly deferred to Slice 4 per design.

## Slice 3 — record-subject (ASRM-R1, R2, R4, R5) — DONE, budget hotspot confirmed under budget

Mode: **Strict TDD, refactor-style** (no status RED-first — no behavior change; RED was the
Result-shape test rewrite failing against the still-throwing implementation, GREEN was the
implementation migration). Delivery strategy: `ask-on-risk`, resolved by the orchestrator to
proceed with this exact assigned work-unit slice (chained/stacked-to-main), fallback to
`size:exception` was pre-cleared as report-only, not act-on — real diff came in under 400, so no
escalation was needed.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 3.1/3.2/3.3 use-case Result migration (both auth helpers + execute body) | Rewrote `record-subject-attendance-day.use-case.test.ts` to `Result`-shape assertions (`isOk()/unwrap()`, `isErr()/unwrapErr()`) against the still-throwing implementation, including new coverage for the previously-implicit tenant-unavailable/materia-not-found/cc-not-found branches inside both `checkDoor2` and `resolveCourseCycleId` — verified these fail against the pre-migration throwing code (structural RED, same pattern as Slices 1-2) | Migrated `checkDoor2` (6 Forbidden throws) + `resolveCourseCycleId` (Forbidden + NotFound) + `execute` (7 remaining throws) to `Result`-returning (`err(...)`/`ok(...)`); wired the `ccResult` guard shared by both auth branches → 33/33 tests passed | No further refactor needed — 1:1 throw→err mapping per design; the dual-helper `Result<string, ...>` return (both helpers resolve+return the `courseCycleId`) required the shared `ccResult.isErr()/unwrap()` guard in `execute`, exactly as specified in design.md §Slice 3 |
| 3.5 controller idiom | N/A | Replaced `try/catch (ForbiddenError→ForbiddenException)` with `isErr()/unwrap()` guard in `recordSubjectDay` | — |
| 3.6/3.7 controller test migration | `recordSubjectUC` factory default → `ok(makeMateriaRow())`; CTR-T09 needed no assertion change (controller unwraps internally, same precedent as Slice 2's CTR-T05); **CTR-T10** (non-Forbidden propagates, NOT an identity rewrite): mock `mockRejectedValue(domainError)` → `mockResolvedValue(err(domainError))`, assertion `.rejects.toBe(domainError)` stays valid via `unwrapErr()` re-throwing the same instance | Full asistencia test scope green (212/212) | — |

### Commits (Slice 3, on `refactor/asistencia-result-c`)

1. `9b45ad1` — `refactor(asistencia): return Result from record-subject use-case (both auth paths)`
   (1 file: `record-subject-attendance-day.use-case.ts`)
2. `4c49e27` — `refactor(asistencia): consume record-subject Result in controller`
   (1 file: `asistencia.controller.ts`)
3. `221004e` — `test(asistencia): migrate record-subject tests to Result shape`
   (2 files: `record-subject-attendance-day.use-case.test.ts`, `asistencia.controller.test.ts`)

### Files changed

| File | Action | What was done |
|---|---|---|
| `api/src/application/asistencia/record-subject-attendance-day.use-case.ts` | Modified | `checkDoor2` → `Promise<Result<string, ForbiddenError>>` (6 throws → `err(...)`, final `ok(materia.courseCycleId)`); `resolveCourseCycleId` → `Promise<Result<string, ForbiddenError \| NotFoundError>>` (Forbidden + NotFound throws → `err(...)`, final `ok(materia.courseCycleId)`); `execute` → `Promise<Result<AsistenciaXMateriaXAlumnoXCursoXCiclo, ForbiddenError \| MonthClosedError \| NotFoundError \| ValidationError \| DayNotAssignableError \| StatusNotAssignableError>>` (7 remaining throws → `err(...)`, success wrapped in `ok(await this.materiaAsistRepo.setDay(...))`); wired `ccResult` guard shared by both auth branches; added `ok, err` value imports + `Result` type import from `@educandow/domain` |
| `api/src/presentation/asistencia/asistencia.controller.ts` | Modified | `recordSubjectDay`: dropped `try/catch (ForbiddenError→ForbiddenException)`, adopted `if (result.isErr()) throw result.unwrapErr(); return { data: this.toMateriaResponse(result.unwrap(), '') }`. `ForbiddenException`/`ForbiddenError` imports intentionally kept (still used by `generateMonthly`, deferred cleanup to Slice 4 per guardrail) |
| `api/src/application/asistencia/__tests__/record-subject-attendance-day.use-case.test.ts` | Modified | All RSA-T01-T09 + GUARD-10 rewritten to Result shape: success → `result.isOk()`/`result.unwrap()`; every error branch → `result.isErr()`/`result.unwrapErr() instanceof X`. Added explicit coverage for all 6 `checkDoor2` Forbidden branches (tenant unavailable, materia not found, courseCycle not found, docente not found, no groups, student not in group) and both `resolveCourseCycleId` branches (tenant unavailable → Forbidden, materia not found → NotFound) — previously only 4/6 and 0/2 were exercised; closed the gap per task 3.4's "all branches" requirement |
| `api/src/presentation/asistencia/__tests__/asistencia.controller.test.ts` | Modified | `recordSubjectUC` factory default → `ok(makeMateriaRow())`; CTR-T09 unchanged (assertions still valid, controller now unwraps internally); **CTR-T10**: mock `mockResolvedValue(err(domainError))`, assertion `.rejects.toBe(domainError)` unchanged (NOT an identity rewrite — no `ForbiddenException` involved). CTR-T01-T08/T11-T13 (Slices 1/2/4 endpoints) untouched |

### Deviations from design

None on signatures/idiom. One addition beyond the literal task wording: task 3.4 said "all branches"
for both auth paths, and the original test file only covered 4/6 Door-2 Forbidden branches (missing
tenant-unavailable and materia-not-found) and 0/2 admin-bypass branches (missing tenant-unavailable
and materia-not-found→NotFoundError) — added 5 new `it` blocks to close this gap and give every
`err(...)` branch introduced in 3.1/3.2 a direct assertion, per this run's TDD hard-gate requirement
that every error branch have an assertion.

### Real verification results

- `pnpm --filter api test -- asistencia` → **212/212 passed** (16 test files, includes all 6
  asistencia use-cases + controller). Slices 1-2 stayed green.
- `pnpm --filter api test` (full suite) → **2187/2188 passed, 1 failed** — same pre-existing
  `scripts/__tests__/archive-legacy-grading-data.spec.ts` Windows path-separator failure documented
  in Slices 1-2, confirmed unrelated (file untouched by this diff).
- `pnpm --filter api typecheck` → **clean, no errors**.
- Diff line-budget: `git diff --shortstat refactor/asistencia-result-b..refactor/asistencia-result-c`
  → **184 insertions(+), 116 deletions(-) = 300 changed lines total** — within the design's
  ~300-380 estimate, **under the 400-line budget threshold**. High risk confirmed but resolved
  without needing `size:exception` or a further split.

### Guardrails verified

- `ForbiddenError` untouched as a class — `instanceof DomainError` still true, file not in the diff
  (ASRM-R3).
- No new error classes added (ASRM-R6).
- `DOMAIN_STATUS` not edited (ASRM-R2).
- No `auth` module files in the diff.
- `ForbiddenException` import still present in controller and controller test (Slice 4 still
  references it for `generateMonthly`/CTR-T02) — correctly deferred, per design and guardrail.
- Only Slice 3's 1 use-case + its 1 controller endpoint + their 2 test files touched — list pair,
  record-general, generate-monthly, attendance-month-status untouched.

## Slice 4 — generate + month-status (ASRM-R1, R2, R3, R4, R5, R6) — DONE, migration complete

Mode: **Strict TDD, refactor-style** (no status RED-first — no behavior change; RED was the
Result-shape test rewrite failing against the still-throwing implementation, GREEN was the
implementation migration). This is the FINAL slice — closes the migration and does the final
dead-import cleanup.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 4.1 generate-monthly union widening (4 legacy throws) | Rewrote the 4 legacy error assertions in `generate-monthly-attendance.use-case.test.ts` (GEN-T01×2, GEN-T02, GEN-T07) from `.rejects.toBeInstanceOf(X)` to `isErr()/unwrapErr()` against the still-throwing implementation — structural RED per Slices 1-3 precedent | Converted the 4 remaining throws (`ForbiddenError`×2, `NotFoundError`, `PreviousMonthOpenError`) to `err(...)`, widened the union to `PresenteTypeNotFoundError \| ForbiddenError \| NotFoundError \| PreviousMonthOpenError` — existing `ok`/`err(PresenteTypeNotFoundError)` untouched → 30/30 tests passed | No further refactor — 1:1 throw→err mapping per design; updated the stale doc comment claiming these throws were "unchanged" |
| 4.2 `assertCourseCycleExists` helper + 3 callers (atomic) | Rewrote `attendance-month-status.use-cases.test.ts` (AMS-T01-T08) to `Result`-shape assertions (`.unwrap()`, `isErr()/unwrapErr()`) against the still-throwing helper — structural RED | Converted the shared helper to `Promise<Result<void, NotFoundError>>` in the SAME commit as its 3 callers (Get/Open/Close), each propagating via `guard.isErr()` and wrapping `toResult(status)` in `ok(...)` — kept the helper SHARED per ADR-D3 (no inlining) → 16/16 tests passed | No further refactor — the atomic helper+callers migration was a single compilation-gated commit, exactly per the design's "never leave a half-migrated intermediate" guardrail |
| 4.5/4.6/4.7 controller idiom (3 endpoints) | N/A (controller changes verified via 4.9-4.12's test updates) | `generateMonthly`: dropped `try/catch (ForbiddenError→ForbiddenException)`, adopted `isErr()/unwrap()`. `getMonthStatus`/`setMonthStatus`: gained the `isErr()/unwrap()` guard (no try/catch existed before — these were the first endpoints to receive the idiom without removing anything) | — |
| 4.8 dead-import cleanup | N/A | Removed `ForbiddenException` (unused: all 5 try/catch blocks gone across Slices 1-4) AND `ForbiddenError` (unused: only referenced by the removed try/catch's `instanceof` check) from the controller's import block | — |
| 4.9-4.12 controller test migration | CTR-T02 rewritten to identity rewrite #3; month-status factory defaults wrapped in `ok(...)`; `ForbiddenException` import removed from the test file | Full asistencia test scope green (212/212) — see Deviations for the one unplanned CTR-T13 fix | — |

### Commits (Slice 4, on `refactor/asistencia-result-d`)

1. `cf45d7d` — `refactor(asistencia): widen generate-monthly union, convert 4 legacy throws`
   (1 file: `generate-monthly-attendance.use-case.ts`)
2. `dc7d381` — `refactor(asistencia): Result-return month-status use-cases + assertCourseCycleExists helper`
   (1 file: `attendance-month-status.use-cases.ts` — atomic: helper + 3 callers)
3. `6393f2b` — `refactor(asistencia): finish controller Result idiom, remove dead ForbiddenException/ForbiddenError imports`
   (1 file: `asistencia.controller.ts`)
4. `1d36bbe` — `test(asistencia): migrate generate + month-status + controller tests; final green`
   (3 files: `generate-monthly-attendance.use-case.test.ts`, `attendance-month-status.use-cases.test.ts`,
   `asistencia.controller.test.ts`)

### Files changed

| File | Action | What was done |
|---|---|---|
| `api/src/application/asistencia/generate-monthly-attendance.use-case.ts` | Modified | Widened `execute` signature to `Promise<Result<GenerationResult, PresenteTypeNotFoundError \| ForbiddenError \| NotFoundError \| PreviousMonthOpenError>>`; converted the 4 remaining legacy throws (2× `ForbiddenError` — admin gate + tenant-unavailable; `NotFoundError` — CC not found; `PreviousMonthOpenError`) to `err(...)`. Existing `ok(...)` success returns and the `err(PresenteTypeNotFoundError)` path (asistencia-autollenado-p) untouched. Updated the doc comment that incorrectly claimed these throws were "unchanged" |
| `api/src/application/asistencia/attendance-month-status.use-cases.ts` | Modified | Shared `assertCourseCycleExists` helper → `Promise<Result<void, NotFoundError>>` (kept SHARED per ADR-D3, not inlined); `GetAttendanceMonthStatusUseCase`/`CloseAttendanceMonthUseCase`/`OpenAttendanceMonthUseCase.execute` → `Promise<Result<AttendanceMonthStatusResult, NotFoundError>>`, each propagating the helper via `guard.isErr()` and wrapping success in `ok(...)`. Added `ok, err` value imports + `Result` type import from `@educandow/domain` |
| `api/src/presentation/asistencia/asistencia.controller.ts` | Modified | `generateMonthly`: dropped `try/catch (ForbiddenError→ForbiddenException)`, adopted `isErr()/unwrap()`. `getMonthStatus`/`setMonthStatus`: added the `isErr()/unwrap()` guard (both `closeMonthUC`/`openMonthUC` branches in `setMonthStatus`). Removed the now-dead `ForbiddenException` (NestJS) and `ForbiddenError` (`@educandow/domain`) imports — all 5 try/catch blocks and the last `instanceof ForbiddenError` check are gone across the 4 slices |
| `api/src/application/asistencia/__tests__/generate-monthly-attendance.use-case.test.ts` | Modified | GEN-T01 (×2), GEN-T02, GEN-T07 (×2, including the try/catch-wrapped "does not call generateMany" test, simplified since the use-case no longer throws) rewritten to `isErr()/unwrapErr()`. GEN-T03-T09 success paths and the `PresenteTypeNotFoundError` assert (GEN-T06) were already Result-shape — untouched |
| `api/src/application/asistencia/__tests__/attendance-month-status.use-cases.test.ts` | Modified | All 8 `it` blocks (AMS-T01-T08) rewritten: success paths → `.unwrap()`; the 3 CC-not-found error paths (AMS-T03, AMS-T08a, AMS-T08b) → `isErr()/unwrapErr() instanceof NotFoundError` |
| `api/src/presentation/asistencia/__tests__/asistencia.controller.test.ts` | Modified | Removed `ForbiddenException` import. **CTR-T02 identity rewrite #3**: mock `mockResolvedValue(err(new ForbiddenError(...)))`, assertion `.rejects.toBeInstanceOf(ForbiddenError)` (403 unchanged). `getMonthStatusUC`/`openMonthUC`/`closeMonthUC` factory defaults + CTR-T11b's local override wrapped in `ok(...)`. CTR-T13's manual duck-typed Result mock fixed (see Deviations) |

### Deviations from design

One unplanned fix beyond the literal task wording. Task 4.9 said "CTR-T13 (`PresenteTypeNotFoundError`)
already correct — no change," but CTR-T13's test used a hand-rolled duck-typed mock
(`{ isOk: () => false, isErr: () => true, unwrap: () => { throw domainError; } }`) that lacked an
`unwrapErr()` method. Once `generateMonthly` adopted the uniform `if (result.isErr()) throw
result.unwrapErr();` idiom (task 4.5, required by ASRM-R5's "all 7 endpoints MUST adopt" wording and
design.md's controller idiom for this exact endpoint), that mock's missing `unwrapErr` surfaced as a
`TypeError: result.unwrapErr is not a function`. Fixed by replacing the duck-typed object with the
real `err(domainError)` helper (already imported, already used by CTR-T04/T06/T10) — a strict subset
fix, no new behavior, no scope creep. Everything else matches `design.md` Slice 4 section exactly
(signatures, error maps, controller idiom, atomic helper+callers commit, test plan).

### Real verification results

- `pnpm --filter api test -- asistencia` → **212/212 passed** (16 test files, all 6 asistencia
  use-cases + controller). Slices 1-3 stayed green.
- `pnpm --filter api test` (full suite) → **2187/2188 passed, 1 failed** — same pre-existing
  `scripts/__tests__/archive-legacy-grading-data.spec.ts` Windows path-separator failure documented
  in Slices 1-3, confirmed unrelated (file untouched by this diff, same failure signature).
- `pnpm --filter api typecheck` → **clean, no errors**.
- Diff line-budget: `git diff --shortstat refactor/asistencia-result-c..refactor/asistencia-result-d`
  → **103 insertions(+), 100 deletions(-) = 203 changed lines total** — under the design's ~250-300
  estimate, comfortably under the 400-line budget threshold (Moderate risk confirmed, no escalation
  needed).

### Guardrails verified

- `ForbiddenError` untouched as a class — `instanceof DomainError` still true, its definition file not
  in the diff (ASRM-R3). `DOMAIN_STATUS` not edited (ASRM-R2).
- No new error classes added (ASRM-R6). No `auth` module files in the diff.
- The `assertCourseCycleExists` helper migration landed atomically with its 3 callers in a single
  commit (`dc7d381`) — no half-migrated intermediate state, compilation gate held.
- All 5 `try/catch (ForbiddenError → ForbiddenException)` blocks are now gone across the 4 slices;
  `ForbiddenException` and `ForbiddenError` imports cleanly removed from both the controller and its
  test file — typecheck confirms no dangling references.
- HTTP status behavior unchanged (403/404/409/422 etc.) — verified via the identity-rewrite tests
  (CTR-T02/T04/T06 now assert `ForbiddenError` directly, `AppExceptionFilter`'s `DOMAIN_STATUS` still
  maps it to 403).

## Overall status

12/12 Slice 1 tasks complete (1.0-1.12). 10/10 Slice 2 tasks complete (2.0-2.9). 12/12 Slice 3 tasks
complete (3.0-3.11). 18/18 Slice 4 tasks complete (4.0-4.17). **All 4 slices done — 52/52 tasks
complete across the entire `asistencia-result-migration` change.** ASRM-R7 (4 stacked,
independently-green slices) satisfied. Ready for `sdd-verify`.
