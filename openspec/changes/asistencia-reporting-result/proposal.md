# Proposal: asistencia-reporting-result

> Follow-up #2 del épico error-handling. CONSUMER de `application-error-handling`.

## Nivel pedagógico afectado

**N/A.** Migración mecánica de `throw` → `Result` en el área de reportes. Sin cambio de
comportamiento observable: cada error mantiene su HTTP status y su body JSON actuales
(reproducidos por la rama genérica de `unwrapResultOrThrow`).

## Intent

Migrar los **28 `throw`** de `asistencia-reporting` + `reportes` al patrón `Result<T, E>`,
eliminando el "canal B" (throw) y colapsando todo en el "canal A" (Result) que `PdfPort` ya
usa end-to-end desde PR #111. Cumple el goal del épico (cero throw en application) para esta área.

## Decisiones (resueltas con el usuario)

1. **Clasificación: SOLO convertir, NO reclasificar.** La exploración probó que la instrucción del
   canónico (L209: reclasificar `BoletinError`/`ConstanciaError`/`AsistenciaReportingError` a
   `extends ApplicationError`) es **semánticamente incorrecta** — ninguno de los 28 sites es
   caller-context/authz (son NOT_FOUND, invariantes intrínsecas, e infra). El único caller-context
   real es `ForbiddenError`, ya `ApplicationError` (#124). → Conversión pura throw→Result; las 3
   clases quedan **como están** (bare `Error` con `code`+`httpStatus`). La reclasificación correcta
   (DomainError para NOT_FOUND/invariantes; InfrastructureError para infra) se **difiere a follow-up #3**
   — mismo patrón "convert-then-reclassify" ya usado en `asistencia` → `forbidden-error`.
2. **Corregir el canónico**: se actualiza `application-error-handling/spec.md` L209 para **quitar**
   la instrucción blanket "→ApplicationError" y notar que la reclasificación se difiere a follow-up #3
   (pendiente de `InfrastructureError` + decisión de producto sobre los códigos ambiguos).
3. **Entrega: mergear #124 primero, luego 4 slices sobre `main` limpio.** No stack profundo sobre
   rama sin mergear. Al mergear #124, se rebasa esta rama a `main` y se entregan 4 PRs slice.
4. **Ambiguos** (`BATCH_ALL_FAILED` aggregate, `INSTITUTION_NOT_FOUND` 500 data-integrity): en este
   change **conservan su clase y status actuales** (solo se envuelven en `Result`). Su clasificación
   semántica se difiere junto con la reclasificación (follow-up #3).
5. **Infra guards** (5 sites: `TEMPLATE_NOT_FOUND`×2, tenant `INTERNAL_ERROR`×3): se envuelven en
   `Result` mecánicamente, sin inventar jerarquía. Van al futuro `InfrastructureError`.
6. **Test legacy** `constancia-controller.test.ts` (duplicado del mismo endpoint vía canal B): se **borra**.
7. **`getBoletinBatch`**: retrofit del endpoint (hoy consume `Buffer` crudo) + **test net-new** (no existe hoy).

## Scope

**IN:**
- `GenerateAsistenciaMensualPdfUseCase` (asistencia-reporting): 12 throws → `err(...)`. Firma →
  `Result<Buffer, PdfError | AsistenciaReportingError | ForbiddenError>`.
- `GenerateBoletinUseCase` (reportes): 7 throws. Firma → `Result<Buffer, PdfError | BoletinError>`.
- `GenerateBoletinBatchUseCase` (reportes): 2 throws + **cambio de firma** `Promise<Buffer>` →
  `Promise<Result<Buffer, BoletinError>>`.
- `GenerateConstanciaRegularUseCase` (reportes): 7 throws. Firma → `Result<Buffer, PdfError | ConstanciaError>`.
- Controllers `asistencia-reporting.controller.ts` (2 endpoints, borrar `handleError()`+try/catch) y
  `reportes.controller.ts` (3 endpoints, incl. retrofit `getBoletinBatch`) → idiom
  `unwrapResultOrThrow(await useCase.execute(...))`.
- Tests: reescribir los use-case tests (error-path canal B → `isErr()`; success-shape sin cambio) y
  los controller tests; **borrar** `constancia-controller.test.ts`; **crear** test de `getBoletinBatch`.
- Actualizar canónico `application-error-handling/spec.md` L209 (decisión 2).

**OUT:**
- Reclasificación de las 3 clases de error (→ follow-up #3).
- `attendance-type-pdf` (`generate-attendance-types-pdf.use-case.ts`): del módulo `attendance-type`,
  ya FULLY MIGRATED. Su guard de template infra sigue trackeado en su propia entrada.
- Modelar `InfrastructureError` (concern aparte, ya diferido en el canónico).
- Cualquier cambio de HTTP status/body (comportamiento idéntico).

## Approach

Conversión mecánica compilation-gated, por slice. En cada use-case: `throw new XError(...)` →
`return err(new XError(...))`, widening de la firma a la unión correspondiente, y remover el try/catch
redundante del controller (la rama genérica de `unwrapResultOrThrow` reproduce el body/status exacto;
la rama `ApplicationError` reproduce el 403 de `ForbiddenError`). Verificado que `PdfPort` ya entrega
`Result`, así que solo se ensancha el tipo, no la lógica de manejo.

## Delivery — 4 slices stacked (tras mergear #124, sobre `main`)

| Slice | Contenido | Throws |
|-------|-----------|--------|
| A | `asistencia-reporting`: generate-asistencia-mensual-pdf + controller + 2 tests + controller test | 12 |
| B | `reportes`/boletin: generate-boletin + getBoletin + test | 7 |
| C | `reportes`/boletin-batch: generate-boletin-batch (Buffer→Result) + retrofit getBoletinBatch + test net-new | 2 |
| D | `reportes`/constancia: generate-constancia-regular + constancia.template + endpoint + borrar test legacy | 7 |

~800-1000 líneas totales (4x budget de 400) → chained obligatorio. `delivery_strategy: ask-on-risk`.

## Risks

- **Spec drift** (mitigado): el canónico L209 se corrige en este change para no propagar la instrucción errónea.
- **`getBoletinBatch` sin red de tests**: se crea test net-new antes de tocar el endpoint (TDD).
- **`BOLETIN_LEVEL_UNKNOWN` duplicado** (boletin L211+L934): verificar no doble-conversión.
- **Base**: espera merge de #124 + rebase a `main` antes del apply de los slices.

## Applicability al épico

CONSUMER. Elimina el throw en el área reportes (canal único Result). Deja la reclasificación correcta
como follow-up #3 (junto con `InfrastructureError` y decisión de producto sobre códigos ambiguos).

## Next

`sdd-spec` + `sdd-design` (delta spec Given/When/Then + RFC 2119; design Clean Arch con el detalle por slice).
El **apply** de los slices espera el merge del #124 y el rebase a `main`.
