# Delta for Report Cards

> **Type**: New capability — no prior spec exists.
> Full spec written at `openspec/specs/report-cards/spec.md`.
> This file is the change-scoped copy for archive reference.
>
> **Amendment (2026-06-06):** Routes were amended to match the implemented contract.
> The original spec used `/v1/boletines/:studentId` but the implementation uses
> `/v1/reportes/boletin/:enrollmentId`. The `enrollmentId` parameter is semantically
> correct because it selects a specific academic cycle/year (a student can have multiple
> enrollments across years), whereas `studentId` alone would be ambiguous. Frontend and
> backend are mutually consistent with the `enrollmentId`-based routes. Spec amended
> to reflect the actual implementation rather than rewriting working routes.

## ADDED Requirements

### Requirement: Single-Student Report Card Endpoint

`GET /v1/reportes/boletin/:enrollmentId` MUST return a PDF file for the specified enrollment.
The `:enrollmentId` parameter uniquely identifies both the student and the academic year/cycle,
making it semantically precise (a student may have multiple enrollments across years).
The endpoint MUST require `@Roles('ROOT', { module: 'REPORTS', action: 'READ' })`.
The response MUST carry `Content-Type: application/pdf` and a
`Content-Disposition: attachment; filename="boletin-{enrollmentId}.pdf"` header.
The PDF MUST include grades, attendance summary, student header, and institution header.
For SECUNDARIO level, the PDF MUST also include exam board results (mesas de examen)
when the student has inscriptions in any active mesa de examen.

#### Scenario: Authorized user downloads a student report card

- GIVEN a user with ROOT role or REPORTS:READ permission
- WHEN `GET /v1/reportes/boletin/:enrollmentId` with a valid enrollmentId
- THEN the system returns HTTP 200 with `Content-Type: application/pdf`
- AND the PDF contains the student's grades, attendance summary, and institution header

#### Scenario: SECUNDARIO report card includes exam board results when present

- GIVEN a SECUNDARIO student with at least one mesa de examen inscription
- WHEN `GET /v1/reportes/boletin/:enrollmentId`
- THEN the PDF includes a "Mesas de Examen" section with materia, turno, fecha, nota, and condición
- AND the section is absent when the student has no mesa de examen inscriptions

#### Scenario: Student not found

- GIVEN a user with REPORTS:READ permission
- WHEN `GET /v1/reportes/boletin/nonexistent-uuid`
- THEN the system MUST return HTTP 404 Not Found

#### Scenario: Unauthorized user is rejected

- GIVEN a user without ROOT role and without REPORTS:READ permission
- WHEN `GET /v1/reportes/boletin/:enrollmentId`
- THEN the system MUST return HTTP 403 Forbidden

#### Scenario: Unauthenticated request is rejected

- GIVEN a request with no valid JWT
- WHEN `GET /v1/reportes/boletin/:enrollmentId`
- THEN the system MUST return HTTP 401 Unauthorized

---

### Requirement: Batch Report Cards Endpoint

`GET /v1/reportes/boletin/curso/:cycleId` MUST return a ZIP archive containing one PDF
report card per printable student in the cycle.
The `:cycleId` parameter identifies the academic cycle (replacing the originally-specced `:courseId`).
The same `@Roles('ROOT', { module: 'REPORTS', action: 'READ' })` guard MUST apply.
Students where `printable = false` MUST be excluded from the batch output.
The response MUST carry `Content-Type: application/zip`.

#### Scenario: Batch download for a cycle

- GIVEN a user with REPORTS:READ permission
- AND a cycle with three students, two of which have `printable = true`
- WHEN `GET /v1/reportes/boletin/curso/:cycleId`
- THEN the system returns HTTP 200 with a ZIP archive
- AND the output contains exactly two report cards

#### Scenario: All students in cycle have printable = false

- GIVEN all students in the cycle have `printable = false`
- WHEN `GET /v1/reportes/boletin/curso/:cycleId`
- THEN the system MUST return HTTP 422 Unprocessable Entity
- AND the error body indicates no printable students found (BATCH_ALL_FAILED)

#### Scenario: Cycle not found

- GIVEN a user with REPORTS:READ permission
- WHEN `GET /v1/reportes/boletin/curso/nonexistent-uuid`
- THEN the system MUST return HTTP 404 Not Found

---

### Requirement: ImprimeSN Flag Enforcement

The system MUST honour the `imprimeSN` flag on each student record.
Students with `imprimeSN = false` MUST NOT appear in any generated PDF output,
whether in single-student or batch mode.
A single-student request for a student with `imprimeSN = false` MUST return
HTTP 422 with a descriptive error message.

#### Scenario: Single request for non-printable student

- GIVEN a student whose `imprimeSN = false`
- WHEN `GET /v1/boletines/:studentId`
- THEN the system MUST return HTTP 422 Unprocessable Entity
- AND the error body MUST state the student is marked as non-printable

#### Scenario: Non-printable students excluded silently from batch

- GIVEN a course where some students have `imprimeSN = false`
- WHEN `GET /v1/boletines/curso/:courseId`
- THEN those students are silently omitted from the output
- AND only printable students appear in the resulting document

---

### Requirement: Level-Specific PDF Templates

The system MUST render a distinct HTML template for each pedagogical level
(INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO).
All templates MUST share a common header (student name, DNI, institution name, academic year)
and MUST differ only in level-specific sections (e.g., concept grades for INICIAL,
subject grades and exam results for SECUNDARIO/TERCIARIO).
Template output MUST be deterministic: same input data MUST produce byte-equivalent PDFs.

#### PDF Content — Attendance Summary (all levels)

All four templates (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO) include an **Asistencia** section
rendered conditionally (`{{#if asistencia}}`). The section shows:
- Total clases registradas (`totalDias`)
- Días presente (`diasPresente`)
- Inasistencias completas (`inasistencias`, where `absenceValue = 1`)
- Medias faltas (`mediasFaltas`, where `absenceValue = 0.5`)
- Porcentaje de asistencia (e.g. "87.5%")

The section is absent when no attendance records exist for the student's cycle.

#### PDF Content — Mesas de Examen (SECUNDARIO only)

The SECUNDARIO template includes a **Mesas de Examen** section rendered conditionally
(`{{#if mesasExamen.length}}`). The section shows one row per inscription with:
- Materia name
- Turno (DICIEMBRE / FEBRERO)
- Fecha (formatted dd/mm/aaaa)
- Nota final (numeric, or "—" when student was absent/nota is null)
- Condición final (APROBADO / DESAPROBADO / AUSENTE), styled green/red

The section is absent when the student has no active mesa de examen inscriptions.
Only mesas with `mesa.active = true` are included. Results are ordered by `fecha asc`.

#### Scenario: INICIAL report card contains concept-based grades

- GIVEN a student enrolled at INICIAL level
- WHEN the PDF is generated
- THEN the output includes concept-area grades without numerical scale
- AND the common header (name, DNI, institution, year) is present

#### Scenario: SECUNDARIO report card contains subject grades and exam results

- GIVEN a student enrolled at SECUNDARIO level
- WHEN the PDF is generated
- THEN the output includes subject-by-subject numerical grades
- AND exam board results (mesas de examen) are included when present
- AND the attendance summary is included when attendance records exist

#### Scenario: Unknown or missing level raises error

- GIVEN a student record with no pedagogical level assigned
- WHEN PDF generation is attempted
- THEN the use case MUST return a domain error `BOLETIN_LEVEL_UNKNOWN`
- AND the endpoint MUST respond HTTP 422

---

### Requirement: PDF Storage and Re-download

Generated PDFs MUST be stored on disk via `PdfStorageService` after first generation
(implementation diverges from the proposal's `FileStoragePort` but is functionally equivalent
for the disk-backed deployment target; the port abstraction remains a future refactor).
On subsequent requests for the same `enrollmentId`, the system SHOULD return the stored
file rather than regenerating (cache-first pattern via `pdfStorage.getPath(enrollmentId)`).
A stored PDF MUST be invalidated and regenerated whenever grade or attendance data
for that student changes. Invalidation is handled by `BoletinInvalidationService`,
injected into `PedagogyController` and called after `postNotaTrimestral` and
`deleteNotaTrimestral`.

#### Scenario: First-time PDF generation stores the file

- GIVEN no stored PDF exists for the enrollmentId
- WHEN `GET /v1/reportes/boletin/:enrollmentId` is called
- THEN a new PDF is generated, stored via `PdfStorageService`, and returned

#### Scenario: Subsequent request serves stored PDF

- GIVEN a PDF was previously stored for the enrollmentId
- AND no grade or attendance data has changed since storage
- WHEN `GET /v1/reportes/boletin/:enrollmentId` is called again
- THEN the system SHOULD return the stored PDF without re-rendering

#### Scenario: Stale PDF is regenerated after grade change

- GIVEN a stored PDF exists for a student's enrollment
- WHEN a grade record (NotaTrimestral) for that student is created or deleted
- THEN the stored PDF MUST be invalidated via `BoletinInvalidationService`
- AND the next request triggers a fresh generation
