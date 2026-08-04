# Proposal: infrastructure-error-model

> Prerequisito de #3a (reporting-errors-reclassification). Modela `InfrastructureError` y lo pilotea.

## Nivel pedagógico afectado

**N/A.** Infraestructura de errores transversal. PR1 (base + wiring) es puramente aditivo, cero cambio
de comportamiento. Los pilotos mantienen el HTTP status actual (todos ya 500); solo agregan el `code`
al body y arreglan un type-mismatch. Sin cambio observable de negocio.

## Intent

Modelar la clase base `InfrastructureError` — el 3er nivel del modelo de error en capas del épico
(`DomainError` → `ApplicationError` → `InfrastructureError`) que se venía difiriendo — y probarla
migrando los **3 sitios que ya la esperan**: guards de infra `bare-Error` en `update-grupo`,
`competency` y `generate-attendance-types-pdf`. Desbloquea también el follow-up
`reporting-errors-reclassification`, que la consume para sus 5 guards de infra.

## Decisiones (de #3a, ya resueltas)

1. `InfrastructureError` = `abstract extends Error`, **`httpStatus` fijo 500** (campo, no parámetro), `code`
   requerido. En `api/src/application/shared/errors/infrastructure-error.ts` (co-ubicado con `ApplicationError`,
   sin dir nuevo).
2. Subclases concretas en `infrastructure-errors.ts`: `TenantClientUnavailableError` (code `TENANT_CLIENT_UNAVAILABLE`,
   reusada en sitios 1 y 2), `TemplateNotFoundError` (code `TEMPLATE_NOT_FOUND`, alinea con el legacy → reuso en el
   follow-up reporting).
3. Wiring: rama `instanceof InfrastructureError` en `exception.filter.ts` (→500/code/message, después de
   `ApplicationError`) y rama dedicada de re-throw en `unwrapResultOrThrow` (espejo de `ApplicationError`,
   por consistencia cross-call-site).

## Scope

**IN:**
- Clase base `InfrastructureError` + subclases `TenantClientUnavailableError` / `TemplateNotFoundError` + tests.
- Rama en `exception.filter.ts` + rama en `unwrap-result-or-throw.ts` + sus tests (RED→GREEN).
- **Piloto 1** `update-grupo.use-case.ts:44`: `throw new Error('No tenant client available')` → `err(new TenantClientUnavailableError())`; widening de firma; reescritura del test MGCM-R6.
- **Piloto 2** `competency.use-cases.ts:258`: guard → `err(...)`; `execute` `Promise<void>` → `Promise<Result<void, TenantClientUnavailableError>>`; inline del getter; **actualizar el call-site fire-and-forget** en `course-cycle.use-cases.ts:421-423` para loguear en `isErr()` (manteniendo el `.catch`); tests nuevos (guard + `.then` branch).
- **Piloto 3** `generate-attendance-types-pdf.use-case.ts:115`: `throw` (type-mismatch) → `err(new TemplateNotFoundError('attendance-types.hbs'))`; widening; test nuevo.

**OUT:**
- La reclasificación de las clases de reporting (`BoletinError`/etc.) → es el change #3a que consume esto.
- Cualquier otro guard de infra fuera de los 3 pilotos.
- Cambio de HTTP status (todos ya 500).

## Approach

Mirror del precedente `ApplicationError`/`PdfError`. Base aditiva primero (nada la usa hasta que un piloto la
retorne), luego los pilotos. Sitios 1 y 3 son widening mecánico de `Result`; el sitio 2 es una mini-migración de
2 archivos (guard + call-site fire-and-forget) — se trata y revisa como el slice de mayor riesgo.

## Delivery — 2 PRs stacked

| PR | Contenido | Riesgo |
|----|-----------|--------|
| **PR1** | Base `InfrastructureError` + subclases + rama filtro + rama `unwrapResultOrThrow` + tests | Bajo — puramente aditivo, cero comportamiento |
| **PR2** | Los 3 pilotos (update-grupo + competency + attendance-types-pdf) | Bajo/Medio — sitio 2 es el foco |

~260-330 líneas total (bajo 400). Se separa en 2 para aislar lo aditivo (PR1, review trivial, desbloquea el
follow-up reporting por sí solo) de los cambios de comportamiento de los pilotos (PR2). No se sub-parte PR2
(sitio 2 está contenido; si el review lo prefiere aislado, se decide en tasks).

## Risks

- **Sitio 2 fire-and-forget** (`course-cycle.use-cases.ts:421-423`): deja de loguear fallos de tenant-client si no
  se actualiza el call-site junto al guard. Mitigación: actualizarlo en el mismo commit; test del `.then` branch.
- **Test de update-grupo revierte una deferral previa documentada** (MGCM-R6, "must stay a throw"): este change es
  el follow-up que la levanta — no es una regresión, se documenta.
- **Naming** `TENANT_CLIENT_UNAVAILABLE` vs el legacy `INTERNAL_ERROR` de reporting: no es decisión de este change;
  se flaggea al follow-up.

## Applicability al épico

3er nivel del modelo de error en capas. Prerequisito cross-cutting: desbloquea los 3 sitios ajenos + el follow-up
`reporting-errors-reclassification`. Patrón: como `forbidden-error-reclassification` fue prerequisito de #2.

## Next

`sdd-spec` + `sdd-design`. La decisión de sub-partir PR2 (2a/2b) se resuelve en `sdd-tasks`.
