# Supplementary Exams Specification

## Purpose

Manage exam recovery for students with `PREVIA` or `LIBRE` condition in Secundario and Terciario: record Diciembre/Febrero exam grades, compute the definitive grade (`Definitiva`), and identify students pending supplementary exams. Pedagogical level: SECUNDARIO, TERCIARIO.

## Requirements

### Requirement: Definitiva Calculation

The system MUST compute `Definitiva` as `max(nota, notaDiciembre, notaFebrero)` ignoring null values. If all three are null, `Definitiva` MUST be null. The domain entity `CalificacionSecundario` MUST own this calculation — no client may compute it independently.

#### Scenario: All three grades present

- GIVEN `nota = 4`, `notaDiciembre = 5`, `notaFebrero = 7`
- WHEN `calcularDefinitiva()` is called
- THEN it returns `7`

#### Scenario: Only nota present

- GIVEN `nota = 6`, `notaDiciembre = null`, `notaFebrero = null`
- WHEN `calcularDefinitiva()` is called
- THEN it returns `6`

#### Scenario: Only supplementary grade present

- GIVEN `nota = null`, `notaDiciembre = null`, `notaFebrero = 8`
- WHEN `calcularDefinitiva()` is called
- THEN it returns `8`

#### Scenario: All grades null

- GIVEN `nota = null`, `notaDiciembre = null`, `notaFebrero = null`
- WHEN `calcularDefinitiva()` is called
- THEN it returns `null`

### Requirement: Record Supplementary Grade

`PATCH /v1/secundario/calificaciones/:id/suplementaria` MUST record `notaDiciembre` or `notaFebrero` on a `CalificacionSecundario` row. Only ADMIN, DIRECTOR, SECRETARIO MAY access. The system MUST reject the request if the student's condition is not `PREVIA` or `LIBRE`.

#### Scenario: Record notaFebrero for PREVIA student

- GIVEN a `CalificacionSecundario` with `condicion = PREVIA`
- WHEN `PATCH /v1/secundario/calificaciones/:id/suplementaria` with `{ turno: "FEBRERO", nota: 7 }`
- THEN `notaFebrero` is persisted and `definitiva` is recalculated and returned

#### Scenario: Reject if condition is REGULAR

- GIVEN a `CalificacionSecundario` with `condicion = REGULAR`
- WHEN `PATCH /v1/secundario/calificaciones/:id/suplementaria`
- THEN the system MUST return HTTP 422 with `"Condición no habilita examen suplementario"`

### Requirement: List Students Pending Supplementary Exams

`GET /v1/secundario/alumnos-examen` MUST return students with `condicion IN (PREVIA, LIBRE)` who have no exam grade recorded for the requested `turno` (DICIEMBRE|FEBRERO). `turno` and `academicYear` are required query params. Only ADMIN, DIRECTOR, SECRETARIO MAY access.

#### Scenario: List pending students for Febrero

- GIVEN 3 students with `condicion = PREVIA` and no `notaFebrero`, 1 student already has `notaFebrero`
- WHEN `GET /v1/secundario/alumnos-examen?turno=FEBRERO&academicYear=2026`
- THEN the response includes exactly the 3 students without a grade
- AND excludes the student who already has `notaFebrero`

#### Scenario: No pending students

- GIVEN all PREVIA/LIBRE students have a grade for the requested turno
- WHEN `GET /v1/secundario/alumnos-examen?turno=DICIEMBRE&academicYear=2026`
- THEN the system returns HTTP 200 with an empty array

#### Scenario: Missing required param

- GIVEN a request without `turno`
- WHEN `GET /v1/secundario/alumnos-examen?academicYear=2026`
- THEN the system MUST return HTTP 400

### Requirement: Terciario ActaExamen Approval Updates Enrollment State

When a grade with `condicion = APROBADO` is recorded in an `ActaExamenNota`, the system MUST update the corresponding `InscripcionMateria.estado` to `APROBADA`. If the grade is `REPROBADO`, `estado` MUST remain `CURSANDO` or be set to `LIBRE` per academic regime rules.

#### Scenario: Approval updates InscripcionMateria

- GIVEN an `InscripcionMateria` with `estado = CURSANDO` for a student/subject
- WHEN `POST /v1/terciario/actas-examen/:id/notas` with `{ condicion: "APROBADO", nota: 6 }`
- THEN `InscripcionMateria.estado` is set to `APROBADA`

#### Scenario: Reprobado does not approve enrollment

- GIVEN an `InscripcionMateria` with `estado = CURSANDO`
- WHEN `POST /v1/terciario/actas-examen/:id/notas` with `{ condicion: "REPROBADO", nota: 3 }`
- THEN `InscripcionMateria.estado` is NOT changed to `APROBADA`

#### Scenario: Acta nota without matching InscripcionMateria

- GIVEN no `InscripcionMateria` exists for the student/subject pair
- WHEN `POST /v1/terciario/actas-examen/:id/notas`
- THEN the system MUST return HTTP 422 with `"Inscripción no encontrada"`
