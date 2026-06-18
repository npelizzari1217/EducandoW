# Spec: final-attempts

> Cambio: evaluacion-terciario · Fase B · Nivel pedagógico: **TERCIARIO**
> Fecha: 2026-06-18

## Purpose

Agregar el campo `intento` (1 | 2 | 3) a `ActaExamenNota` e implementar los guards de negocio para el examen final Terciario: elegibilidad "REGULAR para rendir", TP obligatorio, límite de 3 intentos, y transición automática a LIBRE al tercer fallo.

## Scope

**IN**: campo `intento` en `ActaExamenNota`, migración con backfill, guards de dominio (REGULAR, TP, límite 3, auto-LIBRE), PROMOCIONAL bypass.

**OUT**: boletín Terciario (Fase C), entrada por docente (Fase D).

---

## Requirements

### Requirement: Campo intento en ActaExamenNota

`ActaExamenNota` MUST incluir un campo `intento` de tipo entero con valores permitidos `1`, `2`, `3`. El campo MUST ser NOT NULL con valor por defecto `1`.

La migración Prisma MUST hacer backfill de `intento = 1` en todas las filas preexistentes de `ActaExamenNota`. El backfill MUST ejecutarse en la misma migración que agrega la columna y MUST ser idempotente.

El sistema MUST rechazar valores de `intento` fuera del rango `[1, 3]`.

#### Scenario: Backfill correcto en migración

- GIVEN hay `N` filas preexistentes en `ActaExamenNota` sin campo `intento`
- WHEN se aplica la migración
- THEN todas las filas MUST tener `intento = 1`

#### Scenario: Registro con intento válido

- GIVEN secretaría registra nota de final
- WHEN el payload incluye `{ intento: 2, condicion: "DESAPROBADO" }`
- THEN el sistema MUST retornar HTTP 201

#### Scenario: intento fuera de rango rechazado

- GIVEN secretaría registra nota de final
- WHEN el payload incluye `{ intento: 4 }` o `{ intento: 0 }`
- THEN el sistema MUST retornar HTTP 422 con código `INVALID_INTENTO`

---

### Requirement: Guard — REGULAR para rendir final

> [ALINEADO 2026-06-18: estado vs condicion — ver design ADR-1]

Un alumno MUST tener `InscripcionMateria.estado = REGULAR` para poder rendir el examen final. Las condiciones `LIBRE` y cursada no confirmada MUST bloquear el registro de nota de final.

La condición `PROMOCIONAL` tiene tratamiento especial en REQ — PROMOCIONAL bypass.

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

### Requirement: Guard — PROMOCIONAL bypassa final [SUPUESTO — validar contra reglamento]

> [ALINEADO 2026-06-18: estado vs condicion — ver design ADR-1]

Un alumno con `InscripcionMateria.estado = PROMOCIONAL` SHOULD estar exento de rendir el examen final. El sistema MUST permitir que la secretaría registre el resultado final de ese alumno como APROBADO por promoción sin que exista una `ActaExamenNota`.

El sistema MUST exponer un endpoint o mecanismo para registrar el resultado PROMOCIONAL sin acta de examen.

#### Scenario: PROMOCIONAL aprobado sin rendir [SUPUESTO — validar contra reglamento]

- GIVEN `InscripcionMateria.estado = PROMOCIONAL` para el alumno
- WHEN secretaría registra el resultado final como APROBADO por promoción (fuera del flujo de acta)
- THEN el sistema MUST aceptar la operación sin requerir una `ActaExamenNota` asociada

#### Scenario: PROMOCIONAL no consume intento [SUPUESTO — validar contra reglamento]

- GIVEN un alumno con `InscripcionMateria.estado = PROMOCIONAL`
- WHEN la secretaría registra aprobación por promoción
- THEN el contador de intentos MUST permanecer en 0 para esa `InscripcionMateria`

---

### Requirement: Guard — TP obligatorio bloquea final [SUPUESTO — validar contra reglamento]

Un alumno MUST tener un slot `TP` registrado (con `condicion != AUSENTE`) en `NotaCursadaTerciario` para ser elegible a rendir el examen final. El sistema MUST rechazar el registro de nota de final si no existe ese slot.

#### Scenario: Sin TP bloqueado [SUPUESTO — validar contra reglamento]

- GIVEN el alumno no tiene `NotaCursadaTerciario(slot=TP)` para esa `InscripcionMateria`
- WHEN secretaría intenta registrar nota de final
- THEN el sistema MUST retornar HTTP 422 con código `TP_OBLIGATORIO_FALTANTE`

#### Scenario: Con TP AUSENTE bloqueado [SUPUESTO — validar contra reglamento]

- GIVEN existe `NotaCursadaTerciario(slot=TP, condicion=AUSENTE)` para esa `InscripcionMateria`
- WHEN secretaría intenta registrar nota de final
- THEN el sistema MUST retornar HTTP 422 con código `TP_OBLIGATORIO_FALTANTE`

#### Scenario: Con TP APROBADO permitido [SUPUESTO — validar contra reglamento]

- GIVEN existe `NotaCursadaTerciario(slot=TP, condicion=APROBADO)` para esa `InscripcionMateria`
- AND el alumno cumple los demás guards
- WHEN secretaría registra nota de final
- THEN el guard de TP NO bloquea la operación

---

### Requirement: Límite de 3 intentos

El sistema MUST contar los intentos previos del alumno en `ActaExamenNota` para esa `InscripcionMateria` donde `condicion IN (DESAPROBADO, AUSENTE)`. Si el alumno ya tiene 3 intentos con esas condiciones, el sistema MUST rechazar cualquier intento adicional.

> **[RESUELTO 2026-06-18]**: Un intento con `condicion = AUSENTE` SÍ cuenta como intento consumido a los efectos del límite de 3, igual que `DESAPROBADO`. Confirmado por el usuario.

#### Scenario: Primer intento DESAPROBADO registrado

- GIVEN el alumno tiene 0 intentos previos de final para esa materia
- WHEN secretaría registra `{ intento: 1, condicion: "DESAPROBADO" }`
- THEN el sistema MUST retornar HTTP 201

#### Scenario: Segundo intento AUSENTE registrado

- GIVEN el alumno tiene 1 intento previo con condicion DESAPROBADO
- WHEN secretaría registra `{ intento: 2, condicion: "AUSENTE" }`
- THEN el sistema MUST retornar HTTP 201 (AUSENTE consume intento — RESUELTO)

#### Scenario: Tercer intento registrado y dispara auto-LIBRE

- GIVEN el alumno tiene 2 intentos previos con condicion DESAPROBADO/AUSENTE
- WHEN secretaría registra `{ intento: 3, condicion: "DESAPROBADO" }`
- THEN el sistema MUST retornar HTTP 201 y disparar la transición auto-LIBRE (ver REQ auto-transición)

#### Scenario: Cuarto intento bloqueado

- GIVEN el alumno ya tiene 3 intentos con condicion DESAPROBADO/AUSENTE
- WHEN secretaría intenta registrar un cuarto intento
- THEN el sistema MUST retornar HTTP 422 con código `MAX_INTENTOS_ALCANZADO`

---

### Requirement: Auto-transición a LIBRE

> [ALINEADO 2026-06-18: estado vs condicion — ver design ADR-1]

Cuando el tercer intento de final se registra con `condicion IN (DESAPROBADO, AUSENTE)`, el sistema MUST actualizar `InscripcionMateria.estado` a `LIBRE` de forma atómica en la misma transacción. Si la actualización de `InscripcionMateria` falla, la nota de final NO MUST persistirse.

La respuesta HTTP 201 al tercer intento MUST incluir un flag `libreTransicion: true` para que el cliente pueda informar al usuario.

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

#### Scenario: Alumno LIBRE no puede rendir más

- GIVEN `InscripcionMateria.estado = LIBRE` (por auto-transición o asignación manual)
- WHEN secretaría intenta registrar cualquier intento de final
- THEN el sistema MUST retornar HTTP 422 con código `ALUMNO_LIBRE_NO_PUEDE_RENDIR`

---

### Requirement: Autorización

Los endpoints que registran o consultan `ActaExamenNota` con campo `intento` MUST mantener `@Roles GRADES` + `@Levels TERCIARIO`. No se modifica el modelo de authz en este cambio.

#### Scenario: Acceso sin nivel TERCIARIO rechazado

- GIVEN un usuario con `@Roles GRADES` pero sin `@Levels TERCIARIO`
- WHEN accede a endpoints de finales Terciario
- THEN el sistema MUST retornar HTTP 403

---

## Constraints no funcionales

- El backfill MUST ser idempotente: re-ejecutar la migración sobre una tabla ya migrada no MUST modificar ninguna fila.
- La transacción de auto-LIBRE MUST ser atómica: `ActaExamenNota` + actualización de `InscripcionMateria.estado` ocurren en la misma transacción Prisma.
- Los tests de dominio MUST cubrir todos los guards: REGULAR, TP, límite de 3 intentos, auto-LIBRE.
- La cobertura MUST alcanzar ≥ 80 % en domain y api para el código nuevo de este cambio.
- El use case MUST retornar `Result<T, E>` — no throw en capas domain/application.
