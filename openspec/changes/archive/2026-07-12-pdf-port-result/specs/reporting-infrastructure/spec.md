# Delta: pdf-port-result — Reporting Infrastructure

> Extiende la capability `reporting-infrastructure` (`openspec/specs/reporting-infrastructure/spec.md`).
> IDs nuevos: `PPR-R1`..`PPR-R7` / `PPR-S1`..`PPR-S13`. NO modifica `RPI-R*` ni `PDP-R*` (IDs existentes
> intactos en este delta — ver Nota de archive-time abajo).
> **Enmienda:** `PPR-R4` ampliada (post-proceso de `GenerateBoletinUseCase`: save + cache-first) y se
> agrega `PPR-R7` para el consumidor transitivo `GenerateBoletinBatchUseCase`, hallado en design.
> Scope cerrado: variante (ii) — solo el error de PDF fluye como Result. Los demás errores de los
> use-cases (`BoletinError`, `ConstanciaError`, `AsistenciaReportingError`, etc.) siguen por `throw`,
> fuera de scope.

## Purpose

Define qué DEBE ser verdad sobre la propagación del **error de generación de PDF** en el path
port → service → 4 use-cases → helper de presentation → 3 controllers: un `Result<Buffer, PdfError>`
de punta a punta, sin `throw` en `application/`, materializado a HTTP recién en `presentation/`.

## ADDED Requirements

### PPR-R1 — El port devuelve `Result`, no lanza

`PdfPort.generatePdf` MUST tener la firma
`generatePdf(html: string, options?: GeneratePdfOptions): Promise<Result<Buffer, PdfError>>`.
Ante un fallo de generación, el port MUST NOT rechazar la promesa ni lanzar — el fallo se representa
como `err(PdfError)`.

#### PPR-S1 — Firma del contrato

- GIVEN `api/src/application/shared/ports/pdf.port.ts`
- WHEN se inspecciona la interface `PdfPort`
- THEN `generatePdf` MUST devolver `Promise<Result<Buffer, PdfError>>`

---

### PPR-R2 — El service traduce fallos de Puppeteer a `err(PdfError)`

`PdfGeneratorService.generatePdf`, ante el rechazo de `page.setContent`, `page.pdf` o el lanzamiento
del browser, MUST devolver `err(PdfError)` con `code: 'PDF_GENERATION_FAILED'`. MUST NOT lanzar ni
dejar rechazar la promesa devuelta. El error original MUST preservarse en `PdfError.cause`.

#### PPR-S2 — Rechazo de Puppeteer se traduce a `err`, no a throw

- GIVEN un `PdfGeneratorService` con `page.setContent` o `page.pdf` mockeados para rechazar
- WHEN se invoca `generatePdf(html)`
- THEN la promesa devuelta MUST resolverse (no rechazar) en `err(PdfError)` con
  `code === 'PDF_GENERATION_FAILED'`
- AND `PdfError.cause` MUST ser el error original capturado

---

### PPR-R3 — Existe `PdfError`

`application/shared/errors/pdf.error.ts` MUST exportar `class PdfError extends Error` con
`code: 'PDF_GENERATION_FAILED'`, `httpStatus: 500` y `cause?: unknown`.

#### PPR-S3 — Forma de `PdfError`

- GIVEN `application/shared/errors/pdf.error.ts`
- WHEN se inspecciona la clase exportada
- THEN MUST tener `code = 'PDF_GENERATION_FAILED'`, `httpStatus = 500` y campo opcional `cause`

---

### PPR-R4 — Los 4 use-cases propagan el `Result` sin `throw` (incluye post-proceso de boletín)

`GenerateAttendanceTypesPdfUseCase`, `GenerateConstanciaRegularUseCase`, `GenerateBoletinUseCase` y
`GenerateAsistenciaMensualPdfUseCase` MUST devolver `Result<Buffer, PdfError>`. Ante `err(PdfError)`
del port, cada uno MUST propagar `err(PdfError)` sin lanzar y sin ejecutar ningún post-proceso.
Ante `ok(buffer)`, MUST devolver `ok(buffer)`.

`GenerateBoletinUseCase` es un caso con post-proceso propio y MUST cumplir además: (a) en el camino de
generación fresca, ante `ok(buffer)` del port, MUST invocar `pdfStorage.save(axcc.id, buffer)` **antes**
de devolver `ok(buffer)`; ante `err(PdfError)`, MUST NOT invocar `pdfStorage.save`; (b) en el camino
cache-first (PDF ya almacenado, el port NO se invoca), MUST devolver `ok(buffer)` con el contenido leído
del cache.

#### PPR-S4 — `err` del port se propaga sin throw

- GIVEN cualquiera de los 4 use-cases con `PDF_PORT` mockeado para devolver `err(PdfError)`
- WHEN se invoca `execute(...)`
- THEN el use-case MUST devolver `err(PdfError)` sin lanzar excepción

#### PPR-S5 — `ok` del port se propaga igual

- GIVEN cualquiera de los 4 use-cases con `PDF_PORT` mockeado para devolver `ok(buffer)`
- WHEN se invoca `execute(...)`
- THEN el use-case MUST devolver `ok(buffer)` con el mismo `Buffer`

#### PPR-S11 — `GenerateBoletinUseCase`: `ok(buffer)` se persiste antes de devolver

- GIVEN `GenerateBoletinUseCase` con `PDF_PORT` mockeado devolviendo `ok(buffer)` y sin PDF cacheado
  previo para `alumnosXCursoXCicloId`
- WHEN se invoca `execute(alumnosXCursoXCicloId)`
- THEN `pdfStorage.save(axcc.id, buffer)` MUST haber sido invocado antes de que el use-case devuelva
- AND el use-case MUST devolver `ok(buffer)`

#### PPR-S12 — `GenerateBoletinUseCase`: `err(PdfError)` NO se persiste

- GIVEN `GenerateBoletinUseCase` con `PDF_PORT` mockeado devolviendo `err(PdfError)`
- WHEN se invoca `execute(...)`
- THEN `pdfStorage.save` MUST NOT haber sido invocado
- AND el use-case MUST devolver `err(PdfError)` sin lanzar

#### PPR-S13 — `GenerateBoletinUseCase`: cache-hit devuelve `ok(buffer)` sin invocar el port

- GIVEN un PDF ya cacheado para `alumnosXCursoXCicloId` (`pdfStorage.getPath` devuelve una ruta
  existente)
- WHEN se invoca `execute(...)`
- THEN el use-case MUST devolver `ok(buffer)` con el contenido leído del archivo cacheado
- AND `PDF_PORT.generatePdf` MUST NOT haber sido invocado

---

### PPR-R5 — Helper `unwrapResultOrThrow` materializa `Result` a HTTP

`presentation/shared/` MUST exportar `unwrapResultOrThrow(result: Result<Buffer, PdfError>)`. Ante
`err(PdfError)`, MUST lanzar `HttpException` con `status = PdfError.httpStatus`. Ante `ok(buffer)`,
MUST devolver el `Buffer`.

#### PPR-S6 — `err` lanza `HttpException`

- GIVEN `unwrapResultOrThrow(err(pdfError))` con `pdfError.httpStatus === 500`
- WHEN se invoca el helper
- THEN MUST lanzar `HttpException` con status `500`

#### PPR-S7 — `ok` devuelve el buffer

- GIVEN `unwrapResultOrThrow(ok(buffer))`
- WHEN se invoca el helper
- THEN MUST devolver el mismo `Buffer`, sin lanzar

---

### PPR-R6 — Los 3 controllers mapean el `Result` a HTTP sin throw en `application`

Los controllers de `attendance-type`, `reportes` y `asistencia` que devuelven PDF, ante `err(PdfError)`
del use-case, MUST responder HTTP `500`. Ante `ok`, MUST responder `200` con el PDF. El error de PDF
MUST fluir como `Result` desde el port hasta el borde de `presentation` — ningún punto intermedio en
`application/` MUST lanzar.

#### PPR-S8 — `err(PdfError)` del use-case → HTTP 500

- GIVEN un endpoint de PDF (attendance-type / reportes / asistencia) con su use-case mockeado para
  devolver `err(PdfError)`
- WHEN se invoca el endpoint HTTP
- THEN la respuesta MUST tener status `500` con body mapeado desde `PdfError`
- AND ningún método de `application/` invocado en la cadena MUST haber lanzado una excepción
  (verificable: el use-case y el service devuelven, no rechazan/lanzan)

#### PPR-S9 — `ok(buffer)` del use-case → HTTP 200 con el PDF *(escenario clave)*

- GIVEN el mismo endpoint con su use-case mockeado para devolver `ok(buffer)`
- WHEN se invoca el endpoint HTTP
- THEN la respuesta MUST tener status `200` con el `Buffer` del PDF
- AND la cadena completa (port → service → use-case → helper → controller) MUST haber operado sin
  ningún `throw` en `application/`, demostrando el Result end-to-end del path PDF

---

### PPR-R7 — El consumidor transitivo (`GenerateBoletinBatchUseCase`) maneja el `Result`, no depende de `throw`

`GenerateBoletinBatchUseCase.execute` invoca `GenerateBoletinUseCase.execute` (ahora
`Result<Buffer, PdfError>` por `PPR-R4`) una vez por fila imprimible. Ante `err(PdfError)`, el batch
MUST detectarlo (`isErr()`), MUST NOT appendear ese resultado al ZIP, y MUST tratarlo como un fallo
individual dentro de su lógica existente de "saltear y seguir" (equivalente al camino `catch` actual,
que deja de dispararse porque el use-case singular ya no lanza). Ante `ok(buffer)`, MUST appendear
`buffer` al ZIP como hoy. El batch MUST NOT depender de `try/catch` para capturar fallos de generación
de PDF del use-case singular.

#### PPR-S10 — Un fallo de PDF en el lote no rompe el ZIP ni appendea basura

- GIVEN un batch de N boletines para una `CourseCycle`, donde `GenerateBoletinUseCase.execute` devuelve
  `err(PdfError)` para exactamente 1 fila y `ok(buffer)` para las N-1 restantes
- WHEN se ejecuta `GenerateBoletinBatchUseCase.execute(courseCycleId)`
- THEN el ZIP resultante MUST contener exactamente N-1 PDFs (uno por cada `ok`)
- AND el fallo MUST registrarse (log / contador) sin lanzar ni abortar el batch
- AND el ZIP MUST NOT contener ninguna entrada correspondiente a la fila fallida — nada de "basura"
  appendeada por tratar un `Result` como si fuera directamente el `Buffer`

---

## Out of Scope (explícito)

- Convertir a `Result` los errores NO-PDF de los use-cases (`BoletinError`, `ConstanciaError`,
  `AsistenciaReportingError`, `AttendanceTypeLevelOutOfScopeError`) — siguen por `throw`.
- Crear una base `ApplicationError` compartida (no existe hoy; bloqueante para variante (i), no para
  esta).
- Clasificar causas de fallo en infra (timeout vs launch vs render) — el catch de
  `PdfGeneratorService` sigue siendo genérico.

## Nota de archive-time

`PDP-R1` (firma `Promise<Buffer>`) y `PDP-R4` (misma firma en infra) del spec mergeado quedan
semánticamente desactualizados por `PPR-R1`. Por decisión explícita de scope de este change, este
delta NO reescribe esos bloques como `MODIFIED` — `sdd-archive` deberá decidir si los marca como
superseded por `PPR-R1`/`PPR-R4`(nuevo) al mergear.

## Trazabilidad requisito → escenario

| Requisito | Escenarios |
|-----------|-----------|
| PPR-R1 | PPR-S1 |
| PPR-R2 | PPR-S2 |
| PPR-R3 | PPR-S3 |
| PPR-R4 | PPR-S4, PPR-S5, PPR-S11, PPR-S12, PPR-S13 |
| PPR-R5 | PPR-S6, PPR-S7 |
| PPR-R6 | PPR-S8, PPR-S9 |
| PPR-R7 | PPR-S10 |
