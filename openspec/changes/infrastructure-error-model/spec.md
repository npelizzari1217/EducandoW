# Spec Delta: infrastructure-error-model

> Extends the `application-error-handling` capability (`openspec/specs/application-error-handling/spec.md`)
> with its 3rd tier: `InfrastructureError`. Mirrors the `ApplicationError` requirements in that spec —
> same base-class / filter-wiring / unwrap-wiring / "no throw" shape, applied to infra-caused failures
> instead of caller-context ones.

## Nivel pedagógico afectado

**N/A** — transversal error-handling infrastructure, orthogonal to INICIAL/PRIMARIO/SECUNDARIO/TERCIARIO.

## Purpose

Completes the layered error model `DomainError → ApplicationError → InfrastructureError → Presentation`
by defining the `InfrastructureError` tier: failures whose cause is the INFRASTRUCTURE ITSELF (a
dependency unavailable, an artifact missing), not a domain invariant and not the caller's context.
Where `DomainError` models invariants intrinsic to the data and `ApplicationError` models
caller-context failures, `InfrastructureError` models a working system's dependency failing to be
there — always an unexpected server condition, always HTTP `500`. The three hierarchies MUST NOT
overlap.

Piloted by 3 sites that already type-mismatch a bare `throw new Error(...)` against a `Result`-returning
signature (or an untyped `Promise<void>`): `update-grupo.use-case.ts`, `competency.use-cases.ts`,
`generate-attendance-types-pdf.use-case.ts`.

## Requirements

### Requirement: InfrastructureError base class

The system SHALL define `abstract class InfrastructureError extends Error` in
`api/src/application/shared/errors/infrastructure-error.ts`. It MUST expose `code: string` (readonly,
required — supplied by the concrete subclass, no default) and `httpStatus: number` (readonly) as
instance properties. Unlike `ApplicationError`, `httpStatus` MUST be a **fixed field equal to `500`**,
NOT a constructor parameter — no subclass may override it, because an infrastructure failure is by
definition an unexpected server condition.

#### Scenario: Concrete subclass exposes code, httpStatus and message

- GIVEN a concrete class `extends InfrastructureError` constructed with a message and a code
- WHEN the instance is inspected
- THEN `instance.message` MUST equal the constructor message, `instance.code` MUST equal the code passed by the subclass, and `instance.httpStatus` MUST equal `500`

#### Scenario: httpStatus cannot be overridden by a subclass

- GIVEN any concrete `InfrastructureError` subclass
- WHEN its constructor is inspected
- THEN it MUST NOT accept an `httpStatus` parameter — `httpStatus` MUST always resolve to the fixed value `500`

#### Scenario: InfrastructureError is not an ApplicationError or a DomainError

- GIVEN an instance of any concrete `InfrastructureError` subclass
- WHEN checked with `instanceof ApplicationError` and `instanceof DomainError`
- THEN both checks MUST return `false` — the three hierarchies MUST NOT overlap

#### Scenario: InfrastructureError is still an Error

- GIVEN an instance of any concrete `InfrastructureError` subclass
- WHEN checked with `instanceof Error`
- THEN the check MUST return `true`

### Requirement: Concrete infrastructure error classes

The system SHALL provide `InfrastructureError` subclasses co-located in
`api/src/application/shared/errors/infrastructure-errors.ts`. Each concrete class MUST fix its own
`code` in its constructor and pass a caller-supplied `message` through to `super()`. The catalog
established by this change's 3 pilots:

- `TenantClientUnavailableError` — fixed `code = 'TENANT_CLIENT_UNAVAILABLE'`. Reused by pilot 1
  (`update-grupo`) and pilot 2 (`competency`) — the same infra failure (tenant Prisma client not
  available), not duplicated per call site.
- `TemplateNotFoundError` — fixed `code = 'TEMPLATE_NOT_FOUND'`. Used by pilot 3
  (`generate-attendance-types-pdf`); the code deliberately aligns with the pre-existing legacy
  `TEMPLATE_NOT_FOUND` string so the `reporting-errors-reclassification` follow-up can reuse it.

Both MUST `extend InfrastructureError`.

#### Scenario: TenantClientUnavailableError has fixed code and status

- GIVEN `new TenantClientUnavailableError()`
- WHEN the instance is inspected
- THEN `code` MUST equal `'TENANT_CLIENT_UNAVAILABLE'` and `httpStatus` MUST equal `500`

#### Scenario: TemplateNotFoundError has fixed code and status

- GIVEN `new TemplateNotFoundError('attendance-types.hbs')`
- WHEN the instance is inspected
- THEN `code` MUST equal `'TEMPLATE_NOT_FOUND'` and `httpStatus` MUST equal `500`, and the message MUST reference the supplied template name

### Requirement: AppExceptionFilter maps InfrastructureError to HTTP

`AppExceptionFilter` (`api/src/presentation/shared/filters/exception.filter.ts`) SHALL define a
branch `exception instanceof InfrastructureError` that sets the response `status` to
`exception.httpStatus` (`500`), `code` to `exception.code`, and `message` to `exception.message`.
This branch MUST be evaluated AFTER the `instanceof ApplicationError` branch and BEFORE the generic
`instanceof Error` fallback, so an `InfrastructureError` instance is never caught by the untyped
fallback — which would produce the same `500` status but silently drop `code`.

#### Scenario: InfrastructureError instance maps to 500 with its code

- GIVEN the filter receives an exception that is `instanceof InfrastructureError` with `code = 'TENANT_CLIENT_UNAVAILABLE'`
- WHEN `catch()` runs
- THEN the JSON response body MUST have `error.status = 500`, `error.code = 'TENANT_CLIENT_UNAVAILABLE'`, `error.message` equal to the exception's message

#### Scenario: InfrastructureError branch does not fall through to the generic Error branch

- GIVEN the same `InfrastructureError` instance as above
- WHEN `catch()` runs
- THEN `error.code` MUST be present in the response body (the generic `instanceof Error` fallback would have omitted it)

#### Scenario: ApplicationError and DomainError handling is unaffected

- GIVEN the filter receives an exception that is `instanceof ApplicationError` or `instanceof DomainError` (not `InfrastructureError`)
- WHEN `catch()` runs
- THEN the existing mapping behavior for those branches MUST be unchanged

### Requirement: unwrapResultOrThrow re-throws InfrastructureError as-is

The `unwrapResultOrThrow` helper SHALL define a dedicated branch that re-throws an
`InfrastructureError` instance unchanged, mirroring the existing `ApplicationError` branch. It MUST
NOT wrap the instance in a generic `HttpException` or lose its `instanceof` identity before it
reaches `AppExceptionFilter`.

#### Scenario: InfrastructureError passed through unwrapResultOrThrow preserves identity

- GIVEN a `Result` whose `unwrapErr()` returns an `InfrastructureError` instance
- WHEN `unwrapResultOrThrow` is called on that `Result`
- THEN it MUST throw the SAME instance (or an equivalent preserving `instanceof InfrastructureError === true`), not a generic `HttpException`

### Requirement: Pilot 1 — update-grupo tenant-client guard returns Result

`UpdateGrupoUseCase` (`materia-grupo-ciclo/update-grupo.use-case.ts`) MUST replace its
`throw new Error('No tenant client available')` tenant-client guard with
`return err(new TenantClientUnavailableError())`. The use case's return type MUST widen to include
`TenantClientUnavailableError` in its error union. The controller requires NO change (it already
throws via `unwrapErr()`).

#### Scenario: Missing tenant client returns err, not throw

- GIVEN the tenant client is unavailable when `UpdateGrupoUseCase.execute` runs
- WHEN the use case executes
- THEN it MUST NOT throw directly; it MUST return a `Result` where `isErr()` is `true` and `unwrapErr()` is `instanceof TenantClientUnavailableError`

#### Scenario: Endpoint still responds 500, now with code

- GIVEN the same missing-tenant-client condition reaches the HTTP layer
- WHEN the request completes
- THEN the response status MUST be `500` (unchanged) and the body MUST include `error.code = 'TENANT_CLIENT_UNAVAILABLE'` (new)

### Requirement: Pilot 2 — competency auto-create guard returns Result and caller inspects it

`AutoCreateCompetenciasXMateriaXAlumnoXCursoXCicloUC.execute`
(`pedagogy/competency.use-cases.ts`) MUST change its return type from `Promise<void>` to
`Promise<Result<void, TenantClientUnavailableError>>`. Its tenant-client guard MUST return
`err(new TenantClientUnavailableError())` instead of throwing. The fire-and-forget caller in
`GenerateCourseCyclesUseCase` (`course-cycle.use-cases.ts`) MUST be updated in the same change to
inspect the resolved `Result` (`isErr()`) and log the failure — it MUST continue to log failures via
the existing `.catch(...)` for rejections AND now also via the resolved `Result`'s error branch —
and MUST NOT block course-cycle generation on this failure.

#### Scenario: Guard returns err instead of throwing

- GIVEN the tenant client is unavailable when `AutoCreateCompetenciasXMateriaXAlumnoXCursoXCicloUC.execute` runs
- WHEN the use case executes
- THEN it MUST NOT throw; it MUST resolve to a `Result` where `isErr()` is `true` and `unwrapErr()` is `instanceof TenantClientUnavailableError`

#### Scenario: Fire-and-forget caller still logs the failure without blocking

- GIVEN `GenerateCourseCyclesUseCase` invokes the auto-create use case fire-and-forget and the resolved `Result` is an `err(TenantClientUnavailableError)`
- WHEN the promise resolves
- THEN the caller MUST log the failure (inspecting `isErr()`) and MUST NOT propagate it as a thrown exception, and course-cycle generation MUST proceed unaffected

#### Scenario: Rejection path (non-Result failure) still logged via .catch

- GIVEN the auto-create call rejects (e.g. an unexpected `Promise` rejection unrelated to the guarded `Result`)
- WHEN the rejection occurs
- THEN the existing `.catch(...)` handler MUST still log it — this pathway MUST NOT be removed by this change

### Requirement: Pilot 3 — attendance-types-pdf template guard returns Result

The template-lookup guard in `generate-attendance-types-pdf.use-case.ts` (`render`/`execute`) MUST
replace its bare `throw new Error('Template ... no encontrado')` (a pre-existing type-mismatch
against its `Result`-returning signature) with
`return err(new TemplateNotFoundError('attendance-types.hbs'))`. The `render`/`execute` signatures
MUST widen accordingly. The controller requires NO change (it already uses
`unwrapResultOrThrow`).

#### Scenario: Missing template returns err, not throw

- GIVEN the `attendance-types.hbs` template cannot be resolved when `render` runs
- WHEN the use case executes
- THEN it MUST NOT throw directly; it MUST return a `Result` where `isErr()` is `true` and `unwrapErr()` is `instanceof TemplateNotFoundError`

#### Scenario: Endpoint still responds 500, now with code

- GIVEN the same missing-template condition reaches the HTTP layer
- WHEN the request completes
- THEN the response status MUST be `500` (unchanged) and the body MUST include `error.code = 'TEMPLATE_NOT_FOUND'` (new)

### Requirement: Scope boundary — no reclassification, no status change, no extra sites

This change MUST NOT reclassify the reporting error classes (`BoletinError`, `ConstanciaError`,
`AsistenciaReportingError`) — their classification is DEFERRED to the
`reporting-errors-reclassification` follow-up, which consumes `InfrastructureError` for its own 5
infra guards. This change MUST NOT alter the HTTP status of any of the 3 pilot sites (all are
already `500` before and after). This change MUST NOT modify any infrastructure guard other than
the 3 named pilots.

#### Scenario: Reporting error classes are untouched

- GIVEN the full diff of this change
- WHEN inspecting `BoletinError`, `ConstanciaError`, `AsistenciaReportingError` (definitions and call sites)
- THEN none of them MUST appear in the diff

#### Scenario: No HTTP status changes anywhere in this change

- GIVEN the full diff of this change
- WHEN comparing pre- and post-change HTTP status for the 3 pilot endpoints
- THEN all 3 MUST remain `500` — only `error.code` presence is new

#### Scenario: No infra guards touched beyond the 3 pilots

- GIVEN the full diff of this change
- WHEN inspecting production files outside `infrastructure-error.ts`, `infrastructure-errors.ts`, `exception.filter.ts`, `unwrap-result-or-throw.ts`, and the 3 pilot files (`update-grupo.use-case.ts`, `competency.use-cases.ts`, `course-cycle.use-cases.ts`, `generate-attendance-types-pdf.use-case.ts`)
- THEN no other infrastructure guard (bare `throw new Error(...)` against infra unavailability) MUST be modified

### Requirement: Test coverage for base, wiring and each pilot

The base class, its concrete subclasses, both wiring branches (filter + `unwrapResultOrThrow`), and
each of the 3 pilot guards MUST have test coverage, authored RED→GREEN (test written first, fails,
then the implementation makes it pass) per this project's strict TDD mode.

#### Scenario: Base class and subclasses are covered

- GIVEN the test suite for `infrastructure-error.ts` and `infrastructure-errors.ts`
- WHEN it runs
- THEN it MUST assert `instanceof Error`, non-`instanceof ApplicationError`/`DomainError`, fixed `httpStatus = 500`, and each subclass's fixed `code`

#### Scenario: Both wiring branches are covered

- GIVEN the test suites for `exception.filter.spec.ts` and `unwrap-result-or-throw.test.ts`
- WHEN they run
- THEN each MUST include a case asserting the new `InfrastructureError` branch behavior (500/code/message for the filter; identity-preserving re-throw for the helper)

#### Scenario: Each pilot guard is covered

- GIVEN the test suites for `update-grupo.use-case.test.ts`, `competency.use-cases` (guard) and its `course-cycle.use-cases.ts` fire-and-forget caller, and `generate-attendance-types-pdf.use-case.ts`
- WHEN they run
- THEN each MUST assert the guard returns `err(...)` of the corresponding `InfrastructureError` subclass instead of throwing, and pilot 2's caller test MUST assert the `.then()` `isErr()` logging branch
