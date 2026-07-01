# Spec: Tipos de Asistencia (attendance-types)

**Versión:** 1.0  
**Fecha:** 2026-06-08  
**Propuesta base:** `openspec/changes/attendance-types/proposal.md`

---

## Alcance

Esta spec describe el estado que DEBE ser verdadero una vez aplicado el cambio. No prescribe implementación.

### Dentro del alcance

- Modelo `AttendanceType` en tenant DB
- Dominio: entidad, value objects, errores, interfaz de repositorio
- CRUD backend: use cases, controller, DTOs, módulo NestJS
- 4 códigos de sistema protegidos, generados por nivel
- Cascada idempotente en create/update institución
- Módulo de permisos `ATTENDANCE_TYPES`
- Página front CRUD con filas isSystem read-only

### Fuera del alcance

- ~~Grilla mensual de presentismo / toma de asistencia diaria~~ → ahora en
  `openspec/specs/attendance-recording/spec.md` (ATR-R1 ausentes por materia,
  ATR-R2 presente diario, ATR-R3 modelo de acceso). Resuelto: DEFERRED-1 de
  `docente-ciclo-grupos` (2026-06-16).
- Cómputo de inasistencias ni reportes de presentismo
- Cualquier modificación al modelo `Attendance` (asistencias históricas)

---

## Requisitos

### REQ-1 — Estructura del modelo AttendanceType

El modelo `AttendanceType` DEBE existir en el esquema tenant con los siguientes campos y restricciones:

| Campo         | Tipo           | Restricciones                                    |
|---------------|----------------|--------------------------------------------------|
| `id`          | UUID/string    | PK, único global                                 |
| `code`        | string         | máx 4 caracteres, NOT NULL                       |
| `description` | string         | NOT NULL                                         |
| `absenceValue`| Decimal        | ≥ 0, NOT NULL                                    |
| `level`       | Int            | `EducationalLevelCode` válido (1,2,3,4), NOT NULL|
| `active`      | boolean        | default true                                     |
| `assignable`  | boolean        | NOT NULL                                         |
| `isSystem`    | boolean        | NOT NULL, default false                          |

Restricción compuesta: `(level, code)` es ÚNICO.

#### Escenario 1.1 — code de más de 4 caracteres es rechazado

**Dado** que existe una institución con nivel SECUNDARIO  
**Cuando** se intenta crear un AttendanceType con `code = "ABCDE"` (5 caracteres)  
**Entonces** la operación falla en dominio antes de persistir  
Y el error es de tipo validación (no llega a la DB)

#### Escenario 1.2 — absenceValue negativo es rechazado

**Dado** que existe una institución con nivel PRIMARIO  
**Cuando** se intenta crear un AttendanceType con `absenceValue = -1`  
**Entonces** la operación falla con error de validación  
Y no se persiste ningún registro

#### Escenario 1.3 — level fuera del enum pedagógico es rechazado

**Dado** que se intenta crear un AttendanceType con `level = 9` (ADMINISTRACION)  
**Entonces** la operación falla con error de validación  
Y el mensaje indica que el nivel no es válido para AttendanceType

---

### REQ-2 — Unicidad de code por nivel

`code` es único dentro de un nivel; el mismo `code` puede existir en niveles distintos.

#### Escenario 2.1 — code duplicado en mismo nivel es rechazado

**Dado** que existe un AttendanceType con `code = "P"` para `level = SECUNDARIO`  
**Cuando** se intenta crear otro AttendanceType con `code = "P"` y `level = SECUNDARIO`  
**Entonces** la operación falla con error de conflicto  
Y el HTTP response es 409  
Y no se crea ningún nuevo registro

#### Escenario 2.2 — mismo code en distinto nivel es permitido

**Dado** que existe un AttendanceType con `code = "P"` para `level = SECUNDARIO`  
**Cuando** se crea un AttendanceType con `code = "P"` y `level = PRIMARIO`  
**Entonces** la operación es exitosa  
Y existen dos registros con `code = "P"`, cada uno para su nivel respectivo

---

### REQ-3 — Crear tipo no-sistema (MODIFIED — tipos-asistencia-nivel-e-impresion, 2026-07-01)

> Modificado por: `tipos-asistencia-nivel-e-impresion` (2026-07-01). Archivo:
> `openspec/changes/archive/2026-07-01-tipos-asistencia-nivel-e-impresion/`. Agrega scope de nivel
> base (REQ-16) a la creación. Comportamiento previo (Escenarios 3.1, 3.2) permanece sin cambios.

Un AttendanceType con `isSystem = false` puede ser creado por un usuario con permisos, y el `level`
provisto en el payload DEBE pertenecer al conjunto de niveles base del usuario (REQ-16), salvo que
el usuario tenga `allLevels = true` (ROOT/ADMIN).

#### Escenario 3.1 — creación exitosa de tipo custom

**Dado** que el usuario tiene rol ROOT o módulo ATTENDANCE_TYPES / CREATE  
**Y** no existe ningún AttendanceType con `code = "T"` para `level = PRIMARIO`  
**Cuando** POST `/attendance-types` con `{ code: "T", description: "Tardanza", absenceValue: 0.5, level: 2, assignable: true }`  
**Entonces** HTTP 201  
Y el body contiene `{ data: { id, code: "T", description: "Tardanza", absenceValue: "0.5", level: 2, assignable: true, isSystem: false, active: true } }`

#### Escenario 3.2 — creación sin autenticación es rechazada

**Dado** que la petición no lleva token JWT válido  
**Cuando** POST `/attendance-types`  
**Entonces** HTTP 401

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

### REQ-4 — Editar tipo no-sistema (MODIFIED — tipos-asistencia-nivel-e-impresion, 2026-07-01)

> Modificado por: `tipos-asistencia-nivel-e-impresion` (2026-07-01). Archivo:
> `openspec/changes/archive/2026-07-01-tipos-asistencia-nivel-e-impresion/`. Agrega scope de nivel
> base (REQ-16) a la edición. Comportamiento previo (Escenarios 4.1, 4.2) permanece sin cambios.

Un AttendanceType con `isSystem = false` puede ser actualizado (PATCH). El `level` del registro
existente (invariante, no editable — ver nota de diseño abajo) DEBE pertenecer al conjunto de
niveles base del usuario (REQ-16) para que la edición sea permitida, salvo `allLevels = true`
(ROOT/ADMIN). Los campos editables siguen siendo: `description`, `absenceValue`, `active`,
`assignable`.

#### Escenario 4.1 — edición exitosa de tipo custom

**Dado** que existe un AttendanceType `{ id: "X1", isSystem: false, description: "Tardanza", absenceValue: 0.5 }`  
**Y** el usuario tiene permisos  
**Cuando** PATCH `/attendance-types/X1` con `{ description: "Tardanza leve", absenceValue: 0.25 }`  
**Entonces** HTTP 200  
Y el body contiene los datos actualizados con `description = "Tardanza leve"` y `absenceValue = "0.25"`

#### Escenario 4.2 — cambio de code en tipo no-sistema es rechazado en el DTO

**Dado** que existe un AttendanceType `{ id: "X1", isSystem: false, code: "T" }`  
**Cuando** PATCH `/attendance-types/X1` con `{ code: "T2" }`  
**Entonces** el campo `code` es ignorado o falla con error de validación del DTO  
Y el `code` permanece `"T"` sin cambios

> **Nota de diseño:** `code` y `level` son invariantes de la entidad; no se exponen en el DTO de actualización.

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

> **Nota de alcance (cerrada):** DELETE (REQ-6/REQ-7) y GET por id quedaron pendientes de decisión
> en el delta original de este requisito; la decisión se cerró durante `apply` (PR3, ver
> `tasks.md` de este change archivado) — ambas operaciones también quedan level-scoped. Ver REQ-20.

---

### REQ-5 — Rechazar edición de tipo isSystem

Un AttendanceType con `isSystem = true` NO puede ser editado bajo ninguna circunstancia, ni siquiera por ROOT.

#### Escenario 5.1 — intento de editar tipo de sistema por ROOT

**Dado** que existe un AttendanceType `{ id: "SYS1", code: "P", isSystem: true }`  
**Y** el usuario tiene rol ROOT  
**Cuando** PATCH `/attendance-types/SYS1` con cualquier body  
**Entonces** HTTP 409  
Y el body contiene un error de dominio indicando que el tipo es protegido del sistema

#### Escenario 5.2 — intento de editar tipo de sistema por usuario con módulo

**Dado** que existe un AttendanceType `{ id: "SYS1", code: "SAB", isSystem: true }`  
**Y** el usuario tiene módulo ATTENDANCE_TYPES / UPDATE  
**Cuando** PATCH `/attendance-types/SYS1`  
**Entonces** HTTP 409 con mensaje de protección de sistema

---

### REQ-6 — Borrar tipo no-sistema

Un AttendanceType con `isSystem = false` puede ser eliminado físicamente.

#### Escenario 6.1 — borrado exitoso de tipo custom

**Dado** que existe un AttendanceType `{ id: "X1", isSystem: false }`  
**Y** el usuario tiene permisos  
**Cuando** DELETE `/attendance-types/X1`  
**Entonces** HTTP 204 sin body  
Y el registro ya no existe en la DB

---

### REQ-7 — Rechazar borrado de tipo isSystem

Un AttendanceType con `isSystem = true` NO puede ser eliminado bajo ninguna circunstancia.

#### Escenario 7.1 — intento de borrar tipo de sistema por ROOT

**Dado** que existe un AttendanceType `{ id: "SYS2", code: "DOM", isSystem = true }`  
**Y** el usuario tiene rol ROOT  
**Cuando** DELETE `/attendance-types/SYS2`  
**Entonces** HTTP 409  
Y el body indica que el tipo es protegido  
Y el registro persiste en la DB sin cambios

---

### REQ-8 — Listar y filtrar (MODIFIED — tipos-asistencia-nivel-e-impresion, 2026-07-01)

> Modificado por: `tipos-asistencia-nivel-e-impresion` (2026-07-01). Archivo:
> `openspec/changes/archive/2026-07-01-tipos-asistencia-nivel-e-impresion/`. Agrega scope de nivel
> base (REQ-16) al listado. Comportamiento previo para ROOT/ADMIN (Escenarios 8.1–8.4) permanece
> sin cambios.

El endpoint de listado devuelve `AttendanceType` del tenant con filtros opcionales, ahora scopeados
por el nivel base del usuario autenticado (REQ-16):

- Si el usuario tiene `allLevels = true` (ROOT/ADMIN): el comportamiento es el original — sin
  restricción de nivel, `?level` puede ser cualquier nivel válido de la institución activa.
- Si el usuario NO tiene `allLevels` y pasa `?level=` con un valor que NO pertenece a su conjunto de
  niveles base (REQ-16): la operación DEBE rechazarse con HTTP 403 (ver REQ-19). NUNCA HTTP 200.
- Si el usuario NO tiene `allLevels` y NO pasa `?level=`: el listado DEBE devolver únicamente los
  tipos cuyo `level` pertenece al conjunto de niveles base del usuario (puede ser más de un nivel si
  el usuario tiene más de un nivel base asignado).
- El filtro `?active` (original) se sigue aplicando igual, en conjunto con el scope de nivel.

#### Escenario 8.1 — listar todos los tipos del tenant

**Dado** que existen AttendanceTypes de distintos niveles y distintos `active`  
**Cuando** GET `/attendance-types`  
**Entonces** HTTP 200  
Y el body `{ data: [...] }` contiene todos los registros del tenant sin filtrar

#### Escenario 8.2 — filtrar por nivel

**Dado** que existen AttendanceTypes con `level = 2` (PRIMARIO) y `level = 3` (SECUNDARIO)  
**Cuando** GET `/attendance-types?level=2`  
**Entonces** HTTP 200  
Y todos los items del resultado tienen `level = 2`  
Y no aparece ningún item con `level = 3`

#### Escenario 8.3 — filtrar por activo

**Dado** que existen AttendanceTypes con `active = true` y `active = false`  
**Cuando** GET `/attendance-types?active=true`  
**Entonces** HTTP 200  
Y todos los items tienen `active = true`

#### Escenario 8.4 — filtrar por nivel y activo combinados

**Cuando** GET `/attendance-types?level=3&active=false`  
**Entonces** sólo retorna registros con `level = 3` Y `active = false`

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
Y el body contiene tipos de todos los niveles de la institución activa (comportamiento original,
sin cambios)

#### Escenario 8.9 — usuario con 0 niveles base ve listado vacío (sin `?level`)

**Dado** un usuario no-ROOT/no-ADMIN con niveles base `{}`  
**Cuando** GET `/attendance-types` (sin `?level`)  
**Entonces** HTTP 200  
Y el body es `{ data: [] }` (lista vacía es correcta acá — no hay `?level` explícito fuera de
scope; el estado vacío se comunica en el front vía Escenario ADD-2.4 / REQ-17)

---

### REQ-9 — Valores exactos de los 4 códigos de sistema

Cuando se generan los códigos de sistema para cualquier nivel pedagógico (INICIAL=1, PRIMARIO=2, SECUNDARIO=3, TERCIARIO=4), los valores DEBEN ser exactamente:

| code | description          | assignable | absenceValue | isSystem | active |
|------|----------------------|------------|--------------|----------|--------|
| SAB  | Sábado               | false      | 0            | true     | true   |
| DOM  | Domingo              | false      | 0            | true     | true   |
| P    | Presente             | true       | 0            | true     | true   |
| X    | Día no utilizado     | false      | 0            | true     | true   |

Estos 4 códigos se generan para CADA nivel pedagógico que tenga la institución. ADMINISTRACION (9) NO recibe tipos de sistema.

#### Escenario 9.1 — generación produce los 4 códigos con valores exactos

**Dado** que una institución tiene nivel SECUNDARIO sin ningún AttendanceType  
**Cuando** se dispara la provisión de tipos de sistema para ese nivel  
**Entonces** se crean exactamente 4 registros  
Y cada registro tiene los valores de la tabla anterior para su `code` correspondiente  
Y todos tienen `level = 3` (SECUNDARIO), `isSystem = true`, `active = true`

#### Escenario 9.2 — generación cubre todos los niveles pedagógicos de la institución

**Dado** que una institución tiene niveles PRIMARIO y SECUNDARIO  
**Cuando** se dispara la provisión  
**Entonces** existen 8 registros de sistema: 4 para level=2 y 4 para level=3  
Y no se crean registros para ADMINISTRACION (9)

---

### REQ-10 — Cascada idempotente al crear institución

Al crear una institución con uno o más niveles pedagógicos, se generan automáticamente los 4 códigos de sistema para cada nivel. La operación es idempotente (safe to retry / no duplicates).

#### Escenario 10.1 — crear institución dispara generación de tipos de sistema

**Dado** que no existen AttendanceTypes en el tenant de la nueva institución  
**Cuando** se crea una institución con `institution_levels: [{ level: "PRIMARIO" }]`  
**Entonces** la institución se crea exitosamente  
Y existen 4 AttendanceTypes en el tenant de esa institución, todos con `level = 2` y `isSystem = true`

#### Escenario 10.2 — crear institución sin niveles no genera tipos

**Cuando** se crea una institución sin `institution_levels` (o vacío)  
**Entonces** la institución se crea exitosamente  
Y no existen AttendanceTypes en su tenant

---

### REQ-11 — Cascada idempotente al actualizar institución

Al actualizar una institución y agregar nuevos niveles, se generan los tipos de sistema para los niveles nuevos sin tocar los existentes. Nunca se duplican.

#### Escenario 11.1 — agregar nivel nuevo dispara provisión para ese nivel

**Dado** que una institución tiene nivel PRIMARIO con sus 4 tipos de sistema  
**Cuando** se actualiza la institución agregando nivel SECUNDARIO  
**Entonces** se crean 4 nuevos AttendanceTypes con `level = 3` y `isSystem = true`  
Y los 4 registros de PRIMARIO permanecen intactos (sin duplicados)

#### Escenario 11.2 — actualizar institución sin agregar niveles no duplica tipos

**Dado** que una institución tiene nivel PRIMARIO con sus 4 tipos de sistema  
**Cuando** se actualiza la institución cambiando sólo la dirección (sin modificar niveles)  
**Entonces** siguen existiendo exactamente 4 tipos para PRIMARIO (no hay duplicados)

#### Escenario 11.3 — provisión repetida del mismo nivel es idempotente

**Dado** que un nivel ya tiene sus 4 códigos de sistema  
**Cuando** se ejecuta la provisión para ese nivel nuevamente (por cualquier trigger)  
**Entonces** la cantidad total de AttendanceTypes de sistema para ese nivel sigue siendo 4  
Y los valores no son modificados

---

### REQ-12 — Mapeo HTTP del controller

El controller DEBE producir los siguientes códigos HTTP, consistentes con el patrón de Instituciones:

| Operación                              | Éxito | Error validación | Duplicado / isSystem protegido | No encontrado |
|----------------------------------------|-------|-----------------|-------------------------------|---------------|
| POST `/attendance-types`               | 201   | 400             | 409                           | —             |
| GET `/attendance-types`                | 200   | —               | —                             | —             |
| GET `/attendance-types/:id`            | 200   | —               | —                             | 404           |
| PATCH `/attendance-types/:id`          | 200   | 400             | 409                           | 404           |
| DELETE `/attendance-types/:id`         | 204   | —               | 409                           | 404           |

Los errores de dominio `ATTENDANCE_TYPE_CODE_DUPLICATE` y `ATTENDANCE_TYPE_SYSTEM_PROTECTED` DEBEN estar registrados en `DOMAIN_STATUS` del `AppExceptionFilter` con status 409.

#### Escenario 12.1 — POST exitoso retorna 201

**Cuando** POST `/attendance-types` con datos válidos  
**Entonces** HTTP 201 y `{ data: { ... } }`

#### Escenario 12.2 — PATCH sobre type inexistente retorna 404

**Cuando** PATCH `/attendance-types/id-inexistente`  
**Entonces** HTTP 404

#### Escenario 12.3 — DELETE exitoso retorna 204 sin body

**Cuando** DELETE `/attendance-types/:id` de un tipo no-sistema  
**Entonces** HTTP 204 y body vacío

#### Escenario 12.4 — violación de unicidad retorna 409

**Cuando** POST `/attendance-types` con `code` y `level` ya existentes  
**Entonces** HTTP 409

#### Escenario 12.5 — intento de mutar isSystem retorna 409

**Cuando** PATCH o DELETE sobre un AttendanceType `isSystem = true`  
**Entonces** HTTP 409

---

### REQ-13 — Control de acceso por permisos

El acceso al módulo ATTENDANCE_TYPES requiere rol ROOT o tener el módulo `ATTENDANCE_TYPES` con la acción correspondiente asignada.

#### Escenario 13.1 — ROOT puede acceder a cualquier acción

**Dado** que el usuario tiene rol ROOT  
**Cuando** ejecuta POST, GET, PATCH, DELETE en `/attendance-types`  
**Entonces** el guard de roles no rechaza la petición (el acceso se concede)

#### Escenario 13.2 — usuario con módulo ATTENDANCE_TYPES / READ puede listar

**Dado** que el usuario tiene módulo `ATTENDANCE_TYPES` con acción `READ` pero no es ROOT  
**Cuando** GET `/attendance-types`  
**Entonces** HTTP 200

#### Escenario 13.3 — usuario sin permisos es rechazado

**Dado** que el usuario no tiene rol ROOT ni módulo ATTENDANCE_TYPES  
**Cuando** GET `/attendance-types`  
**Entonces** HTTP 403

#### Escenario 13.4 — módulo ATTENDANCE_TYPES existe en el seed

**Dado** que se ejecuta el seed maestro  
**Entonces** existe un módulo con `name = "ATTENDANCE_TYPES"` en la tabla de módulos  
Y tiene al menos las acciones: CREATE, READ, UPDATE, DELETE

---

### REQ-14 — Entrada de menú en el front

La página de CRUD de tipos de asistencia DEBE ser accesible desde la barra lateral bajo el grupo "Sistema".

#### Escenario 14.1 — entrada de menú visible para ROOT

**Dado** que el usuario autenticado tiene rol ROOT  
**Cuando** carga el dashboard  
**Entonces** el sidebar muestra la entrada "Tipos de asistencia" bajo el grupo "Sistema"  
Y al hacer click navega a la ruta de attendance-types

#### Escenario 14.2 — filas isSystem mostradas como read-only

**Dado** que se carga la tabla de tipos de asistencia  
**Y** existen registros con `isSystem = true`  
**Entonces** esas filas NO muestran botones de edición ni borrado habilitados  
Y las filas con `isSystem = false` muestran los controles de acción normales

---

### REQ-15 — Campo `behavior` (clasificador de ausentismo) (asistencia-behavior-e-impresion, 2026-07-01)

> Agregado por: `asistencia-behavior-e-impresion` (2026-07-01). Archivo: `openspec/changes/archive/2026-07-01-asistencia-behavior-e-impresion/`.
> Extiende REQ-1 (modelo `AttendanceType`): se agrega la columna `behavior` (enum nativo Prisma
> `AttendanceBehavior`, valores 1–7). `absenceValue` (REQ-1) permanece sin cambios de tipo,
> precisión ni semántica — `behavior` es un clasificador adicional, no lo reemplaza ni recalcula.
> `assignable` (REQ-1) deja de ser la fuente de verdad para el combo de grilla y pasa a ser
> DERIVADO de `behavior` (`assignable = behavior !== NO_ELEGIBLE(3)`); la columna NO se elimina
> (compatibilidad de lectura / rollback — ver design.md ADR-03). Cross-reference:
> `attendance-recording/spec.md` — Addendum ATR-R9 (el combo sigue filtrando por `assignable`, que
> ahora refleja `behavior` 1:1) y capacidad nueva `asistencia-reporting/spec.md` (impresión PDF que
> consume `behavior` para totales ponderados).

El modelo `AttendanceType` DEBE tener un campo `behavior` con uno de los siguientes 7 valores enteros:

| behavior | Nombre                | Significado                                                              |
|----------|-----------------------|---------------------------------------------------------------------------|
| 1        | AUSENTE_INJUSTIFICADO | Ausente sin justificar                                                    |
| 2        | AUSENTE_JUSTIFICADO   | Ausente justificado                                                      |
| 3        | NO_ELEGIBLE           | No elegible — reemplaza el rol funcional de `assignable=false` en el combo|
| 4        | NO_COMPUTA            | No considerar ausentismo (ej. Presente)                                  |
| 5        | TARDE_INJUSTIFICADA   | Tarde injustificada                                                      |
| 6        | TARDE_JUSTIFICADA     | Tarde justificada                                                        |
| 7        | DIA_NO_HABIL          | Día no hábil (feriado) — a diferencia de `behavior 3`, SÍ es seleccionable|

El sistema DEBE rechazar cualquier operación de create/update que provea un `behavior` fuera del
rango 1–7.

**Mapeo fijo de tipos de sistema** (inmutable, no editable vía CRUD ni API, ni por ROOT):
- `P` → `behavior = 4` (NO_COMPUTA)
- `SAB`, `DOM`, `X` → `behavior = 3` (NO_ELEGIBLE)

`behavior = 3` (NO_ELEGIBLE) NUNCA aparece en el combo de la grilla diaria/mensual; los demás
valores (1, 2, 4, 5, 6, 7) SÍ aparecen cuando el tipo está `active`. Un custom con `behavior = 7`
(ej. "Feriado") ES seleccionable y marcable día a día por Secretaría para alumnos/filas
individuales — a diferencia de `behavior = 3`, que nunca es seleccionable.

`behavior` NO es único: pueden existir múltiples `AttendanceType` (incluso dentro del mismo nivel)
con el mismo `behavior`, sin conflicto de validación cruzada.

**Invariante de migración:** tras el deploy de este cambio, TODO row de `AttendanceType` (sistema
y custom) DEBE tener un `behavior` válido no-nulo — ningún row PUEDE quedar con `behavior` null o
faltante. La heurística de backfill para customs preexistentes sin `behavior` obvio es una decisión
de diseño (design.md ADR-02, Riesgo A); esta spec solo fija el invariante de estado final y el
mapeo determinístico de sistema arriba descripto.

**Protección de sistema extendida:** la protección de REQ-5/REQ-7 (rechazo de edición/borrado de
`isSystem = true`) se extiende explícitamente al campo `behavior` — cualquier intento de mutar el
`behavior` de un tipo de sistema DEBE rechazarse igual que ya se rechaza para `description` o
`absenceValue`.

#### Escenario 15.1 — behavior válido aceptado en creación de tipo custom

**Dado** un usuario autorizado (Secretario+) creando un AttendanceType custom
**Cuando** el payload incluye `behavior = 6` (Tarde Justificado)
**Entonces** el AttendanceType se crea con `behavior = 6`
Y `absenceValue` se persiste tal cual se envió, independiente del `behavior`

#### Escenario 15.2 — behavior inválido rechazado

**Dado** un usuario autorizado creando o actualizando un AttendanceType
**Cuando** el payload incluye `behavior = 8` (fuera de rango) o `behavior = 0`
**Entonces** la operación se rechaza con error de validación
Y no se crea ni modifica ningún registro

#### Escenario 15.3 — tipo de sistema P fijo en behavior 4

**Dado** el AttendanceType de sistema "P" para un nivel dado
**Cuando** se inspecciona su `behavior` post-migración
**Entonces** `behavior` DEBE ser igual a 4 (NO_COMPUTA)

#### Escenario 15.4 — tipos de sistema SAB/DOM/X fijos en behavior 3

**Dado** los AttendanceTypes de sistema "SAB", "DOM", "X" para un nivel dado
**Cuando** se inspecciona su `behavior` post-migración
**Entonces** cada uno DEBE ser igual a `behavior = 3` (NO_ELEGIBLE)

#### Escenario 15.5 — behavior 3 excluido del combo de grilla

**Dado** el combo de la grilla de asistencia para una celda editable (hábil)
**Y** el AttendanceType "SAB" tiene `behavior = 3`
**Cuando** se computan las opciones del combo
**Entonces** "SAB" NO DEBE aparecer en el combo

#### Escenario 15.6 — behaviors 1,2,4,5,6,7 incluidos en el combo de grilla

**Dado** AttendanceTypes activos con `behavior` en {1,2,4,5,6,7} (ej. "A"=1, "AJ"=2, "P"=4, "TI"=5, "TJ"=6, "Feriado"=7)
**Cuando** se computan las opciones del combo para una celda editable
**Entonces** todos DEBEN aparecer en el combo

#### Escenario 15.7 — Feriado (behavior 7) marcado día a día

**Dado** un AttendanceType custom "Feriado" con `behavior = 7`, `active = true`
**Cuando** Secretaría selecciona "Feriado" para un alumno específico en un día específico de la grilla
**Entonces** el código de ese día para ese alumno DEBE registrarse como "Feriado" (`behavior 7`)
Y los códigos de otros alumnos/días DEBEN permanecer sin afectar

#### Escenario 15.8 (edge) — custom creado para cada valor de behavior sin conflicto de unicidad

**Dado** un usuario autorizado creando 7 AttendanceTypes custom distintos, uno por cada valor de behavior 1 a 7
**Cuando** cada uno se envía con un `absenceValue` válido
**Entonces** cada uno se crea exitosamente con su respectivo `behavior`
Y ninguna validación cruzada rechaza un `behavior` solo porque otro tipo ya lo usa (`behavior` no es único)

#### Escenario 15.9 (edge) — absenceValue fraccionario con cualquier behavior

**Dado** un AttendanceType custom con `absenceValue = 0.25` y `behavior = 5` (Tarde Injustificada)
**Y** otro AttendanceType custom con `absenceValue = 0.75` y `behavior = 1` (Ausente Injustificado)
**Cuando** ambos se crean
**Entonces** ambos DEBEN persistirse con su valor decimal exacto y el `behavior` elegido
Y la validación de `behavior` DEBE ser independiente del `absenceValue` elegido

---

### REQ-16 — Nivel base — colapso de modalidad (tipos-asistencia-nivel-e-impresion, 2026-07-01)

> Agregado por: `tipos-asistencia-nivel-e-impresion` (2026-07-01). Archivo:
> `openspec/changes/archive/2026-07-01-tipos-asistencia-nivel-e-impresion/`. Gobierna el scope de
> nivel usado por REQ-3 (MODIFIED), REQ-4 (MODIFIED), REQ-8 (MODIFIED), REQ-17, REQ-18, REQ-19 y
> REQ-20 de esta sección.

El sistema DEBE derivar, para cada usuario autenticado, el conjunto de **niveles base** a partir de
`user.levels` (códigos compuestos `level * 10 + modality`, ver `access-scope.ts`), colapsando la
modalidad: dos códigos compuestos con el mismo `level` (distinta `modality`) DEBEN contar como UN
solo nivel base. El cardinal de este conjunto (0, 1, o >1 niveles base) es la entrada que gobierna
el scope de listado (REQ-8), alta/edición (REQ-3/REQ-4), impresión (REQ-18) y el selector del front
(REQ-17). Para usuarios con `allLevels = true` (ROOT o ADMIN), este colapso NO aplica — su scope es
"todos los niveles pedagógicos de la institución activa" independientemente de su propio
`user.levels`.

#### Escenario 16.1 — dos modalidades del mismo nivel colapsan a un nivel base

**Dado** un usuario con `user.levels = [21, 22]` (nivel 2, modalidades 1 y 2)  
**Cuando** se resuelve su conjunto de niveles base  
**Entonces** el conjunto resultante es `{2}` (un solo nivel base)

#### Escenario 16.2 — niveles base distintos no colapsan

**Dado** un usuario con `user.levels = [20, 31]` (nivel 2 modalidad 0, nivel 3 modalidad 1)  
**Cuando** se resuelve su conjunto de niveles base  
**Entonces** el conjunto resultante es `{2, 3}` (dos niveles base)

#### Escenario 16.3 — usuario sin niveles asignados

**Dado** un usuario no-ROOT/no-ADMIN con `user.levels = []`  
**Cuando** se resuelve su conjunto de niveles base  
**Entonces** el conjunto resultante es `{}` (cero niveles base)

---

### REQ-17 — Selector de nivel en el front adaptado al scope del usuario (tipos-asistencia-nivel-e-impresion, 2026-07-01)

> Agregado por: `tipos-asistencia-nivel-e-impresion` (2026-07-01). Archivo:
> `openspec/changes/archive/2026-07-01-tipos-asistencia-nivel-e-impresion/`.

La pantalla "Tipos de asistencia" DEBE reemplazar el `LEVEL_OPTIONS` hardcodeado por los niveles
base derivados del usuario (REQ-16), aplicados tanto al listado como al form de alta. El front DEBE
tratarse como mejora de UX — el rechazo real de operaciones fuera de scope ocurre en backend
(REQ-8, REQ-3, REQ-4); el front NUNCA es la única barrera.

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

#### Escenario 17.1 — un solo nivel base: selector visible y deshabilitado

**Dado** un docente con niveles base `{2}` (colapsados de REQ-16)  
**Cuando** carga la pantalla "Tipos de asistencia"  
**Entonces** el selector de nivel se muestra visible, deshabilitado, con valor fijo `2`  
Y el listado muestra solo tipos con `level = 2`  
Y el form de alta abre con `level = 2` pre-seteado y no editable

#### Escenario 17.2 — más de un nivel base: selector limitado a esos niveles

**Dado** un docente con niveles base `{2, 3}`  
**Cuando** carga la pantalla "Tipos de asistencia"  
**Entonces** el selector de nivel ofrece únicamente las opciones `2` y `3`  
Y no ofrece `1` ni `4`

#### Escenario 17.3 — ROOT/ADMIN: todos los niveles de la institución activa

**Dado** un usuario con rol ROOT (o ADMIN)  
**Y** la institución activa tiene niveles `{1, 2, 3}`  
**Cuando** carga la pantalla "Tipos de asistencia"  
**Entonces** el selector ofrece los niveles `1`, `2` y `3`

#### Escenario 17.4 — cero niveles base: estado vacío explícito

**Dado** un usuario no-ROOT/no-ADMIN con niveles base `{}`  
**Cuando** carga la pantalla "Tipos de asistencia"  
**Entonces** la pantalla muestra un estado vacío explícito de "sin acceso a ningún nivel"  
Y NO se renderiza un selector con opciones ni una tabla vacía sin contexto

---

### REQ-18 — Impresión de tipos de asistencia respetando el scope (tipos-asistencia-nivel-e-impresion, 2026-07-01)

> Agregado por: `tipos-asistencia-nivel-e-impresion` (2026-07-01). Archivo:
> `openspec/changes/archive/2026-07-01-tipos-asistencia-nivel-e-impresion/`. Cross-reference:
> `asistencia-reporting/spec.md` ASR-R1 (generación server-side, nunca client-side).

El sistema DEBE exponer un endpoint de impresión de tipos de asistencia (`GET
/attendance-types/print`) que genere el documento server-side y devuelva un archivo
`application/pdf` como adjunto (`Content-Disposition: attachment`). El resultado impreso DEBE
respetar EXACTAMENTE el mismo scope de nivel y los mismos filtros (`?level`, `?active`) que el
listado (REQ-8): mismo conjunto de niveles visibles, misma regla de 403 ante un `?level` fuera de
scope.

#### Escenario 18.1 — impresión exitosa respeta scope de un solo nivel

**Dado** un docente con niveles base `{2}`  
**Cuando** solicita la impresión de tipos de asistencia sin `?level`  
**Entonces** HTTP 200 con `Content-Type: application/pdf` y `Content-Disposition: attachment`  
Y el PDF contiene únicamente tipos con `level = 2`

#### Escenario 18.2 — impresión con nivel fuera de scope es rechazada

**Dado** un docente con niveles base `{2}`  
**Cuando** solicita la impresión con `?level=3`  
**Entonces** HTTP 403  
Y no se genera ningún PDF

#### Escenario 18.3 — impresión para ROOT/ADMIN sin filtro incluye todos los niveles

**Dado** un usuario con rol ROOT  
**Cuando** solicita la impresión sin `?level`  
**Entonces** HTTP 200 con un PDF que incluye tipos de todos los niveles de la institución activa

#### Escenario 18.4 — impresión combina filtro de nivel y activo igual que el listado

**Dado** un usuario ROOT  
**Cuando** solicita la impresión con `?level=3&active=false`  
**Entonces** el PDF contiene únicamente tipos con `level = 3` Y `active = false`, consistente con
el Escenario 8.4

---

### REQ-19 — Rechazo HTTP 403 fuera de scope, nunca 200 con datos vacíos o error en el body (tipos-asistencia-nivel-e-impresion, 2026-07-01)

> Agregado por: `tipos-asistencia-nivel-e-impresion` (2026-07-01). Archivo:
> `openspec/changes/archive/2026-07-01-tipos-asistencia-nivel-e-impresion/`.

Toda operación (listar, crear, editar, eliminar, obtener por id, imprimir) sobre `AttendanceType`
que involucre un `level` fuera del scope resuelto del usuario (REQ-16, `resolveAccessScope`) DEBE
responder HTTP 403 con el envelope de error estándar `{ error: { code, message } }`. El sistema
NUNCA DEBE responder HTTP 200 con una lista vacía, un dato parcial, o un error embebido en el body
como sustituto de un 403 real. El código de error `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE` DEBE
registrarse con status 403 (ver tabla de errores de dominio).

#### Escenario 19.1 — 403 real, no 200 con lista vacía

**Dado** un docente con niveles base `{2}`  
**Cuando** GET `/attendance-types?level=3`  
**Entonces** HTTP 403 (NUNCA HTTP 200 con `{ data: [] }`)  
Y el body es `{ error: { code: "ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE", message: "..." } }`

#### Escenario 19.2 — validación de transporte previa al scope

**Dado** cualquier request a `/attendance-types` (GET, POST, PATCH) o su endpoint de impresión  
**Cuando** el body o los query params no pasan la validación Zod del DTO  
**Entonces** HTTP 400, independientemente del scope del usuario (la validación de transporte ocurre
antes de evaluar el scope)

---

### REQ-20 — Scope de nivel extendido a Eliminar y Obtener por id (tipos-asistencia-nivel-e-impresion, 2026-07-01)

> Agregado por: `tipos-asistencia-nivel-e-impresion` (2026-07-01). Archivo:
> `openspec/changes/archive/2026-07-01-tipos-asistencia-nivel-e-impresion/`. **Nota de mérge:** el
> delta original de este change dejaba DELETE (REQ-6/REQ-7) y GET por id explícitamente FUERA de
> alcance como "riesgo abierto pendiente de decisión" (ver design.md §9 de este change archivado).
> Esa decisión se cerró durante `apply` (PR3, `tasks.md` T12–T19 de este change archivado):
> Update/Delete/Get-by-id quedaron level-scoped igual que Listar/Crear, verificado con tests e2e
> reales (ver `verify-report.md` de este change archivado, filas "Delete scopeado" / "Get-by-id
> scopeado"). Este requisito documenta esa extensión, formalmente no cubierta por las secciones
> MODIFIED del delta original pero sí implementada y verificada.

El `level` del registro objetivo (invariante de la entidad) DEBE pertenecer al conjunto de niveles
base del usuario (REQ-16) para que DELETE (REQ-6) o GET por id (`/attendance-types/:id`, REQ-12)
sean permitidos, salvo `allLevels = true` (ROOT/ADMIN). El comportamiento de REQ-6/REQ-7 (protección
de tipos `isSystem`) permanece sin cambios y se evalúa independientemente del scope de nivel.

#### Escenario 20.1 — DELETE de un tipo cuyo level está fuera de scope es rechazado

**Dado** un docente con niveles base `{2}` y permisos de borrado  
**Y** existe un AttendanceType custom `{ id: "X4", level: 3, isSystem: false }`  
**Cuando** DELETE `/attendance-types/X4`  
**Entonces** HTTP 403  
Y el registro persiste en la DB sin cambios

#### Escenario 20.2 — DELETE de un tipo cuyo level está dentro de scope es aceptado

**Dado** un docente con niveles base `{2}` y permisos de borrado  
**Y** existe un AttendanceType custom `{ id: "X5", level: 2, isSystem: false }`  
**Cuando** DELETE `/attendance-types/X5`  
**Entonces** HTTP 204 (comportamiento de REQ-6 original, sin cambios adicionales)

#### Escenario 20.3 — GET por id de un tipo cuyo level está fuera de scope es rechazado

**Dado** un docente con niveles base `{2}`  
**Y** existe un AttendanceType `{ id: "X6", level: 3 }`  
**Cuando** GET `/attendance-types/X6`  
**Entonces** HTTP 403

#### Escenario 20.4 — ROOT/ADMIN sin restricción de nivel en DELETE/GET por id

**Dado** un usuario con rol ROOT  
**Y** existe un AttendanceType `{ id: "X7", level: 1 }`  
**Cuando** DELETE o GET `/attendance-types/X7`  
**Entonces** la operación procede sin restricción de scope (comportamiento original)

---

## Invariantes de dominio (resumen)

1. `code.length ≤ 4` — validado en entidad antes de persistir
2. `absenceValue ≥ 0` — validado en entidad
3. `level ∈ {1, 2, 3, 4}` — ADMINISTRACION (9) no es válido para AttendanceType
4. `(level, code)` único por tenant — constraint compuesto en DB
5. `isSystem = true` → operaciones de mutación (edit/delete) lanzar error de dominio
6. Los 4 códigos de sistema son SAB, DOM, P, X con valores fijos e inmutables
7. La provisión de tipos de sistema es idempotente: upsert por `(level, code)`, nunca inserta duplicados

---

## Errores de dominio requeridos

| Código de error                       | HTTP | Cuándo se lanza                                                         |
|---------------------------------------|------|-------------------------------------------------------------------------|
| `ATTENDANCE_TYPE_CODE_DUPLICATE`      | 409  | `(level, code)` ya existe para ese tenant                               |
| `ATTENDANCE_TYPE_SYSTEM_PROTECTED`    | 409  | Intento de editar o borrar un tipo con `isSystem = true`                |
| `ATTENDANCE_TYPE_NOT_FOUND`           | 404  | GET/PATCH/DELETE por id inexistente                                      |
| `ATTENDANCE_TYPE_INVALID_LEVEL`       | 400  | `level` no pertenece al enum pedagógico válido (1-4)                    |
| `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE`  | 403  | GET/POST/PATCH/DELETE/impresión con `level` fuera del scope de nivel del usuario (REQ-16/REQ-19/REQ-20, agregado por `tipos-asistencia-nivel-e-impresion`, 2026-07-01) |

Los dos primeros DEBEN registrarse en `DOMAIN_STATUS` del `AppExceptionFilter`. El código
`ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE` NO es un error de dominio en el sentido de invariantes de
entidad — es un rechazo de autorización resuelto en el use case de application usando el scope de
domain (`resolveAccessScope`); se documenta acá porque el HTTP mapping (403, envelope `{error}`) es
observable y forma parte del contrato de API.

---

## Criterios de aceptación transversales

- [ ] Todos los tests pasan: `pnpm test`
- [ ] No existe ningún `AttendanceStatus` activo en el esquema tenant (migrado a `AttendanceType`)
- [ ] Los históricos de `Attendance` no se modifican (snapshots inmutables intactos)
- [ ] Un fresh `pnpm seed` produce los 4 tipos de sistema por cada nivel de las instituciones seed
- [ ] La página front carga sin errores en modo producción
- [ ] Acceso con usuario sin permisos retorna 403 (no 500)

### Adición — tipos-asistencia-nivel-e-impresion (2026-07-01)

- [x] Ningún test verifica un HTTP 200 con datos vacíos como sustituto de un 403 fuera de scope
- [x] `resolveAccessScope` (domain) es la única fuente de verdad para "está dentro de mi scope" —
      ningún use case reimplementa la lógica de colapso de modalidad por su cuenta
- [x] El front nunca es la única barrera: un intento directo a la API fuera de scope (bypaseando el
      front) DEBE seguir devolviendo 403
- [x] La impresión usa exactamente el mismo cálculo de scope/filtro que el listado (mismo resultado
      de conjunto de datos para los mismos query params y el mismo usuario)
