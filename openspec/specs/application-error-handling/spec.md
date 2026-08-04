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

### Requirement: InfrastructureError tier

The system SHALL define `abstract class InfrastructureError extends Error` in
`api/src/application/shared/errors/infrastructure-error.ts` — the 3rd tier of the layered model
(`DomainError → ApplicationError → InfrastructureError → Presentation`). It models failures whose
cause is the INFRASTRUCTURE ITSELF (a dependency unavailable, an artifact missing), always an
unexpected server condition. Unlike `ApplicationError`, its `httpStatus` MUST be a **fixed field
equal to `500`** (not a constructor parameter — no subclass may override it); `code` is a required
readonly instance property. The three hierarchies MUST NOT overlap (`instanceof ApplicationError`
and `instanceof DomainError` MUST both be `false`). Modeled + piloted by change
`infrastructure-error-model` (archived 2026-08-04) — see its delta spec (IEM-R1..R9) for full scenarios.

`AppExceptionFilter` MUST map an `instanceof InfrastructureError` exception to status `500`, `code`,
and `message`, in a branch evaluated after `ApplicationError` and before the generic `Error`
fallback (so `code` is never dropped). `unwrapResultOrThrow` MUST re-throw an `InfrastructureError`
as-is (identity-preserving), mirroring its `ApplicationError` branch.

Concrete subclasses (`api/src/application/shared/errors/infrastructure-errors.ts`):
`TenantClientUnavailableError` (code `TENANT_CLIENT_UNAVAILABLE`) and `TemplateNotFoundError`
(code `TEMPLATE_NOT_FOUND`). New infra consumers MUST add subclasses grouped by failure semantics.

#### Scenario: InfrastructureError maps to 500 with its code

- GIVEN a use case returns `err(new TenantClientUnavailableError())` and it reaches the HTTP boundary
- WHEN the request completes
- THEN the response status MUST be `500` and the body MUST include `error.code = 'TENANT_CLIENT_UNAVAILABLE'`

#### Scenario: httpStatus is not overridable

- GIVEN any concrete `InfrastructureError` subclass
- WHEN its constructor is inspected
- THEN it MUST NOT accept an `httpStatus` parameter — `httpStatus` MUST always resolve to `500`

## Out of Scope / Follow-up

Consumers not yet migrated to this capability (tracked as separate changes, NOT implemented here):

- `materia-grupo-ciclo` — FULLY MIGRATED (archived 2026-07-31) by change
  `materia-grupo-ciclo-result-migration` (3 stacked slices: A materia use-cases, B grupo use-cases +
  `validateTeacherLevel` helper, C `add-student-to-grupo`). 15 of 17 throws were mechanical
  `Result`-wraps of existing `DomainError`s; the group ⊆ materia intrinsic invariant got a NEW
  `DomainError` subclass `GrupoMateriaMismatchError` (code `GRUPO_MATERIA_MISMATCH`, HTTP 422 —
  fixing a prior bare-`Error` 500 bug). The 2 mistyped infrastructure guards
  (`update-grupo.use-case.ts` "No tenant client available", `competency.use-cases.ts`) are now DONE —
  piloted by `infrastructure-error-model` (archived 2026-08-04) as `err(TenantClientUnavailableError)`.
  Remaining for this area: the `createGrupo` controller raw-Prisma anti-pattern; domain entity constructor guards.
- `reportes` / `asistencia-reporting` — FULLY MIGRATED (throw → `Result`) by change
  `asistencia-reporting-result` (épico follow-up #2, 4 stacked slices A asistencia-reporting /
  B boletin / C boletin-batch / D constancia). All 28 throws across the 4 use-cases moved into the
  `Result` channel; `GenerateBoletinBatchUseCase` also changed `Promise<Buffer>` → `Promise<Result<…>>`.
  `ForbiddenError` (already `ApplicationError` via `forbidden-error-reclassification` #124) just moved
  throw → `err`. The 3 bare-`Error` classes `BoletinError`/`ConstanciaError`/`AsistenciaReportingError`
  were **NOT reclassified** — verification proved none of their sites are caller-context/authz (they are
  NOT_FOUND, intrinsic invariants, and infra guards), so the earlier blanket instruction to migrate them
  to `extends ApplicationError` was semantically incorrect and has been removed. Their correct
  classification (candidate `DomainError` for NOT_FOUND/invariants, `InfrastructureError` for the 5 infra
  guards, plus a product decision on the ambiguous `INSTITUTION_NOT_FOUND` 500 and `BATCH_ALL_FAILED`
  aggregate) is DEFERRED to follow-up #3. `attendance-type-pdf` was already FULLY MIGRATED separately
  (module `attendance-type`, archived 2026-07-31) — it is not part of this change.
- `asistencia` — FULLY MIGRATED (archived 2026-08-03) by change `asistencia-result-migration`
  (4 stacked slices: list pair, record-general, record-subject, generate + month-status). All 41
  throws across the 6 use-cases (`list-general`, `list-subject`, `record-general`, `record-subject`,
  `generate-monthly`, + the 3 `attendance-month-status` Get/Open/Close) moved into the `Result`
  channel; the shared `assertCourseCycleExists` helper and the 2 record-subject auth helpers
  (`checkDoor2`, `resolveCourseCycleId`) also return `Result`. **No behavior change** — every error
  keeps its current HTTP status (no `DOMAIN_STATUS` edit). `ForbiddenError` was not reclassified in
  *that* change (stayed `DomainError`); the `DomainError → ApplicationError` reclassification for the
  caller-context Forbidden throws was completed afterwards as the cross-cutting follow-up
  `forbidden-error-reclassification` (FULLY DONE, archived 2026-08-03 — see its entry below). No new
  error classes. 212/212 asistencia tests green, typecheck clean.
- `course-cycle` — FULLY MIGRATED (archived 2026-07-31): named-file slice (7 throws in
  `course-cycle.use-cases.ts` + controller + `Level.fromParts` fix) by change
  `course-cycle-result-migration`; `AlumnosXCurso` slice (10 throws across `registrar-pase`,
  `add/remove-student-from-course-cycle`, `cascade-student-materias-competencias`,
  `toggle-printable` + `AlumnosXCursoXCicloController` retrofit, plus the `PaseFechaInvalidaError`
  entity-throw bridge) by change `course-cycle-alumnos-result-migration`. Follow-up remaining for
  this area: `GenerateCourseCyclesUseCase` batch partial-success semantics (product decision).
- `attendance-type` — FULLY MIGRATED (archived 2026-07-31) by change `attendance-type-result-migration`.
  6 `AttendanceTypeLevelOutOfScopeError` throws (5 in `attendance-type.use-cases.ts` + 1 in the PDF
  use-case) moved into the `Result` channel. Notably, `AttendanceTypeLevelOutOfScopeError` was
  **reclassified from `DomainError` to `ApplicationError`** (fixed `httpStatus = 403`) and moved to
  `api/src/application/shared/errors/` — it is the **2nd real consumer** of the `ApplicationError`
  catalog (after the `users.use-cases.ts` pilot), proving the abstraction generalizes. HTTP 403
  unchanged (no behavior regression). The `generate-attendance-types-pdf.use-case.ts` template
  bare-`Error` guard is now DONE — piloted by `infrastructure-error-model` (archived 2026-08-04) as
  `err(TemplateNotFoundError)`.
- `ForbiddenError` reclassification — FULLY DONE (archived 2026-08-03) by change
  `forbidden-error-reclassification`. The generic `ForbiddenError` (AuthZ caller-context) was moved
  `packages/domain` → `api/src/application/shared/errors/forbidden-error.ts` and reclassified
  `DomainError → ApplicationError` (`super(message, 'FORBIDDEN', 403)`), transversally across 17
  production files / 8 modules + 16 test files; 7 use-case signatures widened to
  `Result<T, DomainError | ForbiddenError>`; the dead `DOMAIN_STATUS['FORBIDDEN']` entry removed.
  **No behavior change** — HTTP 403 preserved (the filter's `ApplicationError` branch, evaluated
  before `DomainError`, yields the 403; verified end-to-end via `3-door-enforcement.db.test.ts`
  against live Postgres). Settles the deferred "Opción A" debt from `asistencia-result-migration`.
  Scope boundary: NO `throw`→`Result` conversion (those stay per-module follow-ups). **3rd real
  consumer** of the `ApplicationError` catalog (after the `users` pilot and `attendance-type`).
- Long tail: `pedagogy`, `ingresante`, `institution`, `asignacion-curso`, `nivel-terciario`.
- Shared `unwrapOrThrow` helper — 23+ controllers duplicate `if (isErr) throw unwrapErr()` inline;
  a shared helper would remove the duplication once enough consumers exist to justify it.
- `InfrastructureError` tier — MODELED + piloted (archived 2026-08-04) by change `infrastructure-error-model`
  (base class + filter/`unwrapResultOrThrow` wiring + 3 pilots: `update-grupo`, `competency`,
  `generate-attendance-types-pdf`). Consumed by the `reporting-errors-reclassification` follow-up for its 5 infra guards.

### Classification note (ApplicationError vs DomainError)

The dividing line proven by this capability's pilot: if the failure depends on the CALLER'S
CONTEXT (who is asking, what their role/institution is) it is `ApplicationError` — an orchestration
concern of `application/`. If the failure is an invariant intrinsic to the data itself, independent
of who is asking, it is `DomainError` — regardless of which layer currently throws it. This
classification MUST be verified per call site, not assumed from the throw's current location.
