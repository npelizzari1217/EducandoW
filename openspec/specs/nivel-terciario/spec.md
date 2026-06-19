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

### Requirement: InscripcionMateria — fechaRegularidad (write-once)

> Introduced by change: vencimiento-regularidad-terciario (2026-06-19)

`InscripcionMateria` MUST expose a `fechaRegularidad: Date | null` property. The field MUST be set to the current UTC wall-clock time when `ConfirmarNotaCursadaUC` confirms a cursada with `condicion = REGULAR`. It MUST be write-once: once set, it MUST NOT be overwritten on any subsequent confirmation. When `condicion` is `LIBRE` or `PROMOCIONAL`, `fechaRegularidad` MUST remain unchanged. When `fechaRegularidad` is `null` (e.g., pre-existing REGULAR rows from before this change), the regularidad MUST be treated as NOT expired.

The entity MUST expose a `setFechaRegularidad(date: Date): void` method that sets the value only when it is currently `null`; subsequent calls MUST be a no-op (enforces write-once at aggregate level).

The Prisma tenant schema MUST define `fechaRegularidad DateTime? @map("fecha_regularidad")` on `InscripcionMateria` (nullable; backward-compatible — existing rows default to `null`).

#### Scenario: fechaRegularidad set on first REGULAR confirmation

- GIVEN an `InscripcionMateria` in `CURSANDO` with `fechaRegularidad = null`
- WHEN `ConfirmarNotaCursadaUC` is executed with `condicion = REGULAR`
- THEN `inscripcion.fechaRegularidad` MUST be set to approximately `now()` (non-null)
- AND the value MUST be persisted

#### Scenario: fechaRegularidad not overwritten on repeated REGULAR confirmation

- GIVEN an `InscripcionMateria` already in `REGULAR` with `fechaRegularidad = T1`
- WHEN `ConfirmarNotaCursadaUC` is executed again with `condicion = REGULAR`
- THEN `inscripcion.fechaRegularidad` MUST remain `T1`

#### Scenario: LIBRE confirmation does not touch fechaRegularidad

- GIVEN an `InscripcionMateria` with `fechaRegularidad = null`
- WHEN `ConfirmarNotaCursadaUC` is executed with `condicion = LIBRE`
- THEN `inscripcion.fechaRegularidad` MUST remain `null`

---

### Requirement: Carrera — llamadosVencimiento

> Introduced by change: vencimiento-regularidad-terciario (2026-06-19)

`Carrera` MUST expose a `llamadosVencimiento: number` property that represents the maximum number of active `LlamadoExamen` records allowed after `fechaRegularidad` before a student's regularidad is considered expired. The field MUST default to `5`. The entity MUST throw a `ValidationError` if a value `<= 0` is provided (both at `create()` and `reconstruct()` time).

The Prisma tenant schema MUST define `llamadosVencimiento Int @default(5) @map("llamados_vencimiento")` on `Carrera` (backward-compatible — existing rows default to `5`).

#### Scenario: Carrera defaults llamadosVencimiento to 5

- GIVEN `Carrera.create()` is called without providing `llamadosVencimiento`
- THEN `carrera.llamadosVencimiento` MUST equal `5`

#### Scenario: llamadosVencimiento rejects zero or negative

- GIVEN `Carrera.create()` is called with `llamadosVencimiento = 0`
- THEN a `ValidationError` MUST be thrown

---

### Requirement: Guard — Regularidad vencida bloquea final

> Introduced by change: vencimiento-regularidad-terciario (2026-06-19)

A student's `REGULAR` status expires when the count of institution-wide active `LlamadoExamen` records with `fechaInicio > inscripcion.fechaRegularidad` reaches `carrera.llamadosVencimiento`. A student with an expired regularidad MUST NOT be permitted to register a final exam grade.

Expiry is **computed on-the-fly** — the `InscripcionMateria.estado` MUST remain `REGULAR` in the database; no write occurs as a result of expiry. No background job or cron task MAY be introduced.

**Expiry rule (normative):** regularidad is expired when ALL of the following hold:
- `inscripcion.estado === REGULAR`
- `inscripcion.fechaRegularidad !== null`
- Count of active `LlamadoExamen` where `fechaInicio > inscripcion.fechaRegularidad` (strict `>`) is `>= carrera.llamadosVencimiento`

A llamado with `fechaInicio` equal to `fechaRegularidad` MUST NOT be counted.

`FinalEligibilityPolicy.check()` MUST accept two additional inputs: `llamadosTranscurridos: number` (count of active llamados after `fechaRegularidad`) and `llamadosVencimiento: number` (from `Carrera`). The expiry guard MUST run as step 2 in the check order — after "cursada no confirmada" (step 1) and before `LIBRE` (step 3). `FinalEligibilityPolicy` MUST remain a pure function; the caller (`RegistrarNotaFinalUC`) MUST load these values before invoking the policy.

When `inscripcion.fechaRegularidad` is `null`, `RegistrarNotaFinalUC` MUST pass `llamadosTranscurridos = 0` to the policy (null is always non-expired).

A new domain error `RegularidadVencidaError` (code `REGULARIDAD_VENCIDA`) MUST be created. It MUST extend `DomainError` and MUST map to HTTP **422 Unprocessable Entity** via `AppExceptionFilter`.

Migration: `pnpm --filter api prisma:migrate:tenant` (run once per tenant DB). The migration name is `20260618200000_vencimiento_regularidad_terciario`. No data backfill is required — all pre-existing REGULAR rows remain non-expired (NULL fechaRegularidad).

#### Scenario: Expired REGULAR student blocked with 422

- GIVEN `InscripcionMateria.estado = REGULAR` with `fechaRegularidad = T0`
- AND `Carrera.llamadosVencimiento = 3`
- AND 3 active `LlamadoExamen` records with `fechaInicio > T0` exist
- WHEN secretaría registers a final grade for that student
- THEN the system MUST return HTTP 422 with error code `REGULARIDAD_VENCIDA`
- AND `inscripcion.estado` MUST remain `REGULAR` in the database

#### Scenario: Non-expired REGULAR student allowed

- GIVEN `InscripcionMateria.estado = REGULAR` with `fechaRegularidad = T0`
- AND `Carrera.llamadosVencimiento = 5`
- AND 2 active `LlamadoExamen` records with `fechaInicio > T0` exist
- WHEN secretaría registers a final grade
- THEN the system MUST NOT return `REGULARIDAD_VENCIDA`

#### Scenario: NULL fechaRegularidad is never expired

- GIVEN `InscripcionMateria.estado = REGULAR` with `fechaRegularidad = null`
- AND any number of `LlamadoExamen` records exist
- WHEN secretaría registers a final grade
- THEN the system MUST NOT apply the expiry guard (passed `llamadosTranscurridos = 0`)

#### Scenario: Boundary — llamado on same date as fechaRegularidad does NOT count

- GIVEN a `LlamadoExamen` with `fechaInicio = T0`
- AND `inscripcion.fechaRegularidad = T0`
- WHEN `llamadosTranscurridos` is computed
- THEN the count is `0` (strict `>`, not `>=`)

#### Scenario: LIBRE guard fires before expiry guard is irrelevant (FR-5.3)

- GIVEN `InscripcionMateria.estado = LIBRE`
- AND `llamadosTranscurridos = 99, llamadosVencimiento = 1`
- WHEN `FinalEligibilityPolicy.check()` is called
- THEN the error MUST be `ALUMNO_LIBRE_NO_PUEDE_RENDIR` (expiry guard skipped for non-REGULAR states)

---

### Requirement: Título

`POST /v1/terciario/titulos` MUST create a degree title record for a graduated student. Only ADMIN, DIRECTOR, ROOT MAY access.

#### Scenario: Create title in process

- GIVEN a student has completed all subjects in their career
- WHEN `POST /v1/terciario/titulos` with `{ studentId, carreraId, estado: "EN_TRAMITE" }`
- THEN the system returns HTTP 201

---

### Requirement: Entity `DocenteXMateriaCarrera` — docente–materia assignment

> Introduced by change: docente-grade-entry (Fase D, Terciario) · 2026-06-19

The tenant schema MUST define a model `DocenteXMateriaCarrera` with fields: `id` (String, CUID PK), `userId` (String, AD-6 soft ref to master `User.id`), `materiaCarreraId` (String, FK → `MateriaCarrera.id`), `anioAcademico` (String, e.g. "2025"), `active` (Boolean, default true), `createdAt`, `updatedAt`. The combination `(userId, materiaCarreraId, anioAcademico)` MUST be unique within the tenant. Multiple distinct `userId` values MAY be active for the same `(materiaCarreraId, anioAcademico)` pair (co-teaching). Hard-delete via the public API is NOT allowed — unassign MUST set `active = false`. Re-assigning an inactive row MUST reactivate it (no duplicate insert). Uses `User.id` directly (Terciario has no AcademicCycle; mirrors `InscripcionMateria.anioAcademico` style).

Tenant migration: `api/prisma_tenant/migrations/20260619100000_docentes_x_materia_carrera/migration.sql`. Run via `prisma migrate deploy` on each tenant DB at deploy time.

#### Scenario: Assignment persisted

- GIVEN valid `userId`, `materiaCarreraId`, and `anioAcademico`
- WHEN secretaría calls the assign endpoint
- THEN a `DocenteXMateriaCarrera` row is created with `active = true` and HTTP 201

#### Scenario: Duplicate active assignment rejected with 409

- GIVEN an active `DocenteXMateriaCarrera` for `(U, M, Y)` exists
- WHEN secretaría attempts to assign the same `(U, M, Y)` again
- THEN HTTP 409 is returned and no duplicate row is created

#### Scenario: Co-teaching allowed

- GIVEN `DocenteXMateriaCarrera` for `(userId=U1, M, Y)` is active
- WHEN secretaría assigns `(userId=U2, M, Y)`
- THEN a second row is created with `active = true` and the first row is unaffected

#### Scenario: Soft unassign sets active=false

- GIVEN an active `DocenteXMateriaCarrera` row with id=R
- WHEN secretaría calls `PATCH /terciario/admin/docentes-materias/R/unassign`
- THEN `active` is set to `false` and the row MUST NOT be deleted from the database

---

### Requirement: `TerciarioAuthorizerService` — Door 3 for Terciario grading

> Introduced by change: docente-grade-entry (Fase D, Terciario) · 2026-06-19

An application service `TerciarioAuthorizerService` MUST exist in `api/src/application/grading/`. It MUST expose:
- `canWriteGrades(userId, userRoles, inscripcionMateriaId): Promise<boolean>` — authorizes create/update/confirmar.
- `getAllowedStudentIds(userId, userRoles, materiaCarreraId, anioAcademico): Promise<string[] | 'all' | null>` — scopes reads to assigned students.

Door 2 bypass: when `resolveAccessScope(userRoles).isAdministrative === true` (rank >= SECRETARIO), `canWriteGrades` MUST return `true` and `getAllowedStudentIds` MUST return `'all'` without querying `DocenteXMateriaCarrera`. Door 3 teacher path: look up an active `DocenteXMateriaCarrera` for `(userId, materiaCarreraId, anioAcademico)` derived from the `InscripcionMateria` record. `anioAcademico` MUST be derived from `InscripcionMateria.anioAcademico` — NEVER from a caller-supplied header or query param. Fail-closed: if the tenant client is null or `InscripcionMateria` is missing, return `false`/`null` (no throw). `AssignmentAuthorizer` (Primario/Secundario) MUST remain untouched.

#### Scenario: Administrative user bypasses Door 3

- GIVEN a user with role SECRETARIO (rank >= SECRETARIO)
- WHEN `canWriteGrades` is called for any `inscripcionMateriaId`
- THEN `true` is returned without querying `DocenteXMateriaCarrera`

#### Scenario: Teacher on assigned materia passes Door 3

- GIVEN a TEACHER with an active `DocenteXMateriaCarrera` for `(U, M, Y)` and an `InscripcionMateria` id=I with materiaCarreraId=M, anioAcademico=Y
- WHEN `canWriteGrades(U, ['TEACHER'], I)` is called
- THEN `true` is returned

#### Scenario: Inactive assignment does not grant access

- GIVEN a `DocenteXMateriaCarrera` row for `(U, M, Y)` with `active = false`
- WHEN `canWriteGrades(U, ['TEACHER'], I)` is called for an inscripcion in materia M / year Y
- THEN `false` is returned

#### Scenario: Null tenant client → fail-closed

- GIVEN `TenantContext.getClient()` returns null
- WHEN `canWriteGrades` is called
- THEN `false` is returned without throwing and HTTP 403 propagates to the caller

---

### Requirement: Admin endpoints — docente–materia assignments

> Introduced by change: docente-grade-entry (Fase D, Terciario) · 2026-06-19

All admin assignment endpoints MUST require Door 1 (`GRADES:CREATE/READ/UPDATE`) AND Door 2 (`isAdministrative`, rank >= SECRETARIO), enforced in the use-case via `resolveAccessScope(userRoles).isAdministrative`. A TEACHER MUST NOT reach these endpoints even with `GRADES:CREATE/UPDATE`.

| Method | Path                                               | Door 1 action  |
|--------|----------------------------------------------------|----------------|
| POST   | `/terciario/admin/docentes-materias`               | GRADES:CREATE  |
| GET    | `/terciario/admin/docentes-materias`               | GRADES:READ    |
| PATCH  | `/terciario/admin/docentes-materias/:id/unassign`  | GRADES:UPDATE  |

`POST` accepts `{ userId, materiaCarreraId, anioAcademico }` (all required Strings); returns 201 on success, 409 on duplicate active assignment. `GET` accepts `?materiaCarreraId=X` (returns active assignments for that materia, optionally filtered by `?anioAcademico=Y`) or `?userId=X` (returns all active assignments for that docente). `PATCH unassign` sets `active = false`; returns 404 if not found, 409 if already inactive.

All inputs MUST be validated with Zod.

#### Scenario: Secretaría assigns a docente

- GIVEN a SECRETARIO user with GRADES:CREATE
- WHEN `POST /terciario/admin/docentes-materias` with valid body
- THEN HTTP 201 is returned with the new assignment row

#### Scenario: Teacher cannot call assign endpoint

- GIVEN a TEACHER with GRADES:CREATE
- WHEN `POST /terciario/admin/docentes-materias` is called
- THEN HTTP 403 is returned

#### Scenario: List by materia returns only active rows

- GIVEN three `DocenteXMateriaCarrera` rows (two active, one inactive) for the same materiaCarreraId
- WHEN `GET /terciario/admin/docentes-materias?materiaCarreraId=M`
- THEN only the two active rows are returned

#### Scenario: Unassign on already-inactive row returns 409

- GIVEN a row with `active = false`
- WHEN `PATCH /terciario/admin/docentes-materias/R/unassign` is called
- THEN HTTP 409 is returned

---

### Requirement: Docente scoped inscripciones read

> Introduced by change: docente-grade-entry (Fase D, Terciario) · 2026-06-19

A TEACHER MUST be able to list inscripciones for a `materiaCarreraId` they are actively assigned to via a dedicated route `GET /terciario/cursada/inscripciones` requiring `GRADES:READ` at Door 1. `ENROLLMENTS:READ` (which TEACHER does not hold) MUST NOT be required. The existing `GET /terciario/inscripciones` (requires `ENROLLMENTS:READ`) MUST remain unchanged. Ownership filtering MUST use `TerciarioAuthorizerService.getAllowedStudentIds`: if it returns `'all'` (administrative), the full list is returned; if it returns an array, only matching inscripciones are returned; if it returns `null` (not assigned), HTTP 403 MUST be returned — NOT an empty list.

#### Scenario: Assigned docente lists inscripciones

- GIVEN a TEACHER with an active assignment for materiaCarreraId=M / anioAcademico=Y
- WHEN `GET /terciario/cursada/inscripciones?materiaCarreraId=M&anioAcademico=Y`
- THEN only inscripciones where `studentId` is in the allowed student set are returned with HTTP 200

#### Scenario: Non-assigned docente receives 403

- GIVEN a TEACHER with no active assignment for materiaCarreraId=M2
- WHEN `GET /terciario/cursada/inscripciones?materiaCarreraId=M2`
- THEN HTTP 403 is returned and no inscripciones data is leaked

#### Scenario: Secretaría receives full list

- GIVEN a SECRETARIO user
- WHEN `GET /terciario/cursada/inscripciones` with any materiaCarreraId
- THEN all inscripciones for that materia are returned without ownership filter
