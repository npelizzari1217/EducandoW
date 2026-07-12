# Tasks: pdf-port-result — Result end-to-end en el path PDF

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~308 (~80 prod + ~228 test) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR (12 commits, TDD order) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (N/A — single PR, no split needed) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Nota de riesgo (no de tamaño): el port `PdfPort.generatePdf` es un contrato único compartido por
los 5 consumidores — no existe estado intermedio compilable para partir esto verticalmente sin un
adapter throwaway. Si en `apply` la estimación real supera 400 líneas, preferir `size:exception`
antes que introducir un adapter (ver design §6, riesgo ALTO).

### Suggested Work Units

| Unit | Goal | Notes |
|------|------|-------|
| 1-3 | Foundation: PdfError, port type, service | Bloquean compilación de todo lo demás |
| 4-8 | 5 consumidores (4 use-cases + batch) | Uno por commit, RED→GREEN |
| 9 | Helper `unwrapResultOrThrow` | Independiente de consumidores |
| 10-12 | 3 controllers | Cablean el helper |

## Phase 1: Foundation (bloquea compilación de todo el resto)

- [x] 1.1 RED: `application/shared/errors/pdf.error.test.ts` — test de forma: `code === 'PDF_GENERATION_FAILED'`, `httpStatus === 500`, `cause` opcional asignado en ctor (PPR-S3). Falla porque la clase no existe.
- [x] 1.2 GREEN: crear `application/shared/errors/pdf.error.ts` con `class PdfError extends Error` según ADR-1 (ctor `{ cause }`, sin `super(msg,{cause})`).
- [x] 1.3 RED: `application/shared/ports/pdf.port.test.ts` — actualizar aserción a `Promise<Result<Buffer, PdfError>>`; stub pasa a `ok(Buffer.from('PDF'))` (PPR-S1). Falla contra la firma vieja.
- [x] 1.4 GREEN: actualizar `application/shared/ports/pdf.port.ts` → `generatePdf(html, options?): Promise<Result<Buffer, PdfError>>`.
- [x] 1.5 RED: `infrastructure/reporting/pdf-generator.service.test.ts` — mockear `page.setContent`/`page.pdf` para rechazar; esperar que la promesa RESUELVA en `err(PdfError)` con `code` y `cause` (PPR-S2). Falla porque hoy lanza.
- [x] 1.6 GREEN: aplicar ADR-2 en `pdf-generator.service.ts` — `catch → return err(new PdfError({cause:e}))`, happy → `return ok(Buffer.from(pdf))`, `finally{page.close()}` intacto.

## Phase 2: Los 4 use-cases directos (RED→GREEN por archivo)

- [x] 2.1 RED: `generate-constancia-regular.use-case.test.ts` — mock `PDF_PORT` → `err(PdfError)` ⇒ UC devuelve `err` sin throw; `ok(buffer)` ⇒ `ok(buffer)` (PPR-S4, PPR-S5).
- [x] 2.2 GREEN: `generate-constancia-regular.use-case.ts` — cambia firma `execute()` a `Promise<Result<Buffer,PdfError>>`, propaga directo (ADR-4).
- [x] 2.3 RED: `generate-attendance-types-pdf.use-case.test.ts` — mismos dos escenarios vía `render()`/`execute()` (PPR-S4, PPR-S5).
- [x] 2.4 GREEN: `generate-attendance-types-pdf.use-case.ts` — firmas de `render()` y `execute()` propagan Result; `throw` de template-not-found intacto.
- [x] 2.5 RED: `generate-asistencia-mensual-pdf.use-case.test.ts` — mismos dos escenarios en `executeGeneral` y `executeMateria` (PPR-S4, PPR-S5).
- [x] 2.6 GREEN: `generate-asistencia-mensual-pdf.use-case.ts` — firmas de `executeGeneral`, `executeMateria` y `render` propagan Result; `throw` de `AsistenciaReportingError` intacto.
- [x] 2.7 RED: `generate-boletin.use-case.test.ts` — 4 escenarios: `err` propaga sin throw (PPR-S4); `ok` propaga (PPR-S5); `ok` invoca `pdfStorage.save` antes de devolver (PPR-S11); `err` NO invoca `pdfStorage.save` (PPR-S12); cache-hit devuelve `ok(buffer)` sin invocar el port (PPR-S13).
- [x] 2.8 GREEN: `generate-boletin.use-case.ts` — aplicar ADR-4: unwrap→save→`ok` en camino fresco; `if (result.isErr()) return result` sin save; cache-first envuelve `ok(await readFile(...))`. `throw new BoletinError(...)` de validación intacto.

## Phase 3: 5.º consumidor transitivo — batch (ADR-5)

- [x] 3.1 RED: `generate-boletin-batch.use-case.test.ts` — migrar mocks de `throw`/`Buffer` a `err(PdfError)`/`ok(buffer)`. Escenario: `err` en 1 fila de N ⇒ ZIP contiene N-1 PDFs, fallo registrado sin abortar, ZIP sin entrada basura (PPR-S10).
- [x] 3.2 GREEN: `generate-boletin-batch.use-case.ts` — reemplazar consumo directo del buffer por `const r = await singleUC.execute(row.id); if (r.isErr()) { log; continue; } archive.append(r.unwrap(), ...)` (ADR-5). `try/catch` para `BoletinError` no-PDF se conserva; `BATCH_ALL_FAILED` intacto.

## Phase 4: Helper Result→HTTP

- [x] 4.1 RED: `presentation/shared/http/unwrap-result-or-throw.test.ts` — `unwrapResultOrThrow(err(pdfError))` lanza `HttpException` status 500 (PPR-S6); `unwrapResultOrThrow(ok(buffer))` devuelve el mismo `Buffer` sin lanzar (PPR-S7).
- [x] 4.2 GREEN: crear `presentation/shared/http/unwrap-result-or-throw.ts` según ADR-6 (genérico `<T>`).

## Phase 5: 3 controllers — cablear el helper

- [x] 5.1 RED: `reportes.controller.test.ts` — mock `singleUC`/`constanciaUC` → `err(PdfError)` ⇒ 500; `ok(buffer)` ⇒ 200 con buffer, sin throw en application (PPR-S8, PPR-S9).
- [x] 5.2 GREEN: `reportes.controller.ts` — insertar `unwrapResultOrThrow` en `getBoletin`/`createConstanciaRegular`; `try/catch` de `BoletinError`/`ConstanciaError` se conserva (ADR-7). `getBoletinBatch` NO cambia.
- [x] 5.3 RED: `attendance-type.controller.test.ts` — mismos dos escenarios en `printList` (PPR-S8, PPR-S9).
- [x] 5.4 GREEN: `attendance-type.controller.ts` — insertar `unwrapResultOrThrow` en `printList`; sin try/catch (se conserva su ausencia, delega al filter global).
- [x] 5.5 RED: `asistencia-reporting.controller.test.ts` — mismos dos escenarios en los 2 endpoints (PPR-S8, PPR-S9).
- [x] 5.6 GREEN: `asistencia-reporting.controller.ts` — insertar `unwrapResultOrThrow`; `try/catch → handleError` se conserva.

## Phase 6: Verificación final

- [x] 6.1 `pnpm test` — todos los tests tocados en verde, coverage ≥ 80%. **2119/2119 tests, 208/208 files GREEN** (`pnpm --filter api test`, corrida completa post-wiring).
- [x] 6.2 `pnpm typecheck` (api) — confirmar que no quedan sitios tratando el retorno del port/use-cases como `Buffer` crudo. **`tsc --noEmit` limpio, cero errores.**

## Nota de cierre — size:exception aplicado

Estimación de diseño: ~308 líneas. Real (`git diff --stat main..HEAD -- . ':!openspec'`):
**30 archivos, +806/-84 (≈890 líneas)**. Supera el presupuesto de 400 líneas.

Causas del delta (no ceremonia — cobertura real exigida por TDD estricto + spec):
1. Cada uno de los 5 consumidores + el helper + los 3 controllers recibió tests RED
   explícitos por escenario (`PPR-S4`..`PPR-S13`), no solo el mínimo de humo.
2. `generate-boletin.use-case.test.ts` sumó 3 tests de integración con archivo temporal
   real (cache-hit `fs.promises.readFile`) — ~115 líneas solas.
3. `generate-boletin-batch.use-case.test.ts` necesitó una instrumentación nueva
   (`vi.hoisted` + `appendedEntries`) para poder aserear "ZIP sin entrada basura"
   (PPR-S10) contra el mock de `archiver`, que antes no exponía los `append()` — ~90 líneas.
4. Se descubrió en `apply` un tercer archivo de test no listado en el inventario del
   design (`constancia-controller.test.ts`, T-11 legacy) que también mockeaba
   `constanciaUC.execute` devolviendo un `Buffer` crudo — 1 fix adicional, pequeño.
5. `reportes.controller.test.ts` no existía — se creó desde cero (117 líneas) en vez
   de extender uno ya existente, como sí pasó con `attendance-type` y `asistencia-reporting`.

Decisión (pre-autorizada por el prompt de `apply`, alineada con design.md §6 riesgo ALTO
"atomicidad del port = no hay chained-PR limpio"): **`size:exception`**, NO adapter
throwaway, NO partición vertical del PR. El port `PdfPort.generatePdf` es un contrato
único — no existe estado intermedio compilable para dividir esto en PRs más chicos sin
introducir un adapter temporal (`generatePdf` deprecado + `generatePdfResult`) que el
propio design.md descarta explícitamente como riesgo mayor al de un PR grande.

### Work Units (commits, conventional, sin atribución IA)

1. `feat(pdf): add PdfError type` — 1.1, 1.2
2. `feat(pdf): pdf port returns Result` — 1.3, 1.4
3. `feat(pdf): pdf generator service returns Result instead of throwing` — 1.5, 1.6
4. `feat(reportes): generate-constancia-regular use-case propagates Result` — 2.1, 2.2
5. `feat(attendance-type): generate-attendance-types-pdf use-case propagates Result` — 2.3, 2.4
6. `feat(asistencia-reporting): generate-asistencia-mensual-pdf use-case propagates Result` — 2.5, 2.6
7. `feat(reportes): generate-boletin use-case propagates Result with save and cache-first` — 2.7, 2.8
8. `fix(reportes): generate-boletin-batch adapts to Result from single use-case` — 3.1, 3.2
9. `feat(presentation): add unwrapResultOrThrow helper` — 4.1, 4.2
10. `feat(reportes): wire unwrapResultOrThrow in reportes controller` — 5.1, 5.2
11. `feat(attendance-type): wire unwrapResultOrThrow in attendance-type controller` — 5.3, 5.4
12. `feat(asistencia-reporting): wire unwrapResultOrThrow in asistencia-reporting controller` — 5.5, 5.6

## Trazabilidad spec → task

| Escenario | Task |
|-----------|------|
| PPR-S1 | 1.3, 1.4 |
| PPR-S2 | 1.5, 1.6 |
| PPR-S3 | 1.1, 1.2 |
| PPR-S4, PPR-S5 | 2.1-2.6, 2.7-2.8 |
| PPR-S6, PPR-S7 | 4.1, 4.2 |
| PPR-S8, PPR-S9 | 5.1-5.6 |
| PPR-S10 | 3.1, 3.2 |
| PPR-S11, PPR-S12, PPR-S13 | 2.7, 2.8 |
