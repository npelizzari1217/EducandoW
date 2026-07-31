# Delta Spec — course-cycle-result-migration

## Purpose

This change is a **consumer** of the canonical capability `application-error-handling`
(`openspec/specs/application-error-handling/spec.md`) — it does not create a new capability.
It finishes the `course-cycle` throw-based holdout under that capability's established
requirements ("No throw in application/ — Result propagation only", "auth module untouched",
classification note). All requirements below are `DomainError` cases; zero `ApplicationError`,
zero new classes. Scope is locked to Option A per the proposal.

## Requirements

### CCRM-R1: No throw remains in `course-cycle.use-cases.ts`

`DeleteCourseCycleUseCase.execute`, `ListStudentsByCourseCycleUC.execute`, and
`GenerateCourseCyclesUseCase.execute` MUST NOT `throw`. They MUST return `Result<T, Error>`,
propagating authorization/domain failures as `err(...)`, per the canonical capability's
"No throw in application/" requirement.

#### Scenario: Delete on missing/inactive cycle returns err, not throw
- GIVEN a `uuid` that does not exist, or exists but is inactive
- WHEN `DeleteCourseCycleUseCase.execute(uuid)` runs
- THEN it MUST NOT throw; it MUST return a `Result` with `isErr()` true and `unwrapErr()` the matching `CourseCycleNotFoundError`/`CourseCycleClosedError`

#### Scenario: ListStudents on missing cycle returns err, not throw
- GIVEN a `uuid` that does not exist
- WHEN `ListStudentsByCourseCycleUC.execute(uuid)` runs
- THEN it MUST NOT throw; it MUST return `err(CourseCycleNotFoundError)`

#### Scenario: Generate top-level guards return err, not throw
- GIVEN a missing/inactive `AcademicCycle` or a missing `StudyPlan`
- WHEN `GenerateCourseCyclesUseCase.execute(input)` runs
- THEN it MUST NOT throw; it MUST return `err(...)` with the matching `NotFoundError`/`AcademicCycleClosedError`

### CCRM-R2: Helpers propagate `ValidationError` instead of bare `Error` (500→4xx)

`buildLevel` and `buildBimonthPeriod` MUST return `Result<T, ValidationError>` instead of
throwing a bare `Error`. Callers (`CreateCourseCycleUseCase`, `UpdateCourseCycleUseCase`)
MUST propagate the `err(...)` so an invalid level or a bimonth with `end ≤ start` responds
4xx (400/422 per `DOMAIN_STATUS`), never 500.

#### Scenario: Invalid level surfaces as 4xx, not 500
- GIVEN a `Create`/`Update` request with an unparseable/out-of-range `level`
- WHEN the use case executes
- THEN the response MUST be 4xx with the `ValidationError` code, NOT 500

#### Scenario: Bimonth `end ≤ start` surfaces as 4xx, not 500
- GIVEN a bimonth period where `end` is not strictly after `start`
- WHEN the use case executes
- THEN the response MUST be 4xx with the `ValidationError` code, NOT 500

#### Scenario: Regression — a test still asserting 500 for these inputs is a failing regression
- GIVEN a test asserting HTTP 500 for invalid level or `end ≤ start`
- WHEN this change lands
- THEN that test MUST be updated to assert 4xx; a suite still green on 500 for these inputs MUST be treated as a failing regression, not an accepted delta

### CCRM-R3: `Level.fromParts` throws `ValidationError`, signature unchanged

`Level.fromParts(levelCode, modalityCode): Level` MUST throw `ValidationError` (a
`DomainError`) instead of bare `Error` for an invalid composite. The signature `: Level`
MUST be preserved — non-breaking for its 6+ existing callers.

#### Scenario: Invalid composite surfaces as ValidationError
- GIVEN a `levelCode`/`modalityCode` pair whose composite is not in `LevelType`
- WHEN `Level.fromParts` is called
- THEN it MUST throw an instance of `ValidationError`, not a bare `Error`

#### Scenario: Existing callers remain source-compatible
- GIVEN the 6+ existing call sites of `Level.fromParts`
- WHEN this change lands
- THEN they MUST continue to compile and behave identically for valid composites — no signature change

#### Scenario: Invalid composite on the generate path surfaces as 4xx, not 500
- GIVEN `GenerateCourseCyclesUseCase` processing a plan whose level/modality composite is invalid
- WHEN the loop reaches that plan course
- THEN the response MUST be 4xx (via the propagated `ValidationError`), NOT 500

### CCRM-R4: Controller adopts the `if (isErr) throw unwrapErr()` idiom

`CourseCycleController.delete`, `.listStudents`, and `.generate` MUST adopt
`if (result.isErr()) throw result.unwrapErr();` (the idiom already used by 9/12 other
endpoints in this controller), mapping to the HTTP status the underlying `DomainError`
already implies.

#### Scenario: Controller throws the unwrapped DomainError
- GIVEN any of `delete`/`listStudents`/`generate` receives an `err(...)` result from its use case
- WHEN the controller method runs
- THEN it MUST call `throw result.unwrapErr()` and MUST NOT swallow or re-wrap the error

### CCRM-R5: No behavior change on the mechanical migrations

The status codes already implied by existing `DomainError` classes MUST be unchanged:
`Delete` (404 not found / 409 inactive), `ListStudents` (404), `Generate` top-level guards
(404 AcademicCycle/StudyPlan not found, 409 AcademicCycle inactive). Only the propagation
mechanism (return vs throw) changes.

#### Scenario: Status codes preserved across the migration
- GIVEN the same not-found/inactive conditions covered before this change
- WHEN the request is made after migration
- THEN the HTTP status MUST be identical to pre-migration behavior

### CCRM-R6: `Generate` batch semantics preserved (all-or-nothing)

`GenerateCourseCyclesUseCase`'s per-plan-course loop MUST keep its current all-or-nothing
semantics (one invalid `CourseName`/`PassingGrade`/composite aborts the batch). Migrating
to partial-success is explicitly OUT OF SCOPE (product decision, tracked as a follow-up).

#### Scenario: One invalid course aborts the whole batch
- GIVEN a batch of plan courses where one produces an invalid composite/VO
- WHEN `Generate` processes the batch
- THEN the batch MUST abort as a whole (no partial persistence of subsequent courses), identical to pre-migration behavior

### CCRM-R7: No new error classes; `auth` module untouched

This change MUST reuse only the existing catalog (`ValidationError`, `CourseCycleNotFoundError`,
`CourseCycleClosedError`, `AcademicCycleClosedError`, `NotFoundError`) — zero new error classes.
Per the canonical capability's "auth module untouched" requirement, no file under the `auth`
module MUST appear in this change's diff.

#### Scenario: Diff contains no new error class
- GIVEN the full diff of this change
- WHEN inspecting `api/src/application/shared/errors/` and `packages/domain/src/**/errors/`
- THEN no new error class file MUST be added

#### Scenario: auth module is untouched
- GIVEN the full diff of this change
- WHEN inspecting files under the `auth` module
- THEN no file under that module MUST appear in the diff
