# Delta Spec — forbidden-error-reclassification

Consumes: `application-error-handling` (canonical capability, `openspec/specs/application-error-handling/spec.md`).
This change reclassifies `ForbiddenError` from `DomainError` to `ApplicationError`, following the
precedent set by `attendance-type-result-migration`. `ForbiddenError` is the highest-traffic
symbol reclassified under this épico to date (8 modules, 17 production files). This change does
**not** define new base classes — it consumes the existing `ApplicationError` hierarchy.

Nivel pedagógico afectado: **N/A** — transversal infrastructure change. No pedagogical level is
affected; HTTP 403 is preserved identically before and after.

## ADDED Requirements

### Requirement: FER-R1 — ForbiddenError is classified as ApplicationError

`ForbiddenError` MUST extend `ApplicationError` (not `DomainError`), MUST live at
`api/src/application/shared/errors/forbidden-error.ts`, and MUST have fixed
`code = 'FORBIDDEN'` and fixed `httpStatus = 403`. It MUST NOT exist anywhere under
`packages/domain` after this change.

#### Scenario: Instance classification is unambiguous

- GIVEN `new ForbiddenError()` (with or without a custom message)
- WHEN the instance is inspected
- THEN `instanceof ApplicationError` MUST be `true`, `instanceof DomainError` MUST be `false`,
  `code` MUST equal `'FORBIDDEN'`, and `httpStatus` MUST equal `403`

#### Scenario: No domain-package definition or export remains

- GIVEN the post-migration state of `packages/domain`
- WHEN searching its source tree and public exports (`packages/domain/src/index.ts`) for `ForbiddenError`
- THEN no file MUST define it and no export path MUST resolve to it

### Requirement: FER-R2 — Class resides in the api application layer only, single-file, no barrel

The class MUST reside at `api/src/application/shared/errors/forbidden-error.ts`, as its own file
(not merged into `authorization-errors.ts`, which hosts per-rule classes with a different
constructor shape). No barrel `index.ts` export MUST be added for it — all 17 production consumers
MUST import it by direct file path, matching the existing convention in
`api/src/application/shared/errors/`.

#### Scenario: Class is importable only from the api-local path

- GIVEN a consumer in `api` needing this error
- WHEN it imports the class
- THEN the import MUST resolve to `api/src/application/shared/errors/forbidden-error`, never to
  `@educandow/domain`

#### Scenario: No barrel export created

- GIVEN the full diff of this change
- WHEN inspecting `api/src/application/shared/errors/`
- THEN no `index.ts` barrel file MUST be added or modified to export `ForbiddenError`

### Requirement: FER-R3 — HTTP status preserved at 403 for every consumer

Every endpoint that today returns HTTP 403 because a use case throws or returns `ForbiddenError`
MUST continue to return HTTP 403 after the reclassification, with no other observable change to
the response body or status for any of the 8 affected modules
(`asistencia`, `asistencia-reporting`, `asignacion-curso`, `grading`, `institution`,
`nivel-terciario`, `student-observation`, `student`).

#### Scenario: Status is 403 both before and after reclassification, for Result-based consumers

- GIVEN a use case that returns `err(new ForbiddenError(...))` in its `Result` error channel
- WHEN the request reaches `AppExceptionFilter` via the controller's throw boundary
  (`if (result.isErr()) throw result.unwrapErr()`)
- THEN the HTTP response status MUST be `403`, identical to pre-reclassification behavior

#### Scenario: Status is 403 both before and after reclassification, for throw-based consumers

- GIVEN a use case that still throws `ForbiddenError` as a literal (e.g. `asistencia-reporting`,
  `asignacion-curso`)
- WHEN the request reaches `AppExceptionFilter`
- THEN the HTTP response status MUST be `403`, produced by the `ApplicationError` branch of the
  filter (`exception.httpStatus`), not by the `DomainError`/`DOMAIN_STATUS` branch

### Requirement: FER-R4 — instanceof-based routing keeps working

Every controller or handler that special-cases `ForbiddenError` via `instanceof ForbiddenError`
(e.g. `student.controller.ts`'s `throwGuardianError()`, `asistencia-reporting.controller.ts`'s
`handleError()`) MUST continue to route it correctly after the reclassification, with no code
changes to the `instanceof` check itself beyond the import path.

#### Scenario: Explicit instanceof check still matches after reclassification

- GIVEN a handler with `if (error instanceof ForbiddenError) { ... }`
- WHEN a `ForbiddenError` instance (constructed from the new `ApplicationError`-based class) is passed
- THEN the check MUST evaluate to `true` and route through the same branch as before the change

### Requirement: FER-R5 — Result signature integrity for widened use cases

The 7 use-case methods across 3 files that type their `Result` error channel as the generic
`DomainError` (3 methods in `nota-cursada-terciario.use-cases.ts`: Create, Update, Confirmar;
3 methods in `docente-materia.use-cases.ts`: Assign, List, Unassign; 1 method in
`student.use-cases.ts`: `PatchStudentUseCase.execute`) MUST have their signatures widened to
`Result<T, DomainError | ForbiddenError>` (or the equivalent explicit union for that method).
The project MUST compile cleanly (`tsc --noEmit` exits 0) after the reclassification.

#### Scenario: Widened use case still returns ForbiddenError correctly

- GIVEN one of the 7 widened methods returns `err(new ForbiddenError(...))`
- WHEN the return value is type-checked against its declared signature
- THEN `tsc --noEmit` MUST NOT report a type error, and `result.unwrapErr()` MUST be an
  `instanceof ForbiddenError`

#### Scenario: No implicit `any` or unchecked cast introduced

- GIVEN the full diff of this change
- WHEN inspecting the 7 widened signatures
- THEN none MUST use `any`, `as unknown as`, or a non-explicit type assertion to satisfy the compiler

### Requirement: FER-R6 — Scope boundary: no throw-to-Result conversion in this change

This change MUST NOT convert any existing `throw` call site to a `Result`-based `return err(...)`.
`asistencia-reporting` (7 throw sites) and `asignacion-curso` (1 throw site, `Promise<T>` return)
MUST keep their current throw/return shape — only the import path and the parent class of
`ForbiddenError` change for these call sites, not the control-flow idiom.

#### Scenario: asistencia-reporting throw sites remain throws

- GIVEN `generate-asistencia-mensual-pdf.use-case.ts`'s 7 `throw new ForbiddenError(...)` sites
- WHEN inspecting the diff of this change
- THEN each site MUST still be a literal `throw`, not converted to `return err(...)`

#### Scenario: asignacion-curso throw site and return type remain unchanged in shape

- GIVEN `assign-docente-to-curso.use-case.ts`'s `throw new ForbiddenError(...)` site
- WHEN inspecting the diff of this change
- THEN the method MUST still return a bare `Promise<T>` (no `Result` wrapping introduced) and the
  site MUST still be a literal `throw`

### Requirement: FER-R7 — Dead-code cleanup in DOMAIN_STATUS

The `FORBIDDEN: 403` entry in the `DOMAIN_STATUS` map (`exception.filter.ts`) MUST be removed, as
it becomes unreachable dead code once `ForbiddenError` is `instanceof ApplicationError` (the
`ApplicationError` filter branch, which reads `exception.httpStatus`, evaluates before the
`DomainError`/`DOMAIN_STATUS` branch). This removal MUST NOT change the observable 403 outcome for
any consumer.

#### Scenario: DOMAIN_STATUS entry removed without status regression

- GIVEN the `DOMAIN_STATUS` map after this change no longer contains a `FORBIDDEN` key
- WHEN any use case throws or returns a `ForbiddenError`
- THEN the response status MUST still be `403`, resolved via the `ApplicationError` branch

### Requirement: FER-R8 — Classification test coverage

A new unit test MUST exist (mirroring `authorization-errors.test.ts`) asserting that
`new ForbiddenError()` is `instanceof ApplicationError`, is NOT `instanceof DomainError`, has
`code === 'FORBIDDEN'`, and has `httpStatus === 403`.

#### Scenario: Classification test asserts the full contract

- GIVEN the new test file under `api/src/application/shared/errors/__tests__/`
- WHEN it runs
- THEN it MUST assert all four properties: `instanceof ApplicationError` true,
  `instanceof DomainError` false, `code === 'FORBIDDEN'`, `httpStatus === 403`

### Requirement: FER-R9 — Scope and guardrails

This change MUST NOT introduce new `ApplicationError` base classes (reuse the existing hierarchy).
It MUST NOT move, consolidate, or relocate the legacy test file
`api/test/unit/patch-student.use-case.test.ts` — only its import path MUST be updated. It MUST NOT
touch any file under `packages/domain` other than deleting `forbidden-error.ts` and removing its
export line from `packages/domain/src/index.ts`.

#### Scenario: No new base classes introduced

- GIVEN the full diff of this change
- WHEN inspecting `api/src/application/shared/errors/`
- THEN no class other than `ForbiddenError` (moved) MUST be newly added as a base class

#### Scenario: Legacy test file stays in place

- GIVEN `api/test/unit/patch-student.use-case.test.ts`
- WHEN inspecting the diff of this change
- THEN the file's path MUST be unchanged; only its `ForbiddenError` import line MUST differ
