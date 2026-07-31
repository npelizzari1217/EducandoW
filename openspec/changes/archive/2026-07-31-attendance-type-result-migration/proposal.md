# Proposal — attendance-type-result-migration

> Épico **application-error-handling** · slice consumidor.
> Migrar 6 throws de `AttendanceTypeLevelOutOfScopeError` a `Result` **y** reclasificar
> el error de `DomainError` → `ApplicationError` (Opción B, elegida por el usuario).
> Nivel pedagógico: **N/A** (transversal; aplica a TODOS los niveles).

## Intent

### Qué problema resolvemos
Las firmas de los use-cases de attendance-type **MIENTEN**. Ya retornan `Result` para sus
otros errores de negocio (`AttendanceTypeCodeDuplicateError`, `SystemAttendanceTypeError`,
`AttendanceTypeNotFoundError`), pero **TIRAN** `AttendanceTypeLevelOutOfScopeError` por fuera
del canal declarado. Un caller que lea el tipo de retorno no puede saber que este rechazo
existe: se entera en runtime por una excepción no anunciada.

Además, el error está **mal clasificado**: vive en `packages/domain` como `DomainError`
cuando conceptualmente es un **rechazo de autorización resuelto en la capa de application**
(caller-context), no una violación de invariante de dominio.

### Por qué ahora
El épico ya entregó la capacidad canónica `application-error-handling` con la clase base
`ApplicationError` (creada 2026-07-12) y su piloto en `users.use-cases.ts`
(`InsufficientRoleHierarchyError`, `CrossInstitutionForbiddenError`). Este slice es la
**prueba de que `ApplicationError` generaliza más allá del piloto**: es el **2º consumidor
real** de la jerarquía. Migrarlo ahora consolida el patrón mientras el contexto del épico
está fresco, y salda una inconsistencia que el spec viene marcando hace un mes.

### Cómo se ve el éxito
- Los 6 throws se convierten en `return err(...)`; ninguna firma miente.
- `AttendanceTypeLevelOutOfScopeError extends ApplicationError` con `httpStatus = 403`.
- La clase vive en `api/src/application/shared/errors/` (co-locada con `ApplicationError`).
- `packages/domain` no exporta más esta clase (cero export colgante).
- Respuesta HTTP: **403 antes y después** — cero cambio de comportamiento observable.
- Suite verde, coverage ≥ 80%, un PR < 400 líneas.

## Scope

### In scope
1. **Reclasificación de la clase** `AttendanceTypeLevelOutOfScopeError`:
   `extends DomainError` → `extends ApplicationError`, con constructor
   `super(message, 'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE', 403)`.
2. **Movimiento de archivo** de `packages/domain/src/attendance-type/errors/` →
   `api/src/application/shared/errors/` (restricción Clean Arch; ver mecánica abajo).
3. **6 throws → `return err(...)`**: 5 en `attendance-type.use-cases.ts`
   (Create:49, Update:99, Delete:147, List:180, Get:206) + 1 en
   `generate-attendance-types-pdf.use-case.ts:100`.
4. **Widening de 5 firmas de return type** (tabla abajo). Caso especial: **`List`** pasa de
   `Promise<AttendanceType[]>` (sin `Result`) a `Promise<Result<AttendanceType[], …>>` —
   sus 2 call sites `return repo.list(...)` envuelven en `ok(...)`.
5. **Controller**: sólo `list()` adopta `if (result.isErr()) throw result.unwrapErr()`.
   create/getOne/update/remove/printList ya usan el idiom → se propagan transparentes.
6. **Remoción de la entrada `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE: 403`** de `DOMAIN_STATUS`
   en `exception.filter.ts` (dead code: el status ahora sale de la rama `ApplicationError`
   vía `exception.httpStatus`, evaluada antes de la rama `DomainError`).
7. **Remoción de exports en `packages/domain`**: `src/index.ts:141`,
   `src/attendance-type/index.ts:8`, `src/attendance-type/errors/index.ts:4`.
8. **Actualización de ~6 import sites en `api`** (2 use-cases + 4 archivos de test) de
   `@educandow/domain` a la ruta api-local.
9. **Actualización de la anotación del spec** `openspec/specs/attendance-types/spec.md`
   (líneas ~833-846) para reflejar que la clasificación ya se materializó como
   `ApplicationError`.

### Out of scope (explícito)
- **`generate-attendance-types-pdf.use-case.ts:112`** — `throw new Error('Template … no
  encontrado')`: guard de infraestructura con `Error` desnudo, pre-existente. Es cola larga
  del épico (concierne a un futuro `InfrastructureError`), no a este slice. **Diferido.**
- `ensure-attendance-types-for-level.use-case.ts` — upsert puro, 0 throws de scope. Sin cambio.
- Los errores ya bien manejados (`CodeDuplicate`, `SystemAttendanceType`, `NotFound`) — no re-migrar.
- Cualquier cambio de comportamiento HTTP: **el 403 se preserva idéntico**.

## Rationale de clasificación — ¿por qué ApplicationError y no DomainError?

Regla del épico: **el contexto del caller decide**. Un error es `ApplicationError` cuando su
existencia depende de *quién pregunta* (scope/autorización del solicitante), no de una
invariante intrínseca del modelo de dominio. `AttendanceTypeLevelOutOfScopeError` es el caso
de libro: se dispara cuando un usuario intenta operar sobre un nivel educativo **fuera de su
scope de acceso** (`resolveAccessScope`). El mismo attendance-type es perfectamente válido
para otro caller con mayor alcance → no es una violación de dominio, es un rechazo de
autorización de application.

**Evidencia pre-existente (smoking gun):** `openspec/specs/attendance-types/spec.md:842-846`
(commiteado 2026-07-01, **antes** de que existiera `ApplicationError` el 2026-07-12) ya
declara textualmente que el código `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE` **NO es un error de
dominio**, sino *"un rechazo de autorización resuelto en el use case de application usando el
scope de domain (`resolveAccessScope`)"*. Los propios autores lo marcaron como caller-context
hace un mes. Esta migración no inventa una clasificación: **la materializa en código**.

## Mecánica de la reclasificación

### La restricción load-bearing: Clean Architecture
`packages/domain` **NO puede depender de `api`**. `ApplicationError` vive en `api`
(`api/src/application/shared/errors/`). Por lo tanto, una clase que `extends ApplicationError`
**no puede seguir viviendo en `packages/domain`** — importaría hacia adentro de `api`,
invirtiendo la dependencia. **El movimiento del archivo no es opcional: es forzado por la
regla arquitectónica.** Destino: `api/src/application/shared/errors/`, co-locado con
`ApplicationError` y las subclases del piloto (`InsufficientRoleHierarchyError`,
`CrossInstitutionForbiddenError`) — coincide con el wording del spec.

### Blast radius enumerado (~10 archivos, 100% internos, cero impacto web/frontend)
| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `api/src/application/shared/errors/attendance-type-level-out-of-scope-error.ts` | **Nuevo** (movido): `extends ApplicationError`, `super(msg, code, 403)` |
| 2 | `packages/domain/src/attendance-type/errors/attendance-type-level-out-of-scope-error.ts` | **Borrado** |
| 3 | `packages/domain/src/index.ts:141` | Quitar export |
| 4 | `packages/domain/src/attendance-type/index.ts:8` | Quitar export |
| 5 | `packages/domain/src/attendance-type/errors/index.ts:4` | Quitar export |
| 6 | `api/…/attendance-type.use-cases.ts` | Import → ruta api-local; 5 throws → `err` |
| 7 | `api/…/generate-attendance-types-pdf.use-case.ts` | Import → ruta api-local; 1 throw → `err` |
| 8 | `api/…/exception.filter.ts` | Quitar entrada `DOMAIN_STATUS` |
| 9-12 | 4 archivos de test (use-cases, pdf, controller, e2e) | Import → ruta api-local |

Todo el cambio es mecánico: import + `extends` + argumento de constructor + `err()`.
Ningún test asere `instanceof DomainError` para esta clase → la reclasificación **no rompe
nada**. Reuso total de la jerarquía `ApplicationError`: **cero clases base nuevas** (YAGNI).

## Widening de return types

| Use case | Firma actual | Firma nueva |
|----------|--------------|-------------|
| Create | `Result<AttendanceType, CodeDuplicate>` | `Result<AttendanceType, CodeDuplicate \| ScopeError>` |
| Update | `Result<AttendanceType, NotFound \| SystemAT>` | `… \| ScopeError` |
| Delete | `Result<void, NotFound \| SystemAT>` | `… \| ScopeError` |
| Get | `Result<AttendanceType, NotFound>` | `… \| ScopeError` |
| **List** | `Promise<AttendanceType[]>` *(sin Result)* | `Promise<Result<AttendanceType[], ScopeError>>` — 2 call sites → `ok(...)` |
| PDF UC | `Result<Buffer, PdfError>` | `… \| ScopeError` |

`List` es el cambio de firma más grande (de "sin Result" a `Result`) y el único endpoint del
controller que requiere cambio de código real.

## Estrategia de tests (TDD estricto — refactor-style)

- Runner: **Vitest**, `pnpm test`, coverage ≥ 80%.
- **NO hay RED-first de status**: el 403 no cambia, así que no existe un assert de status que
  arranque en rojo. Esto es refactor puro:
  1. Reescribir los tests a forma `Result` (`isErr()` + `unwrapErr() instanceof ScopeError`).
  2. Verlos fallar contra el código que **todavía tira** (RED estructural, no de comportamiento).
  3. Migrar los throws a `return err(...)` → GREEN.
- `attendance-type.use-cases.test.ts` (5) + `generate-attendance-types-pdf.use-case.test.ts` (1):
  `.rejects.toBeInstanceOf(ScopeError)` → aserción sobre `Result`.
- `attendance-type.controller.test.ts` (6) + `…e2e.test.ts` (6): **sólo swap de mock**
  (`mockRejectedValue(new ScopeError())` → `mockResolvedValue(err(new ScopeError()))`); la
  aserción `.rejects.toBeInstanceOf` **no cambia** porque el controller sigue tirando vía el idiom.

## Tamaño y delivery

- **Un PR**, estimado ~100-140 líneas → holgadamente < 400. **Sin chained/stacked PRs.**
- **Rama desde `main`** (`attendance-type` disjunto de los últimos merges: course-cycle,
  materia-grupo-ciclo → sin conflictos esperados).
- No es un bugfix: es honestidad-de-firmas + clasificación correcta. Cero cambio de comportamiento.

## Rollback

El movimiento es casi-aditivo: revertir el PR restaura la clase en `packages/domain` (con
`extends DomainError`), re-agrega la entrada en `DOMAIN_STATUS` y revierte los imports. Como
el status HTTP es idéntico en ambos estados, **un rollback no tiene efecto observable para el
cliente** — sólo mueve de vuelta el código y re-abre la inconsistencia de clasificación.
Riesgo de rollback: bajo.

## Follow-ups

1. **PDF template guard** (`generate-attendance-types-pdf.use-case.ts:112`): migrar el
   `throw new Error('Template … no encontrado')` cuando el épico defina `InfrastructureError`.
2. **Concern más amplio de `InfrastructureError`**: los errores de infra (templates, IO,
   dependencias externas) aún no tienen una clase base canónica en la jerarquía. Este slice
   los deja explícitamente fuera; el épico debería abordarlos en un futuro slice.

---
**Nota de arquitectura:** este slice es notable como la **prueba del épico de que
`ApplicationError` generaliza más allá del piloto** (`users.use-cases.ts`). Es el 2º
consumidor real y valida que la jerarquía funciona para dominios distintos.
