# Delta for Report Cards

> **Type**: New capability — no prior spec exists.
> Full spec written at `openspec/specs/report-cards/spec.md`.
> This file is the change-scoped copy for archive reference.

## ADDED Requirements

### Requirement: Single-Student Report Card Endpoint

`GET /v1/boletines/:studentId` MUST return a PDF file for the specified student.
The endpoint MUST require `@Roles('ROOT', { module: 'REPORTS', action: 'READ' })`.
The response MUST carry `Content-Type: application/pdf` and a
`Content-Disposition: attachment; filename="boletin-{studentId}.pdf"` header.
The PDF MUST include grades, attendance summary, student header, and institution header.

#### Scenario: Authorized user downloads a student report card

- GIVEN a user with ROOT role or REPORTS:READ permission
- WHEN `GET /v1/boletines/:studentId` with a valid studentId
- THEN the system returns HTTP 200 with `Content-Type: application/pdf`
- AND the PDF contains the student's grades, attendance summary, and institution header

#### Scenario: Student not found

- GIVEN a user with REPORTS:READ permission
- WHEN `GET /v1/boletines/nonexistent-uuid`
- THEN the system MUST return HTTP 404 Not Found

#### Scenario: Unauthorized user is rejected

- GIVEN a user without ROOT role and without REPORTS:READ permission
- WHEN `GET /v1/boletines/:studentId`
- THEN the system MUST return HTTP 403 Forbidden

#### Scenario: Unauthenticated request is rejected

- GIVEN a request with no valid JWT
- WHEN `GET /v1/boletines/:studentId`
- THEN the system MUST return HTTP 401 Unauthorized

---

### Requirement: Batch Report Cards Endpoint

`GET /v1/boletines/curso/:courseId` MUST return a multi-student PDF or ZIP archive
containing one report card per printable student in the course.
The same `@Roles('ROOT', { module: 'REPORTS', action: 'READ' })` guard MUST apply.
Students where `imprimeSN = false` MUST be excluded from the batch output.
The response MUST carry `Content-Type: application/pdf` or `application/zip`
depending on the aggregation format chosen at generation time.

#### Scenario: Batch download for a course

- GIVEN a user with REPORTS:READ permission
- AND a course with three students, two of which have `imprimeSN = true`
- WHEN `GET /v1/boletines/curso/:courseId`
- THEN the system returns HTTP 200 with a multi-student PDF (or ZIP)
- AND the output contains exactly two report cards

#### Scenario: All students in course have imprimeSN = false

- GIVEN all students in the course have `imprimeSN = false`
- WHEN `GET /v1/boletines/curso/:courseId`
- THEN the system MUST return HTTP 422 Unprocessable Entity
- AND the error body indicates no printable students found

#### Scenario: Course not found

- GIVEN a user with REPORTS:READ permission
- WHEN `GET /v1/boletines/curso/nonexistent-uuid`
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

#### Scenario: Unknown or missing level raises error

- GIVEN a student record with no pedagogical level assigned
- WHEN PDF generation is attempted
- THEN the use case MUST return a domain error `BOLETIN_LEVEL_UNKNOWN`
- AND the endpoint MUST respond HTTP 422

---

### Requirement: PDF Storage and Re-download

Generated PDFs MUST be stored via `FileStoragePort` after first generation.
On subsequent requests for the same `studentId` and `academicYear`, the system
SHOULD return the stored file rather than regenerating.
A stored PDF MUST be invalidated and regenerated whenever grade or attendance data
for that student changes.

#### Scenario: First-time PDF generation stores the file

- GIVEN no stored PDF exists for the student and current academic year
- WHEN `GET /v1/boletines/:studentId` is called
- THEN a new PDF is generated, stored via `FileStoragePort`, and returned

#### Scenario: Subsequent request serves stored PDF

- GIVEN a PDF was previously stored for the student and current academic year
- AND no grade or attendance data has changed since storage
- WHEN `GET /v1/boletines/:studentId` is called again
- THEN the system SHOULD return the stored PDF without re-rendering

#### Scenario: Stale PDF is regenerated after grade change

- GIVEN a stored PDF exists for the student
- WHEN a grade record for that student is updated
- THEN the stored PDF MUST be invalidated
- AND the next request triggers a fresh generation
