# Proposal: reporting-module-compartido

**Issue**: #101 · **Change**: `reporting-module-compartido` · **Nivel pedagógico afectado**: `ALL`

> Justificación del nivel: `PdfGeneratorService` genera los PDF de asistencia mensual, tipos de asistencia, boletines y constancias — capacidades transversales a INICIAL, PRIMARIO, SECUNDARIO y TERCIARIO. El cambio es infraestructural y no discrimina por nivel, por eso `ALL`.

## Intent

**Problema (diagnóstico corregido).** Hoy `PdfGeneratorService` está registrado por separado en el `providers:` de tres módulos que no se importan entre sí (`asistencia-reporting.module.ts:33`, `reportes.module.ts:21`, `attendance-type.module.ts:21-28`). Nest instancia **tres** servicios distintos, cada uno con su propio `browserPromise` privado.

El issue exagera: NO hay tres Chrome al arranque. El browser de Puppeteer se lanza **lazy** en `getBrowser()` (`pdf-generator.service.ts:60-71`), no en `onModuleInit`. El problema real es de **acumulación**: si en la vida del proceso se usan las tres features de PDF, quedan hasta tres Chrome vivos en paralelo que nunca se liberan entre sí — presión de memoria en el VPS Windows.

**Por qué ahora.** La deuda ya está documentada en el código (`attendance-type.module.ts:21-27`, citando `design.md §9` del change archivado de julio). El issue #101 la formaliza. Consolidar es barato y de bajo riesgo.

**Éxito.** Una sola instancia de `PdfGeneratorService` → un solo browser vivo; los PDF de las tres features siguen saliendo OK; `pnpm --filter api test` en verde.

## Approach

Crear un **`ReportingModule` hoja** (`providers` + `exports`: `[PdfGeneratorService]`) importado por los tres módulos feature, que dejan de registrar su propia copia. Sigue el patrón ya probado en el repo (`ReportesModule` exporta servicios que `PedagogyModule` importa). Se descarta `@Global()`: está reservado a `EventBusModule` (cross-cutting real); `PdfGeneratorService` es feature-scoped a tres módulos nombrados.

**Lifecycle del browser.** `onModuleDestroy` (`pdf-generator.service.ts:91-102`) hoy solo corre al shutdown del proceso. Con una sola instancia hay **un solo** `onModuleDestroy`, disparado al destruir `ReportingModule` en el shutdown de la app. El browser NO debe cerrarse cuando se destruye un módulo feature — al no registrar ya el provider, ninguno controla su ciclo de vida. Cero cambios en la lógica de lifecycle: solo se consolida el provider.

**Limpieza de deuda.** Se elimina el comentario de `attendance-type.module.ts:21-27` que cita `design.md §9`: el fix que anticipaba ya es este change.

**Verificación de "una sola instancia".** TDD estricto → el test va primero. Estrategia: un test que arme un `TestingModule` importando los tres módulos feature (o `ReportingModule` resuelto desde cada uno) y afirme **identidad referencial** (`===`) del `PdfGeneratorService` obtenido desde los tres. Falla con la implementación actual (tres instancias), pasa tras consolidar.

## Scope

**In:** crear `ReportingModule`; que los 3 módulos lo importen y quiten el provider propio; borrar el comentario de deuda; test de instancia única.

**Out of scope / Follow-up (ticket separado):** introducir `PdfPort` / token `Symbol`, mover el service a `infrastructure/` detrás del port, o resolver la violación de ADR-06 (los 4 use-cases importan la clase concreta). NO forma parte de este change.

## Estimación y entrega

~5 archivos, bien por debajo de 400 líneas → **un solo PR**. Rollback: revertir el commit restaura los tres `providers:` originales.
