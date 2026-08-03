# Delta Spec — asistencia-result-migration

Consumes: `application-error-handling` canonical capability (`openspec/specs/application-error-handling/spec.md`),
its "No throw in application/" requirement. Mechanical `asistencia` consumer: 41 throws across 6
use-cases become `return err(...)`. **No behavior change** — every error keeps its current HTTP
status. `ForbiddenError` is NOT reclassified here (stays `DomainError`) — see ASRM-R3.

## ADDED Requirements

### Requirement: ASRM-R1 — No throw remains in the 6 asistencia use-cases

`RecordSubjectAttendanceDayUseCase`, `RecordGeneralAttendanceDayUseCase`,
`ListSubjectAttendanceUseCase`, `ListGeneralAttendanceUseCase`, `GenerateMonthlyAttendanceUseCase`,
and the 3 `attendance-month-status` use-cases (Get/Open/Close) MUST NOT `throw` for any of the 41
inventoried conditions; each MUST return `Result<T, E>` per the canonical capability's rule (applied
here, not redefined).

#### Scenario: Every previously-throwing call site returns err instead

- GIVEN any inventoried failure (Forbidden, NotFound, Validation, DayNotAssignable,
  StatusNotAssignable, MonthClosed, PreviousMonthOpen) in any of the 6 use-cases
- WHEN the use case executes
- THEN it MUST NOT throw; `isErr()` MUST be `true` and `unwrapErr()` an instance of the matching class

### Requirement: ASRM-R2 — HTTP status is preserved for every migrated error

Each error MUST surface at the SAME status as today: `ForbiddenError`→403, `NotFoundError`→404,
`ValidationError`→400, `DayNotAssignableError`→422, `StatusNotAssignableError`→400,
`MonthClosedError`→409, `PreviousMonthOpenError`→409. `DOMAIN_STATUS` MUST NOT be edited.

#### Scenario: Status is identical before and after migration

- GIVEN any of the 7 error classes returned by a migrated use case
- WHEN it reaches `AppExceptionFilter` via the controller's throw boundary
- THEN the status MUST equal the pre-migration status — no regression, no improvement

### Requirement: ASRM-R3 — ForbiddenError stays DomainError (reclassification deferred)

This change MUST NOT reclassify `ForbiddenError` to `ApplicationError` or move it. All 22
`ForbiddenError` throws become `err(new ForbiddenError(...))`, class unchanged. Reclassification is
a separate, explicit follow-up (~19 files, 8 modules + 4 controllers).

#### Scenario: Classification and file location are unchanged

- GIVEN any `ForbiddenError` instance returned post-migration, and the full diff of this change
- WHEN inspected
- THEN `instanceof DomainError` MUST be `true`, `instanceof ApplicationError` MUST be `false`, and
  `ForbiddenError`'s definition file MUST NOT appear in the diff

### Requirement: ASRM-R4 — Return-type widening

`RecordSubjectAttendanceDayUseCase.execute`, `RecordGeneralAttendanceDayUseCase.execute`,
`ListSubjectAttendanceUseCase.execute`, `ListGeneralAttendanceUseCase.execute` MUST change from bare
`Promise<T>` to `Promise<Result<T, ErrorUnion>>`. `GenerateMonthlyAttendanceUseCase.execute` MUST
widen its existing union with the 4 previously-thrown types. The 3 month-status use-cases MUST
change to `Promise<Result<T, NotFoundError>>`.

#### Scenario: List use-cases return Result on the success path too

- GIVEN a valid, authorized request
- WHEN either List use case runs
- THEN it MUST return `Result` with `isOk()` true wrapping the array — not a bare array

#### Scenario: generate-monthly union widens, does not narrow

- GIVEN the post-migration signature of `GenerateMonthlyAttendanceUseCase.execute`
- WHEN inspecting its error union
- THEN it MUST include `ForbiddenError`, `NotFoundError`, `PreviousMonthOpenError` in addition to
  the pre-existing `PresenteTypeNotFoundError`

### Requirement: ASRM-R5 — Controller idiom and dead-code cleanup

All 7 `asistencia.controller.ts` endpoints MUST adopt
`if (result.isErr()) throw result.unwrapErr(); return result.unwrap();` (or void equivalent). The 5
endpoints with `try/catch (ForbiddenError → ForbiddenException)` MUST drop that block — the filter's
`DOMAIN_STATUS` already maps `FORBIDDEN`→403 identically. Boundary exception identity changes
`ForbiddenException`→`ForbiddenError`; HTTP status stays 403.

#### Scenario: Uniform idiom, no redundant try/catch, status unchanged

- GIVEN the post-migration controller and a condition that previously hit the removed remap
- WHEN each of the 7 handlers is inspected, and that condition recurs
- THEN each MUST use the `isErr()`/`unwrapErr()` idiom with no `try/catch (ForbiddenError)` block,
  and the response status MUST still be `403`

### Requirement: ASRM-R6 — No new error classes; scope guardrails

This change MUST NOT introduce any new error class — the 7 inventoried types are reused as-is. The
`ForbiddenError`→`ApplicationError` reclassification and the `auth` module are OUT of scope and MUST
NOT appear in the diff.

#### Scenario: No new classes; auth untouched

- GIVEN the full diff of this change
- WHEN inspecting `api/src/domain/**/errors/`, `api/src/application/shared/errors/`, and the `auth`
  module
- THEN no new error class MUST be added and no `auth` file MUST appear

### Requirement: ASRM-R7 — Stacked delivery in 4 independently-green slices

This change MUST land as 4 stacked PRs, each targeting its predecessor: (1) list pair, (2)
record-general, (3) record-subject, (4) generate + month-status. Each slice's atomic unit MUST be
(use-case + tests + its controller endpoint(s) + controller tests) together — widening a use-case's
success shape to `Result` requires its controller call-site in the same slice. Each slice MUST be
independently green (`pnpm test`) before the next starts.

#### Scenario: Each slice is self-contained, green, and controller-complete

- GIVEN any of the 4 delivery slices
- WHEN its scoped use-case(s), tests, and controller endpoint(s) are applied together
- THEN `pnpm test` MUST pass without depending on a later slice, and no use-case's return-type
  widening MUST appear without its controller endpoint update in the same slice
