# Archive Report: pdf-port-result

**Resultado: PASS** — 2119/2119 tests GREEN (208/208 archivos), typecheck limpio, 0 CRITICAL / 0 WARNING / 0 SUGGESTION en verify. `size:exception` aplicado y justificado (~890 líneas reales vs ~308 estimadas en design).

## Requisitos cumplidos (PPR-R1..R7)

| Requisito | Cumplido | Evidencia |
|---|---|---|
| PPR-R1 — el port devuelve `Result`, no lanza | Sí | `api/src/application/shared/ports/pdf.port.ts` — `generatePdf(...): Promise<Result<Buffer, PdfError>>` |
| PPR-R2 — el service traduce fallos de Puppeteer a `err(PdfError)` | Sí | `pdf-generator.service.ts` — catch → `err(new PdfError({cause:e}))`, happy → `ok(Buffer.from(pdf))`, `finally{page.close()}` intacto |
| PPR-R3 — existe `PdfError` | Sí | `application/shared/errors/pdf.error.ts` — `code`/`httpStatus` readonly, `cause?: unknown` |
| PPR-R4 — los 4 use-cases propagan sin throw (incl. post-proceso de boletín) | Sí | 4 use-cases devuelven `Result<Buffer,PdfError>`; `generate-boletin` hace unwrap→save→`ok` en fresh path, `err` sin save, cache-hit `ok` sin invocar el port |
| PPR-R5 — helper `unwrapResultOrThrow` | Sí | `presentation/shared/http/unwrap-result-or-throw.ts` |
| PPR-R6 — 3 controllers mapean Result a HTTP sin throw en application | Sí | `reportes`, `attendance-type`, `asistencia-reporting` controllers cablean el helper |
| PPR-R7 — consumidor transitivo (`generate-boletin-batch`) maneja el Result | Sí — crítico confirmado | `isErr()` → log + `continue` (skip, no append), sin depender de `try/catch` para fallos de PDF |

Cobertura completa 13/13 escenarios (`PPR-S1..S13`), verificada por `sdd-verify` con evidencia runtime (logs reales de la suite, no solo lectura estática).

## Historia — el hallazgo clave del design

El **delta spec original** (fase `spec`) listaba **4 use-cases** consumidores del port: `generate-constancia-regular`, `generate-attendance-types-pdf`, `generate-asistencia-mensual-pdf` y `generate-boletin`. En la fase `design`, la lectura del código reveló un **5.º consumidor transitivo no listado**: `GenerateBoletinBatchUseCase`, que invoca al single use-case dentro de un loop para armar un ZIP de boletines.

Sin adaptar este 5.º consumidor, el cambio de firma del port habría sido un bug silencioso en producción: el batch seguía tratando el retorno del single use-case como `Buffer` crudo y lo pasaba directo a `archive.append(...)`. Con la firma nueva, eso habría **appendeado el objeto `Result` como "basura" al ZIP** en vez de un PDF — y el `try/catch` que hoy captura `BoletinError` para la política "saltear alumno fallido, seguir" **ya no habría disparado**, porque el fallo de PDF pasó de ser un `throw` a ser un `err` devuelto (un valor, no una excepción).

Este hallazgo se reconció explícitamente en el spec **antes de pasar a `tasks`**: se agregó `PPR-R7`/`PPR-S10` (con enmienda documentada en el delta) exigiendo que el batch detecte `isErr()`, no appendee el resultado fallido, y mantenga su política de "saltear y seguir" — ahora sin depender de `try/catch` para los fallos de PDF. La implementación quedó probada con evidencia runtime real: log de un batch de 3 filas con 1 fallo → ZIP con exactamente 2 entradas, sin basura appendeada.

### El segundo detalle no trivial: post-proceso de `generate-boletin`

De los 4 use-cases directos, 3 son propagación pura (reenvían el `Result` del port sin tocarlo). `generate-boletin` es la excepción: hace algo CON el buffer después de generarlo.

- **Camino fresco:** genera el PDF → si `ok`, invoca `pdfStorage.save(axcc.id, buffer)` **antes** de devolver `ok(buffer)`; si `err`, NO guarda nada y propaga el `err` tal cual (`PPR-S11`/`PPR-S12`).
- **Camino cache-first:** si el PDF ya está en cache, el port **NUNCA se invoca** — se lee el archivo cacheado y se envuelve en `ok(...)` directamente (`PPR-S13`).

Esto obligó a un patrón distinto al de propagación pura: unwrap del `Result` → post-procesar (side-effect de guardado) → re-envolver en `ok`, en vez de simplemente reenviar el `Result` recibido del port.

## Coexistencia transitoria de mecanismos (decisión consciente, documentada)

El scope de este change (variante "(ii)" del proposal) fue deliberadamente acotado: **solo el error de generación de PDF** viaja como `Result<Buffer, PdfError>`. Los errores de negocio no relacionados con PDF — `BoletinError`, `ConstanciaError`, `AsistenciaReportingError`, `AttendanceTypeLevelOutOfScopeError` — siguen lanzándose por `throw`, exactamente como antes.

Resultado: cada uno de los 4+1 use-cases del path PDF tiene ahora **dos canales de error simultáneos** — Result para el fallo de PDF, throw para todo lo demás. Ambos convergen en el borde de `presentation/`: el helper `unwrapResultOrThrow` traduce el `err(PdfError)` a `HttpException`, que cae en el mismo `AppExceptionFilter`/`try-catch` que ya manejaba los throws de negocio. No hay dos modelos de error divergentes desde la perspectiva del consumidor HTTP.

Esta coexistencia es un smell **reconocido y bounded**, no un descuido: convertir también los errores no-PDF a Result (variante "(i)" del proposal, descartada) hubiera casi duplicado el blast radius (~500-600 líneas vs ~210-308 estimadas) y requería primero una base `ApplicationError` compartida que hoy no existe. Cerrar esa brecha es explícitamente el follow-up `app-error-model`.

## Follow-ups registrados (NO implementados en este change — fuera de scope)

1. **`app-error-model`** — crear una base `ApplicationError` compartida y convertir los errores no-PDF (`BoletinError`, `ConstanciaError`, `AsistenciaReportingError`, `AttendanceTypeLevelOutOfScopeError`, etc.) a `Result`. Cierra la coexistencia de dos mecanismos descrita arriba. Requiere la base `ApplicationError` como prerequisito (no existe hoy — hallazgo del explore original de `pdf-port`).
2. **`PdfError.code` no viaja en el body HTTP** — el `AppExceptionFilter` extrae `message` de `HttpException` pero no `code` (solo lo hace para `DomainError`). Mejora opcional de +2 líneas en el filter (rama `HttpException`: si el objeto de respuesta trae `code: string`, setearlo). Decisión consciente de ADR-13/ADR-6, no bloqueante.
3. **Clasificar causas de fallo de PDF en infra** (timeout vs launch vs render) — hoy `PdfGeneratorService` tiene un único catch genérico que produce un solo tipo de `PdfError` sin distinguir la causa raíz.

Todos quedaron registrados en `openspec/specs/reporting-infrastructure/spec.md` (sección Follow-up) al mergear.

## Capability canónica actualizada

`openspec/specs/reporting-infrastructure/spec.md`:
- Agregados `PPR-R1..R7` + 13 escenarios (`PPR-S1..S13`) en forma canónica.
- `PDP-R1`/`PDP-S1` (firma `Promise<Buffer>` del port) marcados **SUPERSEDED por `PPR-R1`/`PPR-S1`** — el ID se conserva (auditoría histórica), el texto documenta la evolución de firma.
- `PDP-R4`/`PDP-S4` (estructura de `generatePdf` implementada por infra) marcados **SUPERSEDED por `PPR-R2`/`PPR-S2`** — misma lógica: ID conservado, firma vigente documentada.
- Nuevo ADR cross-reference `pdf-port-result` (ADR-11..ADR-15), incluyendo ADR-15 que documenta explícitamente la superación de PDP-R1/PDP-R4.
- Tabla de trazabilidad y `Out of Scope`/`Follow-up` actualizados; el follow-up histórico "migrar el port a Result" quedó marcado RESUELTO.
- Ningún `RPI-R*` tocado.

## Commits (14 código + docs)

12 work units de implementación (TDD, RED→GREEN por commit) + 1 commit de docs/archive de esta fase:

1. `feat(pdf): add PdfError type`
2. `feat(pdf): pdf port returns Result`
3. `feat(pdf): pdf generator service returns Result instead of throwing`
4. `feat(reportes): generate-constancia-regular use-case propagates Result`
5. `feat(attendance-type): generate-attendance-types-pdf use-case propagates Result`
6. `feat(asistencia-reporting): generate-asistencia-mensual-pdf use-case propagates Result`
7. `feat(reportes): generate-boletin use-case propagates Result with save and cache-first`
8. `fix(reportes): generate-boletin-batch adapts to Result from single use-case`
9. `feat(presentation): add unwrapResultOrThrow helper`
10. `feat(reportes): wire unwrapResultOrThrow in reportes controller`
11. `feat(attendance-type): wire unwrapResultOrThrow in attendance-type controller`
12. `feat(asistencia-reporting): wire unwrapResultOrThrow in asistencia-reporting controller`
13. (verify phase — sin commit de código, solo reporte)
14. `docs(sdd): archive pdf-port-result, extend reporting-infrastructure capability`

Todos conventional commits, sin atribución IA (confirmado por `sdd-verify`: `git log main..HEAD --format='%B' | rg -i 'co-authored|claude|generated with'` → sin resultados).

## Traceability — Engram observation IDs

| Artefacto | Engram ID | topic_key |
|---|---|---|
| Proposal | #1800 | `sdd/pdf-port-result/proposal` |
| Spec (delta) | #1801 | `sdd/pdf-port-result/spec` |
| Design | #1802 | `sdd/pdf-port-result/design` |
| Tasks | #1803 | `sdd/pdf-port-result/tasks` |
| Apply progress | #1804 | `sdd/pdf-port-result/apply-progress` |
| Verify report | #1805 | `sdd/pdf-port-result/verify-report` |
| Archive report (este) | (nuevo, ver mem_save) | `sdd/pdf-port-result/archive-report` |

## Estado openspec/changes

`openspec/changes/` contiene solo `archive/` como carpeta activa además de otros changes ya archivados; `pdf-port-result` se movió íntegro a `openspec/changes/archive/2026-07-12-pdf-port-result/` (proposal, design, tasks, apply-progress, verify-report, specs/). No queda carpeta activa para este change.

## SDD Cycle Complete

`pdf-port-result` fue completamente planificado, implementado, verificado y archivado. La capability `reporting-infrastructure` refleja ahora el contrato Result end-to-end del path de error de PDF. Listo para el próximo change (candidato natural: `app-error-model`).
