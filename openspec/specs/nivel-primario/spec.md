# Nivel Primario Specification

## Purpose

Manage pedagogical operations for Primary Education level (grades 1-6): grados (class groups), trimestral grades (numeric 1-10), and grade books. Pedagogical level: PRIMARIO.

## Requirements

### Requirement: Grado CRUD

`POST /v1/primario/grados` MUST create a grado with `grade` (required, 1-6), `division` (required, A|B|C), and `academicYear` (required). Only ADMIN, DIRECTOR, SECRETARIO MAY access.

> **S3b-1 (2026-06-17):** `teacherId` (optional FK → teachers) was removed from Grado (Approach A — pure DROP). The field was a primitive raw-UUID input with no downstream consumers after S2. The Grado list "Docente" column was also removed from the web UI. See archived change `retiro-sala-grado-curso-teacher-s3b1`.

#### Scenario: Create grado

- GIVEN a SECRETARIO user
- WHEN `POST /v1/primario/grados` with `{ grade: 3, division: "A", academicYear: "2026" }`
- THEN the system returns HTTP 201

#### Scenario: Duplicate grado rejected

- GIVEN a grado 3A already exists for academicYear 2026
- WHEN creating another grado with same grade+division+year
- THEN the system MUST return HTTP 409 Conflict

### Requirement: Calificación Trimestral

`POST /v1/primario/calificaciones` MUST register a trimestral grade for a student in a specific subject, grade, and trimester. Grade MUST be numeric 1.0-10.0. Only TEACHER (of the subject), ADMIN, DIRECTOR MAY access.

#### Scenario: Teacher registers grade

- GIVEN a TEACHER assigned to the subject
- WHEN `POST /v1/primario/calificaciones` with `{ studentId, subjectId, gradeId, trimestre: "1T", nota: 8.5 }`
- THEN the system returns HTTP 201

#### Scenario: Grade out of range rejected

- WHEN the request includes `nota: 11`
- THEN the system MUST return HTTP 400
