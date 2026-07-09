# Spec (delta) — Reporting Module Compartido

- **Change name:** `reporting-module-compartido`
- **Store:** hybrid (engram `sdd/reporting-module-compartido/spec` + este archivo)
- **Basado en:** `openspec/changes/reporting-module-compartido/proposal.md` (Issue #101)
- **Convención:** Given/When/Then + RFC 2119 (MUST/MUST NOT/SHOULD/MAY). Cada escenario es verificable de forma aislada, apto para derivar un test directamente (TDD estricto activo).
- **Nivel pedagógico afectado:** `ALL` (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO). `PdfGeneratorService` genera PDFs de asistencia mensual, tipos de asistencia, boletines y constancias — capacidades transversales a los cuatro niveles. El cambio es infraestructural (wiring de DI) y no discrimina por nivel.
- **Capability afectado:** `reporting-infrastructure` (**NUEVA** — no existe hoy en `openspec/specs/`; se crea con este change). Las capabilities existentes `asistencia-reporting`, `report-cards` y `attendance-types` cubren el CONTENIDO de cada PDF y no se modifican; esta capability nueva cubre el ciclo de vida y la instanciación del servicio compartido `PdfGeneratorService` que las tres consumen.
- **Cross-references:**
  `asistencia-reporting/spec.md` (consumidor de `PdfGeneratorService`, sin cambios de contenido);
  `report-cards/spec.md` (consumidor, sin cambios de contenido);
  `attendance-types/spec.md` (consumidor de generación de PDF de tipos de asistencia, sin cambios de contenido).
- **Scope ampliado (aprobado por el usuario):** `api/src/main.ts` entra en scope de este change para satisfacer RPI-R6 (`app.enableShutdownHooks()`), pre-requisito de RPI-R3. No estaba contemplado en el proposal original; la falta de `enableShutdownHooks()` es una condición PRE-EXISTENTE detectada durante `sdd-design`, no una regresión.

Este documento describe QUÉ debe ser verdad después de aplicar el cambio. No prescribe implementación (eso vive en `sdd-design`).

## Fuera de alcance de esta spec (explícito)

- `PdfPort` / token `Symbol` / mover `PdfGeneratorService` a `infrastructure/` detrás de un port — ticket separado.
- Resolver la violación de ADR-06 (los 4 use-cases de `application/` importan la clase concreta `PdfGeneratorService` en vez de un port) — deuda preexistente, no forma parte de este change.
- Cambios de contenido, formato u opciones de los PDFs generados (grillas, totales, templates Handlebars) — cubiertos por sus specs propias (`asistencia-reporting`, `report-cards`, `attendance-types`) y no modificados.
- Eliminación del comentario de deuda en `attendance-type.module.ts:21-27` — es un detalle de limpieza de código, no un contrato observable; se resuelve en `tasks`/`apply`, no es requisito de spec.

---

## RPI-R1 — Invariante de DI: instancia única para un provider exportado por un módulo compartido

Todo provider exportado por un módulo Nest compartido (en particular, `PdfGeneratorService` exportado por `ReportingModule`) MUST resolverse como la misma referencia (`===`) en cualquier módulo que lo importe. Esta es la invariante general de Nest DI que garantiza, en producción, que los tres módulos feature (`AsistenciaReportingModule`, `ReportesModule`, `AttendanceTypeModule`) —al importar `ReportingModule` sin registrar su propia copia del provider (ver RPI-R5)— compartan una única instancia de `PdfGeneratorService` por proceso.

**Nota de reconciliación con `design.md` (ADR-02):** este requisito se verifica instanciando `ReportingModule` junto a módulos importadores STUB (sin `AuthModule`/`PrismaService`/repos reales), no los tres módulos feature reales completos — decisión correcta del design para evitar arrastrar dependencias pesadas al test de DI. La cobertura de que los tres módulos feature REALES importan `ReportingModule` y no registran su propia copia es una aserción estática, separada, cubierta por RPI-R5/RPI-S9.

### RPI-S1 — Misma referencia resuelta desde módulos importadores de `ReportingModule`

- GIVEN un `TestingModule` que declara `ReportingModule` y dos (o más) módulos importadores STUB que lo importan (sin traer `AuthModule`, `PrismaService` ni repos reales — patrón de `design.md` ADR-02)
- WHEN se resuelve `PdfGeneratorService` desde el contexto de cada módulo stub importador (p. ej. `moduleRef.get(PdfGeneratorService, { strict: false })` por módulo)
- THEN las referencias obtenidas MUST ser estrictamente iguales entre sí (`===`), demostrando la invariante de DI (RPI-R1) que sostiene la instancia única en producción

---

## RPI-R2 — A lo sumo un `Browser` de Puppeteer vivo por proceso (lazy, no eager)

El sistema MUST garantizar que exista a lo sumo un `Browser` de Puppeteer vivo por proceso en cualquier momento. Dado que el lanzamiento del browser es LAZY (`getBrowser()`, `pdf-generator.service.ts:60-71`), un `Browser` MUST NOT lanzarse durante el bootstrap de la aplicación ni antes de que se solicite la primera generación de PDF. Una vez lanzado, toda generación de PDF subsiguiente desde CUALQUIERA de las tres features MUST reutilizar la misma instancia de `Browser` (no lanzar una nueva), como consecuencia directa de que ahora existe una sola instancia de `PdfGeneratorService` (RPI-R1).

### RPI-S2 — Sin browser al bootear la aplicación

- GIVEN la aplicación acaba de arrancar y todavía no se solicitó ninguna generación de PDF
- WHEN se inspecciona el estado del proceso (mock/spy sobre `puppeteer.launch`)
- THEN `puppeteer.launch` MUST NOT haber sido invocado

### RPI-S3 — Un solo browser reutilizado entre las tres features

- GIVEN la aplicación corriendo con `ReportingModule` cableado en los tres módulos feature, y un spy sobre `puppeteer.launch`
- WHEN se genera un PDF de asistencia mensual, luego uno de tipos de asistencia, luego uno de boletín, en secuencia, dentro de la vida del mismo proceso
- THEN `puppeteer.launch` MUST haber sido invocado como máximo una vez en total a lo largo de las tres generaciones — la segunda y la tercera generación MUST reutilizar el `Browser` ya lanzado, sin invocar `launch` de nuevo

---

## RPI-R3 — Shutdown limpio: el browser se cierra exactamente una vez

Cuando la aplicación se apaga, el `Browser` de Puppeteer (si llegó a lanzarse alguna vez durante la vida del proceso) MUST cerrarse exactamente una vez. La destrucción de un módulo feature individual (`AsistenciaReportingModule`, `ReportesModule` o `AttendanceTypeModule`) en aislamiento MUST NOT disparar el cierre del browser, dado que ninguno de los tres módulos feature registra ni controla el ciclo de vida de `PdfGeneratorService` — solo lo controla `ReportingModule` (ver RPI-R5).

**Este requisito solo es alcanzable si RPI-R6 se cumple.** Verificación previa del orquestador: `api/src/main.ts` NO invoca `app.enableShutdownHooks()` (`rg 'enableShutdownHooks' api/src` → 0 resultados; `bootstrap()` va de `app.listen(...)` directo al log). Sin ese registro, Nest no propaga SIGTERM/SIGINT a `onModuleDestroy`, y `onModuleDestroy` de `pdf-generator.service.ts:91-102` NUNCA corre en producción — esta ausencia es una condición PRE-EXISTENTE al issue #101, no una regresión introducida por este change. RPI-R6 la resuelve, entrando explícitamente en el scope de este change.

### RPI-S4 — Apagado de la aplicación cierra el browser una sola vez

- GIVEN un browser fue lanzado durante la vida del proceso (se generó al menos un PDF), y `app.enableShutdownHooks()` fue registrado (RPI-R6)
- WHEN la aplicación Nest se apaga — vía `app.close()` (tests/programático) o vía señal SIGTERM/SIGINT (producción)
- THEN `browser.close()` MUST haber sido invocado exactamente una vez como resultado de ese apagado

### RPI-S5 — Destruir un módulo feature en aislamiento NO cierra el browser

- GIVEN `ReportingModule` está importado por los tres módulos feature y hay un browser vivo
- WHEN se destruye/desmonta una instancia de un módulo feature individual (sin un shutdown completo de la aplicación)
- THEN `browser.close()` MUST NOT haber sido invocado como resultado de esa destrucción

---

## RPI-R6 — Registro de shutdown hooks en el bootstrap (pre-requisito de RPI-R3)

La aplicación MUST invocar `app.enableShutdownHooks()` durante el bootstrap (`api/src/main.ts`), de modo que las señales SIGTERM/SIGINT (y `app.close()` programático) disparen el ciclo `onModuleDestroy` de Nest sobre todos los módulos, incluido `ReportingModule`. Sin este registro, RPI-R3 es inalcanzable en producción — condición confirmada como PRE-EXISTENTE (`enableShutdownHooks` ausente hoy en `api/src/main.ts`), no una regresión de este change. Este requisito amplía el scope original del issue #101 (aprobado explícitamente por el usuario) para que RPI-R3 deje de ser un contrato solo verificable en tests y pase a cumplirse también en producción.

### RPI-S10 — `enableShutdownHooks()` registrado en el bootstrap

- GIVEN el código de bootstrap de la aplicación (`api/src/main.ts`)
- WHEN se inspecciona la secuencia de arranque (`bootstrap()`)
- THEN `app.enableShutdownHooks()` MUST haber sido invocado, en cualquier punto antes de `app.listen(...)` o inmediatamente después de crear la instancia de la app, y en todo caso antes de que el proceso quede sirviendo tráfico

---

## RPI-R4 — Sin regresión funcional: los PDF de las tres features siguen generándose correctamente

Después de consolidar `PdfGeneratorService` en `ReportingModule`, la generación de PDF de las tres features existentes — asistencia mensual (`asistencia-reporting`), tipos de asistencia (`attendance-types`) y boletines/constancias (`reportes`, vía `report-cards`) — MUST seguir produciendo una salida PDF válida, sin cambios de comportamiento, opciones ni contenido respecto del comportamiento previo a este change.

### RPI-S6 — Asistencia mensual sigue generando PDF válido

- GIVEN un `CourseCycle` con datos de asistencia mensual válidos
- WHEN se invoca `GenerateAsistenciaMensualPdfUseCase` tras la consolidación
- THEN el use case MUST devolver un PDF (Buffer) válido, con el mismo comportamiento observable que antes del cambio

### RPI-S7 — Tipos de asistencia sigue generando PDF válido

- GIVEN datos válidos de `AttendanceType` para un nivel
- WHEN se invoca `GenerateAttendanceTypesPdfUseCase` tras la consolidación
- THEN el use case MUST devolver un PDF (Buffer) válido, con el mismo comportamiento observable que antes del cambio

### RPI-S8 — Boletín/constancia sigue generando PDF válido

- GIVEN un `enrollmentId` válido con datos de boletín o constancia regular
- WHEN se invoca `GenerateBoletinUseCase` o `GenerateConstanciaRegularUseCase` tras la consolidación
- THEN el use case MUST devolver un PDF (Buffer) válido, con el mismo comportamiento observable que antes del cambio (incluida la firma de `generatePdf(html, options?)` sin cambios)

---

## RPI-R5 — Ningún módulo feature registra `PdfGeneratorService`; los tres importan `ReportingModule`

`AsistenciaReportingModule`, `ReportesModule` y `AttendanceTypeModule` MUST NOT listar `PdfGeneratorService` en su propio arreglo `providers:`. Los tres MUST listar `ReportingModule` en su propio arreglo `imports:`. El único punto de registro de `PdfGeneratorService` como provider en todo el sistema MUST ser `ReportingModule`. Este requisito absorbe, como aserción ESTÁTICA sobre la metadata `@Module` de los tres módulos feature reales, la parte del contrato que RPI-S1 ya no cubre al usar módulos stub (ver nota de reconciliación en RPI-R1).

### RPI-S9 — Los tres módulos feature importan `ReportingModule` y no registran el provider

- GIVEN los metadatos de módulo (`@Module(...)`) de `AsistenciaReportingModule`, `ReportesModule` y `AttendanceTypeModule` tras el cambio
- WHEN se inspecciona la metadata de cada uno (vía `Reflect.getMetadata('imports', Modulo)` y `Reflect.getMetadata('providers', Modulo)`, o equivalente)
- THEN `imports` MUST incluir `ReportingModule` en los tres módulos
- AND `PdfGeneratorService` MUST NOT estar presente en el `providers` de ninguno de los tres
- AND `PdfGeneratorService` MUST estar presente únicamente en el `providers` (y `exports`) de `ReportingModule`

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
