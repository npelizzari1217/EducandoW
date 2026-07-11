# Spec: Reporting Infrastructure (módulo compartido de generación de PDF)

> Capability area: wiring de DI y ciclo de vida de `PdfGeneratorService` (generación de PDF vía
> Puppeteer + Handlebars), consumido por tres módulos feature (asistencia mensual, tipos de
> asistencia, boletines/constancias). Gobierna instancia única, ciclo de vida del `Browser` de
> Puppeteer y shutdown de la aplicación — NO el contenido/formato de los PDF generados.
> Changes:
>   reporting-module-compartido (archived 2026-07-09) — RPI-R1, RPI-R2, RPI-R3, RPI-R4, RPI-R5, RPI-R6
>   pdf-port (archived 2026-07-11) — PDP-R1, PDP-R2, PDP-R3, PDP-R4, PDP-R5, PDP-R6
> IDs: RPI-R* / RPI-S* (ciclo de vida del provider) · PDP-R* / PDP-S* (inversión de dependencia sobre
> el mismo provider)
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

### PDP-R1 — Existe el contrato `PdfPort`

`api/src/application/shared/ports/pdf.port.ts` MUST exportar una interface `PdfPort` con el método
`generatePdf(html: string, options?: GeneratePdfOptions): Promise<Buffer>`, y una constante
`PDF_PORT = Symbol('PDF_PORT')` en el mismo archivo. `GeneratePdfOptions` MUST estar definida en este
archivo (no en infra).

#### PDP-S1 — El port define la superficie única

- GIVEN el archivo `api/src/application/shared/ports/pdf.port.ts`
- WHEN se inspecciona su contenido exportado
- THEN MUST exportar la interface `PdfPort` con la firma
  `generatePdf(html: string, options?: GeneratePdfOptions): Promise<Buffer>`
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

### PDP-R4 — Infra implementa el port sin invertir la fuga de tipos

`PdfGeneratorService` MUST declarar `implements PdfPort`. Su firma pública de `generatePdf` MUST
coincidir exactamente con la del port. `PdfGeneratorService` MUST importar `GeneratePdfOptions` desde
`pdf.port.ts` (dirección infra → application), y MUST NOT seguir exportando su propia definición de
`GeneratePdfOptions`.

#### PDP-S4 — La clase de infra satisface el contrato del port

- GIVEN la declaración de clase `PdfGeneratorService`
- WHEN se inspecciona su firma (`implements`) y su import de `GeneratePdfOptions`
- THEN MUST declarar `implements PdfPort`
- AND MUST importar `GeneratePdfOptions` desde `application/shared/ports/pdf.port.ts`
- AND la firma de `generatePdf` MUST ser estructuralmente idéntica a la de `PdfPort['generatePdf']`

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
| ADR-10 | Verificación de PDP-S4 vía inspección de código fuente (no type-assignability): TS structural typing hace asignable cualquier clase con la misma forma a `PdfPort` sin `implements` explícito, y esbuild no type-checka en tiempo de test — un `const x: PdfPort = service` nunca daría RED. La combinación test-de-fuente (`pnpm test`) + `implements`-enforcement (`pnpm typecheck`, TS2420 si la firma diverge) cubre el requisito sin ventana abierta | PDP-R4 |

## Out of Scope (explicit non-requirements)

- Cambios de contenido, formato u opciones de los PDF generados (grillas, totales, templates
  Handlebars) — cubiertos por `asistencia-reporting/spec.md`, `report-cards/spec.md` y
  `attendance-types/spec.md`, ninguna modificada.
- Mover `PdfGeneratorService` de capa — ya vive correctamente en `infrastructure/reporting/`.
- `Result<Buffer, PdfError>` — `PdfPort.generatePdf` sigue devolviendo `Promise<Buffer>` (puede
  rechazar). Ver Follow-up.
- `onModuleDestroy` en el contrato de `PdfPort` — lifecycle de infra ligado a `ReportingModule`, no
  forma parte del contrato del port.
- Unificar la convención de tokens legada (`AuthPort`/`FileStoragePort` string-literal) — deuda
  separada, no forma parte de esta capability.

## Follow-up (tickets separados, no forman parte de esta capability)

1. Migrar `PdfPort.generatePdf` de `Promise<Buffer>` a `Result<Buffer, PdfError>` — alinea con la
   convención de error-handling del proyecto; tocaría los 4 call-sites (use-cases) y sus tests. No
   implementado por `pdf-port` (fuera de su scope explícito).
2. Si en el futuro NestJS (o un mecanismo propio) permite destruir un submódulo sin cerrar la
   aplicación completa, reforzar RPI-S5 con un test literal que ejercite ese escenario en vez de
   depender de la inferencia arquitectónica descrita en la nota de RPI-S5.
