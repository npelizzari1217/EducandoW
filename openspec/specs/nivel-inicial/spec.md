# Nivel Inicial Specification

## Purpose

Manage pedagogical operations for Initial Education level (ages 3-5): salas (classrooms by age group), evolutionary reports, development areas, and weekly planning. Pedagogical level: INICIAL.

## Requirements

### Requirement: Sala CRUD

`POST /v1/inicial/salas` MUST create a sala with `name` (required), `ageGroup` (required, enum: 3|4|5), `turno` (required, enum: MAÑANA|TARDE), `capacity` (required, positive integer), and `academicYear` (required). Only ADMIN, DIRECTOR, SECRETARIO MAY access.

> **S3b-1 (2026-06-17):** `teacherId` (optional FK → teachers) was removed from Sala (Approach A — pure DROP). The field was a primitive raw-UUID input with no downstream consumers after S2. See archived change `retiro-sala-grado-curso-teacher-s3b1`.

#### Scenario: Create sala with valid data

- GIVEN a DIRECTOR user
- WHEN `POST /v1/inicial/salas` with `{ name: "Sala Azul", ageGroup: 4, turno: "MAÑANA", capacity: 25, academicYear: "2026" }`
- THEN the system returns HTTP 201 with the created sala

#### Scenario: Invalid age group rejected

- GIVEN a user creating a sala
- WHEN the request includes `ageGroup: 6`
- THEN the system MUST return HTTP 400 with validation error

### Requirement: Informe Evolutivo

`POST /v1/inicial/informes` MUST create an evolutionary report for a student in a specific sala and period. The report contains multiple development areas. Only TEACHER (of the sala), ADMIN, DIRECTOR MAY access.

#### Scenario: Teacher creates report for their sala

- GIVEN a TEACHER assigned to sala "Sala Azul"
- WHEN `POST /v1/inicial/informes` with studentId, salaId, period "1T", and areas[]
- THEN the system returns HTTP 201

### Requirement: Planificación

`POST /v1/inicial/planificaciones` MUST create a weekly planning for a sala. Each planning contains multiple didactic sequences. Only TEACHER (of the sala), ADMIN, DIRECTOR MAY access.

#### Scenario: Create weekly planning

- GIVEN a TEACHER assigned to a sala
- WHEN `POST /v1/inicial/planificaciones` with salaId, week number, and secuencias[]
- THEN the system returns HTTP 201
