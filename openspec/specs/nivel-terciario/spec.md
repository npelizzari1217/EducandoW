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

`POST /v1/terciario/actas-examen` MUST create an exam record with `subjectId`, `date`, `presidenteId` (User.id — AD-6 cross-DB ref, no FK), `vocales` (free-form strings, no FK), `libro`, `folio`. Only ADMIN, DIRECTOR MAY access. When a nota with `condicion = APROBADO` is recorded, the system MUST update the corresponding `InscripcionMateria.estado` to `APROBADA`. If no matching `InscripcionMateria` exists, the system MUST return HTTP 422.

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

---

### Requirement: Campo intento en ActaExamenNota

> Introduced by change: evaluacion-terciario (2026-06-18)

`ActaExamenNota` MUST include a field `intento` of type integer with allowed values `1`, `2`, `3`. The field MUST be NOT NULL with default `1`. The migration MUST backfill `intento = 1` on all pre-existing rows idempotently.

The system MUST reject `intento` values outside `[1, 3]` with HTTP 422 code `INVALID_INTENTO`.

#### Scenario: Backfill correcto en migración

- GIVEN hay N filas preexistentes en `ActaExamenNota` sin campo `intento`
- WHEN se aplica la migración
- THEN todas las filas MUST tener `intento = 1`

#### Scenario: intento fuera de rango rechazado

- GIVEN secretaría registra nota de final
- WHEN el payload incluye `{ intento: 4 }` o `{ intento: 0 }`
- THEN el sistema MUST retornar HTTP 422 con código `INVALID_INTENTO`

---

### Requirement: Guard — REGULAR para rendir final

> Introduced by change: evaluacion-terciario (2026-06-18)
> ADR-1: `condicion` en payload mapea a `InscripcionMateria.estado`.

Un alumno MUST tener `InscripcionMateria.estado = REGULAR` para poder rendir el examen final. Las condiciones `LIBRE` y cursada no confirmada MUST bloquear el registro de nota de final.

#### Scenario: Alumno REGULAR puede rendir

- GIVEN `InscripcionMateria.estado = REGULAR` para el alumno en esa materia
- WHEN secretaría registra nota en `ActaExamenNota` para ese alumno
- THEN el sistema MUST retornar HTTP 201

#### Scenario: Alumno LIBRE bloqueado

- GIVEN `InscripcionMateria.estado = LIBRE` para el alumno
- WHEN secretaría intenta registrar nota de final
- THEN el sistema MUST retornar HTTP 422 con código `ALUMNO_LIBRE_NO_PUEDE_RENDIR`

#### Scenario: Alumno sin cursada confirmada bloqueado

- GIVEN el alumno no tiene `InscripcionMateria` con `estado` definido (null o no confirmada)
- WHEN secretaría intenta registrar nota de final
- THEN el sistema MUST retornar HTTP 422 con código `CURSADA_NO_CONFIRMADA`

---

### Requirement: Guard — PROMOCIONAL bypassa final

> Introduced by change: evaluacion-terciario (2026-06-18)
> ADR-1: `condicion` en payload mapea a `InscripcionMateria.estado`.
> [CONFIRMADO 2026-06-18]

Un alumno con `InscripcionMateria.estado = PROMOCIONAL` SHOULD estar exento de rendir el examen final. El sistema MUST permitir que la secretaría registre el resultado final de ese alumno como APROBADO por promoción sin que exista una `ActaExamenNota`.

#### Scenario: PROMOCIONAL aprobado sin rendir

- GIVEN `InscripcionMateria.estado = PROMOCIONAL` para el alumno
- WHEN secretaría registra el resultado final como APROBADO por promoción (fuera del flujo de acta)
- THEN el sistema MUST aceptar la operación sin requerir una `ActaExamenNota` asociada

#### Scenario: PROMOCIONAL no consume intento

- GIVEN un alumno con `InscripcionMateria.estado = PROMOCIONAL`
- WHEN la secretaría registra aprobación por promoción
- THEN el contador de intentos MUST permanecer en 0 para esa `InscripcionMateria`

---

### Requirement: Guard — TP obligatorio bloquea final

> Introduced by change: evaluacion-terciario (2026-06-18)
> [CONFIRMADO 2026-06-18]

Un alumno MUST tener un slot `TP` registrado con `condicion = APROBADO` en `NotaCursadaTerciario` para ser elegible a rendir el examen final. Tanto `DESAPROBADO` como `AUSENTE` bloquean el acceso al final.

#### Scenario: Sin TP bloqueado

- GIVEN el alumno no tiene `NotaCursadaTerciario(slot=TP)` para esa `InscripcionMateria`
- WHEN secretaría intenta registrar nota de final
- THEN el sistema MUST retornar HTTP 422 con código `TP_OBLIGATORIO_FALTANTE`

#### Scenario: Con TP AUSENTE bloqueado

- GIVEN existe `NotaCursadaTerciario(slot=TP, condicion=AUSENTE)` para esa `InscripcionMateria`
- WHEN secretaría intenta registrar nota de final
- THEN el sistema MUST retornar HTTP 422 con código `TP_OBLIGATORIO_FALTANTE`

#### Scenario: Con TP DESAPROBADO bloqueado

- GIVEN existe `NotaCursadaTerciario(slot=TP, condicion=DESAPROBADO)` para esa `InscripcionMateria`
- WHEN secretaría intenta registrar nota de final
- THEN el sistema MUST retornar HTTP 422 con código `TP_OBLIGATORIO_FALTANTE`

#### Scenario: Con TP APROBADO permitido

- GIVEN existe `NotaCursadaTerciario(slot=TP, condicion=APROBADO)` para esa `InscripcionMateria`
- AND el alumno cumple los demás guards
- WHEN secretaría registra nota de final
- THEN el guard de TP NO bloquea la operación

---

### Requirement: Límite de 3 intentos de final

> Introduced by change: evaluacion-terciario (2026-06-18)
> RESUELTO 2026-06-18: AUSENTE SÍ consume intento, igual que DESAPROBADO.

El sistema MUST contar los intentos previos del alumno en `ActaExamenNota` para esa `InscripcionMateria` donde `condicion IN (DESAPROBADO, AUSENTE)`. Si el alumno ya tiene 3 intentos con esas condiciones, el sistema MUST rechazar cualquier intento adicional.

#### Scenario: Cuarto intento bloqueado

- GIVEN el alumno ya tiene 3 intentos con condicion DESAPROBADO/AUSENTE
- WHEN secretaría intenta registrar un cuarto intento
- THEN el sistema MUST retornar HTTP 422 con código `MAX_INTENTOS_ALCANZADO`

---

### Requirement: Auto-transición a LIBRE

> Introduced by change: evaluacion-terciario (2026-06-18)
> ADR-1: estado vs condicion.

Cuando el tercer intento de final se registra con `condicion IN (DESAPROBADO, AUSENTE)`, el sistema MUST actualizar `InscripcionMateria.estado` a `LIBRE` de forma atómica en la misma transacción. Si la actualización de `InscripcionMateria` falla, la nota de final MUST NOT persistirse.

La respuesta HTTP 201 al tercer intento MUST incluir un flag `libreTransicion: true`.

#### Scenario: Auto-LIBRE al tercer fallo

- GIVEN el alumno tiene 2 intentos previos con condicion DESAPROBADO
- WHEN secretaría registra `{ intento: 3, condicion: "DESAPROBADO" }`
- THEN el sistema MUST en la misma transacción:
  1. Persistir la `ActaExamenNota` con `intento = 3`
  2. Actualizar `InscripcionMateria.estado = LIBRE`
  3. Retornar HTTP 201 con `{ ..., libreTransicion: true }`

#### Scenario: Rollback si actualización de LIBRE falla

- GIVEN el alumno está en su tercer intento
- WHEN se produce un error al actualizar `InscripcionMateria.estado`
- THEN la nota de final MUST NOT persistirse y el sistema MUST retornar HTTP 500

### Requirement: Título

`POST /v1/terciario/titulos` MUST create a degree title record for a graduated student. Only ADMIN, DIRECTOR, ROOT MAY access.

#### Scenario: Create title in process

- GIVEN a student has completed all subjects in their career
- WHEN `POST /v1/terciario/titulos` with `{ studentId, carreraId, estado: "EN_TRAMITE" }`
- THEN the system returns HTTP 201
