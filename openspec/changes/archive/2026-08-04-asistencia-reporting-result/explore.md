# Exploration: asistencia-reporting-result (épico follow-up #2)

> Migrar los `throw` de `asistencia-reporting` + `reportes` a `Result<T,E>`. Rama
> `refactor/asistencia-reporting-result` STACKED sobre `refactor/forbidden-error-reclassification`
> (#124, sin mergear) → `ForbiddenError` ya es `ApplicationError` en `api/application`.
> FASE: exploración (read-only).

## Executive Summary

El área tiene **28 throws verificados** (no ~30) en 4 use-cases. La conversión a `Result` es
**bajo riesgo** porque `PdfPort` ya devuelve `Result` end-to-end (PR #111) — los use-cases ya lo
consumen. **El mayor riesgo es la propia instrucción del canónico**: `application-error-handling/spec.md`
dice reclasificar `BoletinError`/`ConstanciaError`/`AsistenciaReportingError` a `extends ApplicationError`,
pero **ninguno de los 28 throw-sites es caller-context/authz** (la regla del épico para `ApplicationError`).
Son NOT_FOUND, invariantes intrínsecas (`STUDENT_NOT_PRINTABLE`, `BOLETIN_LEVEL_UNKNOWN`) o guards de
infraestructura (template faltante, tenant client faltante) que el épico difiere a un `InfrastructureError`
aún no construido. **Recomendación: conversión throw→Result ahora (mecánica, 28 sites), dejar las 3 clases
SIN reclasificar (defer a follow-up #3), en 4 PRs stacked** (~800-1000 líneas, 2x+ el budget de 400).

## Module Boundary / Scope

- **`asistencia-reporting`** (IN) — `api/src/{application,presentation}/asistencia-reporting/`. 1 use-case: `GenerateAsistenciaMensualPdfUseCase` (General + Materia).
- **`reportes`** (IN) — `api/src/{application,presentation}/reportes/`. 3 use-cases: `GenerateBoletinUseCase`, `GenerateBoletinBatchUseCase`, `GenerateConstanciaRegularUseCase`.
- **`attendance-type-pdf`** (OUT) — es `attendance-type/use-cases/generate-attendance-types-pdf.use-case.ts`, del módulo `attendance-type` ya FULLY MIGRATED (archivado 2026-07-31). La agrupación del canónico "reportes/asistencia-reporting/attendance-type-pdf (30 throws)" es un artefacto de documentación, no un módulo compartido real.

## Throw Inventory (28, file:line verificado)

**asistencia-reporting** — `generate-asistencia-mensual-pdf.use-case.ts`: L153/185/196 `AsistenciaReportingError` NOT_FOUND (404, intrínseco); **L230 TEMPLATE_NOT_FOUND (500, infra)**; L313/318/323/334/342/347/352 `ForbiddenError` (403, caller-context, ya `ApplicationError` por #124); **L359 tenantClient() INTERNAL_ERROR (500, infra)**.

**reportes/boletin** — `generate-boletin.use-case.ts`: L129 AXCC_NOT_FOUND, L132 STUDENT_NOT_PRINTABLE (422), L148 COURSE_CYCLE_NOT_FOUND, L166 STUDENT_NOT_FOUND, L211/934 BOLETIN_LEVEL_UNKNOWN (422, duplicado); **L894 tenantClient() INTERNAL_ERROR (500, infra)**.

**reportes/boletin-batch** — `generate-boletin-batch.use-case.ts`: L109 BATCH_ALL_FAILED (422, aggregate — AMBIGUO); **L148 tenantClient() INTERNAL_ERROR (500, infra)**.

**reportes/constancia** — `generate-constancia-regular.use-case.ts`: **L93 INTERNAL_ERROR (infra)**; L101 AXCC_NOT_FOUND, L113 STUDENT_NOT_FOUND, L120 STUDENT_NOT_ELIGIBLE (422), L133 COURSE_CYCLE_NOT_FOUND, L149 INSTITUTION_NOT_FOUND (500, data-integrity — AMBIGUO); **L188 TEMPLATE_NOT_FOUND (500, infra)**.

## Error-Class Classification (el hallazgo clave)

Las 3 clases hoy `extends Error` directo (bare, no DomainError, no ApplicationError), con `code` + `httpStatus`.

El canónico L209 dice "migrar a `extends ApplicationError`". Verificado vs la regla del propio épico
(ApplicationError = falla depende de QUIÉN pregunta / authz; DomainError = invariante intrínseca del dato):
**cero de los 28 sites es caller-context.** Split:
- **NOT_FOUND** (AXCC/STUDENT/COURSE_CYCLE/MATERIA×curso) → candidatos **DomainError** (DOMAIN_STATUS ya tiene NOT_FOUND:404 etc.).
- **Invariantes** (STUDENT_NOT_PRINTABLE, STUDENT_NOT_ELIGIBLE, BOLETIN_LEVEL_UNKNOWN) → candidatos **DomainError** (categoría GRUPO_MATERIA_MISMATCH 422).
- **Infra guards** (TEMPLATE_NOT_FOUND×2, tenant INTERNAL_ERROR×3) → **defer** al follow-up InfrastructureError (misma categoría ya diferida en el canónico).
- **INSTITUTION_NOT_FOUND (500)** y **BATCH_ALL_FAILED (aggregate)** → AMBIGUOS, open question.
- **ForbiddenError** → el único caller-context real, y ya es ApplicationError (#124). Solo resta throw→err().

Por qué el canónico dijo "ApplicationError": ApplicationError tiene `httpStatus` en la instancia (modelado sobre
"el patrón BoletinError"), DomainError no (usa DOMAIN_STATUS) → ApplicationError es drop-in estructural. Pero la
conveniencia no hace la semántica correcta. El propio "Classification note" del canónico dice: *"MUST be verified
per call site, not assumed."*

**Recomendación: NO reclasificar en este change.** Conversión pura throw→Result, clases igual que están.
Cero riesgo: la rama genérica (no-ApplicationError) de `unwrapResultOrThrow` reproduce el body/status JSON
EXACTO que los controllers arman hoy. Reclasificación → follow-up #3 (mismo patrón "convert-then-reclassify"
ya usado en asistencia→forbidden-error).

## PdfPort Interaction

`PdfPort.generatePdf` ya devuelve `Promise<Result<Buffer, PdfError>>` (PR #111). Los use-cases ya lo consumen
como Result. La migración solo **ensancha el tipo** (Result<Buffer, PdfError> → Result<Buffer, PdfError | XError | ForbiddenError>)
y **colapsa los dos canales** (canal A Result/PdfError vs canal B throw/XError) en uno — win de calidad independiente.

## Return-Type Impact

- `GenerateAsistenciaMensualPdf.executeGeneral/executeMateria`: `Result<Buffer, PdfError>` → `Result<Buffer, PdfError | AsistenciaReportingError | ForbiddenError>`.
- `GenerateBoletin.execute`: `Result<Buffer, PdfError>` → `Result<Buffer, PdfError | BoletinError>`.
- `GenerateConstanciaRegular.execute`: `Result<Buffer, PdfError>` → `Result<Buffer, PdfError | ConstanciaError>`.
- `GenerateBoletinBatch.execute`: **`Promise<Buffer>` (SIN Result hoy)** → `Promise<Result<Buffer, BoletinError>>`.
Success (`ok(buffer)`) sin cambio en los 4; happy path sin cambio de comportamiento.

## Controller

- `asistencia-reporting.controller.ts`: 2 endpoints, ya usan `unwrapResultOrThrow` pero con try/catch + `handleError()` redundante (mapea AsistenciaReportingError + ForbiddenError→ForbiddenException) SOLO porque el use-case aún throwea. Tras convertir: `handleError()` + try/catch se **borran**; cada endpoint = `unwrapResultOrThrow(await useCase.execute(...))`.
- `reportes.controller.ts`: 3 endpoints. `getBoletin`/`createConstanciaRegular` mismo patrón removible. **`getBoletinBatch` = retrofit NO mencionado en el brief**: hoy consume `Buffer` crudo con try/catch(BoletinError); tras Result necesita el mismo retrofit. **Scope nuevo descubierto.**

## Tests

11 (asist-mensual general) + 12 (materia) + 9 (boletin) + 13 (constancia, ~600 líneas) + 11 (batch, +cambio firma Buffer→Result) + ~5 (asist-reporting.controller) + 2 (reportes.controller "canal B") a reescribir. `constancia-controller.test.ts` (149 líneas): **legacy/duplicado** del mismo endpoint vía canal B → **recomendar BORRAR**. `getBoletinBatch` controller test: **no existe hoy** → net-new (sin red de seguridad previa).

## Size / Slicing (Review Workload Forecast)

Producción ~250-300 líneas + tests ~500-650 = **~800-1000 líneas total**. `400-line budget risk: High`.
`Chained PRs recommended: Yes`. `Decision needed before apply: Yes`.

**Slicing recomendado (4 slices stacked sobre #124, patrón asistencia-result-migration):**
- **Slice A — asistencia-reporting**: generate-asistencia-mensual-pdf (12 throws) + 2 tests + controller + controller test.
- **Slice B — reportes/boletin**: generate-boletin (7 throws) + test + endpoint getBoletin + subset controller test.
- **Slice C — reportes/boletin-batch**: generate-boletin-batch (2 throws, Buffer→Result) + test + retrofit getBoletinBatch + NEW controller test.
- **Slice D — reportes/constancia**: generate-constancia-regular (7 throws) + constancia.template + endpoint + BORRAR constancia-controller.test.ts.

## InfrastructureError Gap

5 sites (TEMPLATE_NOT_FOUND×2, tenant INTERNAL_ERROR×3) son infra genuina. Recomendación: **wrap en Result
mecánico** (desbloquea el goal throw-elimination) pero NO inventar jerarquía ahora; foldear en el follow-up
InfrastructureError ya trackeado. No bloquear este change.

## Approach Options + Recommendation

1. **(RECOMENDADA) Conversión mecánica pura, cero reclasificación.** Pros: mínimo riesgo, cero cambio de
   comportamiento (verificado vía rama genérica de unwrapResultOrThrow), desbloquea el goal, difiere el debate
   de clasificación. Cons: 3 clases quedan fuera de ambas jerarquías (documentado como follow-up, no dropeado).
2. Conversión + reclasificar todo a ApplicationError (texto literal del canónico). **Semánticamente MAL** —
   NOT_FOUND/invariantes reportarían como "caller context". Mal precedente. RECHAZADA.
3. Conversión + nuevas subclases DomainError por-code ahora. Correcto pero toca packages/domain, requiere ~8
   entradas DOMAIN_STATUS, no resuelve los ambiguos, infla un scope ya grande. Effort High. RECHAZADA (para este change).

## Risks

- **Spec drift**: el canónico L209 da una instrucción incorrecta (→ApplicationError) que contradice su propia
  regla. Si propose/spec la siguen a ciegas, se introduce clasificación semánticamente mal. Recomendar ACTUALIZAR
  el canónico (quitar el "→ApplicationError" blanket, notar defer a follow-up #3).
- **Size**: ~800-1000 líneas (4x budget) → 4 PRs stacked, no uno.
- **Retrofit oculto**: `getBoletinBatch` sin cobertura de test hoy (net-new tests, sin red).
- **Test legacy duplicado**: `constancia-controller.test.ts` rota si no se borra/reconcilia.
- **BOLETIN_LEVEL_UNKNOWN** duplicado (L211 + L934) — verificar no doble-conversión.
- **Base stacked**: rama sobre #124 (sin mergear) — si #124 cambia, rebase de los 4 slices.

## Open Questions for Proposal

1. **Reclasificación**: ¿conversión pura ahora + defer reclasificación (recomendado), o forzar la clasificación
   correcta (DomainError/nuevas subclases) en este change?
2. ¿Actualizar el canónico L209 para corregir la instrucción "→ApplicationError"?
3. Ambiguos: `BATCH_ALL_FAILED` (aggregate outcome) e `INSTITUTION_NOT_FOUND` (500 data-integrity) — ¿qué clasificación/status?
4. ¿Borrar `constancia-controller.test.ts` (legacy duplicado)?
5. Slicing 4 PRs stacked sobre #124 (sin mergear) — ¿ok la profundidad de stack, o mergear #124 primero?
