# Delta Spec: student-usecases-result-migration

## Purpose

Behavior-preserving refactor that migrates four student use-cases from `throw`-based domain error signaling to `Result<T, DomainError>` returns. The observable HTTP contract MUST remain byte-identical after the change.

Files affected:
- `api/src/application/student/use-cases/student.use-cases.ts`
- `api/src/presentation/student/student.controller.ts`
- `api/src/application/student/use-cases/__tests__/patch-student-email-guard.test.ts`

---

## Requirements

### REQ-01 — Application layer returns Result, never throws DomainError

After this change, the following use-case `execute()` methods MUST return `Promise<Result<T, DomainError>>` and MUST NOT throw any subclass of `DomainError`:

| Use-case | Return type |
|---|---|
| `PatchStudentUseCase.execute()` | `Promise<Result<Student, DomainError>>` |
| `RemoveGuardianUseCase.execute()` | `Promise<Result<void, DomainError>>` |
| `ListGuardiansUseCase.execute()` | `Promise<Result<GuardianOutput[], DomainError>>` |
| `GetMyStudentDataUseCase.execute()` | `Promise<Result<Student, DomainError>>` |

Non-domain errors (infrastructure exceptions not extending `DomainError`) MUST still propagate as thrown exceptions — this is intentional convention.

#### Scenario: No DomainError thrown from PatchStudentUseCase.execute()

- GIVEN a valid student id and any error condition that previously threw a DomainError
- WHEN `PatchStudentUseCase.execute()` is called
- THEN it MUST NOT throw; it MUST return a `Result` whose `isErr()` is `true`

#### Scenario: No DomainError thrown from RemoveGuardianUseCase.execute()

- GIVEN any error condition that previously threw a DomainError
- WHEN `RemoveGuardianUseCase.execute()` is called
- THEN it MUST NOT throw; it MUST return a `Result` whose `isErr()` is `true`

#### Scenario: No DomainError thrown from ListGuardiansUseCase.execute()

- GIVEN any error condition that previously threw a DomainError
- WHEN `ListGuardiansUseCase.execute()` is called
- THEN it MUST NOT throw; it MUST return a `Result` whose `isErr()` is `true`

#### Scenario: No DomainError thrown from GetMyStudentDataUseCase.execute()

- GIVEN any error condition that previously threw a DomainError
- WHEN `GetMyStudentDataUseCase.execute()` is called
- THEN it MUST NOT throw; it MUST return a `Result` whose `isErr()` is `true`

---

### REQ-02 — throwGuardianError() MUST map ForbiddenError to HTTP 403

`StudentController.throwGuardianError()` MUST handle `ForbiddenError` before the generic `DomainError` catch-all branch. The `ForbiddenError` branch MUST throw `ForbiddenException` (HTTP 403). The existing `DomainError` fallthrough (HTTP 400) MUST NOT be reachable for `ForbiddenError` instances.

This fix MUST be applied before any use-case migration that routes errors through `throwGuardianError()`.

#### Scenario: ForbiddenError maps to 403, not 400

- GIVEN `throwGuardianError()` receives a `ForbiddenError` instance
- WHEN the method executes
- THEN it MUST throw `ForbiddenException` (HTTP 403)
- AND it MUST NOT throw `BadRequestException` (HTTP 400)

---

### REQ-03 — PATCH /students/:id HTTP status parity

The `PATCH /students/:id` endpoint MUST preserve the following status codes after the migration. Each error condition was previously handled via a thrown domain error reaching the global exception filter; after the migration it MUST be handled by the controller via `Result` unwrapping.

#### Scenario: Student not found → 404

- GIVEN no student exists with the provided `:id`
- WHEN `PATCH /students/:id` is called by any caller
- THEN the response MUST be HTTP 404

#### Scenario: STUDENT caller editing another student's profile → 403

- GIVEN a caller with role `STUDENT` whose `userId` does NOT match `student.userId`
- WHEN `PATCH /students/:id` is called for that student
- THEN the response MUST be HTTP 403

#### Scenario: TUTOR caller not linked to the target student → 403

- GIVEN a caller with role `TUTOR` who has no `StudentGuardian` record linking them to the target student
- WHEN `PATCH /students/:id` is called for that student
- THEN the response MUST be HTTP 403

#### Scenario: Restricted-role caller patching a forbidden field → 403

- GIVEN a caller whose role is in the restricted set (TUTOR or STUDENT) and the request body contains a field outside the allowed list for that role
- WHEN `PATCH /students/:id` is called
- THEN the response MUST be HTTP 403

#### Scenario: Invalid email value → 400

- GIVEN a valid student and caller with sufficient role
- WHEN `PATCH /students/:id` is called with a non-empty `fatherEmail` or `motherEmail` that fails `Email.create()` validation
- THEN the response MUST be HTTP 400

#### Scenario: Valid patch → 200

- GIVEN a student exists and the caller has permission to edit the requested fields
- WHEN `PATCH /students/:id` is called with valid body
- THEN the response MUST be HTTP 200 with the updated student in `{ data: ... }`

---

### REQ-04 — DELETE /students/:id/guardians/:guardianId HTTP status parity

#### Scenario: Guardian not found → 404

- GIVEN no `StudentGuardian` exists with the provided `:guardianId`
- WHEN `DELETE /students/:id/guardians/:guardianId` is called
- THEN the response MUST be HTTP 404

#### Scenario: Guardian exists but belongs to a different student → 404

- GIVEN a `StudentGuardian` with `id = :guardianId` exists, but its `studentId` does NOT match `:id`
- WHEN `DELETE /students/:id/guardians/:guardianId` is called
- THEN the response MUST be HTTP 404 (ownership check, consistent with prior behavior)

#### Scenario: Valid delete → 204

- GIVEN a `StudentGuardian` with `id = :guardianId` belonging to student `:id` exists
- WHEN `DELETE /students/:id/guardians/:guardianId` is called
- THEN the record is deleted and the response MUST be HTTP 204 with no body

---

### REQ-05 — GET /students/:id/guardians HTTP status parity

#### Scenario: Student not found → 404

- GIVEN no student exists with the provided `:id`
- WHEN `GET /students/:id/guardians` is called
- THEN the response MUST be HTTP 404

#### Scenario: Student found → 200 with guardian list

- GIVEN a student exists with `id = :id`
- WHEN `GET /students/:id/guardians` is called
- THEN the response MUST be HTTP 200 with `{ data: GuardianOutput[] }`

---

### REQ-06 — GET /students/me HTTP status parity

#### Scenario: Authenticated user has no linked student → 404

- GIVEN an authenticated user whose `userId` has no associated `Student` record
- WHEN `GET /students/me` is called
- THEN the response MUST be HTTP 404

#### Scenario: Authenticated user has a linked student → 200

- GIVEN an authenticated user whose `userId` maps to an existing student
- WHEN `GET /students/me` is called
- THEN the response MUST be HTTP 200 with `{ data: <student> }`

---

### REQ-07 — Success paths unchanged

All endpoints' 200/201/204 success responses (body shape, status code, headers) MUST remain identical to the pre-migration behavior. The refactor is internal only.

---

### REQ-08 — Non-domain errors still propagate as throws

For all four migrated use-cases, exceptions that are NOT subclasses of `DomainError` (e.g., Prisma errors, network errors) MUST still propagate as thrown exceptions and MUST NOT be captured into a `Result`. The global `AppExceptionFilter` remains responsible for mapping these to HTTP 500.

#### Scenario: Infrastructure error is not swallowed

- GIVEN the repository throws a non-domain error (e.g., `PrismaClientKnownRequestError`)
- WHEN any migrated use-case `execute()` is called
- THEN the error MUST propagate as a throw (not returned as `err(...)`)

---

### REQ-09 — Test suite consistency

#### REQ-09-A: Stale assertions updated

The 5 assertions in `patch-student-email-guard.test.ts` that currently call `.resolves.toBeDefined()` or check a raw `Student` return MUST be updated to unwrap the `Result` (e.g., `.resolves.toSatisfy(r => r.isOk())` or equivalent) to reflect the new return type.

#### REQ-09-B: Error-path unit tests added

For each of the four migrated use-cases, at least one new unit test MUST assert the error-path return contract:

| Use-case | Required error scenario to test |
|---|---|
| `PatchStudentUseCase` | Student not found returns `err(NotFoundError)` |
| `PatchStudentUseCase` | STUDENT editing another returns `err(ForbiddenError)` |
| `PatchStudentUseCase` | Invalid email returns `err(ValidationError)` |
| `RemoveGuardianUseCase` | Guardian not found returns `err(NotFoundError)` |
| `RemoveGuardianUseCase` | Guardian/student ownership mismatch returns `err(NotFoundError)` |
| `ListGuardiansUseCase` | Student not found returns `err(NotFoundError)` |
| `GetMyStudentDataUseCase` | Student not found returns `err(NotFoundError)` |

#### Scenario: PatchStudent — student not found returns err Result

- GIVEN a `PatchStudentUseCase` with a repo that returns `null` for the given id
- WHEN `execute()` is called
- THEN the return value MUST satisfy `result.isErr() === true`
- AND `result.unwrapErr()` MUST be an instance of `NotFoundError`

#### Scenario: PatchStudent — invalid email returns err Result

- GIVEN a `PatchStudentUseCase` with a valid student in the repo and an ADMIN caller
- WHEN `execute()` is called with `fatherEmail: 'not-an-email'`
- THEN the return value MUST satisfy `result.isErr() === true`
- AND `result.unwrapErr()` MUST be an instance of `ValidationError`

#### Scenario: RemoveGuardian — guardian not found returns err Result

- GIVEN a `RemoveGuardianUseCase` with a repo that returns `null` for the given guardianId
- WHEN `execute()` is called
- THEN the return value MUST satisfy `result.isErr() === true`
- AND `result.unwrapErr()` MUST be an instance of `NotFoundError`

#### Scenario: ListGuardians — student not found returns err Result

- GIVEN a `ListGuardiansUseCase` with a student repo that returns `null` for the given studentId
- WHEN `execute()` is called
- THEN the return value MUST satisfy `result.isErr() === true`
- AND `result.unwrapErr()` MUST be an instance of `NotFoundError`

#### Scenario: GetMyStudentData — user has no student returns err Result

- GIVEN a `GetMyStudentDataUseCase` with a student repo that returns `null` for the given userId
- WHEN `execute()` is called
- THEN the return value MUST satisfy `result.isErr() === true`
- AND `result.unwrapErr()` MUST be an instance of `NotFoundError`

---

## Out of Scope

- Infrastructure rethrows (`throw e` for non-domain errors in repo catch blocks) — intentional convention, MUST remain as-is.
- Any use-cases outside `student.use-cases.ts` (AssignGuardian, CreateStudyTutor, UpdateStudyTutor are already migrated and MUST NOT be touched).
- Any non-student controllers or use-cases.
- HTTP response body shape changes.
