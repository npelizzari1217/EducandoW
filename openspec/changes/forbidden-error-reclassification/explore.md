# Exploration: forbidden-error-reclassification

> Follow-up transversal del épico error-handling. Reclasificar `ForbiddenError` de
> `DomainError` → `ApplicationError`. Deuda diferida explícitamente como "Opción A"
> durante `asistencia-result-migration`. FASE: exploración (read-only). NO se escribió
> código de producción.

## Summary

`ForbiddenError` (`packages/domain/src/shared/errors/forbidden-error.ts`) hoy `extends DomainError`.
Reclasificarlo a `ApplicationError` es **mecánicamente directo para el comportamiento HTTP**
(el exception filter ya rankea `ApplicationError` antes que `DomainError`, así que el 403 se
preserva mientras el nuevo constructor pase `403` explícito) pero **NO es un puro rename de
import-path**: 3 archivos (`nota-cursada-terciario.use-cases.ts`, `docente-materia.use-cases.ts`,
`student.use-cases.ts`) tipan su canal de error del `Result` como el base genérico `DomainError`
y dependen de que `ForbiddenError` lo satisfaga estructuralmente — 7 métodos en esos 3 archivos
**van a fallar `tsc --noEmit`** una vez que `ForbiddenError` deje de extender `DomainError`, y
necesitan widening explícito de firma (`DomainError | ForbiddenError`). Ningún archivo de la capa
domain construye `ForbiddenError` (verificado — el move clean-arch es seguro), y ningún catch por
`instanceof DomainError` lo enrutaría mal (todo consumidor chequea `ForbiddenError` explícito, o
`constructor.name === 'ForbiddenError'`, o delega al filtro, que ya rankea `ApplicationError` primero).

## Current Definition

- `packages/domain/src/shared/errors/forbidden-error.ts:1-7`:
  ```ts
  import { DomainError } from './domain-error';
  export class ForbiddenError extends DomainError {
    constructor(message = 'Forbidden') { super(message, 'FORBIDDEN'); }
  }
  ```
- `DomainError` (`packages/domain/src/shared/errors/domain-error.ts`): `constructor(message, public readonly code)` — sin `httpStatus`; el status HTTP sale del lookup `DOMAIN_STATUS[code]` en el filtro.
- `ApplicationError` (`api/src/application/shared/errors/application-error.ts`): `constructor(message, code, httpStatus = 422)` — lleva su propio `httpStatus`, bypasea `DOMAIN_STATUS`.
- Ya existen clases hermanas en `api/src/application/shared/errors/authorization-errors.ts` (`InsufficientRoleHierarchyError`, `CrossInstitutionForbiddenError`, ambas `extends ApplicationError`, `httpStatus = 403` fijo).
- **Recomendación: archivo propio** (`api/src/application/shared/errors/forbidden-error.ts`), NO dentro de `authorization-errors.ts` — distinta forma de constructor (default `message = 'Forbidden'`, clase genérica reusable vs. clases per-rule del piloto) y símbolo de mucho más tráfico. Misma convención que el precedente attendance-type (un archivo por clase, sin barrel).
- `packages/domain/src/shared/errors/` **no tiene barrel `index.ts`** — el único export es `packages/domain/src/index.ts:7`.

## Exact Scope

**Archivos de producción a cambiar (17 total, 8 módulos)** — verificado con grep `\bForbiddenError\b` + call-sites `new ForbiddenError(`:

| File | Module | How used |
|---|---|---|
| `api/src/application/asistencia/record-subject-attendance-day.use-case.ts` | asistencia | 7× `err(new ForbiddenError)`, unions explícitas — safe |
| `api/src/application/asistencia/record-general-attendance-day.use-case.ts` | asistencia | 4× `err(...)`, union explícita |
| `api/src/application/asistencia/list-subject-attendance.use-case.ts` | asistencia | 5× `err(...)`, union explícita |
| `api/src/application/asistencia/list-general-attendance.use-case.ts` | asistencia | 4× `err(...)`, union explícita |
| `api/src/application/asistencia/generate-monthly-attendance.use-case.ts` | asistencia | 2× `err(...)`, union explícita |
| `api/src/application/asistencia-reporting/generate-asistencia-mensual-pdf.use-case.ts` | asistencia-reporting | 7× **literal `throw new ForbiddenError`** (módulo aún no Result-migrado) |
| `api/src/presentation/asistencia-reporting/asistencia-reporting.controller.ts` | asistencia-reporting | import directo; `handleError()` chequea `instanceof ForbiddenError` — safe |
| `api/src/application/asignacion-curso/assign-docente-to-curso.use-case.ts:44` | asignacion-curso | 1× literal `throw`, retorno `Promise<T>` (sin Result) — sin riesgo de tipado |
| `api/src/application/grading/upsert-subject-period-grades.use-case.ts:91` | grading | `err(...)`, union explícita — safe |
| `api/src/application/grading/upsert-subject-final-grades.use-case.ts:82` | grading | mismo patrón, safe |
| `api/src/application/institution/use-cases/institution.use-cases.ts` | institution | 3× `err(...)`, union explícita — safe |
| `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts` | nivel-terciario | 4× `err(...)` — **3/4 métodos `Result<T, DomainError>` genérico → COMPILE RISK** |
| `api/src/application/nivel-terciario/use-cases/docente-materia.use-cases.ts` | nivel-terciario | 3× `err(...)`, **los 3 métodos `Result<T, DomainError>` → COMPILE RISK** |
| `api/src/application/student-observation/create-observation.use-case.ts` | student-observation | 1× `err(...)`, firma `Result<T, Error>` — safe (`Error` cubre subclases) |
| `api/src/application/student-observation/delete-observation.use-case.ts` | student-observation | 1× `err(...)`, `Result<void, Error>` — safe |
| `api/src/application/student/use-cases/student.use-cases.ts` | student | 3× uso directo; `checkOwnership` → `Result<void, ForbiddenError>` (safe), pero `PatchStudentUseCase.execute` (L151) `Result<Student, DomainError>` → **COMPILE RISK** |
| `api/src/presentation/student/student.controller.ts` | student | import directo; `throwGuardianError()` chequea `instanceof ForbiddenError` antes del branch `DomainError` — safe |

**Falsos positivos** (sin cambios): `subject-grades.controller.ts` (menciona en comentarios; usa `constructor.name`), y los controllers `asistencia`/`institution`/`student-observation`/5× `nivel-terciario` que usan `if (isErr()) throw unwrapErr()` sin importar `ForbiddenError` (dependen del filtro).

**Domain/barrel**: borrar `packages/domain/src/shared/errors/forbidden-error.ts`, remover export en `packages/domain/src/index.ts:7`. Cero throw-sites en domain. `web/` 0 referencias.

**Exception filter** (`api/src/presentation/shared/filters/exception.filter.ts`): entrada `FORBIDDEN: 403` en `DOMAIN_STATUS` (L13) queda dead code tras el move (el precedente attendance-type borró la suya). Cleanup opcional.

**Test files (16)**: sólo splits de import-path (`toBeInstanceOf(ForbiddenError)` no se ve afectado por el cambio de clase padre). Incluye `api/test/unit/patch-student.use-case.test.ts` (ubicación legacy fuera de `api/src` — flag para proposal).

## Mechanical-Risk Analysis

1. **HTTP status — LOW.** `exception.filter.ts:91-98` chequea `instanceof ApplicationError` (usa `exception.httpStatus`) ANTES que `instanceof DomainError` (`DOMAIN_STATUS`). Con `super(message, 'FORBIDDEN', 403)` los ~47 call-sites dan 403 automático.
2. **`instanceof`/name catch — SAFE.** Todos chequean la clase concreta, nunca el bucket genérico `DomainError`. `student.controller.ts:214-218` ya ordena `ForbiddenError` antes del fallback.
3. **Result-widening — RIESGO REAL DE COMPILACIÓN (hallazgo principal).** 7 métodos en 3 archivos tipan el canal como `DomainError` genérico:
   - `nota-cursada-terciario.use-cases.ts`: `CreateNotaCursadaSlotUC.execute` (L57), `UpdateNotaCursadaSlotUC.execute` (L95), `ConfirmarNotaCursadaUC.execute` (L134).
   - `docente-materia.use-cases.ts`: `AssignDocenteMateriaUC.execute` (L37), `ListAssignmentsUC.execute` (L77), `UnassignDocenteMateriaUC.execute` (L103).
   - `student.use-cases.ts`: `PatchStudentUseCase.execute` (L151) reenvía el `err` de `checkOwnership` (L163).
   Fix: widening explícito a `Result<T, DomainError | ForbiddenError>`. NO cubierto por "cambiar imports". `student-observation` usa `Error` genérico (safe). `institution` y `grading` ya listan `ForbiddenError` explícito (safe).
4. **Clean-arch — SAFE.** Cero throw-sites en `packages/domain`. El move a `api/application` es arquitectónicamente forzado (un `ApplicationError` no puede vivir en domain) y no crea edge nuevo `domain→api`.
5. **`asistencia-reporting` mid-flight.** Sus 7 throws siguen literales (no Result-migrados; migración Result bloqueada históricamente por PR #111 **que YA mergeó**). Esta reclasificación sólo necesita cambiar import + constructor ahí; NO depende de la migración a Result (el `throw` es filter-mediated). Flag para no confundir con el trabajo de Result.

## Precedent Notes (attendance-type-result-migration, archivado 2026-07-31)

- Nuevo archivo en `api/src/application/shared/errors/`, `extends ApplicationError`, único token nuevo vs. la vieja clase: el `403` explícito como 3er arg de `super()`.
- Viejo archivo domain **borrado**, líneas de barrel-export removidas.
- Sin barrel en `api/src/application/shared/errors/` — imports por path directo, no crear uno (YAGNI).
- Patrón split-import: sacar el símbolo del bloque `@educandow/domain`, agregar import nuevo al path local `api/application/shared/errors/...`.
- Entrada `DOMAIN_STATUS` del viejo code borrada (inalcanzable una vez que el branch `ApplicationError` dispara primero).
- Precedente necesitó **cero fixups de `instanceof`/firma** — acá diverge (riesgo #3): mayor superficie de consumidores con firmas `DomainError` genéricas.
- Tamaño del precedente: ~100-140 líneas, single PR, budget Low (6 throws / 2 use-cases + 4 tests).

## Size/PR-Budget Estimate

1 archivo nuevo (~10) + 1 borrado (~8) + 1 barrel-export (1) + filtro cleanup opcional (1) + 15 use-case/controller import-splits (~30-60) + 7 firmas con `| ForbiddenError` (~7) + 16 test import-splits (~35-65) + 1 test de clasificación nuevo (~20-25) ≈ **~200-350 líneas**. Plausiblemente bajo el budget de 400 de single-PR, pero toca **8 módulos** (más que cualquier reclasificación previa). Precedentes cross-cutting comparables usaron slices por-módulo stacked por reviewability.

- `Chained PRs recommended: Yes` (por convención/reviewability, no porque exceda 400 crudo — judgment call, estimate borderline).
- `400-line budget risk: Medium` (cerca de 400; cualquier subestimación del reflow de import-blocks lo empuja arriba).
- `Decision needed before apply: Yes`.

## Approach Options + Recommendation

**Option A — Move atómico full (single PR, 8 módulos + widenings + tests juntos).**
- Pros: un solo cambio compilation-gated, fácil de razonar "done", matchea el lenguaje "Opción A" de la deuda diferida.
- Cons: toca todos los módulos a la vez, blast radius de review más grande.

**Option B — Slices chained/stacked por-módulo (base-class primero, luego un PR por módulo).**
- Pros: reviewable en incrementos de ~40-60 líneas; aísla los 3 archivos con widening en su propio slice etiquetado; matchea la convención establecida del repo.
- Cons: más overhead de PRs (8-9 en vez de 1); el slice base debe mergear primero y los demás rebasean.

**Recomendación: Option B** — slice 1 = move+delete + barrel + filtro cleanup + test de clasificación combinado con el módulo más chico (`asignacion-curso`, un archivo, sin Result) para probar que compila end-to-end; luego un slice por módulo en orden de riesgo creciente: `student-observation` → `grading` → `institution` → `asistencia` → `asistencia-reporting` → `student` → `nivel-terciario` (los dos con widening, últimos).

## Open Questions for Proposal

1. Scope de `asignacion-curso`: ¿sólo reclasificación (dejar el `throw`/`Promise<T>` como está, sin Result-wrap), o Result-wrap también? La nota de deuda diferida sólo menciona reclasificación.
2. `api/test/unit/patch-student.use-case.test.ts` (ubicación legacy fuera de `api/src`): ¿mover/consolidar o dejar sólo actualizando su import?
3. ¿Borrar la entrada `FORBIDDEN: 403` de `DOMAIN_STATUS` (cleanup dead-code, per precedente) o dejarla?
4. Ubicación del archivo nuevo: `api/src/application/shared/errors/forbidden-error.ts` (propio, recomendado) vs. agregarlo a `authorization-errors.ts`.

## Ready for Proposal

Sí — scope, riesgo y precedente verificados contra código real. Mensaje al usuario: es mecánico pero
no risk-free (7 firmas necesitan widening explícito, verificado). Recomendar avanzar a `sdd-propose`
con Option B como supuesto de trabajo, sujeto a las 4 open questions.
