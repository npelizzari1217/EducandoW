# Exploration — attendance-type-result-migration (épico error-handling)

> Slice chico (~6 throws) pero con un fork arquitectónico real: reclasificar
> `AttendanceTypeLevelOutOfScopeError` de `DomainError` → `ApplicationError`.

## Resumen ejecutivo

6 throws de `AttendanceTypeLevelOutOfScopeError` (5 en el use-cases principal + 1 en el PDF UC).
Las firmas MIENTEN: los use-cases ya retornan `Result` para otros errores pero TIRAN el error de
scope fuera del canal declarado. **NO hay bug de status** — `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE: 403`
ya está en `DOMAIN_STATUS` y el filter de Nest atrapa el throw → hoy ya responde 403. Es puro trabajo
de honestidad de firmas (throw→Result). El fork: reclasificar el error a `ApplicationError` (Opción B,
recomendada) o dejarlo como `DomainError` (Opción A). Un PR en cualquier caso, <400 líneas.

## Inventario de throws

- `attendance-type.use-cases.ts`: 5 × `throw new AttendanceTypeLevelOutOfScopeError(...)` — Create:49,
  Update:99, Delete:147, List:180, Get:206.
- `generate-attendance-types-pdf.use-case.ts:100`: 1 × mismo error (6º throw).
- `ensure-attendance-types-for-level.use-case.ts`: 0 throws (upsert puro, sin scope). Fuera de scope.
- Controller: sin throws propios; ya usa `if(isErr) throw unwrapErr()` (create/get/update/delete) y
  `unwrapResultOrThrow` (printList). **Solo `list()` necesita cambio** (hoy no usa Result).

Ya bien manejados (NO re-migrar): `AttendanceTypeCodeDuplicateError` (return err), `SystemAttendanceTypeError`
(try/catch → err en Update/Delete), `AttendanceTypeNotFoundError` (return err).

FUERA DE SCOPE: `generate-attendance-types-pdf.use-case.ts:112` `throw new Error('Template ... no
encontrado')` — guard de infra bare-Error pre-existente, cola larga.

## Smoking gun (evidencia pre-existente)

`openspec/specs/attendance-types/spec.md:842-846` (commiteado 2026-07-01, ANTES de que existiera
`ApplicationError` el 2026-07-12) ya dice: *"El código `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE` NO es un
error de dominio... es un rechazo de autorización resuelto en el use case de application usando el
scope de domain (`resolveAccessScope`)."* Los propios autores lo marcaron como caller-context.

## EL FORK — reclasificar `AttendanceTypeLevelOutOfScopeError`?

| | **A — mecánico (queda DomainError)** | **B — reclasificar a ApplicationError (403)** |
|---|---|---|
| Clase | Sin cambio (`extends DomainError`) | `extends ApplicationError`, `super(msg, code, 403)` |
| Ubicación | Queda en `packages/domain/.../errors/` | **DEBE MOVERSE** a `api/src/application/shared/errors/` — `packages/domain` NO puede depender de `api`, así que `ApplicationError` nunca puede importarse desde el paquete domain |
| `DOMAIN_STATUS` | Sin cambio (403 sigue) | Quitar la entrada (dead code); status ahora sale de `exception.httpStatus` (rama ApplicationError, antes de DomainError) |
| Blast radius | 0 archivos extra | ~10 archivos: 3 index/export de domain, 1 archivo movido, 6 archivos api (2 use-cases + 4 test) actualizan import de `@educandow/domain` a la ruta api-local |
| Status HTTP | 403 igual | 403 igual (sin cambio de comportamiento) |
| Rotura de tests | Ninguna (ningún test asere `instanceof DomainError` para esta clase) | Ninguna (idem) |
| Correctitud | Deja una inconsistencia documentada (caller-context viviendo en domain) | Matchea la regla del épico + la anotación del spec; **2º consumidor real de ApplicationError** tras el piloto |
| Esfuerzo | Bajo (~60-90 líneas) | Bajo-Medio (~100-140 líneas, mecánico, enumerado) |

**Recomendación: Opción B.** El blast radius está 100% enumerado (~10 archivos, todos internos, cero
impacto web/frontend) y es mecánico (import + `extends` + arg de constructor). La correctitud casi no
cuesta extra: mismo status, mismos rewrites de tests que Opción A igual requiere, y el spec ya
anticipó el movimiento. Opción A = "más barato hoy, deuda mañana" (re-commitea una inconsistencia que
el spec viene marcando hace un mes). Fallback A válido si se quiere minimizar churn — comportamiento
runtime idéntico.

## Widening de return types

| Use case | Actual | Nuevo |
|---|---|---|
| Create | `Result<AttendanceType, AttendanceTypeCodeDuplicateError>` | `... \| AttendanceTypeLevelOutOfScopeError` |
| Update | `Result<AttendanceType, NotFound \| SystemAT>` | `... \| ScopeError` |
| Delete | `Result<void, NotFound \| SystemAT>` | `... \| ScopeError` |
| Get | `Result<AttendanceType, NotFound>` | `... \| ScopeError` |
| **List** | `Promise<AttendanceType[]>` (SIN Result) | `Promise<Result<AttendanceType[], ScopeError>>` — 2 call sites `return this.repo.list(...)` → `ok(...)` |
| PDF UC | `Result<Buffer, PdfError>` | `... \| ScopeError` |

`List` es el cambio de firma más grande (de "sin Result" a Result) y el único endpoint del controller
que requiere cambio de código.

## Controller

- create/getOne/update/remove/printList: **sin cambio** (ya usan el idiom; el widening del error se
  propaga transparente).
- `list`: único cambio real → `const result = await this.listUC.execute(...); if (result.isErr())
  throw result.unwrapErr(); return { data: result.unwrap().map(toResponse) };`.

## Impacto en tests

- `attendance-type.use-cases.test.ts` (5), `generate-attendance-types-pdf.use-case.test.ts` (1):
  `.rejects.toBeInstanceOf(ScopeError)` → `Result` (`isErr()` + `unwrapErr() instanceof`).
- `attendance-type.controller.test.ts` (6) + `.e2e.test.ts` (6): solo cambia el mock
  (`mockRejectedValue(new ScopeError())` → `mockResolvedValue(err(new ScopeError()))`); la aserción
  `.rejects.toBeInstanceOf` NO cambia (el controller sigue tirando vía el idiom).
- Ningún test asere `instanceof DomainError` para esta clase → Opción B no rompe nada.
- **Sin RED-first de status** (status no cambia). Es refactor puro TDD (test Result-shaped falla
  contra el código que aún tira, luego migra).

## Tamaño + delivery

Opción A ~60-90 líneas; Opción B ~100-140. Ambas <400 → **un PR**. Sin chained.

## Rama

`attendance-type` disjunto de los últimos merges (course-cycle, materia-grupo-ciclo). **Rama desde main.**

## Riesgos / preguntas para propose

1. Fork A vs B → decisión del usuario ANTES de propose.
2. Si B: destino del archivo movido = `api/src/application/shared/errors/` (junto a ApplicationError +
   subclases del piloto, matchea el wording del spec). Actualizar `attendance-types/spec.md:833-846`.
3. El bare-Error del PDF (:112) queda fuera de scope.
