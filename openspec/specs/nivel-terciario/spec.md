# Nivel Terciario Specification

## Purpose

Manage pedagogical operations for Tertiary Education level: careers (carreras), subject enrollments with prerequisite validation, exam records (actas), and degree titles. Pedagogical level: TERCIARIO.

## Requirements

### Requirement: Carrera CRUD

`POST /v1/terciario/carreras` MUST create a carrera with `name` (required), `titulo` (required, the degree name), `duracion` (required, years), `resolucion` (optional, ministerial resolution number). Only ADMIN, DIRECTOR, ROOT MAY access.

#### Scenario: Create career

- GIVEN an ADMIN user
- WHEN `POST /v1/terciario/carreras` with `{ name: "Profesorado de Matemática", titulo: "Profesor de Educación Secundaria en Matemática", duracion: 4 }`
- THEN the system returns HTTP 201

### Requirement: Inscripción a Materia

`POST /v1/terciario/inscripciones` MUST enroll a student in a subject. The system MUST validate correlativas (prerequisites) before allowing enrollment. Only ADMIN, DIRECTOR, SECRETARIO MAY access.

#### Scenario: Enroll with prerequisites met

- GIVEN a student has approved "Análisis I" (correlativa of "Análisis II")
- WHEN `POST /v1/terciario/inscripciones` for "Análisis II"
- THEN the enrollment succeeds, HTTP 201

#### Scenario: Enroll with unmet prerequisites rejected

- GIVEN a student has NOT approved "Análisis I"
- WHEN `POST /v1/terciario/inscripciones` for "Análisis II"
- THEN the system MUST return HTTP 400 with "Correlativa no aprobada: Análisis I"

### Requirement: Acta de Examen

`POST /v1/terciario/actas-examen` MUST create an exam record with `subjectId`, `date`, `presidenteId`, `vocales` (Teacher[]), `libro`, `folio`. Only ADMIN, DIRECTOR MAY access. When a nota with `condicion = APROBADO` is recorded, the system MUST update the corresponding `InscripcionMateria.estado` to `APROBADA`. If no matching `InscripcionMateria` exists, the system MUST return HTTP 422.

#### Scenario: Register exam grade

- GIVEN an acta exists
- WHEN `POST /v1/terciario/actas-examen/:id/notas` with `{ studentId, nota, condicion: "APROBADO" }`
- THEN the grade is recorded in the acta
- AND `InscripcionMateria.estado` for that student/subject is set to `APROBADA`

#### Scenario: Reprobado does not change enrollment state

- GIVEN an `InscripcionMateria` with `estado = CURSANDO`
- WHEN `POST /v1/terciario/actas-examen/:id/notas` with `{ condicion: "REPROBADO", nota: 3 }`
- THEN the grade is recorded
- AND `InscripcionMateria.estado` is NOT changed to `APROBADA`

#### Scenario: Acta nota without matching InscripcionMateria

- GIVEN no `InscripcionMateria` exists for the student/subject pair
- WHEN `POST /v1/terciario/actas-examen/:id/notas`
- THEN the system MUST return HTTP 422 with `"Inscripción no encontrada"`

### Requirement: Título

`POST /v1/terciario/titulos` MUST create a degree title record for a graduated student. Only ADMIN, DIRECTOR, ROOT MAY access.

#### Scenario: Create title in process

- GIVEN a student has completed all subjects in their career
- WHEN `POST /v1/terciario/titulos` with `{ studentId, carreraId, estado: "EN_TRAMITE" }`
- THEN the system returns HTTP 201
