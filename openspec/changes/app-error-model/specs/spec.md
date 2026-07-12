# Spec: application-error-handling (delta — app-error-model)

## Purpose

Establishes `ApplicationError` as the sibling of `DomainError` for application-layer failures whose cause is the CALLER'S CONTEXT (authorization/hierarchy), not an intrinsic domain invariant. Proves the base in real use by migrating `users.use-cases.ts`'s 5 generic authorization throws. Corrects a live bug: those denials currently surface as HTTP 500 instead of 403.

This is a **new capability** (`application-error-handling`) — it does not extend an existing domain spec. Level: `ALL` (transversal architecture concern, orthogonal to pedagogical levels).

Out of scope (declared, follow-ups): materia-grupo-ciclo (MGC-R4's new DomainError + domain-wrap of its other 16 throws), asistencia (41), course-cycle (17), attendance-type (5), reportes/reporting/attendance-type-pdf (post-#111), infra guards (2), shared `unwrapOrThrow` helper. `auth`/token/login module is NOT touched.

## Requirements

### Requirement: ApplicationError base class (AEM-R1)

The system SHALL define `abstract class ApplicationError extends Error` in `api/src/application/shared/errors/application-error.ts`. Its constructor MUST accept `(message: string, code: string, httpStatus: number = 422)` and MUST expose `code: string` and `httpStatus: number` as readonly instance properties (mirrors the existing `DomainError` contract: `code` on the instance; adds `httpStatus`, following the `BoletinError`-style pattern already used elsewhere in the codebase).

#### Scenario: Concrete subclass exposes code, httpStatus and message

- GIVEN a concrete class `extends ApplicationError` constructed with a message and an explicit `httpStatus`
- WHEN the instance is inspected
- THEN `instance.message` MUST equal the constructor message, `instance.code` MUST equal the code passed by the subclass, and `instance.httpStatus` MUST equal the explicit value

#### Scenario: httpStatus defaults to 422 when omitted

- GIVEN a hypothetical concrete subclass that does not pass an explicit `httpStatus` to `super(...)`
- WHEN the instance is constructed
- THEN `instance.httpStatus` MUST equal `422`

#### Scenario: ApplicationError is not a DomainError

- GIVEN an instance of any concrete `ApplicationError` subclass
- WHEN checked with `instanceof DomainError`
- THEN the check MUST return `false` — the two hierarchies MUST NOT overlap

### Requirement: AppExceptionFilter maps ApplicationError to HTTP (AEM-R2)

`AppExceptionFilter` (`api/src/presentation/shared/filters/exception.filter.ts`) SHALL add a branch `exception instanceof ApplicationError` that sets the response `status` to `exception.httpStatus`, `code` to `exception.code`, and `message` to `exception.message`. This branch MUST be evaluated BEFORE the existing `instanceof DomainError` branch and BEFORE the generic `instanceof Error` fallback, so no `ApplicationError` instance is ever caught by the untyped fallback (which leaves `status` at its `500` default).

#### Scenario: ApplicationError instance maps to its own httpStatus and code

- GIVEN the filter receives an exception that is `instanceof ApplicationError` with `httpStatus = 403` and `code = 'SOME_CODE'`
- WHEN `catch()` runs
- THEN the JSON response body MUST have `error.status = 403`, `error.code = 'SOME_CODE'`, `error.message` equal to the exception's message

#### Scenario: ApplicationError branch does not fall through to the generic Error branch

- GIVEN the same `ApplicationError` instance as above
- WHEN `catch()` runs
- THEN the response status MUST NOT be `500` (the value the generic `instanceof Error` fallback would have produced)

#### Scenario: DomainError handling is unaffected

- GIVEN the filter receives an exception that is `instanceof DomainError` (not `ApplicationError`)
- WHEN `catch()` runs
- THEN the existing `DOMAIN_STATUS` mapping behavior MUST be unchanged

### Requirement: Concrete authorization error classes (AEM-R3)

The system SHALL provide two concrete `ApplicationError` subclasses in the same errors module (or a co-located file under `application/shared/errors/`):

- `InsufficientRoleHierarchyError` — fixed `code = 'INSUFFICIENT_ROLE_HIERARCHY'`, fixed `httpStatus = 403`. Constructor MUST accept a caller-supplied `message` (the specific denial message from each call site) and pass it through to `super()`.
- `CrossInstitutionForbiddenError` — fixed `code = 'CROSS_INSTITUTION_FORBIDDEN'`, fixed `httpStatus = 403`. Same message-passthrough contract.

Both MUST `extends ApplicationError`.

#### Scenario: InsufficientRoleHierarchyError has fixed code and status

- GIVEN `new InsufficientRoleHierarchyError('some message')`
- WHEN the instance is inspected
- THEN `code` MUST equal `'INSUFFICIENT_ROLE_HIERARCHY'` and `httpStatus` MUST equal `403`, regardless of the message passed in

#### Scenario: CrossInstitutionForbiddenError has fixed code and status

- GIVEN `new CrossInstitutionForbiddenError('some message')`
- WHEN the instance is inspected
- THEN `code` MUST equal `'CROSS_INSTITUTION_FORBIDDEN'` and `httpStatus` MUST equal `403`, regardless of the message passed in

### Requirement: users.use-cases.ts migrates to Result — no throw remains (AEM-R4)

The affected methods in `api/src/application/users/use-cases/users.use-cases.ts` (`CreateUserUseCase.execute`, `UpdateUserUseCase.execute`, `DeleteUserUseCase.execute`) SHALL return `Result<T, E>` for every failure path currently expressed with `throw`. Concretely:

- The 5 authorization/hierarchy `throw new Error(...)` sites (today at lines 211, 420, 428, 437, 629) MUST become `return err(new InsufficientRoleHierarchyError(...))` (sites 211, 428, 437, 629 — insufficient role hierarchy for create/update roles, update, delete) or `return err(new CrossInstitutionForbiddenError(...))` (site 420 — cross-institution update), preserving each site's original message text as the constructor argument.
- The 4 domain-error throw sites (today at lines 205, 446 for `EmailAlreadyExistsError`, and the `throw validationResult.unwrapErr()` sites at 241 and 492 for `ValidationError` via `validateLevelsSubset`) MUST become `return err(...)` of the same domain error instance/type — no behavior change in error type, only in propagation mechanism (return, not throw).
- Call sites in the corresponding `presentation/users/*.controller.ts` files MUST adopt the existing project idiom already used 23+ times elsewhere: `if (result.isErr()) throw result.unwrapErr(); return result.unwrap();` (or the ok-path equivalent for methods without a meaningful return value, e.g. `DeleteUserUseCase`).
- After the change, `users.use-cases.ts` MUST contain zero `throw` statements in the migrated methods — this is a hard architectural constraint per the project's `error-handling` standard (no `throw` in `application/`).

#### Scenario: CreateUserUseCase returns err for insufficient hierarchy instead of throwing

- GIVEN a non-ROOT caller whose `creatorRoles` do not have sufficient rank to assign the requested `roles`
- WHEN `CreateUserUseCase.execute(...)` is called
- THEN it MUST NOT throw; it MUST return a `Result` where `isErr()` is `true` and `unwrapErr()` is an `instanceof InsufficientRoleHierarchyError`

#### Scenario: UpdateUserUseCase returns err for cross-institution attempt instead of throwing

- GIVEN a non-ROOT caller with `creatorInstitutionId` different from the target user's `institutionId`
- WHEN `UpdateUserUseCase.execute(...)` is called
- THEN it MUST NOT throw; it MUST return a `Result` where `isErr()` is `true` and `unwrapErr()` is an `instanceof CrossInstitutionForbiddenError`

#### Scenario: UpdateUserUseCase returns err for insufficient hierarchy (manage) instead of throwing

- GIVEN a non-ROOT caller whose highest role rank is not strictly greater than the target's current roles (per `canManageUser`)
- WHEN `UpdateUserUseCase.execute(...)` is called
- THEN it MUST NOT throw; it MUST return a `Result` where `isErr()` is `true` and `unwrapErr()` is an `instanceof InsufficientRoleHierarchyError`

#### Scenario: UpdateUserUseCase returns err for insufficient hierarchy (role assignment) instead of throwing

- GIVEN a non-ROOT caller attempting to assign roles of higher rank than their own via update
- WHEN `UpdateUserUseCase.execute(...)` is called
- THEN it MUST NOT throw; it MUST return a `Result` where `isErr()` is `true` and `unwrapErr()` is an `instanceof InsufficientRoleHierarchyError`

#### Scenario: DeleteUserUseCase returns err for insufficient hierarchy instead of throwing

- GIVEN a non-ROOT caller whose highest role rank is not strictly greater than the target's current roles
- WHEN `DeleteUserUseCase.execute(...)` is called
- THEN it MUST NOT throw; it MUST return a `Result` where `isErr()` is `true` and `unwrapErr()` is an `instanceof InsufficientRoleHierarchyError`

#### Scenario: Domain errors still propagate as domain errors via Result

- GIVEN an email that already exists (create or update path) or levels that are not a subset of institution levels
- WHEN the corresponding use case executes
- THEN it MUST NOT throw; it MUST return a `Result` where `isErr()` is `true` and `unwrapErr()` is an `instanceof EmailAlreadyExistsError` or `instanceof ValidationError` respectively, matching today's error type

### Requirement: Authorization denials return 403, not 500 (AEM-R5)

Today, the 5 generic `throw new Error(...)` authorization/hierarchy denial sites in `users.use-cases.ts` are caught by the filter's untyped `instanceof Error` fallback, which does not alter `status` from its `500` default — an authorization denial (request understood, caller lacks permission) incorrectly surfaces as HTTP 500. After this change, the same denial conditions MUST surface as HTTP **403** with the matching `code`. This is a deliberate behavior correction, NOT parity — any existing test asserting the previous `500` response for these conditions MUST be updated to assert `403`.

#### Scenario: Insufficient role hierarchy on create → 403, not 500

- GIVEN a caller without sufficient role hierarchy attempts to create a user with roles above their own rank
- WHEN the request reaches the API (use case → controller → `AppExceptionFilter`)
- THEN the HTTP response status MUST be `403` (NOT `500`) and `error.code` MUST be `INSUFFICIENT_ROLE_HIERARCHY`

#### Scenario: Insufficient role hierarchy on update (target's existing roles) → 403, not 500

- GIVEN a caller without sufficient role hierarchy attempts to modify a user whose current roles outrank the caller
- WHEN the request reaches the API
- THEN the HTTP response status MUST be `403` (NOT `500`) and `error.code` MUST be `INSUFFICIENT_ROLE_HIERARCHY`

#### Scenario: Insufficient role hierarchy on update (target roles being assigned) → 403, not 500

- GIVEN a caller attempts to assign roles of higher rank than their own during an update
- WHEN the request reaches the API
- THEN the HTTP response status MUST be `403` (NOT `500`) and `error.code` MUST be `INSUFFICIENT_ROLE_HIERARCHY`

#### Scenario: Insufficient role hierarchy on delete → 403, not 500

- GIVEN a caller without sufficient role hierarchy attempts to delete a user whose current roles outrank the caller
- WHEN the request reaches the API
- THEN the HTTP response status MUST be `403` (NOT `500`) and `error.code` MUST be `INSUFFICIENT_ROLE_HIERARCHY`

#### Scenario: Cross-institution update → 403, not 500

- GIVEN a non-ROOT caller with a `creatorInstitutionId` different from the target user's `institutionId` attempts an update
- WHEN the request reaches the API
- THEN the HTTP response status MUST be `403` (NOT `500`) and `error.code` MUST be `CROSS_INSTITUTION_FORBIDDEN`

#### Scenario: Regression — pre-existing tests asserting 500 for these conditions MUST be updated to 403

- GIVEN any test in the suite that currently asserts a `500` response for one of the five conditions above (a pre-existing bug being fixed by this change)
- WHEN this change is applied
- THEN that test MUST be updated to assert `403` with the corresponding `code` — a test still asserting `500` for these conditions after this change is applied MUST be treated as a failing regression, not as a delta of expected behavior

### Requirement: No regression on authorized paths and login/token module untouched (AEM-R6)

Paths that are currently authorized MUST continue to succeed after this change: ROOT bypass (any hierarchy/institution check), a caller with strictly sufficient role rank (per `canManageUser`/`canViewUser`), and same-institution updates. The `auth` module (login/token issuance) is explicitly OUT OF SCOPE and MUST NOT be modified by this change.

#### Scenario: ROOT bypasses all hierarchy and institution checks

- GIVEN a caller whose `creatorRoles` includes `ROOT`
- WHEN `CreateUserUseCase`, `UpdateUserUseCase`, or `DeleteUserUseCase` execute regardless of target roles or institution
- THEN the operation MUST succeed (`isOk()` is `true`) — no `ApplicationError` is returned

#### Scenario: Caller with sufficient hierarchy succeeds

- GIVEN a non-ROOT caller whose highest role rank is strictly greater than the target's roles (per `canManageUser`) and, where applicable, whose assigned/requested roles are within their own rank (per `canViewUser`)
- WHEN the corresponding use case executes
- THEN the operation MUST succeed (`isOk()` is `true`)

#### Scenario: Same-institution update succeeds

- GIVEN a non-ROOT caller whose `creatorInstitutionId` matches the target user's `institutionId`
- WHEN `UpdateUserUseCase.execute(...)` runs
- THEN the operation MUST NOT return a `CrossInstitutionForbiddenError`

#### Scenario: auth module is untouched

- GIVEN the full diff of this change
- WHEN inspecting files under the `auth` module (login/token issuance)
- THEN no file under that module MUST appear in the diff
