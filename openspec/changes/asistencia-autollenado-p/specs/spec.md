# Spec (delta) — Autollenado de "P" en días hábiles al Generar

> **Nota de reconciliación (sdd-archive, 2026-07-02):** la versión original de este delta definía la
> resolución del Presente (ATR-R11.5) en 4 ramas, incluyendo una rama de ambigüedad
> (`PresenteTypeAmbiguousError` / `PRESENTE_TYPE_AMBIGUOUS`, HTTP 422) y el escenario ATR-S79. La
> implementación real (`findPresenteByLevel`, ver `design.md` ADR-2) resuelve el Presente con UNA sola
> consulta determinística — `isPresent && isSystem && active && !deletedAt` para el nivel — unívoca por
> construcción (`@@unique([level, code])` + protección `ATTENDANCE_TYPE_SYSTEM_PROTECTED` sobre tipos
> de sistema). Esa ambigüedad de negocio nunca puede ocurrir con esta implementación, y el fallback a
> un `AttendanceType` custom con `behavior = NO_COMPUTA` (ex-ramas 1/2 del delta) tampoco se implementó
> — la consulta real filtra `isSystem = true`, por lo que un custom jamás puede resolverse como
> Presente. Este archivo se reescribe abajo con la resolución real (2 ramas: encontrado / no
> encontrado); `PRESENTE_TYPE_AMBIGUOUS` no existe en el repo. ATR-S78 y ATR-S79 quedan marcados VOID.
> Detalle completo: `sdd/asistencia-autollenado-p/archive-report` (engram).

- **Change name:** `asistencia-autollenado-p`
- **Store:** hybrid (engram `sdd/asistencia-autollenado-p/spec` + este archivo)
- **Basado en:** `openspec/changes/asistencia-autollenado-p/proposal.md`
- **Convención:** Given/When/Then + RFC 2119 (MUST/SHALL/SHOULD/MAY). Cada AC es verificable de forma aislada.
- **Nivel pedagógico afectado:** ALL (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO). La regla de autollenado es idéntica para los cuatro niveles; la única variable por nivel es la resolución del `AttendanceType` Presente (ver ATR-R11.4/ATR-R11.5), que puede fallar de forma controlada si el nivel no tiene un tipo Presente resoluble.
- **Capability afectado:** `attendance-recording` (MODIFIED). Este delta agrega el requisito `ATR-R11` al canónico `openspec/specs/attendance-recording/spec.md`; se mergeará en `sdd-archive`.
- **Cross-references:** `attendance-types/spec.md` REQ-15 (`behavior` enum, `NO_COMPUTA = 4`, mapeo fijo `P → behavior 4` para tipos de sistema); `attendance-recording/spec.md` ATR-R6/ATR-R7 (`calendar-utils`, `buildLockedDayMap`, upsert/merge de generate) y ATR-R10 (cierre mensual, guard de escritura en mes CERRADO).

Este documento describe QUÉ debe ser verdad después de aplicar el cambio. No prescribe implementación (eso vive en `sdd-design`).

---

## ATR-R11 — Autollenado de Presente en días hábiles vacíos al Generar

Al invocar Generar para un `CourseCycle` C, año Y, mes M, en CUALQUIERA de los dos modos
(General por Curso o Por Materia), el sistema MUST prellenar con el `AttendanceType` Presente
del nivel toda celda de día HÁBIL cuya key esté AUSENTE en el JSONB `days` de la fila, sin
excepción y sin requerir una acción manual adicional del usuario.

### ATR-R11.1 — Grilla nueva

Cuando se genera una grilla por primera vez para (C, Y, M), toda celda de día hábil (lunes a
viernes existente en el mes) MUST quedar con el código Presente. Las celdas de SAB, DOM y días
inexistentes (X) MUST permanecer bloqueadas exactamente como hoy (ATR-R6/ATR-R7) — el autollenado
MUST NOT tocar ninguna celda ya cubierta por `buildLockedDayMap`.

### ATR-R11.2 — Grilla ya generada (re-Generar)

Cuando se invoca Generar sobre (C, Y, M) que ya tiene filas de asistencia, SOLO las celdas de día
hábil cuya key esté AUSENTE MUST recibir el código Presente. Toda celda de día hábil que YA tenga
un valor (cargado por un docente/preceptor: "P", "A", "T", un código custom, o un FERIADO marcado
a mano) MUST permanecer exactamente igual — el autollenado MUST NOT sobrescribir, ni reemplazar,
ni "corregir" ningún valor existente, sea cual sea ese valor.

### ATR-R11.3 — Invariante crítico: nunca sobrescribir

Esta es la regla no negociable de todo el cambio: para cualquier celda de día hábil con una key ya
presente en `days` (independientemente de su valor), el autollenado MUST dejarla bit-a-bit
idéntica. El autollenado únicamente MUST escribir en keys ausentes. Ningún camino de código
(General, Por Materia, primera generación, re-generación) MUST violar este invariante.

### ATR-R11.4 — Modo Por Materia — mismo comportamiento que General

El eje Por Materia MUST aplicar exactamente la misma regla (ATR-R11.1, ATR-R11.2, ATR-R11.3) que
el eje General. No MUST existir divergencia de comportamiento entre ambos modos: mismo criterio de
"hábil vacío", mismo invariante de no-sobrescritura, misma resolución de Presente por nivel.

### ATR-R11.5 — Resolución del `AttendanceType` Presente por nivel (2 ramas)

El sistema MUST resolver, para el nivel pedagógico del `CourseCycle`, el `AttendanceType` a usar
como Presente mediante una única consulta determinística sobre los `AttendanceType` de SISTEMA de
ese nivel: `isPresent = true AND isSystem = true AND active = true AND deletedAt = null`. Esta
consulta MUST ser unívoca — el `@@unique([level, code])` del schema y la protección
`ATTENDANCE_TYPE_SYSTEM_PROTECTED` (ver `attendance-types/spec.md`) garantizan que nunca exista más
de un `AttendanceType` de sistema con `isPresent=true` por nivel. El sistema MUST NOT hardcodear el
string `"P"`: MUST usar el `code` real devuelto por la consulta.

1. **Encontrado**: si la consulta devuelve un `AttendanceType`, el sistema MUST usar su `code` como
   Presente, sin más verificación.
2. **No encontrado**: si el nivel no tiene ningún `AttendanceType` de sistema con `isPresent=true`
   configurado, el sistema MUST rechazar la operación con un error `PresenteTypeNotFoundError`
   (`PRESENTE_TYPE_NOT_FOUND`, HTTP 422) y MUST NOT escribir ninguna fila ni celda — nunca un
   skip silencioso.

Este error MUST llevar contexto (`level`, `courseCycleId`) y MUST propagarse como `Result<T,E>`
en domain/application (sin `throw`), mapeándose a HTTP 422 en el borde (controller), consistente
con el patrón ya usado por `DayNotAssignableError`/`StatusNotAssignableError` (ATR-R8).

### ATR-R11.6 — Mes CERRADO — el autollenado nunca escribe

El comportamiento de `generate-monthly-attendance` frente a un mes (C, Y, M) en estado CLOSED
(`AttendanceMonthStatus`, ATR-R10) NO cambia por este proposal. Decisión explícita (resuelve
pregunta abierta Q2 del proposal): el autollenado hereda el comportamiento actual de Generar sobre
mes cerrado, sea cual sea ese comportamiento hoy (rechazo explícito o no-op) — este cambio MUST NOT
introducir un nuevo código de error ni un nuevo bypass para ese caso. Lo único que este requisito
fija como invariante verificable es negativo: bajo NINGUNA circunstancia el paso de autollenado
(`fillHabilVacios` o equivalente) MUST ejecutar una escritura efectiva sobre un (C, Y, M) CLOSED.
Si Generar hoy permite crear/actualizar filas en un mes CLOSED, ese comportamiento preexistente
queda fuera del alcance de este cambio (no se agrava ni se corrige acá); si Generar hoy ya rechaza
toda escritura en mes CLOSED, el autollenado simplemente nunca se alcanza a ejecutar en ese camino.

### ATR-R11.7 — Idempotencia preservada

Ejecutar Generar dos veces consecutivas sobre el mismo (C, Y, M), sin edición manual entre medio,
MUST producir el mismo estado final en la segunda ejecución que al final de la primera — la segunda
invocación no MUST encontrar celdas hábiles vacías para autollenar (ya fueron llenadas en la
primera), y MUST NOT alterar ningún valor ya presente (código Presente autogenerado o valor
docente).

---

## Escenarios de aceptación

**ATR-S71 — Grilla nueva, modo General: todos los hábiles vacíos quedan en Presente**
- Given un `CourseCycle` C1 de nivel SECUNDARIO sin filas de asistencia para (2026, 8)
- And el nivel SECUNDARIO tiene un `AttendanceType` con `code = "P"`
- When se invoca Generar (General) para C1, 2026, 8
- Then cada fila creada SHALL tener el código Presente en TODAS las keys de día hábil (lunes a viernes existentes en agosto 2026)
- And ninguna key de día hábil SHALL quedar ausente ni vacía

**ATR-S72 — Grilla nueva, modo Por Materia: mismo resultado que General**
- Given un `CourseCycle` C1, materia M1, sin filas de asistencia por materia para (2026, 8)
- When se invoca Generar (Por Materia) para C1, M1, 2026, 8
- Then cada fila creada SHALL tener el código Presente en todas las keys de día hábil, idéntico al comportamiento de ATR-S71

**ATR-S73 — SAB/DOM/X nunca reciben Presente**
- Given la generación de (2026, 8) para C1 (agosto 2026 tiene sábados y domingos)
- When Generar se ejecuta (General o Por Materia)
- Then las keys correspondientes a SAB y DOM SHALL mantener sus códigos `"SAB"`/`"DOM"` (ATR-R6/ATR-R7)
- And ninguna key bloqueada SHALL contener el código Presente

**ATR-S74 — Regeneración General: solo hábiles vacíos reciben Presente, valores existentes intactos**
- Given una fila de asistencia General para alumno A1 en (2026, 8) con `days = { "3": "A", "4": "SAB" }` (día 3 es hábil y ya tiene "A" cargado por un docente)
- When se invoca Generar (General) nuevamente para C1, 2026, 8
- Then la key `"3"` SHALL permanecer `"A"` sin cambios
- And las demás keys de día hábil ausentes en la fila original SHALL quedar con el código Presente
- And la key `"4"` SHALL permanecer `"SAB"` sin cambios

**ATR-S75 — Regeneración Por Materia: mismo comportamiento que General**
- Given una fila de asistencia Por Materia con un día hábil ya cargado como `"T"` (Tardanza)
- When se invoca Generar (Por Materia) nuevamente para el mismo (C, materia, año, mes)
- Then esa key SHALL permanecer `"T"` sin cambios, y el resto de hábiles vacíos SHALL recibir el código Presente — comportamiento idéntico a ATR-S74

**ATR-S76 — Invariante: FERIADO cargado a mano nunca es sobrescrito**
- Given una fila con un día hábil marcado a mano como `"Feriado"` (behavior DIA_NO_HABIL, ver attendance-types REQ-15) ANTES de re-invocar Generar
- When Generar se invoca nuevamente para ese (C, Y, M)
- Then esa key SHALL permanecer `"Feriado"` sin cambios — el autollenado MUST NOT sobrescribir ningún valor existente, sea cual sea su origen o su `behavior`

**ATR-S77 — Resolución Presente: solo `AttendanceType` de sistema, los custom se ignoran**
- Given el nivel PRIMARIO tiene un `AttendanceType` de sistema con `isPresent = true`, `code = "P"` Y además un custom con `behavior = NO_COMPUTA` y `code = "PR"`
- When se resuelve el tipo Presente para ese nivel
- Then el sistema SHALL usar el `AttendanceType` de sistema (`code = "P"`), ignorando el custom `"PR"` — la consulta filtra `isSystem = true`, no evalúa `behavior` de tipos custom

**ATR-S78 — VOID (reconciliado en archive, 2026-07-02)**
- No implementado. El delta original definía un fallback a un `AttendanceType` custom único con
  `behavior = NO_COMPUTA` cuando no existe `code = "P"` de sistema. La implementación real NUNCA
  evalúa `behavior` para elegir Presente — filtra únicamente `isSystem = true`, por lo que un custom
  jamás puede resolverse como Presente. Ver nota de reconciliación al inicio de este archivo.

**ATR-S79 — VOID (reconciliado en archive, 2026-07-02)**
- No implementado. El delta original definía un rechazo `PresenteTypeAmbiguousError`
  (`PRESENTE_TYPE_AMBIGUOUS`, HTTP 422) para 2+ `AttendanceType` custom con `behavior = NO_COMPUTA`
  sin `code = "P"`. Esa ambigüedad es estructuralmente imposible con la resolución real
  (`isPresent && isSystem`, unívoca por diseño) — no existe ningún código de error
  `PRESENTE_TYPE_AMBIGUOUS` en el repo. Ver nota de reconciliación al inicio de este archivo.

**ATR-S80 — Nivel sin tipo Presente resoluble: error claro, sin skip silencioso**
- Given un nivel que NO tiene ningún `AttendanceType` de sistema con `isPresent = true` configurado
- When se invoca Generar para un `CourseCycle` de ese nivel
- Then la operación SHALL rechazarse con `PresenteTypeNotFoundError` (`PRESENTE_TYPE_NOT_FOUND`, HTTP 422), con contexto `level` y `courseCycleId`
- And NO SHALL crearse ni actualizarse ninguna fila ni celda — el fallo SHALL ser total, no parcial

**ATR-S81 — Mes CERRADO: el autollenado nunca escribe**
- Given un mes (C1, 2026, 6) en estado CLOSED (`AttendanceMonthStatus`, ATR-R10)
- When se invoca Generar (General o Por Materia) para (C1, 2026, 6)
- Then ninguna celda de ese mes SHALL recibir el código Presente por efecto del autollenado — el comportamiento de Generar sobre mes cerrado permanece exactamente el que tenía antes de este cambio (ATR-R11.6)

**ATR-S82 — Idempotencia: doble Generar no cambia el resultado**
- Given Generar ya fue invocado una vez para (C1, 2026, 8) y todos los hábiles vacíos quedaron en Presente (ATR-S71)
- When se invoca Generar nuevamente para (C1, 2026, 8) sin ninguna edición manual entre medio
- Then el estado final de `days` en cada fila SHALL ser idéntico al estado tras la primera invocación — ninguna key cambia de valor

---

## Errores de dominio agregados

| Código de error              | HTTP | Cuándo se lanza                                                                                     |
|-------------------------------|------|------------------------------------------------------------------------------------------------------|
| `PRESENTE_TYPE_NOT_FOUND`     | 422  | El nivel del `CourseCycle` no tiene ningún `AttendanceType` de sistema con `isPresent = true` (ATR-R11.5.2) |

Este error MUST registrarse en `DOMAIN_STATUS` del `AppExceptionFilter`, consistente con el patrón
ya usado por `DayNotAssignableError`/`StatusNotAssignableError` (ATR-R8). `PRESENTE_TYPE_AMBIGUOUS`
NO existe en el repo — ver nota de reconciliación al inicio de este archivo.

---

## Fuera de alcance de esta spec

- Autollenado de valores distintos de Presente (A, T, custom) — fuera de alcance del proposal.
- Marcado de feriados — sigue siendo manual, post-generación; si se marca DESPUÉS de que el
  autollenado ya puso Presente, el marcado manual simplemente sobrescribe esa celda (comportamiento
  normal de edición, no cubierto por el invariante de no-sobrescritura del autollenado — ese
  invariante protege al autollenado de pisar al humano, no al revés).
- Cambios de UI del botón Generar más allá de su comportamiento de escritura.
- Cualquier nuevo endpoint o ruta — este cambio reutiliza `generate-monthly-attendance` existente.
- Detalle de forma del helper de dominio, del port de resolución de `AttendanceType`, y de la
  estrategia de upsert/merge: se resuelve en `sdd-design`.

## Preguntas abiertas resueltas en esta spec (no requieren decisión del usuario)

- **Q2 (mes CERRADO):** resuelta en ATR-R11.6 — el autollenado hereda el comportamiento actual de
  Generar sobre mes cerrado; no se introduce un nuevo código de error ni un nuevo bypass.
- **Q3 (ambigüedad de NO_COMPUTA):** resuelta en ATR-R11.5 — la resolución real es una consulta
  unívoca por diseño (`isPresent && isSystem`), no una cascada de prioridad; la ambigüedad no puede
  ocurrir, por lo que `PRESENTE_TYPE_AMBIGUOUS` no se implementó (reconciliado en archive, 2026-07-02).
