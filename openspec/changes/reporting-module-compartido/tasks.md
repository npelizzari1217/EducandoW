# Tasks — reporting-module-compartido (issue #101)

Store: hybrid (este archivo + engram `sdd/reporting-module-compartido/tasks`, contenido idéntico).
Depende de: `spec.md` (v2, RPI-R1..R6 / RPI-S1..S10) y `design.md` (v2, ADR-01..05).
TDD estricto activo. `test_command: pnpm --filter api test` (o `pnpm test` en raíz). Coverage ≥ 80%.
Fuera de scope: `PdfPort`/Symbol, mover el service de capa, ADR-06 (Follow-up separado).

## Corrección aplicada respecto al design (hueco de TDD, paso 6)

El paso 5 del orden TDD de `design.md` (`generatePdf` + `await app.close()` → `mockBrowser.close` x1) **pasa en verde
sin tocar `main.ts`**, porque `app.close()` dispara `onModuleDestroy` exista o no `app.enableShutdownHooks()` — el hook
solo hace que una señal SIGTERM/SIGINT del SO recorra ese mismo camino. El paso 6 original (agregar el hook) sería
GREEN sin RED propio → código de producción sin test que lo obligue, y **`RPI-S10` queda sin cobertura real**.

Resolución (Work Unit 3 abajo): extraer `app.enableShutdownHooks()` (junto con el resto del wiring de bootstrap que
no depende de I/O real) a una función pura y exportada `configureApp(app, config)` en un archivo NUEVO
`api/src/infrastructure/config/configure-app.ts` — **no** dentro de `main.ts`. Motivo técnico: `main.ts` termina con
`bootstrap();` a nivel de módulo (línea 58, sin guard); si `configureApp` viviera en `main.ts`, importarla en un test
ejecutaría `bootstrap()` real (crea la app Nest completa) como efecto secundario del import. Extraerla a un archivo
propio permite testear `configureApp` con un doble de `app` (métodos espiados) sin arrastrar Nest real — mismo patrón
que `infrastructure/config/env.config.ts` ya establece para lógica de bootstrap testable fuera de `main.ts`.

`configureApp(app: NestExpressApplication, config: EnvConfig): void` aplica, en orden (ADR-04 del design):
`setGlobalPrefix('v1')` → `useStaticAssets(...)` → `enableCors(...)` → `app.use(cookieParser())` →
`app.enableShutdownHooks()`. Swagger queda FUERA de `configureApp` y se mantiene en `bootstrap()`: no tiene relación
con el shutdown hook ni con ningún RPI-Sx, y meterlo en el doble de test solo agregaría ruido (DocumentBuilder no
tiene nada que espiar). `bootstrap()` pasa a: `configureApp(app, config)` + Swagger + `await app.listen(...)`.

---

## Work Unit 1 — Shared ReportingModule (RPI-R1, R2, R3 · RPI-S1, S2, S3, S4, S5)

- [x] **Task 1 [RED]** — `api/src/infrastructure/reporting/__tests__/reporting.module.test.ts` (NUEVO).
  Mockear `puppeteer` (mismo patrón que `pdf-generator.service.test.ts`: `mockLaunch`/`mockBrowser`/`mockPage`).
  Dos módulos stub (`StubModuleA`, `StubModuleB`) que `imports:[ReportingModule]` y exponen
  `{ provide: 'A_PDF'|'B_PDF', useExisting: PdfGeneratorService }` + `exports`. Root `TestingModule` importa ambos.
  Casos:
  - **RPI-S1**: `get('A_PDF') === get('B_PDF')` (misma referencia).
  - **RPI-S2**: inmediatamente después de compilar/inicializar el módulo, ANTES de llamar `generatePdf`, `mockLaunch`
    MUST NOT haber sido llamado.
  - **RPI-S3**: llamar `generatePdf` 3 veces en secuencia (simulando las 3 features) sobre el provider resuelto →
    `mockLaunch` llamado exactamente 1 vez.
  - **RPI-S4**: forzar lazy-launch con un `generatePdf` + `await app.close()` → `mockBrowser.close` llamado
    exactamente 1 vez.
  - **RPI-S5**: una instancia NUEVA/aislada del mismo módulo (segundo `TestingModule.compile()` + `createNestApplication`)
    que NUNCA llama `generatePdf` → `await app.close()` → `mockBrowser.close` MUST NOT ser llamado para esa instancia
    (el guard `if (this.browserPromise)` en `onModuleDestroy` ya existe en `pdf-generator.service.ts`; este test lo
    hace explícito a nivel de módulo, no solo de clase).
  Debe fallar: `reporting.module.ts` no existe todavía (import error).

- [x] **Task 2 [GREEN]** — `api/src/infrastructure/reporting/reporting.module.ts` (NUEVO). `@Module({ providers:
  [PdfGeneratorService], exports: [PdfGeneratorService] })`. Sin controller (precedente: `event-bus.module.ts`).
  Ubicación ADR-01: junto al service, NO se mueve de capa.

- [x] **Task 3 [GREEN/refactor]** — `api/src/infrastructure/reporting/index.ts` (MODIFICAR). Agregar
  `export { ReportingModule } from './reporting.module';` al barrel. Correr Task 1 → verde.

**Commit sugerido**: `feat(reporting): add shared ReportingModule to dedupe PdfGeneratorService instance`

---

## Work Unit 2 — Los 3 módulos feature consumen ReportingModule (RPI-R5 · RPI-S9)

- [x] **Task 4 [RED]** — `api/src/infrastructure/reporting/__tests__/reporting-module-metadata.test.ts` (NUEVO).
  Aserción ESTÁTICA sin DI, `Reflect.getMetadata('imports'|'providers', Modulo)` para
  `AttendanceTypeModule`, `AsistenciaReportingModule`, `ReportesModule`:
  - `imports` MUST incluir `ReportingModule`.
  - `providers` MUST NOT incluir `PdfGeneratorService`.
  Debe fallar: ninguno de los 3 importa `ReportingModule` hoy, y 2 de ellos (`AsistenciaReportingModule`,
  `ReportesModule`) sí registran `PdfGeneratorService` en `providers` (verificado por grep en design.md).

- [x] **Task 5 [GREEN]** — `api/src/presentation/attendance-type/attendance-type.module.ts` (MODIFICAR).
  Agregar `ReportingModule` a `imports: [AuthModule, ReportingModule]`. Quitar `PdfGeneratorService` de `providers`.
  Borrar el comentario de deuda técnica (líneas 21-27, "NO shared ReportingModule exists..."). El `import` de la
  CLASE `PdfGeneratorService` se mantiene (se usa como tipo en el `useFactory` de `GenerateAttendanceTypesPdfUseCase`
  y en `inject`). RPI-S9.

- [x] **Task 6 [GREEN]** — `api/src/presentation/asistencia-reporting/asistencia-reporting.module.ts` (MODIFICAR).
  Mismo tratamiento: `ReportingModule` a `imports`, quitar `PdfGeneratorService` de `providers`, mantener el import
  de tipo. RPI-S9.

- [x] **Task 7 [GREEN]** — `api/src/presentation/reportes/reportes.module.ts` (MODIFICAR). Mismo tratamiento. Ojo:
  este módulo tiene `exports: [BoletinInvalidationService, PdfStorageService]` — no tocar, `PdfGeneratorService`
  nunca estuvo exportado. RPI-S9.

- [x] **Task 8 [verify]** — Correr Task 4 → verde.

**Commit sugerido**: `refactor(reporting): consume shared ReportingModule from feature modules`

---

## Work Unit 3 — Shutdown hooks testeables en bootstrap (RPI-R6 · RPI-S10) — corrección del hueco TDD

- [x] **Task 9 [RED]** — `api/src/infrastructure/config/__tests__/configure-app.test.ts` (NUEVO). Doble de `app`
  (objeto plano con `setGlobalPrefix`, `useStaticAssets`, `enableCors`, `use`, `enableShutdownHooks` como
  `vi.fn()`) + `EnvConfig` de fixture (`corsOrigin: 'http://localhost:5173'`). Llamar
  `configureApp(fakeApp, fakeConfig)`. Aserciones:
  - `enableShutdownHooks` llamado exactamente 1 vez (**RPI-S10** — este es el test que de verdad exige el hook).
  - `setGlobalPrefix` llamado con `'v1'`.
  - `useStaticAssets` llamado (ruta `uploads` + `prefix: '/uploads/'`).
  - `enableCors` llamado con `credentials: true`.
  - `use` llamado (cookie parser middleware).
  Debe fallar: el módulo `infrastructure/config/configure-app.ts` no existe (import error) — RED real, previo a
  cualquier cambio de producción.

- [x] **Task 10 [GREEN]** — `api/src/infrastructure/config/configure-app.ts` (NUEVO). Exporta
  `configureApp(app: NestExpressApplication, config: EnvConfig): void`. Contiene, en orden (ADR-04): prefijo global,
  static assets, resolución de CORS origin (misma lógica que hoy vive inline en `main.ts` líneas 41-48) + `enableCors`,
  `app.use(cookieParser())`, `app.enableShutdownHooks()` al final (después de cookieParser, antes de que el caller
  haga `listen`). Sin Swagger — queda en `bootstrap()`.

- [x] **Task 11 [GREEN/refactor]** — `api/src/main.ts` (MODIFICAR). `bootstrap()` pasa a llamar
  `configureApp(app, config);` en vez del bloque inline (setGlobalPrefix/staticAssets/CORS/cookieParser). Mantener
  Swagger (`DocumentBuilder`/`SwaggerModule`) y `await app.listen(config.port)` en `bootstrap()`. Quitar de `main.ts`
  los imports que migraron a `configure-app.ts` (`join`, `cookieParser`) si quedan sin uso; agregar
  `import { configureApp } from './infrastructure/config/configure-app';`.

- [x] **Task 12 [verify]** — Correr Task 9 → verde.

**Commit sugerido**: `fix(bootstrap): extract configureApp so RPI-S10 shutdown-hook wiring is test-enforced`

---

## Work Unit 4 — Regresión y no-regresión de los 3 use-cases de PDF (RPI-R4 · RPI-S6, S7, S8) — sin commit propio

- [x] **Task 13 [verify, no código nuevo]** — Correr `pnpm --filter api test` (o `pnpm test` raíz) + `pnpm --filter
  api typecheck` completos. Confirmar que **ya están cubiertos por la suite existente** (ningún test nuevo requerido
  — la lógica de negocio de los 3 use-cases no cambia, solo cómo se resuelve `PdfGeneratorService` vía DI):
  - **RPI-S6** (asistencia mensual): `api/src/application/asistencia-reporting/__tests__/generate-asistencia-mensual-pdf.use-case.test.ts`
  - **RPI-S7** (tipos de asistencia): `api/src/application/attendance-type/__tests__/generate-attendance-types-pdf.use-case.test.ts`
  - **RPI-S8** (boletines/constancias): `api/src/application/reportes/__tests__/generate-boletin.docente-s2.test.ts`,
    `generate-boletin.terciario.test.ts`, `generate-boletin.inicial.test.ts`,
    `generate-constancia-regular.use-case.test.ts`
  Estos 7 archivos instancian `PdfGeneratorService` con `new` (no vía DI/módulo — confirmado en design.md §"Orden
  TDD" paso 7), por lo que el refactor de Work Unit 2 no los afecta. `api/src/__tests__/app.e2e.test.ts` importa
  `AppModule` completo (que arrastra transitivamente los 3 módulos feature) — su paso en verde es la regresión de
  integración de que el wiring de `ReportingModule` no rompe el árbol de módulos real.
  No requiere commit — es el gate de verificación previo al PR (Task 12 y 13 se corren juntas antes de abrir PR).

---

## Cobertura spec → task

| Requisito | Escenario | Task | Cubierto por |
|---|---|---|---|
| RPI-R1 | RPI-S1 | Task 1 | `reporting.module.test.ts` — stubs A/B === |
| RPI-R2 | RPI-S2 | Task 1 | `reporting.module.test.ts` — sin generatePdf, launch no llamado |
| RPI-R2 | RPI-S3 | Task 1 | `reporting.module.test.ts` — 3 generatePdf secuenciales, launch x1 |
| RPI-R3 | RPI-S4 | Task 1 | `reporting.module.test.ts` — generatePdf + app.close() → close x1 |
| RPI-R3 | RPI-S5 | Task 1 | `reporting.module.test.ts` — instancia aislada sin generatePdf, close() → browser.close NO llamado |
| RPI-R4 | RPI-S6 | Task 13 | suite existente `generate-asistencia-mensual-pdf.use-case.test.ts` (sin cambios) |
| RPI-R4 | RPI-S7 | Task 13 | suite existente `generate-attendance-types-pdf.use-case.test.ts` (sin cambios) |
| RPI-R4 | RPI-S8 | Task 13 | suite existente `generate-boletin.*.test.ts` + `generate-constancia-regular.use-case.test.ts` (sin cambios) |
| RPI-R5 | RPI-S9 | Task 4 | `reporting-module-metadata.test.ts` — Reflect.getMetadata sobre los 3 módulos reales |
| RPI-R6 | RPI-S10 | Task 9 | `configure-app.test.ts` — enableShutdownHooks llamado 1 vez (corrección del hueco TDD) |

Los 10 escenarios (`RPI-S1..S10`) tienen al menos un test nuevo o existente que los ejerce. Ninguno queda sin
cobertura automatizada; no hace falta verificación manual.

---

## Review Workload Forecast

- Líneas estimadas totales: **≈293** (detalle abajo).
  - `reporting.module.ts` (nuevo): ~12
  - `reporting.module.test.ts` (nuevo, S1/S2/S3/S4/S5): ~95
  - `reporting-module-metadata.test.ts` (nuevo, S9): ~40
  - `infrastructure/reporting/index.ts` (+1)
  - `attendance-type.module.ts` (diff, incluye borrar 7 líneas de comentario): ~15
  - `asistencia-reporting.module.ts` (diff): ~6
  - `reportes.module.ts` (diff): ~6
  - `infrastructure/config/configure-app.ts` (nuevo): ~35
  - `infrastructure/config/__tests__/configure-app.test.ts` (nuevo): ~50
  - `main.ts` (diff, extracción de bloque + import): ~33
- Chained PRs recommended: **No** (≈293 < 400).
- 400-line budget risk: **Medium** — la corrección del hueco TDD (Work Unit 3 completa, ~118 líneas no previstas en
  design.md v2, que estimaba ≈141 total) empuja el total de ≈141 a ≈293. Sigue debajo del límite pero con menos
  margen del que asumía el design original; una sub-estimación de +110 líneas en la implementación real cruzaría 400.
- Decision needed before apply: **No** (bajo 400 con el estimado actual), pero se marca como riesgo a vigilar — ver
  `risks` en el entregable de esta fase. Delivery strategy de la sesión: `ask-on-risk` (ya resuelta: no dispara el
  guard con el estimado actual; si `sdd-apply` reporta un diff real que se acerque a 400, debe detenerse y consultar
  antes de continuar).

---

## Orden TDD global (RED antes que GREEN, siempre)

1. Task 1 [RED] → 2 [GREEN] → 3 [GREEN/refactor] — Work Unit 1
2. Task 4 [RED] → 5,6,7 [GREEN] → 8 [verify] — Work Unit 2
3. Task 9 [RED] → 10,11 [GREEN/refactor] → 12 [verify] — Work Unit 3
4. Task 13 [verify] — Work Unit 4, gate final antes de PR
