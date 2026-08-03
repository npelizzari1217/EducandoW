# Tasks: asistencia-result-migration

## Review Workload Forecast

| Slice | Est. diff | 400-budget risk | Chained | Decision before apply |
|---|---|---|---|---|
| 1 — list pair | ~140-180 | Low | Yes (base) | No |
| 2 — record-general | ~240-300 | Moderate | Yes (on PR1) | No |
| 3 — record-subject | ~300-380 | **High** | Yes (on PR2) | **Yes** |
| 4 — generate + month-status | ~250-300 | Moderate | Yes (on PR3) | No |
| **Aggregate** | **~950-1160** | **High** | **Yes (4 stacked)** | **Yes** |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Delivery strategy: ask-on-risk — orchestrator MUST stop and confirm strategy before Slice 3 apply.
If Slice 3's real diff exceeds 400, fallback is `size:exception` (NOT a further split — the single
`record-subject-attendance-day.use-case.ts` + its 2 auth helpers cannot cleanly split).

### Suggested Work Units

| Unit | Goal | Branch (base) | Notes |
|------|------|----------------|-------|
| 1 | List pair (ASRM-R1/R2/R5) | `refactor/asistencia-result-a` (from `main`) | Low risk |
| 2 | record-general (ASRM-R1/R2/R4/R5) | `refactor/asistencia-result-b` (from `-a`) | Moderate |
| 3 | record-subject (ASRM-R1/R2/R4/R5) | `refactor/asistencia-result-c` (from `-b`) | **High — watch 400** |
| 4 | generate + month-status + helper + cleanup (ASRM-R1/R2/R3/R4/R5/R6) | `refactor/asistencia-result-d` (from `-c`) | Moderate; final green |

Shared-file warning: `asistencia.controller.test.ts` is touched by all 4 slices — each slice edits
ONLY its own endpoint's factory default + its own CTR tests. Do not touch other slices' defaults.

No new error classes (ASRM-R6); `ForbiddenError` stays `DomainError` (ASRM-R3) — never edit its
definition file or `DOMAIN_STATUS`.

---

## Slice 1 — list pair (ASRM-R1, R2, R5)

- [x] 1.0 Create branch `refactor/asistencia-result-a` from `main`
- [x] 1.1 `list-general-attendance.use-case.ts`: widen `checkDoor2` to `Promise<Result<void, ForbiddenError>>`, convert 4 throws to `err(...)`, wrap execute success in `ok(rows)`; signature → `Promise<Result<EnrichedGeneralAttendance[], ForbiddenError>>`
- [x] 1.2 `list-subject-attendance.use-case.ts`: same treatment for `checkDoor2` (5 throws), wrap execute success in `ok(rows)`; signature → `Promise<Result<EnrichedMateriaAttendance[], ForbiddenError>>`
- [x] 1.3 Rewrite `__tests__/list-general-attendance.use-case.test.ts` (LGA-T01-T04): success → `result.unwrap()`; error (T03) → `isErr()`/`unwrapErr()` instanceof `ForbiddenError`
- [x] 1.4 Rewrite `__tests__/list-subject-attendance.use-case.test.ts` (LSA-T*): same Result-shape pattern for success + 5 Forbidden branches
- [x] 1.5 `asistencia.controller.ts` `listGeneral` (lines ~132-154): drop try/catch, adopt `isErr()/unwrap()` idiom
- [x] 1.6 `asistencia.controller.ts` `listSubject` (lines ~194-217): drop try/catch, adopt `isErr()/unwrap()` idiom
- [x] 1.7 `asistencia.controller.test.ts`: update `listGeneralUC`/`listSubjectUC` factory defaults to `ok(...)`; update CTR-T03/T07/T08 to `result.unwrap()`
- [x] 1.8 `asistencia.controller.test.ts` **CTR-T04 (identity rewrite #1)**: mock → `mockResolvedValue(err(new ForbiddenError(...)))`, assertion → `.rejects.toBeInstanceOf(ForbiddenError)` (403 unchanged)
- [x] 1.9 Commit: `refactor(asistencia): return Result from list-general/list-subject use-cases`
- [x] 1.10 Commit: `refactor(asistencia): consume list Result in controller, drop redundant try/catch`
- [x] 1.11 Commit: `test(asistencia): migrate list use-case + controller tests to Result shape`
- [x] 1.12 Slice verification: `pnpm --filter api test` (list use-cases + controller subset) green, `pnpm --filter api typecheck` green, diff line-budget check (~140-180, Low) — **real: 169 diff lines, within estimate**

---

## Slice 2 — record-general (ASRM-R1, R2, R4, R5)

- [x] 2.0 Create branch `refactor/asistencia-result-b` from `refactor/asistencia-result-a`
- [x] 2.1 `record-general-attendance-day.use-case.ts`: widen `checkDoor2` to `Result<void, ForbiddenError>`, convert 11 throws (`MonthClosedError`, `NotFoundError`, `ValidationError`×2, `DayNotAssignableError`×2, `StatusNotAssignableError`, `ForbiddenError`×4) to `err(...)`; wrap success in `ok(await this.generalRepo.setDay(...))`; signature → `Promise<Result<AsistenciaXAlumnoXCursoXCiclo, ForbiddenError | MonthClosedError | NotFoundError | ValidationError | DayNotAssignableError | StatusNotAssignableError>>`
- [x] 2.2 Rewrite `__tests__/record-general-attendance-day.use-case.test.ts`: success → `.unwrap()`/`isOk()`; every error branch → `isErr()`/`unwrapErr()` instanceof the matching class
- [x] 2.3 `asistencia.controller.ts` `recordGeneralDay` (lines ~161-186): drop try/catch, adopt `isErr()/unwrap()` idiom
- [x] 2.4 `asistencia.controller.test.ts`: update `recordGeneralUC` factory default to `ok(makeGeneralRow())`; update CTR-T05 to `result.unwrap()`
- [x] 2.5 `asistencia.controller.test.ts` **CTR-T06 (identity rewrite #2)**: mock → `mockResolvedValue(err(new ForbiddenError(...)))`, assertion → `.rejects.toBeInstanceOf(ForbiddenError)`
- [x] 2.6 Commit: `refactor(asistencia): return Result from record-general use-case`
- [x] 2.7 Commit: `refactor(asistencia): consume record-general Result in controller`
- [x] 2.8 Commit: `test(asistencia): migrate record-general tests to Result shape`
- [x] 2.9 Slice verification: `pnpm --filter api test` (record-general + controller subset, Slice 1 stays green) + `pnpm --filter api typecheck` green, diff line-budget check (~240-300, Moderate) — **real: 311 diff lines (slightly above estimate, well under 400)**

---

## Slice 3 — record-subject (ASRM-R1, R2, R4, R5) — **BUDGET HOTSPOT, High risk**

> If real diff exceeds 400 lines at implementation time: fallback is `size:exception` (approved by
> maintainer), NOT a further split — one use-case + its 2 auth helpers cannot cleanly split.

- [x] 3.0 Create branch `refactor/asistencia-result-c` from `refactor/asistencia-result-b`
- [x] 3.1 `record-subject-attendance-day.use-case.ts`: widen `checkDoor2` → `Promise<Result<string, ForbiddenError>>` (6 Forbidden throws → `err(...)`, final `ok(materia.courseCycleId)`)
- [x] 3.2 Same file: widen `resolveCourseCycleId` → `Promise<Result<string, ForbiddenError | NotFoundError>>` (Forbidden + NotFound throws → `err(...)`, final `ok(materia.courseCycleId)`)
- [x] 3.3 Same file: convert remaining 7 execute-body throws (`MonthClosedError`, `NotFoundError`, `ValidationError`×2, `DayNotAssignableError`×2, `StatusNotAssignableError`) to `err(...)`; wire `ccResult` guard for both auth branches; wrap success in `ok(await this.materiaAsistRepo.setDay(...))`; signature → `Promise<Result<AsistenciaXMateriaXAlumnoXCursoXCiclo, ForbiddenError | MonthClosedError | NotFoundError | ValidationError | DayNotAssignableError | StatusNotAssignableError>>`
- [x] 3.4 Rewrite `__tests__/record-subject-attendance-day.use-case.test.ts`: success → `.unwrap()`/`isOk()`; all branches for both Door-2 (6 Forbidden) and admin-bypass (`resolveCourseCycleId`, Forbidden + NotFound) paths → `isErr()`/`unwrapErr()`
- [x] 3.5 `asistencia.controller.ts` `recordSubjectDay` (lines ~224-249): drop try/catch, adopt `isErr()/unwrap()` idiom
- [x] 3.6 `asistencia.controller.test.ts`: update `recordSubjectUC` factory default to `ok(makeMateriaRow())`; update CTR-T09 to `result.unwrap()`
- [x] 3.7 `asistencia.controller.test.ts` CTR-T10 (non-Forbidden propagates, NOT an identity rewrite): mock → `mockResolvedValue(err(domainError))`; assertion `.rejects.toBe(domainError)` stays valid via `unwrapErr()` re-throw
- [x] 3.8 Commit: `refactor(asistencia): return Result from record-subject use-case (both auth paths)`
- [x] 3.9 Commit: `refactor(asistencia): consume record-subject Result in controller`
- [x] 3.10 Commit: `test(asistencia): migrate record-subject tests to Result shape`
- [x] 3.11 Slice verification: `pnpm --filter api test` (record-subject + controller subset, Slices 1-2 stay green) + `pnpm --filter api typecheck` green, diff line-budget check (~300-380, High — confirm <400 or escalate `size:exception`) — **real: 300 diff lines (184+116), within estimate, under 400 threshold, no `size:exception` needed**

---

## Slice 4 — generate + month-status (ASRM-R1, R2, R3, R4, R5, R6)

- [x] 4.0 Create branch `refactor/asistencia-result-d` from `refactor/asistencia-result-c`
- [x] 4.1 `generate-monthly-attendance.use-case.ts`: convert 4 legacy throws (`ForbiddenError`×2, `NotFoundError`, `PreviousMonthOpenError`) to `err(...)`; widen union → `Promise<Result<GenerationResult, PresenteTypeNotFoundError | ForbiddenError | NotFoundError | PreviousMonthOpenError>>` (existing `ok`/`err(PresenteTypeNotFoundError)` unchanged)
- [x] 4.2 `attendance-month-status.use-cases.ts`: convert shared `assertCourseCycleExists` helper to `Promise<Result<void, NotFoundError>>` **atomically with** its 3 callers (Get/Open/Close) propagating via `guard.isErr()` guard; each use-case signature → `Promise<Result<AttendanceMonthStatusResult, NotFoundError>>`, wrap existing `toResult(status)` in `ok(...)`
- [x] 4.3 Rewrite `__tests__/generate-monthly-attendance.use-case.test.ts`: convert the 4 legacy error asserts (`ForbiddenError`×2, `NotFoundError`, `PreviousMonthOpenError`) to `isErr()`/`unwrapErr()`; success paths and `PresenteTypeNotFoundError` assert already correct — leave untouched
- [x] 4.4 Rewrite `__tests__/attendance-month-status.use-cases.test.ts`: Get/Open/Close success → `.unwrap()`; CC-not-found error path → `isErr()`/`unwrapErr()` instanceof `NotFoundError`
- [x] 4.5 `asistencia.controller.ts` `generateMonthly` (lines ~99-125): drop try/catch, adopt `isErr()/unwrap()` idiom
- [x] 4.6 `asistencia.controller.ts` `getMonthStatus` (lines ~256-268): add `isErr()/unwrap()` idiom (no try/catch existed)
- [x] 4.7 `asistencia.controller.ts` `setMonthStatus` (lines ~276-288): add `isErr()/unwrap()` idiom for both `closeMonthUC`/`openMonthUC` branches (no try/catch existed)
- [x] 4.8 `asistencia.controller.ts`: remove now-dead `ForbiddenException` import (all 5 try/catch blocks removed across Slices 1-4) — also removed the now-dead `ForbiddenError` import per design.md's cleanup note (both unused post-migration)
- [x] 4.9 `asistencia.controller.test.ts`: CTR-T01 stays (generateMonthlyUC default already `ok`); CTR-T13 (`PresenteTypeNotFoundError`) required a small fix — see Deviations
- [x] 4.10 `asistencia.controller.test.ts` **CTR-T02 (identity rewrite #3)**: mock → `mockResolvedValue(err(new ForbiddenError(...)))`, assertion → `.rejects.toBeInstanceOf(ForbiddenError)`
- [x] 4.11 `asistencia.controller.test.ts`: update `getMonthStatusUC`/`openMonthUC`/`closeMonthUC` factory defaults to `ok(...)`; CTR-T11b's local override updated to `ok(...)` too
- [x] 4.12 `asistencia.controller.test.ts`: verify no assertion still references `ForbiddenException` (all 3 identity rewrites now assert `ForbiddenError`) — removed the now-dead `ForbiddenException` import from the test file
- [x] 4.13 Commit: `refactor(asistencia): widen generate-monthly union, convert 4 legacy throws` (`cf45d7d`)
- [x] 4.14 Commit: `refactor(asistencia): Result-return month-status use-cases + assertCourseCycleExists helper` (atomic: helper + 3 callers) (`dc7d381`)
- [x] 4.15 Commit: `refactor(asistencia): finish controller Result idiom, remove dead ForbiddenException/ForbiddenError imports` (`6393f2b`)
- [x] 4.16 Commit: `test(asistencia): migrate generate + month-status + controller tests; final green` (`1d36bbe`)
- [x] 4.17 Slice verification: `pnpm --filter api test -- asistencia` → **212/212 green** (all 6 use-case + controller test files); full suite 2187/2188 (1 pre-existing unrelated failure, same as Slices 1-3); `pnpm --filter api typecheck` → clean; real diff `git diff --shortstat refactor/asistencia-result-c..refactor/asistencia-result-d` → **103 insertions(+), 100 deletions(-) = 203 changed lines**, under the ~250-300 estimate, comfortably under 400 (Low-Moderate risk confirmed)

---

## Traceability

ASRM-R1 (no throw) → tasks 1.1/1.2, 2.1, 3.1-3.3, 4.1-4.2. ASRM-R2 (status preserved) → 1.5/1.6,
2.3, 3.5, 4.5-4.7 (no `DOMAIN_STATUS` edit in any task). ASRM-R3 (`ForbiddenError` stays `DomainError`)
→ guardrail across all slices, never a task target. ASRM-R4 (return-type widening) → 1.1/1.2, 2.1,
3.1-3.3, 4.1/4.2. ASRM-R5 (controller idiom, dead-code cleanup) → 1.5/1.6, 2.3, 3.5, 4.5-4.8, 4.12.
ASRM-R6 (no new error classes, auth out of scope) → guardrail, verified at each slice verification.
ASRM-R7 (4 stacked, independently-green slices) → 1.0/1.12, 2.0/2.9, 3.0/3.11, 4.0/4.17.
</content>
