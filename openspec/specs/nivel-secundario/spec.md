# Nivel Secundario Specification

## Purpose

Manage pedagogical operations for Secondary Education level: cursos with orientation, exam boards (mesas de examen), academic regime, and grades. Pedagogical level: SECUNDARIO.

## Requirements

### Requirement: Curso CRUD

`POST /v1/secundario/cursos` MUST create a curso with `year` (required, 1-6), `division` (required, A|B|C), `orientacion` (optional: NATURALES|SOCIALES|ECONOMIA|ARTE), `academicYear` (required). Only ADMIN, DIRECTOR, SECRETARIO MAY access.

#### Scenario: Create curso with orientation

- GIVEN a DIRECTOR user
- WHEN `POST /v1/secundario/cursos` with `{ year: 5, division: "A", orientacion: "NATURALES", academicYear: "2026" }`
- THEN the system returns HTTP 201

### Requirement: Mesa de Examen

`POST /v1/secundario/mesas-examen` MUST create an exam board with `subjectId`, `date`, `turno` (DICIEMBRE|FEBRERO), `presidenteId` (User.id — AD-6 cross-DB ref, no FK). Only ADMIN, DIRECTOR MAY access.

#### Scenario: Create exam board

- GIVEN an ADMIN user
- WHEN `POST /v1/secundario/mesas-examen` with valid data
- THEN the system returns HTTP 201

#### Scenario: Inscribir alumno en mesa

- GIVEN an exam board exists
- WHEN `POST /v1/secundario/mesas-examen/:id/inscripciones` with studentId
- THEN the student is registered for that exam board

### Requirement: Régimen Académico

`POST /v1/secundario/regimen-academico` MUST configure the academic regime for a curso+subject combination: `promocionDirecta` (bool), `requiereExamenFinal` (bool), `notaMinimaAprobacion` (decimal, default 6). Only ADMIN, DIRECTOR MAY access.

### Requirement: Supplementary Grade on CalificacionSecundario

`PATCH /v1/secundario/calificaciones/:id/suplementaria` MUST record `notaDiciembre` or `notaFebrero` on a `CalificacionSecundario` row. The request MUST include `turno` (DICIEMBRE|FEBRERO) and `nota` (decimal). Only ADMIN, DIRECTOR, SECRETARIO MAY access. The system MUST reject if `condicion` is not `PREVIA` or `LIBRE`.

**Business rule — Diciembre before Febrero**: Recording a FEBRERO grade REQUIRES that a DICIEMBRE grade already exists on the same `CalificacionSecundario`. If `notaDiciembre` is `null` when FEBRERO is submitted, the system MUST return HTTP 422 with `"Debe registrarse la nota de Diciembre antes de Febrero"`. Rationale: the school calendar always runs Diciembre exams first; Febrero is a second-chance sitting.

#### Scenario: Record notaDiciembre for LIBRE student

- GIVEN a `CalificacionSecundario` with `condicion = LIBRE`
- WHEN `PATCH /v1/secundario/calificaciones/:id/suplementaria` with `{ turno: "DICIEMBRE", nota: 5 }`
- THEN `notaDiciembre` is persisted and the response includes recalculated `definitiva`

#### Scenario: Record notaFebrero for PREVIA student (after Diciembre)

- GIVEN a `CalificacionSecundario` with `condicion = PREVIA` and an existing `notaDiciembre`
- WHEN `PATCH /v1/secundario/calificaciones/:id/suplementaria` with `{ turno: "FEBRERO", nota: 7 }`
- THEN `notaFebrero` is persisted and `definitiva` reflects the new value

#### Scenario: Reject Febrero when Diciembre is missing

- GIVEN a `CalificacionSecundario` with `condicion = PREVIA` and `notaDiciembre = null`
- WHEN `PATCH /v1/secundario/calificaciones/:id/suplementaria` with `{ turno: "FEBRERO", nota: 7 }`
- THEN the system MUST return HTTP 422 with `"Debe registrarse la nota de Diciembre antes de Febrero"`

#### Scenario: Reject if condition is REGULAR

- GIVEN a `CalificacionSecundario` with `condicion = REGULAR`
- WHEN `PATCH /v1/secundario/calificaciones/:id/suplementaria`
- THEN the system MUST return HTTP 422 with `"Condición no habilita examen suplementario"`

### Requirement: List Students Pending Supplementary Exams

`GET /v1/secundario/alumnos-examen` MUST return students with `condicion IN (PREVIA, LIBRE)` who have no exam grade for the requested `turno`. Query params `turno` (DICIEMBRE|FEBRERO) and `academicYear` are REQUIRED. Only ADMIN, DIRECTOR, SECRETARIO MAY access. Each item in the response MUST include `studentName`, `subjectName`, and `cursoName` populated from the joined Student, Subject, and Curso records.

#### Scenario: Returns only students missing a grade

- GIVEN 3 students with `condicion = PREVIA` and no `notaFebrero`, 1 student already has `notaFebrero`
- WHEN `GET /v1/secundario/alumnos-examen?turno=FEBRERO&academicYear=2026`
- THEN the response contains exactly the 3 students without a grade, each with `studentName`, `subjectName`, and `cursoName` populated

#### Scenario: Missing required param

- GIVEN a request without `turno`
- WHEN `GET /v1/secundario/alumnos-examen?academicYear=2026`
- THEN the system MUST return HTTP 400

### Requirement: Calculate Definitiva

`POST /v1/secundario/calificaciones/:id/definitiva` computes and returns the `definitiva` (final grade) for a `CalificacionSecundario`. This is a read-only calculation endpoint. Only ADMIN, DIRECTOR, SECRETARIO MAY access.

Note: the implementation uses `POST` for this endpoint (existing production behavior). The endpoint is idempotent — it does not mutate state, only returns the computed value.

#### Scenario: Calculate definitiva after Febrero grade

- GIVEN a `CalificacionSecundario` with `notaDiciembre = 5` and `notaFebrero = 7`
- WHEN `POST /v1/secundario/calificaciones/:id/definitiva`
- THEN the response includes `definitiva: 7` (highest of the two sitting grades)

#### Scenario: Calculate definitiva with only Diciembre grade

- GIVEN a `CalificacionSecundario` with `notaDiciembre = 6` and `notaFebrero = null`
- WHEN `POST /v1/secundario/calificaciones/:id/definitiva`
- THEN the response includes `definitiva: 6`

### Enum values

The `condicion` field on `CalificacionSecundario` uses the following values as stored in the database:
- `APROBADO` (not `APROBADA`) — student passed the trimester
- `PREVIA` — student has a previa (must sit supplementary exam)
- `LIBRE` — student is libre (free condition, must sit supplementary exam)
