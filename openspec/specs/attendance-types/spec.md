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

### REQ-3 — Crear tipo no-sistema

Un AttendanceType con `isSystem = false` puede ser creado por un usuario con permisos.

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

---

### REQ-4 — Editar tipo no-sistema

Un AttendanceType con `isSystem = false` puede ser actualizado (PATCH). Los campos editables son: `description`, `absenceValue`, `active`, `assignable`.

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

### REQ-8 — Listar y filtrar

El endpoint de listado devuelve AttendanceTypes del tenant con filtros opcionales.

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

Los dos primeros DEBEN registrarse en `DOMAIN_STATUS` del `AppExceptionFilter`.

---

## Criterios de aceptación transversales

- [ ] Todos los tests pasan: `pnpm test`
- [ ] No existe ningún `AttendanceStatus` activo en el esquema tenant (migrado a `AttendanceType`)
- [ ] Los históricos de `Attendance` no se modifican (snapshots inmutables intactos)
- [ ] Un fresh `pnpm seed` produce los 4 tipos de sistema por cada nivel de las instituciones seed
- [ ] La página front carga sin errores en modo producción
- [ ] Acceso con usuario sin permisos retorna 403 (no 500)
