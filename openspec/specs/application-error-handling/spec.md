# Application Error Handling Specification

## Purpose

Establishes `ApplicationError` as the sibling of `DomainError` for application-layer failures
whose cause is the CALLER'S CONTEXT (authorization/hierarchy), not an intrinsic domain invariant.
`DomainError` models invariants intrinsic to the data itself; `ApplicationError` models failures
that depend on who is asking (orchestration concern of `application/`, not `domain/`). The two
hierarchies MUST NOT overlap.

Level: `ALL` (transversal architecture concern, orthogonal to pedagogical levels — this spec
governs error propagation across `application/`, independent of INICIAL/PRIMARIO/SECUNDARIO/TERCIARIO).

Piloted by `users.use-cases.ts` (5 authorization/hierarchy call sites) — the first real consumer
of the `ApplicationError` base, proving the pattern in use rather than as an unused abstraction.

## Requirements

### Requirement: ApplicationError base class

The system SHALL define `abstract class ApplicationError extends Error` in
`api/src/application/shared/errors/application-error.ts`. Its constructor MUST accept
`(message: string, code: string, httpStatus: number = 422)` and MUST expose `code: string` and
`httpStatus: number` as readonly instance properties (mirrors the existing `DomainError` contract:
`code` on the instance; adds `httpStatus`, following the `BoletinError`-style pattern already used
elsewhere in the codebase).

#### Scenario: Concrete subclass exposes code, httpStatus and message

- GIVEN a concrete class `extends ApplicationError` constructed with a message and an explicit `httpStatus`
- WHEN the instance is inspected
- THEN `instance.message` MUST equal the constructor message, `instance.code` MUST equal the code passed by the subclass, and `instance.httpStatus` MUST equal the explicit value

#### Scenario: httpStatus defaults to 422 when omitted

- GIVEN a concrete subclass that does not pass an explicit `httpStatus` to `super(...)`
- WHEN the instance is constructed
- THEN `instance.httpStatus` MUST equal `422`

#### Scenario: ApplicationError is not a DomainError

- GIVEN an instance of any concrete `ApplicationError` subclass
- WHEN checked with `instanceof DomainError`
- THEN the check MUST return `false` — the two hierarchies MUST NOT overlap

### Requirement: AppExceptionFilter maps ApplicationError to HTTP

`AppExceptionFilter` (`api/src/presentation/shared/filters/exception.filter.ts`) SHALL define a
branch `exception instanceof ApplicationError` that sets the response `status` to
`exception.httpStatus`, `code` to `exception.code`, and `message` to `exception.message`. This
branch MUST be evaluated BEFORE the `instanceof DomainError` branch and BEFORE the generic
`instanceof Error` fallback, so no `ApplicationError` instance is ever caught by the untyped
fallback (which leaves `status` at its `500` default).

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

### Requirement: Concrete authorization error classes

The system SHALL provide `ApplicationError` subclasses co-located under
`api/src/application/shared/errors/`. Each concrete class MUST fix its own `code` and `httpStatus`
in its constructor and pass a caller-supplied `message` through to `super()`. The catalog
established by the `users.use-cases.ts` pilot:

- `InsufficientRoleHierarchyError` — fixed `code = 'INSUFFICIENT_ROLE_HIERARCHY'`, fixed `httpStatus = 403`.
- `CrossInstitutionForbiddenError` — fixed `code = 'CROSS_INSTITUTION_FORBIDDEN'`, fixed `httpStatus = 403`.

Both `extends ApplicationError`. New consumers of this capability MUST add further concrete classes
grouped by failure SEMANTICS (not by call site) — one class per distinct authorization rule, not
one per throw statement.

#### Scenario: InsufficientRoleHierarchyError has fixed code and status

- GIVEN `new InsufficientRoleHierarchyError('some message')`
- WHEN the instance is inspected
- THEN `code` MUST equal `'INSUFFICIENT_ROLE_HIERARCHY'` and `httpStatus` MUST equal `403`, regardless of the message passed in

#### Scenario: CrossInstitutionForbiddenError has fixed code and status

- GIVEN `new CrossInstitutionForbiddenError('some message')`
- WHEN the instance is inspected
- THEN `code` MUST equal `'CROSS_INSTITUTION_FORBIDDEN'` and `httpStatus` MUST equal `403`, regardless of the message passed in

### Requirement: No throw in application/ — Result propagation only

Methods in `application/` MUST NOT `throw` for failures that are expected outcomes of business
logic (authorization denials, domain invariant violations, validation errors). They MUST return
`Result<T, E>` and let the failure propagate as data. Presentation-layer call sites (controllers)
MUST adopt the project idiom `if (result.isErr()) throw result.unwrapErr(); return result.unwrap();`
(or the ok-path equivalent for methods without a meaningful return value) to convert the `Result`
into the single `throw` boundary consumed by `AppExceptionFilter`.

`users.use-cases.ts` (`CreateUserUseCase.execute`, `UpdateUserUseCase.execute`,
`DeleteUserUseCase.execute`) is the reference implementation: zero `throw` statements remain in
these methods. Authorization/hierarchy failures return `err(new InsufficientRoleHierarchyError(...))`
or `err(new CrossInstitutionForbiddenError(...))`; pre-existing domain failures
(`EmailAlreadyExistsError`, `ValidationError`) continue to return `err(...)` of the same error
type — only the propagation mechanism changed (return, not throw).

#### Scenario: Authorization denial returns err instead of throwing

- GIVEN a non-ROOT caller whose `creatorRoles` do not have sufficient rank to perform the requested operation
- WHEN the use case executes
- THEN it MUST NOT throw; it MUST return a `Result` where `isErr()` is `true` and `unwrapErr()` is an `instanceof ApplicationError`

#### Scenario: Cross-institution attempt returns err instead of throwing

- GIVEN a non-ROOT caller with `creatorInstitutionId` different from the target resource's `institutionId`
- WHEN the use case executes
- THEN it MUST NOT throw; it MUST return a `Result` where `isErr()` is `true` and `unwrapErr()` is an `instanceof CrossInstitutionForbiddenError`

#### Scenario: Domain errors still propagate as domain errors via Result

- GIVEN a pre-existing domain failure condition (e.g. duplicate email, invalid data)
- WHEN the corresponding use case executes
- THEN it MUST NOT throw; it MUST return a `Result` where `isErr()` is `true` and `unwrapErr()` is the matching domain error type, unchanged from prior behavior

### Requirement: Authorization denials return 403, not 500

Authorization/hierarchy denial conditions MUST surface as HTTP **403** with the matching `code` —
never as `500`. An authorization denial (request understood, caller lacks permission) is a client
error with a well-defined semantic (`Forbidden`), not an unexpected server failure. Any consumer
of this capability that previously expressed such a denial as a generic `throw new Error(...)`
(caught by the filter's untyped fallback, `500` by default) is fixing a bug by migrating to
`ApplicationError`, not introducing a behavior parity risk — existing tests asserting `500` for
these conditions MUST be updated to assert `403`.

#### Scenario: Insufficient role hierarchy → 403, not 500

- GIVEN a caller without sufficient role hierarchy attempts an operation requiring higher rank
- WHEN the request reaches the API (use case → controller → `AppExceptionFilter`)
- THEN the HTTP response status MUST be `403` (NOT `500`) and `error.code` MUST be `INSUFFICIENT_ROLE_HIERARCHY`

#### Scenario: Cross-institution attempt → 403, not 500

- GIVEN a non-ROOT caller with a `creatorInstitutionId` different from the target resource's `institutionId`
- WHEN the request reaches the API
- THEN the HTTP response status MUST be `403` (NOT `500`) and `error.code` MUST be `CROSS_INSTITUTION_FORBIDDEN`

#### Scenario: Regression — pre-existing tests asserting 500 for these conditions MUST be updated to 403

- GIVEN any test in the suite that currently asserts a `500` response for an authorization denial condition (a pre-existing bug being fixed by migration to this capability)
- WHEN a consumer migrates to `ApplicationError`
- THEN that test MUST be updated to assert `403` with the corresponding `code` — a test still asserting `500` for that condition afterward MUST be treated as a failing regression, not as an accepted delta

### Requirement: No regression on authorized paths; auth module untouched

Paths that are currently authorized MUST continue to succeed after any migration to this
capability: ROOT bypass (any hierarchy/institution check), a caller with strictly sufficient role
rank, and same-institution operations. The `auth` module (login/token issuance) is explicitly OUT
OF SCOPE for this capability and MUST NOT be modified by changes that consume it — this capability
governs authorization DECISIONS already made elsewhere (`role-hierarchy`), not authentication.

#### Scenario: ROOT bypasses all hierarchy and institution checks

- GIVEN a caller whose `creatorRoles` includes `ROOT`
- WHEN a use case governed by this capability executes, regardless of target roles or institution
- THEN the operation MUST succeed (`isOk()` is `true`) — no `ApplicationError` is returned

#### Scenario: Caller with sufficient hierarchy succeeds

- GIVEN a non-ROOT caller whose highest role rank is strictly greater than the target's roles (per `canManageUser`) and, where applicable, whose assigned/requested roles are within their own rank (per `canViewUser`)
- WHEN the corresponding use case executes
- THEN the operation MUST succeed (`isOk()` is `true`)

#### Scenario: Same-institution operation succeeds

- GIVEN a non-ROOT caller whose `creatorInstitutionId` matches the target resource's `institutionId`
- WHEN the use case executes
- THEN the operation MUST NOT return a `CrossInstitutionForbiddenError`

#### Scenario: auth module is untouched

- GIVEN the full diff of a change that consumes this capability
- WHEN inspecting files under the `auth` module (login/token issuance)
- THEN no file under that module MUST appear in the diff

## Out of Scope / Follow-up

Consumers not yet migrated to this capability (tracked as separate changes, NOT implemented here):

- `materia-grupo-ciclo` — FULLY MIGRATED (archived 2026-07-31) by change
  `materia-grupo-ciclo-result-migration` (3 stacked slices: A materia use-cases, B grupo use-cases +
  `validateTeacherLevel` helper, C `add-student-to-grupo`). 15 of 17 throws were mechanical
  `Result`-wraps of existing `DomainError`s; the group ⊆ materia intrinsic invariant got a NEW
  `DomainError` subclass `GrupoMateriaMismatchError` (code `GRUPO_MATERIA_MISMATCH`, HTTP 422 —
  fixing a prior bare-`Error` 500 bug). Remaining for this area: the 2 mistyped infrastructure
  guards (`update-grupo.use-case.ts` "No tenant client available", `competency.use-cases.ts:258`)
  DEFERRED to the `InfrastructureError` follow-up below; the `createGrupo` controller raw-Prisma
  anti-pattern; domain entity constructor guards.
- `reportes` / `asistencia-reporting` / `attendance-type-pdf` (30 throws) — BLOCKED until PR #111
  merges; migrate `BoletinError`/`ConstanciaError`/`AsistenciaReportingError` to `extends ApplicationError`.
- `asistencia` (41 throws, 100% domain-wrap candidate).
- `course-cycle` — FULLY MIGRATED (archived 2026-07-31): named-file slice (7 throws in
  `course-cycle.use-cases.ts` + controller + `Level.fromParts` fix) by change
  `course-cycle-result-migration`; `AlumnosXCurso` slice (10 throws across `registrar-pase`,
  `add/remove-student-from-course-cycle`, `cascade-student-materias-competencias`,
  `toggle-printable` + `AlumnosXCursoXCicloController` retrofit, plus the `PaseFechaInvalidaError`
  entity-throw bridge) by change `course-cycle-alumnos-result-migration`. Follow-up remaining for
  this area: `GenerateCourseCyclesUseCase` batch partial-success semantics (product decision).
- `attendance-type.use-cases.ts` (5 throws, misleading return types).
- Long tail: `pedagogy`, `ingresante`, `institution`, `asignacion-curso`, `nivel-terciario`.
- Shared `unwrapOrThrow` helper — 23+ controllers duplicate `if (isErr) throw unwrapErr()` inline;
  a shared helper would remove the duplication once enough consumers exist to justify it.
- 2 mistyped infrastructure guards (`update-grupo.use-case.ts:43`, `competency.use-cases.ts:258`)
  need a minimal `InfrastructureError` — separate concern from `ApplicationError`, not yet modeled.

### Classification note (ApplicationError vs DomainError)

The dividing line proven by this capability's pilot: if the failure depends on the CALLER'S
CONTEXT (who is asking, what their role/institution is) it is `ApplicationError` — an orchestration
concern of `application/`. If the failure is an invariant intrinsic to the data itself, independent
of who is asking, it is `DomainError` — regardless of which layer currently throws it. This
classification MUST be verified per call site, not assumed from the throw's current location.
