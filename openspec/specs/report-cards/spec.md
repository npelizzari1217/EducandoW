# Report Cards Specification

## Purpose

Server-side PDF generation of student report cards (boletines) for all four pedagogical
levels (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO). Replaces the legacy WINDEV
`iPrintReport()` flow. Access is controlled by the existing `REPORTS` module.

## Requirements

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
- WHEN `GET /v1/reportes/boletin/:enrollmentId`
- THEN the system MUST return HTTP 422 Unprocessable Entity
- AND the error body MUST state the student is marked as non-printable

#### Scenario: Non-printable students excluded silently from batch

- GIVEN a cycle where some students have `imprimeSN = false`
- WHEN `GET /v1/reportes/boletin/curso/:cycleId`
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

---

### Requirement: Docente Name Source in Generated PDFs

> Added: retiro-boletin-docente-s2 · 2026-06-17
> Applies to: all boletín levels (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO)

The boletín generation pipeline MUST NOT read the `Teacher` table in any branch or helper.
This applies to `generate-boletin.use-case.ts` and every method it calls — including the
Primario, Secundario, and legacy Inicial/Terciario branches.

For INICIAL, the `docente` name displayed per subject MUST be sourced from the
`DocenteXCiclo` / grupo chain (tenant Prisma client) resolved to `User.firstName` /
`User.lastName` (master Prisma client). This is a documented behavioral change: if a
`Teacher` record was manually edited after the materia-grupo backfill and diverges from
the master `User`, the boletín shows the `User` value.

For PRIMARIO and SECUNDARIO, `MateriaBoletin.docente` MUST equal `""` (empty string)
directly — zero queries against `SubjectAssignment` or the DocenteXCiclo chain.

For TERCIARIO, `docente` is not rendered in the template; the value MUST also be `""`
with no teacher-related query.

`MateriaBoletin.docente` MUST remain typed as `string`. No template changes.

The `SubjectAssignment` table and its rows MUST remain intact. The legacy
Inicial/Terciario branch still queries `SubjectAssignment` for the subject list
and as the join key to `NotaTrimestral` grades (`NotaTrimestral.assignmentId`;
`NotaTrimestral` has no `subjectId`). Removing `SubjectAssignment` from this branch
requires a separate migration stage.

**Tenant/master client separation (mandatory):** queries to the DocenteXCiclo/grupo chain
(MateriaXCursoXCiclo → AlumnosXMateriaXCursoXCiclo → AlumnosXGrupo →
GrupoXCursoXMateriaXCiclo → DocenteXCiclo) MUST use the tenant Prisma client.
The `User` name lookup MUST use the master Prisma client (`PrismaService`).
These two clients MUST NOT be swapped.

**Deploy precondition (operational):** the materia-grupo backfill MUST be verified for each
tenant before deploying. If it has not run, INICIAL boletines degrade to `docente = ""`
(silent, not a crash). PRIMARIO/SECUNDARIO/TERCIARIO are unaffected.

#### Scenario: INICIAL — single docente resolved from master User

- GIVEN an INICIAL student's boletín is being generated
- AND the DocenteXCiclo chain resolves exactly one docente for a given (student, subject)
- WHEN the use-case builds `MateriaBoletin` for that subject
- THEN `docente` MUST equal `"${User.lastName}, ${User.firstName}"` (last name first, comma-space)
- AND the value MUST be sourced from the master `User` record, not from the tenant `Teacher` record

#### Scenario: INICIAL — co-docencia (N ≥ 2 docentes)

- GIVEN the chain resolves N ≥ 2 distinct DocenteXCiclo records after deduplication by `docenteXCicloId`
- WHEN the use-case builds `MateriaBoletin` for that subject
- THEN `docente` MUST equal names joined with `" / "` in alphabetical order
  (e.g. `"Apellido1, Nombre1 / Apellido2, Nombre2"`)
- AND duplicate `docenteXCicloId` values MUST be collapsed before building the string

#### Scenario: INICIAL — zero docentes resolved (accepted degradation)

- GIVEN the DocenteXCiclo chain resolves zero records for a (student, subject) combination
- WHEN the use-case builds `MateriaBoletin` for that subject
- THEN `docente` MUST equal `""` (empty string)
- AND the boletín MUST be generated without error (no throw, no partial document)

#### Scenario: PRIMARIO — docente always blank, no query issued

- GIVEN a PRIMARIO student's boletín is being generated
- WHEN the use-case builds `MateriaBoletin` for any subject
- THEN `docente` MUST equal `""` directly
- AND zero queries against `SubjectAssignment` MUST be issued for this branch
- AND zero queries against the DocenteXCiclo chain MUST be issued for this branch

#### Scenario: SECUNDARIO — docente always blank, no query issued

- GIVEN a SECUNDARIO student's boletín is being generated
- WHEN the use-case builds `MateriaBoletin` for any subject
- THEN `docente` MUST equal `""` directly
- AND zero queries against `SubjectAssignment` MUST be issued for this branch
- AND zero queries against the DocenteXCiclo chain MUST be issued for this branch

#### Scenario: No Teacher-table read in any level (integration guard)

- GIVEN the boletín generation is triggered for a student of any level
- WHEN the full execution of `generate-boletin.use-case.ts` completes
- THEN zero reads of the `Teacher` table MUST have been issued (no `teacher` include/select)
- AND this MUST be verifiable via test-level Prisma mock/spy assertions
