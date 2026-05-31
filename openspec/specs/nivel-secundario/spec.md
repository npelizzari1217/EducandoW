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

`POST /v1/secundario/mesas-examen` MUST create an exam board with `subjectId`, `date`, `turno` (DICIEMBRE|FEBRERO), `presidenteId` (FK→Teacher). Only ADMIN, DIRECTOR MAY access.

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
