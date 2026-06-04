# Delta for Nivel Secundario

## ADDED Requirements

### Requirement: Supplementary Grade on CalificacionSecundario

`PATCH /v1/secundario/calificaciones/:id/suplementaria` MUST record `notaDiciembre` or `notaFebrero` on a `CalificacionSecundario` row. The request MUST include `turno` (DICIEMBRE|FEBRERO) and `nota` (decimal). Only ADMIN, DIRECTOR, SECRETARIO MAY access. The system MUST reject if `condicion` is not `PREVIA` or `LIBRE`.

#### Scenario: Record notaDiciembre for LIBRE student

- GIVEN a `CalificacionSecundario` with `condicion = LIBRE`
- WHEN `PATCH /v1/secundario/calificaciones/:id/suplementaria` with `{ turno: "DICIEMBRE", nota: 5 }`
- THEN `notaDiciembre` is persisted and the response includes recalculated `definitiva`

#### Scenario: Record notaFebrero for PREVIA student

- GIVEN a `CalificacionSecundario` with `condicion = PREVIA`
- WHEN `PATCH /v1/secundario/calificaciones/:id/suplementaria` with `{ turno: "FEBRERO", nota: 7 }`
- THEN `notaFebrero` is persisted and `definitiva` reflects the new value

#### Scenario: Reject if condition is REGULAR

- GIVEN a `CalificacionSecundario` with `condicion = REGULAR`
- WHEN `PATCH /v1/secundario/calificaciones/:id/suplementaria`
- THEN the system MUST return HTTP 422 with `"Condición no habilita examen suplementario"`

### Requirement: List Students Pending Supplementary Exams

`GET /v1/secundario/alumnos-examen` MUST return students with `condicion IN (PREVIA, LIBRE)` who have no exam grade for the requested `turno`. Query params `turno` (DICIEMBRE|FEBRERO) and `academicYear` are REQUIRED. Only ADMIN, DIRECTOR, SECRETARIO MAY access.

#### Scenario: Returns only students missing a grade

- GIVEN 3 students with `condicion = PREVIA` and no `notaFebrero`, 1 student already has `notaFebrero`
- WHEN `GET /v1/secundario/alumnos-examen?turno=FEBRERO&academicYear=2026`
- THEN the response contains exactly the 3 students without a grade

#### Scenario: Missing required param

- GIVEN a request without `turno`
- WHEN `GET /v1/secundario/alumnos-examen?academicYear=2026`
- THEN the system MUST return HTTP 400
