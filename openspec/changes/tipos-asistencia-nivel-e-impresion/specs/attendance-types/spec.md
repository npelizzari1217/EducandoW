# Delta for Attendance Types

**Nivel pedagógico afectado:** todos (1-4) — INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO.
**Propuesta base:** `openspec/changes/tipos-asistencia-nivel-e-impresion/proposal.md`
**Extiende:** `openspec/specs/attendance-types/spec.md` (REQ-1..REQ-15)
**RFC 2119 aplica en todo el documento.**

## Alcance de este delta

Scopea por nivel base del usuario el listado, la creación y la edición de `AttendanceType`
(backend-first, AuthZ en use case de application, lógica de nivel en domain vía
`resolveAccessScope`), ajusta el selector del front a ese scope, y agrega impresión PDF de tipos
de asistencia respetando exactamente el mismo scope. No modifica el modelo `AttendanceType`, no
agrega `institutionId`, no cambia `UserLevel`.

---

## ADDED Requirements

### Requirement: Nivel base — colapso de modalidad (tipos-asistencia-nivel-e-impresion, 2026-07-01)

El sistema DEBE derivar, para cada usuario autenticado, el conjunto de **niveles base** a partir de
`user.levels` (códigos compuestos `level * 10 + modality`, ver `access-scope.ts`), colapsando la
modalidad: dos códigos compuestos con el mismo `level` (distinta `modality`) DEBEN contar como UN
solo nivel base. El cardinal de este conjunto (0, 1, o >1 niveles base) es la entrada que gobierna
REQ-17 (scope de listado), REQ-18 (scope de alta/edición) y REQ-19 (selector del front). Para
usuarios con `allLevels = true` (ROOT o ADMIN, ver REQ-17), este colapso NO aplica — su scope es
"todos los niveles pedagógicos de la institución activa" independientemente de su propio
`user.levels`.

#### Escenario ADD-1.1 — dos modalidades del mismo nivel colapsan a un nivel base

**Dado** un usuario con `user.levels = [21, 22]` (nivel 2, modalidades 1 y 2)
**Cuando** se resuelve su conjunto de niveles base
**Entonces** el conjunto resultante es `{2}` (un solo nivel base)

#### Escenario ADD-1.2 — niveles base distintos no colapsan

**Dado** un usuario con `user.levels = [20, 31]` (nivel 2 modalidad 0, nivel 3 modalidad 1)
**Cuando** se resuelve su conjunto de niveles base
**Entonces** el conjunto resultante es `{2, 3}` (dos niveles base)

#### Escenario ADD-1.3 — usuario sin niveles asignados

**Dado** un usuario no-ROOT/no-ADMIN con `user.levels = []`
**Cuando** se resuelve su conjunto de niveles base
**Entonces** el conjunto resultante es `{}` (cero niveles base)

---

### Requirement: Selector de nivel en el front adaptado al scope del usuario (tipos-asistencia-nivel-e-impresion, 2026-07-01)

La pantalla "Tipos de asistencia" DEBE reemplazar el `LEVEL_OPTIONS` hardcodeado por los niveles
base derivados del usuario (REQ-16), aplicados tanto al listado como al form de alta. El front DEBE
tratarse como mejora de UX — el rechazo real de operaciones fuera de scope ocurre en backend
(REQ-17, REQ-18); el front NUNCA es la única barrera.

- Con exactamente 1 nivel base: el selector de nivel DEBE mostrarse VISIBLE pero DESHABILITADO, con
  el valor fijado a ese único nivel; el listado DEBE mostrarse filtrado a ese nivel; el form de alta
  DEBE iniciar con el nivel pre-seteado y el campo bloqueado (no editable).
- Con más de 1 nivel base: el selector DEBE ofrecer únicamente esos niveles base (ni más ni menos),
  habilitado.
- Para usuarios con `allLevels = true` (ROOT/ADMIN): el selector DEBE ofrecer todos los niveles
  pedagógicos de la institución activa.
- Con 0 niveles base (usuario no-ROOT/no-ADMIN sin ningún nivel asignado): la pantalla DEBE mostrar
  un estado vacío explícito indicando ausencia de acceso a cualquier nivel — NUNCA una tabla vacía
  sin explicación ni un selector con opciones fantasma.

#### Escenario ADD-2.1 — un solo nivel base: selector visible y deshabilitado

**Dado** un docente con niveles base `{2}` (colapsados de REQ-16)
**Cuando** carga la pantalla "Tipos de asistencia"
**Entonces** el selector de nivel se muestra visible, deshabilitado, con valor fijo `2`
Y el listado muestra solo tipos con `level = 2`
Y el form de alta abre con `level = 2` pre-seteado y no editable

#### Escenario ADD-2.2 — más de un nivel base: selector limitado a esos niveles

**Dado** un docente con niveles base `{2, 3}`
**Cuando** carga la pantalla "Tipos de asistencia"
**Entonces** el selector de nivel ofrece únicamente las opciones `2` y `3`
Y no ofrece `1` ni `4`

#### Escenario ADD-2.3 — ROOT/ADMIN: todos los niveles de la institución activa

**Dado** un usuario con rol ROOT (o ADMIN)
**Y** la institución activa tiene niveles `{1, 2, 3}`
**Cuando** carga la pantalla "Tipos de asistencia"
**Entonces** el selector ofrece los niveles `1`, `2` y `3`

#### Escenario ADD-2.4 — cero niveles base: estado vacío explícito

**Dado** un usuario no-ROOT/no-ADMIN con niveles base `{}`
**Cuando** carga la pantalla "Tipos de asistencia"
**Entonces** la pantalla muestra un estado vacío explícito de "sin acceso a ningún nivel"
Y NO se renderiza un selector con opciones ni una tabla vacía sin contexto

---

### Requirement: Impresión de tipos de asistencia respetando el scope (tipos-asistencia-nivel-e-impresion, 2026-07-01)

El sistema DEBE exponer un endpoint de impresión de tipos de asistencia que genere el documento
server-side (consistente con la convención de `asistencia-reporting/spec.md` ASR-R1: generación
server-side, NUNCA client-side) y devuelva un archivo `application/pdf` como adjunto
(`Content-Disposition: attachment`). El resultado impreso DEBE respetar EXACTAMENTE el mismo scope
de nivel y los mismos filtros (`?level`, `?active`) que el listado (REQ-17): mismo conjunto de
niveles visibles, misma regla de 403 ante un `?level` fuera de scope.

#### Escenario ADD-3.1 — impresión exitosa respeta scope de un solo nivel

**Dado** un docente con niveles base `{2}`
**Cuando** solicita la impresión de tipos de asistencia sin `?level`
**Entonces** HTTP 200 con `Content-Type: application/pdf` y `Content-Disposition: attachment`
Y el PDF contiene únicamente tipos con `level = 2`

#### Escenario ADD-3.2 — impresión con nivel fuera de scope es rechazada

**Dado** un docente con niveles base `{2}`
**Cuando** solicita la impresión con `?level=3`
**Entonces** HTTP 403
Y no se genera ningún PDF

#### Escenario ADD-3.3 — impresión para ROOT/ADMIN sin filtro incluye todos los niveles

**Dado** un usuario con rol ROOT
**Cuando** solicita la impresión sin `?level`
**Entonces** HTTP 200 con un PDF que incluye tipos de todos los niveles de la institución activa

#### Escenario ADD-3.4 — impresión combina filtro de nivel y activo igual que el listado

**Dado** un usuario ROOT
**Cuando** solicita la impresión con `?level=3&active=false`
**Entonces** el PDF contiene únicamente tipos con `level = 3` Y `active = false`,
consistente con el Escenario 8.4 de la spec canónica

---

### Requirement: Rechazo HTTP 403 fuera de scope, nunca 200 con datos vacíos o error en el body (tipos-asistencia-nivel-e-impresion, 2026-07-01)

Toda operación (listar, crear, editar, imprimir) sobre `AttendanceType` que involucre un `level`
fuera del scope resuelto del usuario (REQ-16, `resolveAccessScope`) DEBE responder HTTP 403 con el
envelope de error estándar `{ error: { code, message } }`. El sistema NUNCA DEBE responder HTTP 200
con una lista vacía, un dato parcial, o un error embebido en el body como sustituto de un 403 real.
El código de error `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE` DEBE registrarse con status 403.

#### Escenario ADD-4.1 — 403 real, no 200 con lista vacía

**Dado** un docente con niveles base `{2}`
**Cuando** GET `/attendance-types?level=3`
**Entonces** HTTP 403 (NUNCA HTTP 200 con `{ data: [] }`)
Y el body es `{ error: { code: "ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE", message: "..." } }`

#### Escenario ADD-4.2 — validación de transporte previa al scope

**Dado** cualquier request a `/attendance-types` (GET, POST, PATCH) o su endpoint de impresión
**Cuando** el body o los query params no pasan la validación Zod del DTO
**Entonces** HTTP 400, independientemente del scope del usuario (la validación de transporte ocurre
antes de evaluar el scope)

---

## MODIFIED Requirements

### Requirement: Listar y filtrar

El endpoint de listado devuelve `AttendanceType` del tenant con filtros opcionales, ahora scopeados
por el nivel base del usuario autenticado (REQ-16):

- Si el usuario tiene `allLevels = true` (ROOT/ADMIN): el comportamiento es el de REQ-8 original —
  sin restricción de nivel, `?level` puede ser cualquier nivel válido de la institución activa.
- Si el usuario NO tiene `allLevels` y pasa `?level=` con un valor que NO pertenece a su conjunto de
  niveles base (REQ-16): la operación DEBE rechazarse con HTTP 403 (ver requerimiento "Rechazo HTTP
  403 fuera de scope" arriba). NUNCA HTTP 200.
- Si el usuario NO tiene `allLevels` y NO pasa `?level=`: el listado DEBE devolver únicamente los
  tipos cuyo `level` pertenece al conjunto de niveles base del usuario (puede ser más de un nivel si
  el usuario tiene más de un nivel base asignado).
- El filtro `?active` (REQ-8 original) se sigue aplicando igual, en conjunto con el scope de nivel.

(Previamente: REQ-8 no consideraba el usuario autenticado en absoluto — cualquier usuario con
permiso de módulo `ATTENDANCE_TYPES/READ` veía y podía filtrar sobre TODOS los niveles del tenant,
sin relación con sus niveles asignados.)

#### Escenario 8.5 — sin `?level`, usuario con un nivel base ve solo el suyo

**Dado** un docente con niveles base `{2}`
**Y** existen AttendanceTypes de `level = 1`, `level = 2` y `level = 3`
**Cuando** GET `/attendance-types` (sin `?level`)
**Entonces** HTTP 200
Y el body solo contiene tipos con `level = 2`

#### Escenario 8.6 — `?level` fuera de scope es 403

**Dado** un docente con niveles base `{2}`
**Cuando** GET `/attendance-types?level=1`
**Entonces** HTTP 403
Y no se filtra ni se expone ningún dato de `level = 1`

#### Escenario 8.7 — `?level` dentro de scope es aceptado

**Dado** un docente con niveles base `{2, 3}`
**Cuando** GET `/attendance-types?level=3`
**Entonces** HTTP 200
Y el body contiene solo tipos con `level = 3`

#### Escenario 8.8 — ROOT/ADMIN sin restricción de nivel

**Dado** un usuario con rol ROOT
**Cuando** GET `/attendance-types` (sin `?level`)
**Entonces** HTTP 200
Y el body contiene tipos de todos los niveles de la institución activa (comportamiento de REQ-8
original, sin cambios)

#### Escenario 8.9 — usuario con 0 niveles base ve listado vacío (sin `?level`)

**Dado** un usuario no-ROOT/no-ADMIN con niveles base `{}`
**Cuando** GET `/attendance-types` (sin `?level`)
**Entonces** HTTP 200
Y el body es `{ data: [] }` (lista vacía es correcta acá — no hay `?level` explícito fuera de
scope; el estado vacío se comunica en el front vía Escenario ADD-2.4)

---

### Requirement: Crear tipo no-sistema

Un `AttendanceType` con `isSystem = false` puede ser creado por un usuario con permisos, y ahora el
`level` provisto en el payload DEBE pertenecer al conjunto de niveles base del usuario (REQ-16),
salvo que el usuario tenga `allLevels = true` (ROOT/ADMIN).

(Previamente: REQ-3 no validaba el `level` del payload contra el usuario autenticado — cualquier
usuario con permiso de módulo `ATTENDANCE_TYPES/CREATE` podía crear un tipo para cualquier nivel del
tenant.)

#### Escenario 3.3 — creación con level fuera de scope es rechazada

**Dado** un docente con niveles base `{2}` y permisos de creación
**Cuando** POST `/attendance-types` con `{ ..., level: 3 }`
**Entonces** HTTP 403
Y no se crea ningún registro

#### Escenario 3.4 — creación con level dentro de scope es aceptada

**Dado** un docente con niveles base `{2}` y permisos de creación
**Cuando** POST `/attendance-types` con `{ ..., level: 2 }`
**Entonces** HTTP 201 (comportamiento de REQ-3 original, sin cambios adicionales)

#### Escenario 3.5 — ROOT/ADMIN puede crear en cualquier nivel de la institución activa

**Dado** un usuario con rol ROOT
**Cuando** POST `/attendance-types` con `{ ..., level: 4 }`
**Entonces** HTTP 201, sin restricción de scope (comportamiento de REQ-3 original)

---

### Requirement: Editar tipo no-sistema

Un `AttendanceType` con `isSystem = false` puede ser actualizado (PATCH). El `level` del registro
existente (invariante, no editable — ver nota de diseño de REQ-4 original) DEBE pertenecer al
conjunto de niveles base del usuario (REQ-16) para que la edición sea permitida, salvo
`allLevels = true` (ROOT/ADMIN). Los campos editables siguen siendo los de REQ-4 original:
`description`, `absenceValue`, `active`, `assignable`.

(Previamente: REQ-4 no validaba el `level` del registro objetivo contra el usuario autenticado —
cualquier usuario con permiso de módulo `ATTENDANCE_TYPES/UPDATE` podía editar un tipo custom de
cualquier nivel del tenant.)

#### Escenario 4.3 — edición de un tipo cuyo level está fuera de scope es rechazada

**Dado** un docente con niveles base `{2}` y permisos de edición
**Y** existe un AttendanceType custom `{ id: "X1", level: 3, isSystem: false }`
**Cuando** PATCH `/attendance-types/X1` con `{ description: "..." }`
**Entonces** HTTP 403
Y el registro permanece sin cambios

#### Escenario 4.4 — edición de un tipo cuyo level está dentro de scope es aceptada

**Dado** un docente con niveles base `{2}` y permisos de edición
**Y** existe un AttendanceType custom `{ id: "X2", level: 2, isSystem: false }`
**Cuando** PATCH `/attendance-types/X2` con `{ description: "Tardanza leve" }`
**Entonces** HTTP 200 (comportamiento de REQ-4 original, sin cambios adicionales)

#### Escenario 4.5 — ROOT/ADMIN puede editar cualquier nivel de la institución activa

**Dado** un usuario con rol ROOT
**Y** existe un AttendanceType custom `{ id: "X3", level: 1, isSystem: false }`
**Cuando** PATCH `/attendance-types/X3` con `{ active: false }`
**Entonces** HTTP 200, sin restricción de scope (comportamiento de REQ-4 original)

> **Nota de alcance:** DELETE (REQ-6/REQ-7) y GET por id (REQ-8 original, ruta `/:id`) NO quedan
> cubiertos por scope de nivel en este delta — no fueron pedidos por la propuesta base. Riesgo
> explícito: queda pendiente de decisión en design.md si deben scopearse por consistencia con
> REQ-17/REQ-18 o si el modelo de permisos existente (`ATTENDANCE_TYPES/DELETE`) es la única barrera
> aceptada para esas dos operaciones.

---

## Errores de dominio requeridos (adición a la tabla de la spec canónica)

| Código de error                          | HTTP | Cuándo se lanza                                                          |
|-------------------------------------------|------|---------------------------------------------------------------------------|
| `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE`      | 403  | GET/POST/PATCH/impresión con `level` fuera del scope de nivel del usuario (ver `resolveAccessScope`, REQ-16) |

Este código NO es un error de dominio en el sentido de invariantes de entidad (REQ-1..REQ-15) — es
un rechazo de autorización resuelto en el use case de application usando el scope de domain
(`resolveAccessScope`). Se documenta acá porque el HTTP mapping (403, envelope `{error}`) es
observable y forma parte del contrato de API.

---

## Criterios de aceptación transversales (adición)

- [ ] Ningún test verifica un HTTP 200 con datos vacíos como sustituto de un 403 fuera de scope
- [ ] `resolveAccessScope` (domain) es la única fuente de verdad para "está dentro de mi scope" —
      ningún use case reimplementa la lógica de colapso de modalidad por su cuenta
- [ ] El front nunca es la única barrera: un intento directo a la API fuera de scope (bypaseando el
      front) DEBE seguir devolviendo 403
- [ ] La impresión usa exactamente el mismo cálculo de scope/filtro que el listado (mismo resultado
      de conjunto de datos para los mismos query params y el mismo usuario)
