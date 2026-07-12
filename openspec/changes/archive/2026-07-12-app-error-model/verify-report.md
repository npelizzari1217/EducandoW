# Verify Report: app-error-model

Veredicto: **PASS**

## Suite + typecheck

- `pnpm --filter api test` — **208 test files, 2116 tests, todos pasaron.** Confirma exactamente lo
  reportado por apply.
- `pnpm --filter api typecheck` — limpio, sin errores.

## Bug 500→403 (AEM-R5) — CONFIRMADO

`exception.filter.ts`: orden de ramas confirmado línea por línea —
`HttpException` (L76) → `ApplicationError` (L91) → `DomainError` (L95) → fallback `Error` (L99).
La rama `ApplicationError` está ANTES de `DomainError` y del fallback, tal como exige AEM-R2.

`exception.filter.spec.ts`, `describe('AEM-R2: ApplicationError branch')` (L197-236):
- `maps ApplicationError to its own httpStatus, code and message` — `StubApplicationError('denied','SOME_CODE',403)` → `statusFn` llamado con `403`, body `{status:403, code:'SOME_CODE', message:'denied'}`.
- `does not fall through to the generic Error fallback (status is never 500)` — assertion explícita `expect(statusFn).not.toHaveBeenCalledWith(500)`.
- Regresión `DomainError` (`NotFoundError` → 404) sigue intacta.

Sin la rama `ApplicationError`, el stub caería en `instanceof Error` → `status` quedaría en el
default `500` — el propio apply-progress documenta el RED real observado
(`expected [403] / received [500]`), y el filter real hoy tiene la rama insertada. Confirmado.

Los 5 sitios de autorización en `users.use-cases.ts` (L212, L421, L429, L438, L630 tras el diff)
devuelven `err(new InsufficientRoleHierarchyError(...))` / `err(new CrossInstitutionForbiddenError(...))`
— cero `throw` en el archivo (`rg 'throw ' users.use-cases.ts` → sin matches). Cadena confirmada:
use-case `err(ApplicationError)` → controller `if (result.isErr()) throw result.unwrapErr()` → filter
rama `ApplicationError` → **403**, no 500.

## Cobertura de requisitos (AEM-R1..R6)

| Req | Estado | Evidencia |
|---|---|---|
| AEM-R1 (base) | PASS | `application-error.ts`: `abstract class ApplicationError extends Error`, ctor `(message, code, httpStatus=422)`, `code`/`httpStatus` readonly. 3 tests (`application-error.test.ts`) cubren explícito, default 422, no-instanceof-DomainError. |
| AEM-R2 (filter) | PASS | Ver sección bug 500→403 arriba. |
| AEM-R3 (2 clases) | PASS | `authorization-errors.ts`: `InsufficientRoleHierarchyError` (403, `INSUFFICIENT_ROLE_HIERARCHY`), `CrossInstitutionForbiddenError` (403, `CROSS_INSTITUTION_FORBIDDEN`), ambas `extends ApplicationError`, message pass-through. 2 tests dedicados. |
| AEM-R4 (users a Result) | PASS | 9/9 throws migrados: 5 autorización → `ApplicationError` concretos, 4 domain (`EmailAlreadyExistsError` x2, `ValidationError` vía `err(validationResult.unwrapErr())` x2) → `err(...)` sin cambiar el tipo de error. Cero `throw` remanente en el archivo. Controllers adoptan idiom `isErr()→throw / unwrap()` en `create`/`update`/`delete`. |
| AEM-R5 (403 no 500) | PASS | Confirmado end-to-end (unit use-case → controller → filter). No existían tests previos asertando 500 (confirmado en tasks.md antes de escribir — grep sin matches), por lo que AEM-R5.S6 (regresión de tests viejos) correctamente no aplica; no es un gap, es la premisa documentada. |
| AEM-R6 (no romper auth) | PASS — CRÍTICO verificado | `git diff --name-only main..HEAD \| rg '/auth/'` → sin matches, módulo auth intacto. 9 tests de regresión: ROOT bypass x3 (uno por use case), jerarquía suficiente x3, same-institution x1 (Update) — todos ejercen los paths reales (`canManageUser`/`canViewUser`) y pasan. Los 2 casos "no encontrado" (Update/Delete) preservan semántica OK previa (no se convirtieron en error, tal como documenta el design). |

## Auth no roto

Los controles de acceso siguen firmes: la migración a `Result` es puramente de propagación
(`throw` → `return err(...)`), no tocó la lógica de decisión (`canManageUser`, `canViewUser`,
chequeo `ROOT`, chequeo de institución). Los 9 tests de regresión ejercitan exactamente los 3 paths
autorizados (ROOT, jerarquía suficiente, misma institución) contra los 3 use cases y todos pasan.
El módulo `auth` (login/token) no aparece en el diff.

## Diff — legítimo, sin scope creep

- Prod: 5 archivos, **59 inserciones + 25 eliminaciones = 84 líneas netas** (coincide con la
  estimación del usuario).
- Test: 5 archivos, **705 inserciones**.
- Los 10 archivos tocados son exclusivamente: `application/shared/errors/*` (nuevo),
  `application/users/use-cases/users.use-cases.ts`, `presentation/shared/filters/exception.filter.ts`,
  `presentation/users/users.controller.ts`, y sus `__tests__/` correspondientes. Ningún archivo fuera
  de este scope.
- El volumen de test es cobertura legítima, no scope creep: `users.use-cases.test.ts` no tenía
  ningún test previo de `CreateUserUseCase`/`UpdateUserUseCase`/`DeleteUserUseCase` (confirmado en
  tasks.md antes de aplicar), y `users.controller.test.ts` es un archivo nuevo — se está cubriendo
  un área sin tests preexistentes, no inflando tests sobre código ya cubierto.
- Sin atribución IA: `git log main..HEAD --format='%B' | rg -i 'co-authored|claude|anthropic'` → sin
  matches.
- Fuera de scope respetado: no se tocó `materia-grupo-ciclo`, `asistencia`, `course-cycle`,
  `attendance-type`, `reportes`, guards de infra, `unwrapOrThrow`, ni `auth`.

## Hallazgos

Ninguno CRITICAL. Ninguno WARNING. Ninguno SUGGESTION bloqueante.

(Nota informativa, no accionable: el ratio test/prod (705/84 ≈ 8.4x) es alto en términos absolutos,
pero está justificado por la ausencia total de cobertura previa en el área — no requiere acción.)

## Reconciliación pendiente

Ninguna. Spec, tasks, apply-progress y código están alineados. `openspec/changes/app-error-model/`
contiene proposal, design, spec, tasks y apply-progress consistentes con el estado real del código
en `refactor/app-error-model`.

## Veredicto final: PASS
