# Delta Spec — llamados-examen-terciario

> Phase: sdd-spec · Date: 2026-06-18 · Nivel pedagógico: **TERCIARIO**
> Introduced by change: llamados-examen-terciario (Change 1 of 2)

## Purpose

Introduce the `LlamadoExamen` entity — the institution-wide exam turn calendar for Terciario.
Today, `ActaExamen` carries only a loose `fecha` field; there is no first-class model for exam
turns in the Terciario bounded context. This change makes the calendar explicit and countable,
unblocking change 2 (`vencimiento-regularidad-terciario`) which must count how many llamados have
elapsed since a cursada became REGULAR.

## Scope

**IN**: `LlamadoExamen` entity + domain invariants, repository port + Prisma implementation,
use cases (create / update / list / soft-delete), NestJS controller with Zod validation.

**OUT**: expiry rule, `InscripcionMateria.fechaRegularidad`, `Carrera.llamadosVencimiento`,
`ActaExamen → LlamadoExamen` FK, web UI.

---

## Requirements

### R1 — Entity: LlamadoExamen

The `LlamadoExamen` domain entity MUST exist in `packages/domain` with the following fields:

| Field | Type | Constraint |
|---|---|---|
| `id` | UUID | PK, NOT NULL |
| `nombre` | string | NOT NULL, free-text (e.g. "Julio 2025") |
| `anioAcademico` | integer | NOT NULL (e.g. 2025) |
| `fechaInicio` | DateTime | NOT NULL |
| `fechaFin` | DateTime | NOT NULL |
| `active` | boolean | NOT NULL, default `true` |
| `deletedAt` | DateTime | nullable — soft-delete marker |
| `createdAt` | DateTime | NOT NULL |
| `updatedAt` | DateTime | NOT NULL |

The entity MUST be institution/tenant-scoped. There MUST NOT be a `carreraId` or any subject FK.

The Prisma model MUST be named `LlamadoExamen`, mapped to table `llamados_examen`, placed in the
Terciario section of `api/prisma_tenant/schema.prisma`. It MUST carry indexes on `anioAcademico`
and `fechaInicio`.

---

### R2 — Domain Invariant: Date Range

**INV-RANGE**: `fechaInicio` MUST be less than or equal to `fechaFin`. The domain MUST enforce this
invariant. Any violation MUST produce error code `INVALID_LLAMADO_RANGE`.

#### Scenario: Crear llamado con rango válido

- GIVEN una secretaría autenticada con `@Roles GRADES` + `@Levels TERCIARIO`
- WHEN `POST /v1/terciario/llamados-examen` con `{ nombre: "Julio 2025", anioAcademico: 2025, fechaInicio: "2025-07-01", fechaFin: "2025-07-15" }`
- THEN el sistema MUST retornar HTTP 201 con la entidad `LlamadoExamen` creada

#### Scenario: Crear llamado con fechaInicio igual a fechaFin (válido)

- GIVEN una secretaría autenticada
- WHEN `POST /v1/terciario/llamados-examen` con `{ fechaInicio: "2025-07-01", fechaFin: "2025-07-01", ... }`
- THEN el sistema MUST retornar HTTP 201 (`fechaInicio === fechaFin` es válido)

#### Scenario: Crear llamado con rango inválido rechazado

- GIVEN una secretaría autenticada
- WHEN `POST /v1/terciario/llamados-examen` con `{ fechaInicio: "2025-07-15", fechaFin: "2025-07-01", ... }`
- THEN el sistema MUST retornar HTTP 422 con código `INVALID_LLAMADO_RANGE`

---

### R3 — Domain Invariant: No Overlap

**INV-OVERLAP**: For a given `anioAcademico`, no two active `LlamadoExamen` records (where
`deletedAt IS NULL`) MAY have overlapping `[fechaInicio, fechaFin]` intervals. Two intervals
overlap if one starts before the other ends (inclusive). Any violation MUST produce error code
`LLAMADO_OVERLAP`.

Overlap check MUST exclude the record being updated (self-exclusion on edit).

#### Scenario: Crear llamado sin solapamiento aceptado

- GIVEN existe un `LlamadoExamen` activo con `{ anioAcademico: 2025, fechaInicio: "2025-07-01", fechaFin: "2025-07-15" }`
- WHEN secretaría crea `{ anioAcademico: 2025, fechaInicio: "2025-07-16", fechaFin: "2025-07-31" }`
- THEN el sistema MUST retornar HTTP 201 (sin solapamiento)

#### Scenario: Crear llamado con solapamiento rechazado

- GIVEN existe un `LlamadoExamen` activo con `{ anioAcademico: 2025, fechaInicio: "2025-07-01", fechaFin: "2025-07-15" }`
- WHEN secretaría intenta crear `{ anioAcademico: 2025, fechaInicio: "2025-07-10", fechaFin: "2025-07-20" }`
- THEN el sistema MUST retornar HTTP 409 con código `LLAMADO_OVERLAP`

#### Scenario: Solapamiento en distinto anioAcademico permitido

- GIVEN existe un `LlamadoExamen` activo con `{ anioAcademico: 2024, fechaInicio: "2024-07-01", fechaFin: "2024-07-15" }`
- WHEN secretaría crea `{ anioAcademico: 2025, fechaInicio: "2025-07-01", fechaFin: "2025-07-15" }`
- THEN el sistema MUST retornar HTTP 201 (distintos años académicos no se solapan entre sí)

#### Scenario: Solapamiento no verifica llamados con soft-delete

- GIVEN existe un `LlamadoExamen` con `deletedAt != null` y `{ anioAcademico: 2025, fechaInicio: "2025-07-01", fechaFin: "2025-07-15" }`
- WHEN secretaría crea un nuevo llamado con `{ anioAcademico: 2025, fechaInicio: "2025-07-01", fechaFin: "2025-07-15" }`
- THEN el sistema MUST retornar HTTP 201 (registros eliminados no participan en la validación de solapamiento)

---

### R4 — Use Case: Crear LlamadoExamen

The `CreateLlamadoExamenUC` use case MUST:
- Accept: `nombre`, `anioAcademico`, `fechaInicio`, `fechaFin`.
- Enforce INV-RANGE before persistence.
- Enforce INV-OVERLAP against active records in the same `anioAcademico` before persistence.
- Return `Result<LlamadoExamen, ValidationError | ConflictError>`.

#### Scenario: Crear llamado — campo requerido faltante rechazado

- GIVEN una secretaría autenticada
- WHEN `POST /v1/terciario/llamados-examen` sin el campo `nombre`
- THEN el sistema MUST retornar HTTP 422 (Zod validation error)

---

### R5 — Use Case: Actualizar LlamadoExamen

The `UpdateLlamadoExamenUC` use case MUST:
- Accept: `id` + subset of `{ nombre, fechaInicio, fechaFin }`.
- Reject if the llamado does not exist or is soft-deleted → `NotFoundError` → HTTP 404.
- Re-enforce INV-RANGE on the resulting state.
- Re-enforce INV-OVERLAP excluding the record being updated.
- Return `Result<LlamadoExamen, NotFoundError | ValidationError | ConflictError>`.

#### Scenario: Actualizar nombre exitosamente

- GIVEN existe `LlamadoExamen(id="abc")` activo
- WHEN `PATCH /v1/terciario/llamados-examen/abc` con `{ nombre: "Agosto 2025" }`
- THEN el sistema MUST retornar HTTP 200 con el campo `nombre` actualizado

#### Scenario: Actualizar fechas — rango inválido rechazado

- GIVEN existe `LlamadoExamen(id="abc")` activo
- WHEN `PATCH /v1/terciario/llamados-examen/abc` con `{ fechaInicio: "2025-08-01", fechaFin: "2025-07-01" }`
- THEN el sistema MUST retornar HTTP 422 con código `INVALID_LLAMADO_RANGE`

#### Scenario: Actualizar fechas — solapamiento rechazado (otro llamado)

- GIVEN existen dos llamados activos en `anioAcademico: 2025`:
  - `llamado-A` con `fechaInicio: "2025-07-01"`, `fechaFin: "2025-07-15"`
  - `llamado-B` con `fechaInicio: "2025-08-01"`, `fechaFin: "2025-08-15"`
- WHEN `PATCH /v1/terciario/llamados-examen/llamado-B` con `{ fechaInicio: "2025-07-10", fechaFin: "2025-08-15" }`
- THEN el sistema MUST retornar HTTP 409 con código `LLAMADO_OVERLAP`

#### Scenario: Actualizar registro propio sin solapamiento consigo mismo

- GIVEN existe `LlamadoExamen(id="abc", fechaInicio: "2025-07-01", fechaFin: "2025-07-15")` y no hay otros llamados en ese año
- WHEN `PATCH /v1/terciario/llamados-examen/abc` con `{ fechaFin: "2025-07-20" }`
- THEN el sistema MUST retornar HTTP 200 (self-exclusion en la validación de solapamiento)

#### Scenario: Actualizar llamado inexistente

- GIVEN no existe `LlamadoExamen` con id="xyz"
- WHEN `PATCH /v1/terciario/llamados-examen/xyz` con cualquier payload
- THEN el sistema MUST retornar HTTP 404

---

### R6 — Use Case: Listar LlamadoExamen por anioAcademico

The `ListLlamadosExamenUC` use case MUST:
- Accept: `anioAcademico` (required integer query param).
- Return only active records (`deletedAt IS NULL`) for that academic year.
- Order results by `fechaInicio ASC`.
- Return `Result<LlamadoExamen[], never>`.

#### Scenario: Listar llamados de un año académico

- GIVEN existen 3 `LlamadoExamen` activos en `anioAcademico: 2025` y 1 en `anioAcademico: 2024`
- WHEN `GET /v1/terciario/llamados-examen?anioAcademico=2025`
- THEN el sistema MUST retornar HTTP 200 con un array de 3 registros ordenados por `fechaInicio ASC`

#### Scenario: Listar cuando no hay llamados en ese año

- GIVEN no existen `LlamadoExamen` activos para `anioAcademico: 2030`
- WHEN `GET /v1/terciario/llamados-examen?anioAcademico=2030`
- THEN el sistema MUST retornar HTTP 200 con array vacío `[]`

#### Scenario: Listar excluye registros con soft-delete

- GIVEN existen 2 llamados activos y 1 eliminado (deletedAt != null) en `anioAcademico: 2025`
- WHEN `GET /v1/terciario/llamados-examen?anioAcademico=2025`
- THEN el sistema MUST retornar HTTP 200 con array de 2 registros (el eliminado no aparece)

#### Scenario: anioAcademico es requerido

- GIVEN una secretaría autenticada
- WHEN `GET /v1/terciario/llamados-examen` sin query param `anioAcademico`
- THEN el sistema MUST retornar HTTP 422 (Zod validation error)

---

### R7 — Use Case: Eliminar LlamadoExamen (soft-delete)

The `DeleteLlamadoExamenUC` use case MUST perform a soft-delete: set `deletedAt = now()` and
`active = false`. The record MUST remain in the database.

A hard-delete MUST NOT be performed.

The use case MUST:
- Reject if the llamado does not exist or is already soft-deleted → `NotFoundError` → HTTP 404.
- Return `Result<void, NotFoundError>`.

#### Scenario: Eliminar llamado exitosamente

- GIVEN existe `LlamadoExamen(id="abc")` activo (`deletedAt = null`)
- WHEN `DELETE /v1/terciario/llamados-examen/abc`
- THEN el sistema MUST retornar HTTP 204 y el registro queda con `deletedAt != null` y `active = false`

#### Scenario: Eliminar llamado inexistente

- GIVEN no existe `LlamadoExamen` con id="xyz"
- WHEN `DELETE /v1/terciario/llamados-examen/xyz`
- THEN el sistema MUST retornar HTTP 404

#### Scenario: Eliminar llamado ya eliminado

- GIVEN existe `LlamadoExamen(id="abc")` con `deletedAt != null`
- WHEN `DELETE /v1/terciario/llamados-examen/abc`
- THEN el sistema MUST retornar HTTP 404

---

### R8 — Autorización

All `LlamadoExamen` endpoints MUST require `@Roles GRADES` + `@Levels(TERCIARIO)`.

#### Scenario: Acceso sin módulo GRADES rechazado

- GIVEN un usuario autenticado sin el módulo `GRADES`
- WHEN accede a cualquier endpoint de `LlamadoExamen`
- THEN el sistema MUST retornar HTTP 403

#### Scenario: Acceso sin nivel TERCIARIO rechazado

- GIVEN un usuario autenticado con `@Roles GRADES` pero sin `@Levels TERCIARIO`
- WHEN accede a cualquier endpoint de `LlamadoExamen`
- THEN el sistema MUST retornar HTTP 403

#### Scenario: Acceso con GRADES + TERCIARIO permitido

- GIVEN un usuario autenticado con `@Roles GRADES` + `@Levels TERCIARIO`
- WHEN realiza `GET /v1/terciario/llamados-examen?anioAcademico=2025`
- THEN el sistema MUST retornar HTTP 200

---

## Constraints no funcionales

- La migración Prisma MUST ser tenant-scoped (`api/prisma_tenant/schema.prisma`). El cliente master MUST NOT ser utilizado.
- Los use cases MUST retornar `Result<T, E>` — nunca throw en la capa application.
- La validación de entrada MUST usar Zod en la capa presentation (controller).
- Los Value Objects del dominio que encapsulen invariantes MUST ser inmutables y auto-validantes.
- La cobertura MUST alcanzar ≥ 80 % en domain y api para el código nuevo de este cambio.
- El repositorio MUST exponer un port (interface) en la capa domain; la implementación Prisma vive en infrastructure.

---

## Decisions (resolved)

| ID | Decision | Detail |
|---|---|---|
| D1 | Institution-scoped | `LlamadoExamen` es a nivel institución/tenant. Sin `carreraId` ni FK a materia. |
| D2 | nombre free-text | `nombre` es string libre ("Julio 2025", "Diciembre 2025"). No enum. |
| D3 | Overlap validation | Se rechaza crear/actualizar si `[fechaInicio, fechaFin]` solapa con un llamado activo del mismo `anioAcademico`. Soft-deleted excluidos. |
| D4 | INV-RANGE | `fechaInicio <= fechaFin` es un invariante de dominio. |
| D5 | Soft-delete | DELETE no elimina físicamente; setea `deletedAt` y `active=false`. |
| D6 | ActaExamen FK diferida | Sin FK `ActaExamen → LlamadoExamen` en este change. El vencimiento cuenta por calendario de fechas. |
