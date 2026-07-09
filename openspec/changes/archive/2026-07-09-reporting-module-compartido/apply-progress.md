# Apply Progress — reporting-module-compartido (issue #101)

Store: hybrid (este archivo + engram `sdd/reporting-module-compartido/apply-progress`).
Estado: **13/13 tasks completadas**. Primera y única tanda.

## Resumen

Los 4 work units de `tasks.md` se ejecutaron en orden TDD estricto (RED confirmado antes de
cada GREEN). 3 commits de código + 1 commit de docs para el checkbox del gate de regresión.

## Work Unit 1 — Shared ReportingModule (Tasks 1-3) — commit `5aa7649`

- **RED**: `api/src/infrastructure/reporting/__tests__/reporting.module.test.ts` (5 tests: RPI-S1..S5)
  falló con `Cannot find module '../reporting.module'` (import error) — `reporting.module.ts` no existía.
- **GREEN**: creado `reporting.module.ts` (`@Module({ providers: [PdfGeneratorService], exports:
  [PdfGeneratorService] })`) + re-export en `index.ts`. 5/5 tests verdes.

## Work Unit 2 — Los 3 módulos feature consumen ReportingModule (Tasks 4-8) — commit `c111f61`

- **RED**: `reporting-module-metadata.test.ts` (6 tests: 3 módulos × `imports`/`providers`) falló —
  `AttendanceTypeModule.imports` no contenía `ReportingModule`; `AsistenciaReportingModule.providers` y
  `ReportesModule.providers` sí contenían `PdfGeneratorService`.
- **GREEN**: los 3 módulos agregan `ReportingModule` a `imports`, quitan `PdfGeneratorService` de
  `providers` (el import de la clase se mantiene, se usa como tipo/token en los `useFactory`).
  `reportes.module.ts` `exports: [BoletinInvalidationService, PdfStorageService]` intacto. Comentario
  de deuda técnica en `attendance-type.module.ts:21-27` eliminado. 6/6 tests verdes.

## Work Unit 3 — Shutdown hooks testeables (Tasks 9-12) — commit `9deb59e`

Corrección deliberada del hueco de TDD en `design.md` (documentada en el header de `tasks.md`):
`app.enableShutdownHooks()` inline en `main.ts` sería GREEN sin RED propio (porque `app.close()` ya
dispara `onModuleDestroy` con o sin el hook registrado). Se extrajo `configureApp(app, config)` a un
archivo NUEVO y SEPARADO de `main.ts` (`api/src/infrastructure/config/configure-app.ts`), porque
`main.ts` llama `bootstrap()` a nivel de módulo sin guard (línea 58 original) — importar `configureApp`
desde `main.ts` en un test hubiera arrancado la app Nest real como efecto secundario del import.

- **RED**: `configure-app.test.ts` (5 tests, doble de `app`) falló con `Cannot find module
  '../configure-app'` — el archivo no existía.
- **GREEN**: creado `configure-app.ts` con `setGlobalPrefix` → `useStaticAssets` → CORS →
  `cookieParser` → `enableShutdownHooks()` (este último es el que exige RPI-S10). `main.ts` pasa a
  llamar `configureApp(app, config)`; Swagger y `app.listen(...)` quedan en `bootstrap()`. Imports
  `join`/`cookieParser` removidos de `main.ts` (migraron a `configure-app.ts`). 5/5 tests verdes.

## Work Unit 4 — Gate de regresión (Task 13) — commit `b25b6d4` (solo docs, sin código nuevo)

- `pnpm --filter api test`: **202 test files / 2075 tests — todos verdes**. Incluye
  `postgres-admin.service.test.ts` (mencionado como baseline flaky pre-existente) — corrió y pasó sin
  intervención en esta corrida; no se observó ninguna de las ~6 fallas de infra pre-existentes que se
  advirtieron de antemano.
- `pnpm --filter api typecheck`: limpio, sin errores.

## Verificación final

- Tests: 202/202 archivos, 2075/2075 tests pasados. 0 fallos (incluido baseline conocido).
- Typecheck: limpio.
- Líneas cambiadas (código, excluyendo `openspec/`): **331 insertions(+), 33 deletions(-)** = 364
  líneas. Con los artefactos SDD incluidos (`openspec/changes/reporting-module-compartido/**`): 971
  insertions(+), 33 deletions(-). Por debajo de 400 → un solo PR, sin necesidad de `size:exception`
  (el estimado de `tasks.md` era ≈293; el real (364, código) quedó ~24% arriba pero sigue bajo el
  límite).

## Commits (orden cronológico)

1. `5aa7649` — `feat(reporting): add shared ReportingModule to dedupe PdfGeneratorService instance`
   (incluye artefactos SDD: proposal/spec/design/tasks)
2. `c111f61` — `refactor(reporting): consume shared ReportingModule from feature modules`
3. `9deb59e` — `fix(bootstrap): extract configureApp so RPI-S10 shutdown-hook wiring is test-enforced`
4. `b25b6d4` — `docs(reporting): mark Task 13 regression gate complete`

## Riesgos / notas para verify

- Ninguna task quedó pendiente. Ningún test nuevo requirió mocks distintos a los ya establecidos en
  el repo (`vi.mock('puppeteer')`).
- El presupuesto de 400 líneas tuvo menos margen del estimado en `tasks.md` (~293 → ~364 real en
  código), coherente con el riesgo "Medium" ya señalado en el Review Workload Forecast del propio
  `tasks.md`. No se cruzó el límite, no se disparó el guard `ask-on-risk`.
