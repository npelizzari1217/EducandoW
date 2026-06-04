# Delta for Nivel Terciario

## MODIFIED Requirements

### Requirement: Acta de Examen

`POST /v1/terciario/actas-examen` MUST create an exam record with `subjectId`, `date`, `presidenteId`, `vocales` (Teacher[]), `libro`, `folio`. Only ADMIN, DIRECTOR MAY access. When a nota with `condicion = APROBADO` is recorded, the system MUST update the corresponding `InscripcionMateria.estado` to `APROBADA`. If no matching `InscripcionMateria` exists, the system MUST return HTTP 422.
(Previously: grade recording had no side-effect on InscripcionMateria.estado)

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
