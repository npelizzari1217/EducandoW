# Delta Spec — attendance-type-result-migration

Consumes: `application-error-handling` (canonical capability, `openspec/specs/application-error-handling/spec.md`) —
this change adds `AttendanceTypeLevelOutOfScopeError` as the **2nd real consumer** of the
`ApplicationError` catalog ("Concrete authorization error classes" requirement), after the
`users.use-cases.ts` pilot. No behavior change: HTTP 403 is preserved before and after.

## ADDED Requirements

### Requirement: ATRM-R1 — AttendanceTypeLevelOutOfScopeError is classified as ApplicationError

`AttendanceTypeLevelOutOfScopeError` MUST extend `ApplicationError` (not `DomainError`), with fixed
`code = 'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE'` and fixed `httpStatus = 403`, per the canonical
capability's non-overlap rule (an `ApplicationError` instance MUST NOT be `instanceof DomainError`).

#### Scenario: Instance classification is unambiguous

- GIVEN `new AttendanceTypeLevelOutOfScopeError('some message')`
- WHEN the instance is inspected
- THEN `instanceof ApplicationError` MUST be `true`, `instanceof DomainError` MUST be `false`,
  `code` MUST equal `'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE'`, and `httpStatus` MUST equal `403`
  regardless of the message passed in

### Requirement: ATRM-R2 — Class resides in the api application layer only

The class MUST reside under `api/src/application/shared/errors/`, co-located with
`ApplicationError` and its pilot subclasses. `@educandow/domain` MUST NOT export this class (no
dangling export in `src/index.ts`, `src/attendance-type/index.ts`, or
`src/attendance-type/errors/index.ts`), enforcing that `packages/domain` does not depend on `api`.

#### Scenario: No domain-package export remains

- GIVEN the post-migration state of `packages/domain`
- WHEN searching its public exports for `AttendanceTypeLevelOutOfScopeError`
- THEN no export path MUST resolve to this class

#### Scenario: Class is importable only from the api-local path

- GIVEN a consumer in `api` needing this error
- WHEN it imports the class
- THEN the import MUST resolve to `api/src/application/shared/errors/...`, never to `@educandow/domain`

### Requirement: ATRM-R3 — No throw remains for scope denials

The 6 call sites (5 in `attendance-type.use-cases.ts`: Create, Update, Delete, List, Get; 1 in
`generate-attendance-types-pdf.use-case.ts`) MUST return `err(new AttendanceTypeLevelOutOfScopeError(...))`
instead of throwing. The return-type unions of Create, Update, Delete, Get, and the PDF use case
MUST widen to include this error. `List` MUST change from a bare `Promise<AttendanceType[]>` to
`Promise<Result<AttendanceType[], AttendanceTypeLevelOutOfScopeError>>`.

#### Scenario: Scope-out-of-bounds request returns err, does not throw

- GIVEN a caller whose scope excludes the target `level`
- WHEN any of Create, Update, Delete, Get, List, or the PDF use case executes
- THEN the use case MUST NOT throw; it MUST return a `Result` where `isErr()` is `true` and
  `unwrapErr()` is an `instanceof AttendanceTypeLevelOutOfScopeError`

#### Scenario: List returns Result even on the success path

- GIVEN a caller whose scope includes the target `level`
- WHEN `List` executes
- THEN it MUST return `Result` with `isOk()` true wrapping the array (not a bare array)

### Requirement: ATRM-R4 — HTTP status preserved at 403

A scope denial MUST still surface as HTTP 403 with `code = 'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE'`,
now produced via the `ApplicationError` filter branch (`exception.httpStatus`) instead of the
`DOMAIN_STATUS` map. The `DOMAIN_STATUS` entry for this code MUST be removed as dead code.

#### Scenario: Status is 403 both before and after migration

- GIVEN any of the 6 previously-throwing call sites now returning `err(...)`
- WHEN the request reaches `AppExceptionFilter` via the controller's throw boundary
- THEN the HTTP response status MUST be `403` — identical to pre-migration behavior, not a regression

### Requirement: ATRM-R5 — Controller idiom for list()

`list()` in `attendance-type.controller.ts` MUST adopt
`if (result.isErr()) throw result.unwrapErr();` to convert the widened `Result` into the throw
boundary. `create`, `getOne`, `update`, `remove`, and `printList` MUST remain unchanged — they
already use this idiom or `unwrapResultOrThrow`.

#### Scenario: list() propagates the scope error via the idiom

- GIVEN `ListAttendanceTypesUseCase.execute` returns `err(new AttendanceTypeLevelOutOfScopeError(...))`
- WHEN the controller's `list()` handler runs
- THEN it MUST throw that error via `result.unwrapErr()`, and the other 5 controller methods'
  code MUST be untouched by this change

### Requirement: ATRM-R6 — No regression on already-correct errors

`AttendanceTypeCodeDuplicateError`, `SystemAttendanceTypeError`, and `AttendanceTypeNotFoundError`
MUST keep their existing `err`-return behavior and HTTP statuses unchanged by this migration.

#### Scenario: Pre-existing Result-based errors are untouched

- GIVEN a duplicate-code, system-protected, or not-found condition
- WHEN the corresponding use case executes
- THEN it MUST return `err(...)` of the same error type and same HTTP status as before this change

### Requirement: ATRM-R7 — Scope and guardrails

This migration MUST NOT introduce new `ApplicationError` base classes (reuse the existing
hierarchy). The PDF template bare-`Error` guard (`generate-attendance-types-pdf.use-case.ts:112`)
and the `auth` module MUST remain untouched. `openspec/specs/attendance-types/spec.md` (errors
table annotation, ~lines 840-846) MUST be updated to state the classification is now materialized
in code as `ApplicationError`, not merely documented intent.

#### Scenario: No new base classes introduced

- GIVEN the full diff of this change
- WHEN inspecting `api/src/application/shared/errors/`
- THEN no class other than `AttendanceTypeLevelOutOfScopeError` (moved) MUST be newly added as a base class

#### Scenario: PDF template guard and auth module are out of diff

- GIVEN the full diff of this change
- WHEN inspecting `generate-attendance-types-pdf.use-case.ts:112` and any file under the `auth` module
- THEN the bare-`Error` guard MUST be unchanged and no `auth` file MUST appear in the diff
