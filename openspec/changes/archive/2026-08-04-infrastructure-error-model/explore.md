# Exploration: infrastructure-error-model (prerequisito de #3a)

> Modelar `InfrastructureError` (base + wiring filtro/helper) + piloto de los 3 sitios ajenos que ya lo
> esperan. Base `main`. FASE: exploración (read-only). Diseño ya DECIDIDO en las decisiones de #3a.

## Executive Summary

Base + filtro + `unwrapResultOrThrow` es bajo riesgo y mecánico (espejo 1:1 de `ApplicationError`/`PdfError`).
El mayor riesgo es el **piloto 2** (`competency.use-cases.ts:258`): su `AutoCreate...UC.execute` retorna
`Promise<void>` y se llama **fire-and-forget** (`.catch(e => console.error)`) desde `GenerateCourseCyclesUseCase`,
así que convertir el guard a `err(...)` rompe silenciosamente el "log on failure, never block" salvo que se
actualice también el call-site para inspeccionar el Result. Mini-migración real (2 archivos), no swap mecánico.

## Base Class — spec

`api/src/application/shared/errors/infrastructure-error.ts`:
```ts
export abstract class InfrastructureError extends Error {
  public readonly httpStatus = 500;
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
```
Divergencia deliberada vs `ApplicationError`: `httpStatus` es campo fijo (no param) — ninguna subclase override
(infra siempre 500). `code` REQUERIDO (el bound estructural de `unwrapResultOrThrow` lo exige). `abstract` (como
ApplicationError, nada instancia la base).

Subclases `api/src/application/shared/errors/infrastructure-errors.ts` (plural, como authorization-errors.ts):
```ts
export class TenantClientUnavailableError extends InfrastructureError {
  constructor(context?: string) { super(context ? `No tenant client available (${context})` : 'No tenant client available', 'TENANT_CLIENT_UNAVAILABLE'); }
}
export class TemplateNotFoundError extends InfrastructureError {
  constructor(templateName: string) { super(`Template ${templateName} no encontrado`, 'TEMPLATE_NOT_FOUND'); }
}
```
`TemplateNotFoundError` code alinea con el `TEMPLATE_NOT_FOUND` legacy → reuso gratis para el follow-up reporting.

## Filter Wiring

`exception.filter.ts`: rama nueva `instanceof InfrastructureError` (→ status 500, code, message), después de
`ApplicationError`, antes del fallback genérico `Error`. Sin riesgo de capturar de más (clase nueva, class-identity).
**Mandatoria**: el piloto 1 bypasea `unwrapResultOrThrow` (throw directo del unwrapErr) → el instance llega crudo al
filtro; sin rama, cae al genérico `Error` que nunca lee `.code`.

## unwrapResultOrThrow Wiring

Rama dedicada `instanceof InfrastructureError` (re-throw as-is), espejo de `ApplicationError`. Recomendada sobre el
fallback estructural: sin ella, el mismo error toma 2 formas según qué controller lo llame (pierde identidad
`instanceof` para los que usan el helper, ej. piloto 3), y la rama del filtro queda medio-muerta. Cuesta 3 líneas.

## Pilotos

**Piloto 1 — `materia-grupo-ciclo/update-grupo.use-case.ts:44`** (LOW): ya Result-returning. `if (!client) throw new Error('No tenant client available')` → `return err(new TenantClientUnavailableError())`. Firma widened a `...| TenantClientUnavailableError`. Controller SIN cambio (ya hace `throw unwrapErr()`; nueva rama del filtro maneja). HTTP status YA es 500, gana `code`. Test `update-grupo.use-case.test.ts:222-239` (MGCM-R6, `.rejects.toThrow`) → reescribir a isErr/unwrapErr. NOTA: revierte una deferral previa documentada ("must stay a throw") — este change es el follow-up que la levanta.

**Piloto 2 — `pedagogy/competency.use-cases.ts:258`** (MEDIUM): `AutoCreateCompetenciasXMateriaXAlumnoXCursoXCicloUC.execute` retorna `Promise<void>`, guard en `private get client()` (`if (!c) throw new Error('TenantContext: no client available')`). NO Result. Call-site único `course-cycle.use-cases.ts:421-423` (GenerateCourseCyclesUseCase) fire-and-forget con `.catch(console.error)`. Migración 3 partes: (a) inline del getter; (b) widen execute a `Promise<Result<void, TenantClientUnavailableError>>` (guard → `return err(...)`, `return ok(undefined)`); (c) actualizar call-site a `.then(r => { if (r.isErr()) console.error(...) }).catch(...)` (el `.catch` se mantiene: repos/Prisma aún pueden rejectar). Sin cobertura de test hoy → test nuevo del guard + test del `.then()` branch. Scope MEDIUM (2 archivos prod, blast contenido).

**Piloto 3 — `attendance-type/use-cases/generate-attendance-types-pdf.use-case.ts:115`** (LOW): ya Result-returning; el `throw new Error('Template ... no encontrado')` en `render` es un type-mismatch (declara Result). → `return err(new TemplateNotFoundError('attendance-types.hbs'))`. Firmas render/execute widened. Controller usa `unwrapResultOrThrow`, sin cambio. Sin cobertura → test nuevo (mock template null). El más limpio.

## Subclass-vs-direct

Subclases concretas (no `new InfrastructureError` directo): `TenantClientUnavailableError` reusada en sitios 1 y 2
(evita duplicar el magic string), matchea todos los precedentes del repo, forward-compatible con reporting follow-up.

## Test Impact

Nuevos: infrastructure-error.ts test, infrastructure-errors.ts tests, exception.filter.spec.ts (+rama 500/code),
unwrap-result-or-throw.test.ts (+rama re-throw). Reescritura: update-grupo.use-case.test.ts (MGCM-R6). Nuevos por
cero-cobertura: competency guard + course-cycle `.then()` branch + generate-attendance-types-pdf template guard.
Todos RED→GREEN (TDD estricto).

## Size / Slicing

~260-330 líneas (bajo 400 como 1 PR). RECOMENDADO 2 PRs:
- **PR1** — base + subclases + filtro + unwrapResultOrThrow + tests (~150-180). Puramente ADITIVO, cero cambio de
  comportamiento hasta que algo lo use. Bajo riesgo, desbloquea los 3 pilotos Y el follow-up reporting.
- **PR2** — los 3 pilotos (~110-150). Opcional split 2a (sitios 1+3, mecánico) / 2b (sitio 2, fire-and-forget, medium).
  Decidir en sdd-tasks.

## Approach + Recommendation

Diseño decidido verificado contra código, sin contradicciones. 2 PRs (PR1 base+wiring aditivo, PR2 pilotos). Sitios
1 y 3 mecánicos; sitio 2 mini-migración 2-archivos (flag explícito en tasks/apply).

## Open Questions

1. Convergencia de naming `TENANT_CLIENT_UNAVAILABLE` con el follow-up reporting (que tiene legacy `INTERNAL_ERROR`) — no es decisión de este change.
2. Confirmar que el lint no flaggea Result sin `.isErr()` (no-floating-promises) para el fix del call-site del sitio 2.
3. ¿PR2 split 2a/2b o único? Decidir en sdd-tasks.

## Riesgos

(1) call-site fire-and-forget del sitio 2 deja de loguear si no se actualiza — mayor riesgo; (2) test de update-grupo revierte una deferral previa documentada (no es regresión); (3) ~260-330 líneas, recomendado 2 PRs; (4) naming convergence con reporting follow-up sin resolver (no es de este change).
