# Delta Spec — course-cycle-alumnos-result-migration

## Purpose

This change is a **consumer** of the canonical capability `application-error-handling`
(`openspec/specs/application-error-handling/spec.md`) — it does not create a new capability.
It closes the `AlumnosXCurso` throw-based holdout under that capability's established
requirement "No throw in application/ — Result propagation only". All requirements below are
`DomainError` cases; zero `ApplicationError`, zero new classes.

**Honesty note (differs from `course-cycle-result-migration`).** This slice introduces
**NO 500→4xx correction**. Every throw classified in the proposal's 11-row table already maps
to a correct, existing 4xx status (`NotFoundError` → 404, `StudentHasPaseError` → 409,
`PaseFechaInvalidaError` → its existing `DOMAIN_STATUS` entry). The only observable effect of
this change is internal: failures propagate as `Result` instead of as a thrown exception up to
the controller boundary, where they are re-thrown identically to today. Any requirement below
that reads as "status unchanged" is intentional, not a placeholder for a bug fix.

## Requirements

### CCAM-R1: No throw remains in the 5 `AlumnosXCurso` use-cases

`AddStudentToCourseCycleUseCase.execute`, `RemoveStudentFromCourseCycleUseCase.execute`,
`TogglePrintableUseCase.execute`, `RegistrarPaseUseCase.execute`, and
`CascadeStudentMateriasCompetenciasUseCase.execute` MUST NOT `throw`. Each MUST return
`Result<T, Error>`, propagating every failure as `err(...)` of the same `DomainError` type
already used pre-migration, per the canonical capability's "No throw in application/" requirement.

#### Scenario: AddStudent returns err, not throw, on missing CourseCycle or Student
- GIVEN a `courseCycleId` that does not exist, or a `studentId` that does not exist
- WHEN `AddStudentToCourseCycleUseCase.execute(...)` runs
- THEN it MUST NOT throw; it MUST return a `Result` with `isErr()` true and `unwrapErr()` an instance of the matching `NotFoundError`

#### Scenario: RemoveStudent returns err, not throw, on missing CourseCycle, missing enrollment, or an active pase
- GIVEN a CourseCycle that does not exist, an enrollment that does not exist (IDOR), or an enrollment where `student.tienePase` is true
- WHEN `RemoveStudentFromCourseCycleUseCase.execute(...)` runs
- THEN it MUST NOT throw; it MUST return `err(NotFoundError)` for the first two conditions and `err(StudentHasPaseError)` for the third

#### Scenario: TogglePrintable returns err, not throw, on missing/IDOR row
- GIVEN a row that does not exist or does not belong to the caller's institution
- WHEN `TogglePrintableUseCase.execute(...)` runs
- THEN it MUST NOT throw; it MUST return `err(NotFoundError)`

#### Scenario: RegistrarPase returns err, not throw, on any of its 3 pre-existing NotFoundError guards
- GIVEN a missing CourseCycle, a missing/IDOR enrollment, or a missing Student
- WHEN `RegistrarPaseUseCase.execute(...)` runs
- THEN it MUST NOT throw; it MUST return `err(NotFoundError)` for the matching condition

#### Scenario: Cascade returns err, not throw, on missing/IDOR bridge row
- GIVEN a bridge row that does not exist or does not belong to the caller's institution
- WHEN `CascadeStudentMateriasCompetenciasUseCase.execute(...)` runs
- THEN it MUST NOT throw; it MUST return `err(NotFoundError)`

### CCAM-R2: `PaseFechaInvalidaError` entity throw is bridged to `Result`

`RegistrarPaseUseCase.execute` MUST wrap the call(s) to the entity methods
`student.registrarPase(fecha)` (register branch) and `student.revertirPase()` (revert branch) in
try/catch. On catching a `PaseFechaInvalidaError` thrown by the entity, the use case MUST return
`err(e as PaseFechaInvalidaError)` instead of letting the exception propagate past the use case
boundary. On success, both branches MUST return `ok(undefined)`, matching the return shape of
`RemoveStudentFromCourseCycleUseCase`.

#### Scenario: Entity throw on register does not escape the use case
- GIVEN `fecha` is in the future (invalid per `student.registrarPase`'s intrinsic invariant)
- WHEN `RegistrarPaseUseCase.execute(...)` calls `student.registrarPase(fecha)` (register branch)
- THEN the use case MUST NOT let a `PaseFechaInvalidaError` escape as a thrown exception; it MUST return a `Result` with `isErr()` true and `unwrapErr()` an instance of `PaseFechaInvalidaError`

#### Scenario: Register success returns ok(undefined)
- GIVEN valid inputs for the register branch
- WHEN `RegistrarPaseUseCase.execute(...)` completes the register branch
- THEN it MUST return a `Result` with `isOk()` true and `unwrap()` equal to `undefined`

#### Scenario: Revert success returns ok(undefined)
- GIVEN valid inputs for the revert branch
- WHEN `RegistrarPaseUseCase.execute(...)` completes the revert branch (`student.revertirPase()`)
- THEN it MUST return a `Result` with `isOk()` true and `unwrap()` equal to `undefined`

### CCAM-R3: HTTP status codes are preserved — no 500→4xx correction in this slice

Every failure migrated by CCAM-R1 and CCAM-R2 MUST map to the exact same HTTP status it produced
before this change: `NotFoundError` → 404, `StudentHasPaseError` → 409, `PaseFechaInvalidaError` →
its pre-existing `DOMAIN_STATUS` entry (design records the concrete number; this requirement only
asserts it is unchanged). Unlike `course-cycle-result-migration`, this change MUST NOT alter any
status code, MUST NOT introduce a new `DOMAIN_STATUS` entry, and MUST NOT correct any 500 fallback
— there is no such bug in this slice's throw inventory.

#### Scenario: Status codes identical before and after migration
- GIVEN any of the not-found, `StudentHasPaseError`, or `PaseFechaInvalidaError` conditions covered by CCAM-R1/CCAM-R2
- WHEN the corresponding request is made after this change lands
- THEN the HTTP response status MUST be identical to the status produced by the pre-migration `throw`-based code path

#### Scenario: No new DOMAIN_STATUS entry is required or added
- GIVEN the full diff of this change
- WHEN inspecting the `DOMAIN_STATUS` mapping consumed by `AppExceptionFilter`
- THEN no new entry MUST be added — `PaseFechaInvalidaError` already has one, verified by design before apply

### CCAM-R4: Controller adopts the `if (isErr) throw unwrapErr()` idiom on the 5 in-scope endpoints

`AlumnosXCursoXCicloController`'s 5 endpoints that call an in-scope use case — add student, remove
student, toggle printable, registrar pase, cascade — MUST adopt
`if (result.isErr()) throw result.unwrapErr();` (the idiom already established by
`course-cycle-result-migration`), unwrapping the ok payload only after that check. The 4 endpoints
that do not call an in-scope use case (list students, bulk toggle printable, list memberships,
bulk cascade) MUST remain unchanged.

#### Scenario: Each in-scope endpoint throws the unwrapped error
- GIVEN any of the 5 in-scope endpoints receives an `err(...)` result from its use case
- WHEN the controller method runs
- THEN it MUST call `throw result.unwrapErr()` and MUST NOT swallow, re-wrap, or transform the error

#### Scenario: Non-in-scope endpoints are unaffected
- GIVEN the full diff of this change
- WHEN inspecting the 4 endpoints that do not call an in-scope use case
- THEN their implementation MUST be unchanged

### CCAM-R5: Cascade result shape is preserved on the ok path

`CascadeStudentMateriasCompetenciasUseCase.execute` has 4 success return sites. All 4 MUST be
wrapped in `ok(...)`. The `CascadeResult` payload (its counts/fields) MUST be structurally
unchanged from pre-migration — only the wrapping in `Result` changes, not the shape of the success
value.

#### Scenario: Each of the 4 success return sites yields ok(CascadeResult)
- GIVEN any of the 4 code paths that previously returned a `CascadeResult` directly
- WHEN `CascadeStudentMateriasCompetenciasUseCase.execute(...)` completes that path
- THEN it MUST return a `Result` with `isOk()` true and `unwrap()` a `CascadeResult` with the same fields/counts as the pre-migration return value

### CCAM-R6: No new error classes; `auth` module untouched; no scope creep

This change MUST reuse only the existing error catalog (`NotFoundError`, `StudentHasPaseError`,
`PaseFechaInvalidaError`) — zero new error classes, zero reclassification. Per the canonical
capability's "auth module untouched" requirement, no file under the `auth` module MUST appear in
this change's diff. `course-cycle.use-cases.ts` (migrated by the prior, already-archived
`course-cycle-result-migration` slice) MUST NOT appear in this change's diff. The fire-and-forget
`.catch()` sites in `GenerateCourseCyclesUseCase` (`course-cycle.use-cases.ts:421,429`) are OUT OF
SCOPE and MUST NOT be modified by this change.

#### Scenario: Diff contains no new error class
- GIVEN the full diff of this change
- WHEN inspecting `packages/domain/src/**/errors/` and `api/src/application/shared/errors/`
- THEN no new error class file MUST be added

#### Scenario: auth module is untouched
- GIVEN the full diff of this change
- WHEN inspecting files under the `auth` module
- THEN no file under that module MUST appear in the diff

#### Scenario: course-cycle.use-cases.ts is untouched
- GIVEN the full diff of this change
- WHEN inspecting `course-cycle.use-cases.ts`
- THEN that file MUST NOT appear in the diff

#### Scenario: GenerateCourseCyclesUseCase fire-and-forget sites are untouched
- GIVEN the full diff of this change
- WHEN inspecting the `.catch()` sites at `course-cycle.use-cases.ts:421,429`
- THEN those sites MUST NOT be modified by this change

### CCAM-R7: `togglePrintable` gains controller-spec coverage

`AlumnosXCursoXCicloController`'s `togglePrintable` endpoint currently has no test coverage in
`alumnos-x-curso-x-ciclo.controller.spec.ts`. This change MUST add coverage for its three
observable outcomes (success, not-found, IDOR) as part of migrating the endpoint to the
`if (isErr) throw unwrapErr()` idiom, written RED-first per the project's strict-TDD mode.

#### Scenario: togglePrintable success path is covered
- GIVEN a valid row owned by the caller's institution
- WHEN the `togglePrintable` endpoint test suite runs
- THEN a test MUST assert the success response (200/204) when the use case returns `ok(...)`

#### Scenario: togglePrintable not-found path is covered
- GIVEN a row id that does not exist
- WHEN the `togglePrintable` endpoint test suite runs
- THEN a test MUST assert the controller throws the unwrapped `NotFoundError` when the use case returns `err(NotFoundError)`

#### Scenario: togglePrintable IDOR path is covered
- GIVEN a row that exists but does not belong to the caller's institution
- WHEN the `togglePrintable` endpoint test suite runs
- THEN a test MUST assert the same `NotFoundError` handling as the not-found case (IDOR MUST NOT leak existence information)
