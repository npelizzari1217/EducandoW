# Spec: Reporting Infrastructure (módulo compartido de generación de PDF)

> Capability area: wiring de DI y ciclo de vida de `PdfGeneratorService` (generación de PDF vía
> Puppeteer + Handlebars), consumido por tres módulos feature (asistencia mensual, tipos de
> asistencia, boletines/constancias). Gobierna instancia única, ciclo de vida del `Browser` de
> Puppeteer y shutdown de la aplicación — NO el contenido/formato de los PDF generados.
> Changes:
>   reporting-module-compartido (archived 2026-07-09) — RPI-R1, RPI-R2, RPI-R3, RPI-R4, RPI-R5, RPI-R6
>   pdf-port (archived 2026-07-11) — PDP-R1, PDP-R2, PDP-R3, PDP-R4, PDP-R5, PDP-R6
>   pdf-port-result (archived 2026-07-12) — PPR-R1, PPR-R2, PPR-R3, PPR-R4, PPR-R5, PPR-R6, PPR-R7
> IDs: RPI-R* / RPI-S* (ciclo de vida del provider) · PDP-R* / PDP-S* (inversión de dependencia sobre
> el mismo provider) · PPR-R* / PPR-S* (propagación del error de PDF como `Result` de punta a punta)
> Cross-references:
>   `asistencia-reporting/spec.md` (consumidor de `PdfGeneratorService`/`PdfPort`, contenido de PDF sin cambios)
>   `report-cards/spec.md` (consumidor de `PdfGeneratorService`/`PdfPort`, contenido de PDF sin cambios)
>   `attendance-types/spec.md` (consumidor de `PdfGeneratorService`/`PdfPort` para exportar tipos de asistencia,
>   contenido de PDF sin cambios)

## Purpose

Define qué DEBE ser verdad sobre el ciclo de vida compartido de `PdfGeneratorService`: una única
instancia entre los tres módulos feature consumidores, a lo sumo un `Browser` de Puppeteer vivo por
proceso, apagado limpio, y ninguna regresión funcional en los PDF que las tres features producen.
Esta spec NO cubre contenido ni formato de PDF (grillas, totales, templates Handlebars) — eso vive en
`asistencia-reporting/spec.md`, `report-cards/spec.md` y `attendance-types/spec.md`, ninguna de las
cuales es modificada por esta capability.

Además define el contrato de inversión de dependencia (`PdfPort`) que `application/` MUST usar para
consumir el motor de PDF: los use-cases dependen de una interface propia de `application/`, nunca de
la clase concreta de `infrastructure/`.

El contrato del port también define cómo viaja el **error** de generación de PDF: `PdfPort.generatePdf`
MUST devolver `Result<Buffer, PdfError>` (nunca lanzar) y ese `Result` MUST propagarse sin `throw` a
través de `application/` hasta materializarse en HTTP recién en `presentation/` (ver PPR-R1..R7). Los
errores de negocio NO relacionados con PDF (`BoletinError`, `ConstanciaError`,
`AsistenciaReportingError`, etc.) NO están cubiertos por este contrato y siguen por `throw` — ver
`app-error-model` en Follow-up.

## Requirements

### RPI-R1 — Invariante de DI: instancia única para un provider exportado por un módulo compartido

Todo provider exportado por un módulo Nest compartido (en particular, `PdfGeneratorService` exportado
por `ReportingModule`) MUST resolverse como la misma referencia (`===`) en cualquier módulo que lo
importe. Esta es la invariante general de Nest DI que garantiza, en producción, que los tres módulos
feature (`AsistenciaReportingModule`, `ReportesModule`, `AttendanceTypeModule`) —al importar
`ReportingModule` sin registrar su propia copia del provider (ver RPI-R5)— compartan una única
instancia de `PdfGeneratorService` por proceso.

#### RPI-S1 — Misma referencia resuelta desde módulos importadores de `ReportingModule`

- GIVEN un `TestingModule` que declara `ReportingModule` y dos (o más) módulos importadores que lo
  importan
- WHEN se resuelve `PdfGeneratorService` desde el contexto de cada módulo importador
- THEN las referencias obtenidas MUST ser estrictamente iguales entre sí (`===`), demostrando la
  invariante de DI (RPI-R1) que sostiene la instancia única en producción

---

### RPI-R2 — A lo sumo un `Browser` de Puppeteer vivo por proceso (lazy, no eager)

El sistema MUST garantizar que exista a lo sumo un `Browser` de Puppeteer vivo por proceso en
cualquier momento. Dado que el lanzamiento del browser es LAZY (`getBrowser()`), un `Browser` MUST NOT
lanzarse durante el bootstrap de la aplicación ni antes de que se solicite la primera generación de
PDF. Una vez lanzado, toda generación de PDF subsiguiente desde CUALQUIERA de las tres features MUST
reutilizar la misma instancia de `Browser` (no lanzar una nueva), como consecuencia directa de que
existe una sola instancia de `PdfGeneratorService` (RPI-R1).

#### RPI-S2 — Sin browser al bootear la aplicación

- GIVEN la aplicación acaba de arrancar y todavía no se solicitó ninguna generación de PDF
- WHEN se inspecciona el estado del proceso (mock/spy sobre `puppeteer.launch`)
- THEN `puppeteer.launch` MUST NOT haber sido invocado

#### RPI-S3 — Un solo browser reutilizado entre las tres features

- GIVEN la aplicación corriendo con `ReportingModule` cableado en los tres módulos feature, y un spy
  sobre `puppeteer.launch`
- WHEN se genera un PDF de asistencia mensual, luego uno de tipos de asistencia, luego uno de boletín,
  en secuencia, dentro de la vida del mismo proceso
- THEN `puppeteer.launch` MUST haber sido invocado como máximo una vez en total a lo largo de las tres
  generaciones — la segunda y la tercera generación MUST reutilizar el `Browser` ya lanzado, sin
  invocar `launch` de nuevo

---

### RPI-R3 — Shutdown limpio: el browser se cierra exactamente una vez

Cuando la aplicación se apaga, el `Browser` de Puppeteer (si llegó a lanzarse alguna vez durante la
vida del proceso) MUST cerrarse exactamente una vez. La destrucción de un módulo feature individual
(`AsistenciaReportingModule`, `ReportesModule` o `AttendanceTypeModule`) en aislamiento MUST NOT
disparar el cierre del browser, dado que ninguno de los tres módulos feature registra ni controla el
ciclo de vida de `PdfGeneratorService` — solo lo controla `ReportingModule` (ver RPI-R5). Este
requisito depende de RPI-R6 (sin registro de shutdown hooks en el bootstrap, `onModuleDestroy` no se
dispara ante señales del proceso).

#### RPI-S4 — Apagado de la aplicación cierra el browser una sola vez

- GIVEN un browser fue lanzado durante la vida del proceso (se generó al menos un PDF), y
  `app.enableShutdownHooks()` fue registrado (RPI-R6)
- WHEN la aplicación Nest se apaga — vía `app.close()` (tests/programático) o vía señal SIGTERM/SIGINT
  (producción)
- THEN `browser.close()` MUST haber sido invocado exactamente una vez como resultado de ese apagado

#### RPI-S5 — Destruir un módulo feature en aislamiento NO cierra el browser

- GIVEN `ReportingModule` está importado por los tres módulos feature y hay un browser vivo
- WHEN se destruye/desmonta una instancia de un módulo feature individual (sin un shutdown completo de
  la aplicación)
- THEN `browser.close()` MUST NOT haber sido invocado como resultado de esa destrucción

**Nota de cobertura (verify 2026-07-09, WARNING, no bloqueante):** NestJS no expone una API pública
para destruir un submódulo mientras la aplicación sigue corriendo — no existe una forma de reproducir
el escenario literal de forma aislada con las herramientas del framework. RPI-S5 se cubre por
**inferencia arquitectónica**, no por un test que ejercite el escenario tal como está redactado: dado
que `ReportingModule` es el único owner registrado de `PdfGeneratorService` (RPI-R5/RPI-S9) y por lo
tanto el único punto donde corre `onModuleDestroy` de ese provider, ningún módulo feature individual
puede disparar el cierre del browser al ser destruido — no tiene el provider, no tiene su
`onModuleDestroy`. Esta garantía queda demostrada por la combinación de RPI-S1 (instancia única
compartida) + RPI-S4 (un solo `onModuleDestroy`, en el owner) + RPI-S9 (metadata: ningún módulo
feature registra el provider). El test implementado (`reporting.module.test.ts`) ejercita una
propiedad más débil pero relacionada: una app aislada que nunca lanzó un browser, cerrada por
completo, no invoca `close()` — válido por el guard `if (this.browserPromise)` de
`pdf-generator.service.ts`, pero no equivalente al escenario literal (destruir un módulo mientras los
otros dos siguen vivos en el mismo proceso). Ver Follow-up.

---

### RPI-R6 — Registro de shutdown hooks en el bootstrap (pre-requisito de RPI-R3)

La aplicación MUST invocar `app.enableShutdownHooks()` durante el bootstrap (`api/src/main.ts` /
`configureApp`), de modo que las señales SIGTERM/SIGINT (y `app.close()` programático) disparen el
ciclo `onModuleDestroy` de Nest sobre todos los módulos, incluido `ReportingModule`.

#### RPI-S10 — `enableShutdownHooks()` registrado en el bootstrap

- GIVEN el código de bootstrap de la aplicación
- WHEN se inspecciona la secuencia de arranque
- THEN `app.enableShutdownHooks()` MUST haber sido invocado, en cualquier punto antes de
  `app.listen(...)` o inmediatamente después de crear la instancia de la app, y en todo caso antes de
  que el proceso quede sirviendo tráfico

---

### RPI-R4 — Sin regresión funcional: los PDF de las tres features siguen generándose correctamente

Después de consolidar `PdfGeneratorService` en `ReportingModule`, la generación de PDF de las tres
features existentes — asistencia mensual (`asistencia-reporting`), tipos de asistencia
(`attendance-types`) y boletines/constancias (`report-cards`) — MUST seguir produciendo una salida PDF
válida, sin cambios de comportamiento, opciones ni contenido respecto del comportamiento previo a esta
capability.

#### RPI-S6 — Asistencia mensual sigue generando PDF válido

- GIVEN un `CourseCycle` con datos de asistencia mensual válidos
- WHEN se invoca `GenerateAsistenciaMensualPdfUseCase`
- THEN el use case MUST devolver un PDF (Buffer) válido, con el mismo comportamiento observable que
  antes de esta capability

#### RPI-S7 — Tipos de asistencia sigue generando PDF válido

- GIVEN datos válidos de `AttendanceType` para un nivel
- WHEN se invoca `GenerateAttendanceTypesPdfUseCase`
- THEN el use case MUST devolver un PDF (Buffer) válido, con el mismo comportamiento observable que
  antes de esta capability

#### RPI-S8 — Boletín/constancia sigue generando PDF válido

- GIVEN un `enrollmentId` válido con datos de boletín o constancia regular
- WHEN se invoca `GenerateBoletinUseCase` o `GenerateConstanciaRegularUseCase`
- THEN el use case MUST devolver un PDF (Buffer) válido, con el mismo comportamiento observable que
  antes de esta capability (incluida la firma de `generatePdf(html, options?)` sin cambios)

---

### RPI-R5 — Ningún módulo feature registra `PdfGeneratorService`; los tres importan `ReportingModule`

`AsistenciaReportingModule`, `ReportesModule` y `AttendanceTypeModule` MUST NOT listar
`PdfGeneratorService` en su propio arreglo `providers:`. Los tres MUST listar `ReportingModule` en su
propio arreglo `imports:`. El único punto de registro de `PdfGeneratorService` como provider en todo
el sistema MUST ser `ReportingModule`.

#### RPI-S9 — Los tres módulos feature importan `ReportingModule` y no registran el provider

- GIVEN los metadatos de módulo (`@Module(...)`) de `AsistenciaReportingModule`, `ReportesModule` y
  `AttendanceTypeModule`
- WHEN se inspecciona la metadata de cada uno (vía `Reflect.getMetadata('imports', Modulo)` y
  `Reflect.getMetadata('providers', Modulo)`, o equivalente)
- THEN `imports` MUST incluir `ReportingModule` en los tres módulos
- AND `PdfGeneratorService` MUST NOT estar presente en el `providers` de ninguno de los tres
- AND `PdfGeneratorService` MUST estar presente únicamente en el `providers` (y `exports`) de
  `ReportingModule`

---

### PDP-R1 — Existe el contrato `PdfPort` *(firma SUPERSEDED por `PPR-R1`)*

> **SUPERSEDED por `PPR-R1`** (change `pdf-port-result`, 2026-07-12): la firma de retorno descrita
> abajo (`Promise<Buffer>`, puede rechazar) quedó reemplazada por `Promise<Result<Buffer, PdfError>>`
> (nunca rechaza). El resto del requisito — que exista la interface `PdfPort`, la constante
> `PDF_PORT = Symbol('PDF_PORT')` y que `GeneratePdfOptions` viva en este archivo — sigue vigente sin
> cambios. Ver `PPR-R1`/`PPR-S1` para la firma actual.

`api/src/application/shared/ports/pdf.port.ts` MUST exportar una interface `PdfPort` con el método
`generatePdf(html: string, options?: GeneratePdfOptions): Promise<Buffer>` ~~(superseded — ver arriba,
la firma vigente es `Promise<Result<Buffer, PdfError>>`)~~, y una constante `PDF_PORT = Symbol('PDF_PORT')`
en el mismo archivo. `GeneratePdfOptions` MUST estar definida en este archivo (no en infra).

#### PDP-S1 — El port define la superficie única *(escenario histórico, ver `PPR-S1` para la firma vigente)*

- GIVEN el archivo `api/src/application/shared/ports/pdf.port.ts`
- WHEN se inspecciona su contenido exportado
- THEN MUST exportar la interface `PdfPort` con la firma
  `generatePdf(html: string, options?: GeneratePdfOptions): Promise<Buffer>` ~~(superseded por
  `PPR-S1`: `Promise<Result<Buffer, PdfError>>`)~~
- AND MUST exportar `PDF_PORT: symbol`
- AND MUST exportar el tipo `GeneratePdfOptions`

---

### PDP-R2 — Inversión de dependencia: `application/` no conoce infra (requisito central)

Ningún archivo bajo `api/src/application/` MUST importar la clase concreta `PdfGeneratorService` ni
ningún path bajo `infrastructure/reporting/pdf-generator.service`. La única referencia permitida desde
`application/` al motor de PDF es el contrato `PdfPort` / token `PDF_PORT`.

#### PDP-S2 — Aserción estática: cero imports de infra desde application

- GIVEN el árbol de código bajo `api/src/application/`
- WHEN se busca (grep/test de arquitectura) la cadena `PdfGeneratorService` o el path
  `infrastructure/reporting/pdf-generator.service` en sentencias de import
- THEN el resultado MUST ser cero coincidencias

---

### PDP-R3 — Los 4 use-cases dependen del port, no de la clase

`GenerateAttendanceTypesPdfUseCase`, `GenerateConstanciaRegularUseCase`, `GenerateBoletinUseCase` y
`GenerateAsistenciaMensualPdfUseCase` MUST inyectar `PdfPort` vía `@Inject(PDF_PORT)` en su
constructor. Ninguno MUST tipar el parámetro como `PdfGeneratorService`.

#### PDP-S3 — Los 4 use-cases resuelven `PdfPort` por token

- GIVEN los 4 use-cases instanciados vía `TestingModule` con un provider
  `{ provide: PDF_PORT, useValue: { generatePdf: vi.fn() } }`
- WHEN se construye cada use-case
- THEN cada uno MUST resolver su dependencia de generación de PDF a través de `PDF_PORT`, sin requerir
  ningún provider registrado bajo la clase `PdfGeneratorService`

---

### PDP-R4 — Infra implementa el port sin invertir la fuga de tipos *(firma SUPERSEDED por `PPR-R2`)*

> **SUPERSEDED por `PPR-R2`** (change `pdf-port-result`, 2026-07-12): "firma pública... MUST coincidir
> exactamente con la del port" ahora resuelve contra la firma vigente de `PdfPort` (`PPR-R1`):
> `PdfGeneratorService.generatePdf` ante fallo de Puppeteer MUST devolver `err(PdfError)` (NO lanzar,
> NO dejar rechazar la promesa). El resto del requisito — `implements PdfPort`, import de
> `GeneratePdfOptions` desde `pdf.port.ts` — sigue vigente sin cambios. Ver `PPR-R2`/`PPR-S2`.

`PdfGeneratorService` MUST declarar `implements PdfPort`. Su firma pública de `generatePdf` MUST
coincidir exactamente con la del port (vigente: `Promise<Result<Buffer, PdfError>>`, ver `PPR-R1`).
`PdfGeneratorService` MUST importar `GeneratePdfOptions` desde `pdf.port.ts` (dirección
infra → application), y MUST NOT seguir exportando su propia definición de `GeneratePdfOptions`.

#### PDP-S4 — La clase de infra satisface el contrato del port *(escenario histórico, ver `PPR-S2` para el comportamiento vigente ante fallo)*

- GIVEN la declaración de clase `PdfGeneratorService`
- WHEN se inspecciona su firma (`implements`) y su import de `GeneratePdfOptions`
- THEN MUST declarar `implements PdfPort`
- AND MUST importar `GeneratePdfOptions` desde `application/shared/ports/pdf.port.ts`
- AND la firma de `generatePdf` MUST ser estructuralmente idéntica a la de `PdfPort['generatePdf']`
  (vigente: `Promise<Result<Buffer, PdfError>>` — ver `PPR-S1`)

---

### PDP-R5 — Una sola instancia preservada (protege RPI-R1)

El wiring de `PDF_PORT` MUST resolver a la MISMA instancia singleton de `PdfGeneratorService` que
gestiona el ciclo de vida del `Browser` de Puppeteer — MUST NOT crear una segunda instancia. El
provider de `PDF_PORT` MUST usar `useExisting: PdfGeneratorService` (o equivalente que preserve la
referencia), no `useClass`.

#### PDP-S5 — `PDF_PORT` y `PdfGeneratorService` resuelven a la misma referencia

- GIVEN un `TestingModule` que registra `ReportingModule` y expone tanto `PdfGeneratorService` como
  `PDF_PORT`
- WHEN se resuelven ambos desde el mismo contexto de módulo (`moduleRef.get(PdfGeneratorService)` y
  `moduleRef.get(PDF_PORT)`)
- THEN las dos referencias obtenidas MUST ser estrictamente iguales (`===`)

---

### PDP-R6 — Sin regresión de comportamiento

Los 4 use-cases MUST seguir produciendo el mismo PDF (mismo Buffer resultante para la misma entrada)
tras la inversión de dependencia. Los tests existentes que mockean la dependencia como
`{ generatePdf: vi.fn() }` MUST seguir pasando sin cambiar la forma del mock — solo el tipo/token
inyectado cambia.

#### PDP-S6 — Los 4 use-cases producen el mismo PDF con el mismo mock

- GIVEN cada uno de los 4 use-cases con un mock
  `{ generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) }` provisto bajo `PDF_PORT`
- WHEN se ejecuta cada use-case con datos válidos (igual que antes del cambio)
- THEN cada uno MUST devolver el mismo `Buffer` que el mock resuelve, sin cambios de comportamiento
  observable
- AND la suite de tests existente MUST seguir en verde sin modificar la forma de los mocks

---

### PPR-R1 — El port devuelve `Result`, no lanza

`PdfPort.generatePdf` MUST tener la firma
`generatePdf(html: string, options?: GeneratePdfOptions): Promise<Result<Buffer, PdfError>>`.
Ante un fallo de generación, el port MUST NOT rechazar la promesa ni lanzar — el fallo se representa
como `err(PdfError)`. Reemplaza la firma histórica de `PDP-R1`/`PDP-S1` (`Promise<Buffer>`).

#### PPR-S1 — Firma del contrato

- GIVEN `api/src/application/shared/ports/pdf.port.ts`
- WHEN se inspecciona la interface `PdfPort`
- THEN `generatePdf` MUST devolver `Promise<Result<Buffer, PdfError>>`

---

### PPR-R2 — El service traduce fallos de Puppeteer a `err(PdfError)`

`PdfGeneratorService.generatePdf`, ante el rechazo de `page.setContent`, `page.pdf` o el lanzamiento
del browser, MUST devolver `err(PdfError)` con `code: 'PDF_GENERATION_FAILED'`. MUST NOT lanzar ni
dejar rechazar la promesa devuelta. El error original MUST preservarse en `PdfError.cause`. Satisface
la firma vigente exigida por `PDP-R4` (superseded).

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

## Trazabilidad requisito → escenario

| Requisito | Escenarios |
|-----------|-----------|
| RPI-R1 | RPI-S1 |
| RPI-R2 | RPI-S2, RPI-S3 |
| RPI-R3 | RPI-S4, RPI-S5 |
| RPI-R4 | RPI-S6, RPI-S7, RPI-S8 |
| RPI-R5 | RPI-S9 |
| RPI-R6 | RPI-S10 |
| PDP-R1 | PDP-S1 |
| PDP-R2 | PDP-S2 |
| PDP-R3 | PDP-S3 |
| PDP-R4 | PDP-S4 |
| PDP-R5 | PDP-S5 |
| PDP-R6 | PDP-S6 |
| PPR-R1 *(supersede firma de PDP-R1)* | PPR-S1 |
| PPR-R2 *(supersede firma de PDP-R4)* | PPR-S2 |
| PPR-R3 | PPR-S3 |
| PPR-R4 | PPR-S4, PPR-S5, PPR-S11, PPR-S12, PPR-S13 |
| PPR-R5 | PPR-S6, PPR-S7 |
| PPR-R6 | PPR-S8, PPR-S9 |
| PPR-R7 | PPR-S10 |

## ADR cross-reference (reporting-module-compartido)

| ADR    | Decision | Satisfies |
|--------|----------|-----------|
| ADR-01 | `ReportingModule` vive en `infrastructure/reporting/`, junto a `PdfGeneratorService` — módulo hoja sin controller, precedente `event-bus.module.ts` | RPI-R1, RPI-R5 |
| ADR-02 | Test de instancia única vía stub consumer modules (semántica DI) + aserción estática de metadata sobre los 3 módulos feature reales | RPI-R1, RPI-R5 |
| ADR-03 | Verificación de "un solo browser" por spy sobre `puppeteer.launch`, reutilizando el patrón `vi.mock('puppeteer')` ya existente | RPI-R2 |
| ADR-04 | `app.enableShutdownHooks()` agregado al bootstrap (vía `configureApp`) — condición pre-existente ausente, no una regresión | RPI-R3, RPI-R6 |
| ADR-05 | Se descarta `@Global()` — `PdfGeneratorService` es feature-scoped a tres módulos nombrados, no cross-cutting | RPI-R5 |

## ADR cross-reference (pdf-port)

| ADR    | Decision | Satisfies |
|--------|----------|-----------|
| ADR-06 | `{ provide: PDF_PORT, useExisting: PdfGeneratorService }` en `ReportingModule` (alias al mismo singleton) — descartado `useClass` (instanciaría un segundo `PdfGeneratorService`/`Browser`) y `useValue` (pierde el ciclo de vida `onModuleDestroy` gestionado por Nest) | PDP-R5 |
| ADR-07 | `PDF_PORT` se registra y exporta una sola vez en `ReportingModule` (dueño del singleton); los 3 módulos feature lo reciben gratis al importar `ReportingModule`, sin duplicar el wiring | PDP-R3, PDP-R5 |
| ADR-08 | `GeneratePdfOptions` se reubica a `pdf.port.ts`; `pdf-generator.service.ts` la reimporta (flecha `infra → application`, dirección DIP correcta) | PDP-R1, PDP-R4 |
| ADR-09 | Test de arquitectura path-based (no name-based) sobre `api/src/application/` para detectar imports de infra — evita falso positivo con referencias a `PdfGeneratorService` en JSDoc | PDP-R2 |
| ADR-10 | Verificación de PDP-S4 vía inspección de código fuente (no type-assignability): TS structural typing hace asignable cualquier clase con la misma forma a `PdfPort` sin `implements` explícito, y esbuild no type-checka en tiempo de test — un `const x: PdfPort = service` nunca daría RED. La combinación test-de-fuente (`pnpm test`) + `implements`-enforcement (`pnpm typecheck`, TS2420 si la firma diverge) cubre el requisito sin ventana abierta | PDP-R4 *(superseded — ver ADR-15)* |

## ADR cross-reference (pdf-port-result)

| ADR    | Decision | Satisfies |
|--------|----------|-----------|
| ADR-11 | Doble canal de error transitorio: el fallo de PDF (único que subía crudo desde infra) baja al canal `Result`; los errores de negocio no-PDF (`BoletinError`, `ConstanciaError`, `AsistenciaReportingError`, etc.) siguen por `throw`. Ambos canales convergen en `HttpException → AppExceptionFilter` en el borde de `presentation/`. Cierre completo de la coexistencia queda para el change `app-error-model` (requiere una base `ApplicationError` que hoy no existe) | PPR-R1..R7 |
| ADR-12 | `PdfError` como clase en `application/shared/errors/`, `cause` como campo propio (no `super(msg,{cause})`, para no depender del `lib` de tsconfig) | PPR-R3 |
| ADR-13 | `unwrapResultOrThrow<T>` en `presentation/shared/http/` — genérico, lanza `HttpException` mapeando `PdfError.httpStatus`; decisión consciente de NO tocar `AppExceptionFilter` (el `code` del `PdfError` no viaja en el body, solo `status`+`message`; mejora de +2 líneas queda como SUGGESTION no tomada) | PPR-R5 |
| ADR-14 | `GenerateBoletinBatchUseCase` (5.º consumidor, hallado en `design`, no listado originalmente en la spec/proposal) adaptado para manejar AMBOS canales en el mismo loop: `isErr()` para el `Result` de PDF, `try/catch` para `BoletinError` no-PDF — ambos resuelven en "saltear alumno, seguir" | PPR-R7 |
| ADR-15 | La firma `Promise<Buffer>` fijada por `PDP-R1`/`PDP-S1` y el requisito estructural de `PDP-R4`/`PDP-S4` quedan `SUPERSEDED` por `PPR-R1`/`PPR-R2` — el port y su implementación ahora devuelven `Promise<Result<Buffer, PdfError>>` y nunca lanzan | PDP-R1, PDP-R4 → PPR-R1, PPR-R2 |

## Out of Scope (explicit non-requirements)

- Cambios de contenido, formato u opciones de los PDF generados (grillas, totales, templates
  Handlebars) — cubiertos por `asistencia-reporting/spec.md`, `report-cards/spec.md` y
  `attendance-types/spec.md`, ninguna modificada.
- Mover `PdfGeneratorService` de capa — ya vive correctamente en `infrastructure/reporting/`.
- `onModuleDestroy` en el contrato de `PdfPort` — lifecycle de infra ligado a `ReportingModule`, no
  forma parte del contrato del port.
- Unificar la convención de tokens legada (`AuthPort`/`FileStoragePort` string-literal) — deuda
  separada, no forma parte de esta capability.
- Convertir a `Result` los errores NO-PDF de los use-cases (`BoletinError`, `ConstanciaError`,
  `AsistenciaReportingError`, `AttendanceTypeLevelOutOfScopeError`) — siguen por `throw`. Requiere
  primero una base `ApplicationError` compartida (no existe hoy). Ver Follow-up (`app-error-model`).
- Clasificar causas de fallo de PDF en infra (timeout vs launch vs render) — el catch de
  `PdfGeneratorService` sigue siendo genérico, un solo `PdfError`.

## Follow-up (tickets separados, no forman parte de esta capability)

1. ~~Migrar `PdfPort.generatePdf` de `Promise<Buffer>` a `Result<Buffer, PdfError>`~~ — **RESUELTO**
   por el change `pdf-port-result` (2026-07-12, ver `PPR-R1`/`PPR-R2`).
2. Si en el futuro NestJS (o un mecanismo propio) permite destruir un submódulo sin cerrar la
   aplicación completa, reforzar RPI-S5 con un test literal que ejercite ese escenario en vez de
   depender de la inferencia arquitectónica descrita en la nota de RPI-S5.
3. **`app-error-model`** (nuevo, hallado por `pdf-port-result`): crear una base `ApplicationError`
   compartida y convertir a `Result` los errores no-PDF de los use-cases (`BoletinError`,
   `ConstanciaError`, `AsistenciaReportingError`, `AttendanceTypeLevelOutOfScopeError`) — cierra la
   coexistencia de dos mecanismos de error documentada en ADR-11.
4. **Mejora opcional de +2 líneas en `AppExceptionFilter`** (hallado por `pdf-port-result`, ADR-13):
   hoy el filter extrae `message` de `HttpException` pero no `code`, así que `PdfError.code`
   (`PDF_GENERATION_FAILED`) no viaja en el body HTTP (solo `status`+`message`). No bloqueante.
5. **Clasificar causas de fallo de PDF en infra** (timeout vs launch vs render) — hoy
   `PdfGeneratorService` tiene un solo catch genérico y un único `PdfError`.
