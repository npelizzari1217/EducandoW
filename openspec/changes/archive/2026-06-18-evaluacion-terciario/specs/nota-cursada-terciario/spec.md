# Spec: nota-cursada-terciario

> Cambio: evaluacion-terciario · Fase A · Nivel pedagógico: **TERCIARIO**
> Fecha: 2026-06-18

## Purpose

Modelar la cursada estructurada del nivel Terciario: 2 parciales, recuperatorios de parciales y TP, con entrada manual por secretaría. La entidad `NotaCursadaTerciario` cubre los slots de evaluación parcial que hoy no existen (solo existe el float crudo `notaCursada`). La `notaCursada` pasa a ser confirmada manualmente por la secretaría, sin cómputo automático en MVP.

## Scope

**IN**: entidad `NotaCursadaTerciario`, endpoints de secretaría para CRUD de slots, endpoint de confirmación de `notaCursada`, constraints de dominio.

**OUT**: cómputo automático de `notaCursada` desde slots, entrada por docente (Fase D), boletín Terciario (Fase C).

---

## Requirements

### Requirement: Entidad NotaCursadaTerciario

La entidad `NotaCursadaTerciario` MUST existir en `packages/domain` con los siguientes campos:

| Campo | Tipo | Constraint |
|---|---|---|
| `id` | UUID | PK, NOT NULL |
| `inscripcionMateriaId` | UUID | FK → InscripcionMateria, NOT NULL |
| `slot` | SlotCursadaTerciario | NOT NULL |
| `nota` | float | nullable |
| `condicion` | CondicionCursada | NOT NULL |
| `fecha` | string (ISO date) | nullable — fechas libres, sin GradingPeriodDate |
| `creadoAt` | datetime | NOT NULL |
| `actualizadoAt` | datetime | NOT NULL |

El enum `SlotCursadaTerciario` MUST contener exactamente: `PARCIAL_1`, `PARCIAL_2`, `RECUPERATORIO_PARCIAL_1`, `RECUPERATORIO_PARCIAL_2`, `TP`.

El enum `CondicionCursada` MUST contener exactamente: `APROBADO`, `DESAPROBADO`, `AUSENTE`.

La combinación `(inscripcionMateriaId, slot)` MUST ser única. El sistema NO puede persistir más de un registro por par.

#### Scenario: Crear slot de parcial exitosamente

- GIVEN una secretaría autenticada con `@Roles GRADES` + `@Levels TERCIARIO`
- WHEN `POST /v1/terciario/cursada/:inscripcionMateriaId/slots` con `{ slot: "PARCIAL_1", nota: 7.5, condicion: "APROBADO", fecha: "2026-06-10" }`
- THEN el sistema MUST retornar HTTP 201 con la entidad `NotaCursadaTerciario` creada

#### Scenario: Slot con nota y fecha nulas aceptado

- GIVEN una secretaría autenticada
- WHEN `POST /v1/terciario/cursada/:inscripcionMateriaId/slots` con `{ slot: "TP", nota: null, condicion: "APROBADO", fecha: null }`
- THEN el sistema MUST retornar HTTP 201 (nota y fecha son opcionales)

#### Scenario: Duplicado de slot rechazado

- GIVEN ya existe un registro `NotaCursadaTerciario` para `(inscripcionMateriaId, PARCIAL_1)`
- WHEN se intenta crear otro registro para el mismo par
- THEN el sistema MUST retornar HTTP 409 con código de error `SLOT_ALREADY_EXISTS`

#### Scenario: Actualizar slot existente

- GIVEN existe `NotaCursadaTerciario(inscripcionMateriaId, PARCIAL_1)`
- WHEN `PATCH /v1/terciario/cursada/:inscripcionMateriaId/slots/PARCIAL_1` con `{ nota: 8.0, condicion: "APROBADO" }`
- THEN el sistema MUST retornar HTTP 200 con la entidad actualizada

#### Scenario: Listar slots de una inscripción

- GIVEN una `InscripcionMateria` con 3 slots registrados (PARCIAL_1, PARCIAL_2, TP)
- WHEN `GET /v1/terciario/cursada/:inscripcionMateriaId/slots`
- THEN el sistema MUST retornar HTTP 200 con los 3 registros

---

### Requirement: Período temporal sin cambios

El sistema MUST conservar el eje de período `ANUAL / 1C / 2C` ya existente en `MateriaCarrera.cuatrimestre`. Este cambio NO introduce ningún eje temporal nuevo (ni bimestral, ni cuatrimestral, ni `GradingPeriodDate`).

---

### Requirement: Elegibilidad de recuperatorio [SUPUESTO — validar contra reglamento]

Un slot `RECUPERATORIO_PARCIAL_1` MUST validar que exista un `NotaCursadaTerciario` previo con `slot = PARCIAL_1` y `condicion IN (DESAPROBADO, AUSENTE)` para la misma `InscripcionMateria`. El mismo criterio aplica para `RECUPERATORIO_PARCIAL_2` respecto de `PARCIAL_2`.

El sistema MUST rechazar la creación del slot recuperatorio si no se cumple el prerequisito.

#### Scenario: Recuperatorio habilitado por desaprobado [SUPUESTO — validar contra reglamento]

- GIVEN existe `NotaCursadaTerciario(inscripcionMateriaId, slot=PARCIAL_1, condicion=DESAPROBADO)`
- WHEN secretaría crea `{ slot: "RECUPERATORIO_PARCIAL_1", condicion: "APROBADO", fecha: "2026-07-01" }`
- THEN el sistema MUST retornar HTTP 201

#### Scenario: Recuperatorio habilitado por ausente [SUPUESTO — validar contra reglamento]

- GIVEN existe `NotaCursadaTerciario(inscripcionMateriaId, slot=PARCIAL_1, condicion=AUSENTE)`
- WHEN secretaría crea `{ slot: "RECUPERATORIO_PARCIAL_1", condicion: "APROBADO" }`
- THEN el sistema MUST retornar HTTP 201

#### Scenario: Recuperatorio bloqueado sin parcial previo [SUPUESTO — validar contra reglamento]

- GIVEN NO existe ningún `NotaCursadaTerciario` para `PARCIAL_1` de esa `InscripcionMateria`
- WHEN secretaría intenta crear `{ slot: "RECUPERATORIO_PARCIAL_1", ... }`
- THEN el sistema MUST retornar HTTP 422 con código `PREREQUISITE_SLOT_MISSING`

#### Scenario: Recuperatorio bloqueado si parcial fue aprobado [SUPUESTO — validar contra reglamento]

- GIVEN existe `NotaCursadaTerciario(inscripcionMateriaId, slot=PARCIAL_1, condicion=APROBADO)`
- WHEN secretaría intenta crear `{ slot: "RECUPERATORIO_PARCIAL_1", ... }`
- THEN el sistema MUST retornar HTTP 422 con código `PARCIAL_YA_APROBADO`

---

### Requirement: Confirmación manual de notaCursada

> [ALINEADO 2026-06-18: estado vs condicion — ver design ADR-1]

La secretaría MUST poder confirmar `notaCursada` y `condicion` (DTO, término de negocio) en `InscripcionMateria` mediante un endpoint dedicado. El sistema NOT computes `notaCursada` automáticamente desde los slots. Los slots son referencia informativa; la secretaría valida y confirma el valor.

`InscripcionMateria.estado` MUST ser actualizado por la secretaría a uno de: `REGULAR`, `PROMOCIONAL`, `LIBRE`. El payload del endpoint usa el campo `condicion` (término de negocio) que se persiste en `InscripcionMateria.estado` (ADR-1). El sistema NOT infiere la condición de los slots en MVP.

#### Scenario: Confirmación de notaCursada como REGULAR

- GIVEN una `InscripcionMateria` existente con slots cargados
- WHEN `PATCH /v1/terciario/cursada/:inscripcionMateriaId/confirmar` con `{ notaCursada: 7.0, condicion: "REGULAR" }`
- THEN el sistema MUST retornar HTTP 200 con `InscripcionMateria` actualizada

#### Scenario: Confirmación de condicion PROMOCIONAL [SUPUESTO — validar contra reglamento]

- GIVEN una `InscripcionMateria` con slots registrados
- WHEN secretaría envía `{ notaCursada: 9.0, condicion: "PROMOCIONAL" }`
- THEN el sistema MUST retornar HTTP 200 y `InscripcionMateria.estado` queda `PROMOCIONAL`

#### Scenario: Condicion inválida rechazada

- GIVEN una `InscripcionMateria` existente
- WHEN secretaría envía `{ condicion: "APROBADO" }` (valor inválido para condicion de cursada)
- THEN el sistema MUST retornar HTTP 422

---

### Requirement: Autorización

Los endpoints de `NotaCursadaTerciario` y confirmación de `notaCursada` MUST requerir `@Roles GRADES` + `@Levels TERCIARIO`. No se introduce DocenteXCiclo ni variantes en este cambio. La entrada por docente queda diferida a Fase D.

#### Scenario: Acceso sin nivel TERCIARIO rechazado

- GIVEN un usuario con `@Roles GRADES` pero sin `@Levels TERCIARIO`
- WHEN accede a cualquier endpoint de cursada Terciario
- THEN el sistema MUST retornar HTTP 403

#### Scenario: Acceso sin módulo GRADES rechazado

- GIVEN un usuario autenticado pero sin `@Roles GRADES`
- WHEN accede a cualquier endpoint de cursada Terciario
- THEN el sistema MUST retornar HTTP 403

---

## Constraints no funcionales

- La migración Prisma MUST ser tenant-scoped (`api/prisma_tenant/schema.prisma`).
- Los Value Objects del dominio MUST ser inmutables y auto-validantes (no throw fuera de constructores).
- El uso case MUST retornar `Result<T, E>` — nunca throw en la capa application.
- Los tests unitarios del dominio MUST cubrir las invariantes de unicidad de slot y elegibilidad de recuperatorio.
- La cobertura MUST alcanzar ≥ 80 % en domain y api para el código nuevo de este cambio.
