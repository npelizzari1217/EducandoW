# Delta Spec — asistencia-reporting-result

> Nivel pedagógico afectado: **N/A** — migración mecánica `throw` → `Result`, sin cambio de
> comportamiento observable.

Consumes: `application-error-handling` canonical capability
(`openspec/specs/application-error-handling/spec.md`), its "No throw in application/" requirement
and its `unwrapResultOrThrow` boundary idiom. Mechanical `reportes` + `asistencia-reporting`
consumer: **28 throws** across 4 use-cases become `return err(...)`. **No behavior change** — every
error keeps its current HTTP status and JSON body. `BoletinError` / `ConstanciaError` /
`AsistenciaReportingError` are NOT reclassified here (stay bare `extends Error` with `code` +
`httpStatus`) — see ARR-R3. This delta spec does not redefine the `Result<T, E>` model or the
`ApplicationError`/`DomainError` split; it applies them.

## ADDED Requirements

### Requirement: ARR-R1 — No throw remains in the 4 reporting use-cases

`GenerateAsistenciaMensualPdfUseCase`, `GenerateBoletinUseCase`, `GenerateBoletinBatchUseCase`, and
`GenerateConstanciaRegularUseCase` MUST NOT contain a `throw` statement after this change (the only
remaining `throw` in the reporting flow is the presentation-layer re-throw performed inside
`unwrapResultOrThrow`, which is out of scope for these use-cases). All 28 inventoried throw sites
MUST return `err(...)` instead.

#### Scenario: Every previously-throwing call site returns err instead

- GIVEN any inventoried failure (NOT_FOUND, an intrinsic invariant, an infra guard, or
  `ForbiddenError`) in any of the 4 use-cases
- WHEN the use case executes
- THEN it MUST NOT throw; `isErr()` MUST be `true` and `unwrapErr()` an instance of the matching
  error class

### Requirement: ARR-R2 — HTTP status preserved; error body migrates to the app-standard envelope preserving code+message

Each error MUST surface at the SAME HTTP status as today. The response **body** migrates from the two
controllers' current non-standard flat shape (`{ statusCode, error: <code>, message }`, hand-rolled via
`res.json`) to the app-standard nested envelope emitted by `AppExceptionFilter`
(`{ error: { status, code, message } }`) — the same envelope every other endpoint already returns. This
migration MUST preserve `status`, `code`, and `message`: because the bare-`Error` classes flow through the
filter's `HttpException` branch (which today does NOT read `code` back), a **2-line additive fix** MUST be
applied so the branch re-reads `code` from the thrown `HttpException` body (see ARR-R7 allowance). The
`message` field — the only field the frontend's `extractErrorMessage` consumes, and which it reads from
both flat and nested shapes — MUST be unchanged. The following status invariants MUST hold:

- Every `NOT_FOUND`-coded error (`AXCC_NOT_FOUND`, `STUDENT_NOT_FOUND`, `COURSE_CYCLE_NOT_FOUND`) →
  **404**.
- Every 422 invariant (`STUDENT_NOT_PRINTABLE`, `STUDENT_NOT_ELIGIBLE`, `BOLETIN_LEVEL_UNKNOWN`,
  `BATCH_ALL_FAILED`) → **422**, status unchanged.
- Every infra guard (`TEMPLATE_NOT_FOUND` ×2, tenant-client `INTERNAL_ERROR` ×3) → **500**, status
  unchanged.
- `INSTITUTION_NOT_FOUND` → **500**, status unchanged (ambiguous classification, deferred — see
  ARR-R7).
- `ForbiddenError` → **403** via the `ApplicationError` filter branch.

#### Scenario: Status unchanged; body carries the same status/code/message under the standard envelope

- GIVEN any of the error codes above returned by a migrated use case
- WHEN the request is handled through `unwrapResultOrThrow` at the controller boundary
- THEN the response status MUST be unchanged, and the body MUST be the standard
  `{ error: { status, code, message } }` envelope with `code` and `message` populated identically to the
  pre-migration values (only the flat→nested envelope shape changes, matching every other endpoint)

### Requirement: ARR-R3 — No reclassification of the 3 error classes

This change MUST NOT reclassify `BoletinError`, `ConstanciaError`, or `AsistenciaReportingError`.
Each MUST keep its current parent (`extends Error` directly, not `DomainError`, not
`ApplicationError`) and its current `code` + `httpStatus` shape. Reclassifying these classes
(candidate split: NOT_FOUND/invariants → `DomainError`; infra guards → a future
`InfrastructureError`) is explicitly deferred to follow-up #3.

#### Scenario: Classification and parent class are unchanged

- GIVEN any instance of `BoletinError`, `ConstanciaError`, or `AsistenciaReportingError` returned
  post-migration, and the full diff of this change
- WHEN inspected
- THEN `instanceof DomainError` MUST be `false`, `instanceof ApplicationError` MUST be `false`, and
  none of the 3 classes' definition files MUST show a changed `extends` clause in the diff

### Requirement: ARR-R4 — Return-type widening

Each migrated use-case method MUST widen its `Result` error channel to the explicit union of error
types it can now return:

- `GenerateAsistenciaMensualPdfUseCase.executeGeneral` / `.executeMateria`:
  `Result<Buffer, PdfError | AsistenciaReportingError | ForbiddenError>`.
- `GenerateBoletinUseCase.execute`: `Result<Buffer, PdfError | BoletinError>`.
- `GenerateConstanciaRegularUseCase.execute`: `Result<Buffer, PdfError | ConstanciaError>`.
- `GenerateBoletinBatchUseCase.execute`: changes from bare `Promise<Buffer>` to
  `Promise<Result<Buffer, BoletinError>>`.

`tsc --noEmit` MUST pass after each slice.

#### Scenario: Batch use-case signature changes from bare Promise to Result

- GIVEN the post-migration signature of `GenerateBoletinBatchUseCase.execute`
- WHEN inspecting its return type
- THEN it MUST be `Promise<Result<Buffer, BoletinError>>`, not `Promise<Buffer>`

#### Scenario: Signature widens, does not narrow

- GIVEN the post-migration signature of any of the other 3 use-case methods
- WHEN inspecting its error union
- THEN it MUST include every error class listed above for that method in addition to the
  pre-existing `PdfError`

### Requirement: ARR-R5 — Controller retrofit to unwrapResultOrThrow

`asistencia-reporting.controller.ts` MUST drop its `handleError()` helper and the surrounding
try/catch, and each of its 2 endpoints MUST use `unwrapResultOrThrow(await useCase.execute(...))`.
`reportes.controller.ts` MUST retrofit all 3 endpoints to the same idiom, INCLUDING
`getBoletinBatch`, which today consumes a raw `Buffer` from the use case and MUST be updated to
consume `Result<Buffer, BoletinError>` instead. `ForbiddenError` MUST still yield **403** via the
`ApplicationError` filter branch after the retrofit.

#### Scenario: Uniform idiom, no redundant try/catch, status unchanged

- GIVEN the post-migration controllers and a condition that previously hit a removed
  `handleError()`/try-catch remap
- WHEN each of the 5 endpoints (2 in `asistencia-reporting.controller.ts`, 3 in
  `reportes.controller.ts`) is inspected, and that condition recurs
- THEN each MUST use the `unwrapResultOrThrow` idiom with no bespoke try/catch block, and the
  response status MUST be unchanged from before the migration

#### Scenario: getBoletinBatch retrofit preserves the batch response

- GIVEN a `getBoletinBatch` request that previously received the raw `Buffer` on success
- WHEN the retrofitted endpoint runs against `GenerateBoletinBatchUseCase.execute` returning
  `ok(buffer)`
- THEN the endpoint MUST still respond with the same `Buffer` body and status as before the
  migration

### Requirement: ARR-R6 — Test coverage rewritten, legacy test removed, new test added

The use-case and controller tests for all 4 migrated use-cases MUST be rewritten so that
error-path assertions use `isErr()`/`unwrapErr()` instead of `expect(...).toThrow(...)`, with
success-path shape unchanged. `constancia-controller.test.ts` (duplicate coverage of the same
endpoint via the pre-migration throw channel) MUST be deleted. A NEW controller test for
`getBoletinBatch` MUST be added — no such coverage exists today.

#### Scenario: Error-path tests assert Result, not thrown exceptions

- GIVEN a rewritten use-case or controller test for any of the 4 migrated use-cases
- WHEN it exercises a previously-throwing condition
- THEN it MUST assert `isErr()` is `true` and `unwrapErr()` is an instance of the expected error
  class, and MUST NOT assert via `toThrow()`

#### Scenario: Legacy duplicate test is gone, batch test is net-new

- GIVEN the full diff of this change
- WHEN inspecting `api/src/presentation/reportes/__tests__/`
- THEN `constancia-controller.test.ts` MUST NOT exist, and a test covering `getBoletinBatch` MUST
  exist where none did before

### Requirement: ARR-R7 — Scope boundary (no reclassification, no InfrastructureError, no status change)

This change MUST NOT reclassify any of the 3 error classes, MUST NOT introduce or model
`InfrastructureError`, and MUST NOT touch `attendance-type-pdf`
(`generate-attendance-types-pdf.use-case.ts`, already fully migrated). This change MUST NOT change
any HTTP **status** for any of the 28 sites. **Allowed exception** (per ARR-R2): a minimal 2-line
additive fix to `unwrap-result-or-throw.ts` and `exception.filter.ts`'s `HttpException` branch to
preserve the `code` field through the standard envelope. This allowance is strictly for `code`
preservation — it MUST NOT reclassify anything, MUST NOT model `InfrastructureError`, and MUST NOT
alter status or `message` for any error (in this module or elsewhere). The 5 infra guards
(`TEMPLATE_NOT_FOUND` ×2, tenant-client `INTERNAL_ERROR` ×3) and the 2 ambiguous codes
(`BATCH_ALL_FAILED` aggregate, `INSTITUTION_NOT_FOUND` data-integrity 500) MUST be wrapped in
`Result` while keeping their current class and status — their semantic classification is deferred
to follow-up #3.

#### Scenario: No reclassification, no new hierarchy, no status drift in the diff

- GIVEN the full diff of this change
- WHEN inspecting `api/src/domain/**/errors/`, `api/src/application/shared/errors/`, and
  `attendance-type-pdf`
- THEN no error class MUST be reclassified or moved, no `InfrastructureError` class MUST appear,
  no `attendance-type-pdf` file MUST appear, and no HTTP status literal MUST change for any of the
  28 migrated sites

### Requirement: ARR-R8 — Canonical consumer-tracking correction

This change MUST update `openspec/specs/application-error-handling/spec.md`'s consumer-tracking
entry for `reportes` / `asistencia-reporting` / `attendance-type-pdf` (currently instructing to
"migrate `BoletinError`/`ConstanciaError`/`AsistenciaReportingError` to `extends ApplicationError`")
to remove that blanket reclassification instruction and instead record that this change performed a
pure `throw` → `Result` conversion with the 3 classes unchanged, and that their correct
classification (candidate `DomainError`/`InfrastructureError` split) is deferred to follow-up #3.
This is a correction to existing canonical tracking text, not a redefinition of the
`ApplicationError`/`DomainError` model itself.

#### Scenario: Canonical text no longer instructs an incorrect reclassification

- GIVEN the canonical `application-error-handling/spec.md` after this change is archived
- WHEN reading the `reportes`/`asistencia-reporting`/`attendance-type-pdf` consumer entry
- THEN it MUST NOT instruct reclassifying the 3 classes to `ApplicationError`, and MUST reference
  follow-up #3 as the place where their classification is decided
