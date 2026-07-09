# Verify Report — reporting-module-compartido (issue #101)

**Fecha**: 2026-07-09 · **Rama**: `refactor/reporting-module-compartido` (5 commits sobre `main`)
**Veredicto**: **PASS WITH WARNINGS**

---

## PRIORIDAD 1 — Discrepancia de tests (resuelta empíricamente)

Corrida real (`pnpm --filter api test`, este entorno, ahora): **202/202 archivos, 2075/2075 tests, 0 fallos, 0 skips.**
`Duration 51.29s`. El "202/202, 0 fallos" reportado por `sdd-apply` es **REAL**, no un artefacto de tests no ejecutados.

Investigación de los ~6 tests supuestamente "siempre fallan por infra":
- `postgres-admin.service.test.ts` (5 tests) y `ensure-institution-levels.test.ts` (4 tests) **corrieron y pasaron**
  (confirmado vía `--reporter=verbose`, nombre por nombre).
- Ninguno de los dos archivos tiene `describe.skipIf`/`it.skip`/guard condicional — grep confirmó cero matches.
- Ambos mockean su dependencia de infraestructura completa: `postgres-admin.service.test.ts` mockea `pg.Pool` y
  `child_process.exec`; `ensure-institution-levels.test.ts` mockea `@prisma/client` entero. **Ninguno de los dos
  abre una conexión real a Postgres** — son unit tests puros con dobles, no integration tests.
- Sí hay Postgres real corriendo en esta máquina (`educandow-db` en :5433, `soporte-postgres-master` en :5432,
  ambos `Up`/`healthy`), pero es irrelevante para estos dos archivos dado el mock completo.

**Veredicto**: el baseline "~6 tests que fallan siempre por infra" que citó el orquestador **no aplica a este
estado del repo**. Puede ser una referencia a otra suite (e2e con DB real) o estar desactualizada. El "0 fallos"
de `sdd-apply` es válido y verificable.

`pnpm --filter api typecheck` → limpio, sin salida (0 errores).

---

## PRIORIDAD 2 — Cobertura de escenarios RPI-S1..S10

| Escenario | Test real | ¿Prueba lo que dice? |
|---|---|---|
| RPI-S1 (identidad `===`) | `reporting.module.test.ts` — `ConsumerAModule`/`ConsumerBModule` con `useExisting: PdfGeneratorService`, `expect(get('A_PDF')).toBe(get('B_PDF'))` | **Sí.** No es trivial: si `ReportingModule` no exportara el provider, `useExisting` en cada consumer no podría resolver `PdfGeneratorService` fuera de su propio scope → `Test.createTestingModule(...).compile()` lanzaría `UnknownDependenciesException` antes de llegar al `expect`. El test SÍ fallaría (con error, no con `!==`) si se rompe la invariante. |
| RPI-S2 (sin `launch` al bootear) | `reporting.module.test.ts` — `app.init()` sin llamar `generatePdf`, `expect(mockLaunch).not.toHaveBeenCalled()` | **Sí**, aserción directa y real. |
| RPI-S3 (un solo `launch` en 3 generaciones) | `reporting.module.test.ts` — 3x `svc.generatePdf(...)` secuenciales, `expect(mockLaunch).toHaveBeenCalledTimes(1)` | **Sí**, cuenta invocaciones reales sobre el mock. |
| RPI-S4 (browser cerrado 1 vez) | `reporting.module.test.ts` — `generatePdf` (fuerza lazy-launch) + `app.close()`, `expect(mockBrowser.close).toHaveBeenCalledTimes(1)` | **Sí.** |
| RPI-S5 (destruir módulo feature aislado NO cierra browser) | `reporting.module.test.ts` — `Test.createTestingModule({imports:[ReportingModule]})` **aislado y separado**, nunca llama `generatePdf`, `app.close()` → `expect(mockBrowser.close).not.toHaveBeenCalled()` | **Parcial — ver WARNING abajo.** El test NO reproduce el escenario literal del spec (destruir UN módulo feature mientras los otros dos siguen vivos en el mismo proceso). Prueba una propiedad más débil: una app completamente aislada que nunca lanzó un browser, al cerrarse del todo, no llama `close()` — trivial dado el guard `if (this.browserPromise)` que ya existe en `pdf-generator.service.ts`. No hay artefacto de test que demuestre "un browser vivo compartido sigue vivo tras destruir un solo consumer". |
| RPI-S6 (asistencia mensual) | `generate-asistencia-mensual-pdf.use-case.test.ts` (sin cambios) | **Sí**, aunque `PdfGeneratorService` está mockeado como doble plano en el test (no vía DI real) — correcto: el refactor de DI wiring no afecta la lógica del use case, que es lo que este test cubre. |
| RPI-S7 (tipos de asistencia) | `generate-attendance-types-pdf.use-case.test.ts` (sin cambios) | **Sí**, mismo patrón. |
| RPI-S8 (boletín/constancia) | `generate-boletin.docente-s2.test.ts`, `generate-boletin.terciario.test.ts`, `generate-boletin.inicial.test.ts`, `generate-constancia-regular.use-case.test.ts` (sin cambios) | **Sí**, mismo patrón. |
| RPI-S9 (metadata de los 3 módulos reales) | `reporting-module-metadata.test.ts` — `Reflect.getMetadata('imports'\|'providers', X)` sobre `AttendanceTypeModule`, `AsistenciaReportingModule`, `ReportesModule` **importados directamente desde `presentation/`** (no stubs) | **Sí**, confirmado por lectura del import: son las clases reales, `it.each` sobre las 3. |
| RPI-S10 (`enableShutdownHooks` invocado) | `configure-app.test.ts` — doble de `app` con `enableShutdownHooks: vi.fn()`, `expect(app.enableShutdownHooks).toHaveBeenCalledOnce()` | **Sí, confirmado leyendo el código de producción.** `configure-app.ts` tiene una sola línea `app.enableShutdownHooks();` al final de `configureApp`. Si se borra esa línea, el test falla (0 llamadas vs 1 esperada) — no hay ninguna otra vía en el archivo que dispare esa aserción. |

---

## PRIORIDAD 3 — Verificaciones estructurales

- Los 3 módulos feature (`attendance-type.module.ts`, `asistencia-reporting.module.ts`, `reportes.module.ts`)
  importan `ReportingModule` y NO declaran `PdfGeneratorService` en `providers` — confirmado leyendo los 3 archivos
  completos.
- `reportes.module.ts` conserva `exports: [BoletinInvalidationService, PdfStorageService]` intacto.
- El comentario de deuda técnica en `attendance-type.module.ts` (líneas 21-27 originales, citando `design.md §9`)
  fue eliminado — confirmado, el archivo actual no lo contiene.
- `main.ts` delega en `configureApp(app, config)`; ya no duplica prefix/staticAssets/CORS/cookieParser inline.
  `configure-app.ts` solo define y exporta la función — sin `bootstrap()` ni `listen()` a nivel de módulo, sin
  efectos de importación.
- `app.enableShutdownHooks()` está presente y es la última línea de `configureApp`, en el camino real de bootstrap
  (`main.ts` → `bootstrap()` → `configureApp(app, config)`).
- `git log main..HEAD` — 5 commits, ninguno contiene "Co-Authored-By" ni atribución de IA (grep vacío).
- `pnpm --filter api typecheck` → verde, sin errores.
- **Clean-arch — ubicación de `configure-app.ts`**: vive en `api/src/infrastructure/config/configure-app.ts`, no en
  `api/src/` como sugería `tasks.md` en su descripción prosa inicial. **Aceptable y correcto**: es wiring de
  bootstrap sin I/O real, mismo patrón que `infrastructure/config/env.config.ts` ya establecido en el repo;
  cumple la regla del proyecto "el wiring de DI vive en `infrastructure/`". La discrepancia es de redacción en
  `tasks.md` (que en su propio detalle de implementación sí especifica la ruta correcta bajo
  `infrastructure/config/`), no del código.

---

## PRIORIDAD 4 — Scope

Confirmado por `git diff main..HEAD -- api/src`: cero apariciones de `PdfPort` o `Symbol(`. `PdfGeneratorService`
no cambió de capa (sigue en `infrastructure/reporting/`). Los 4 use-cases de `application/` siguen importando la
clase concreta (ADR-06 no tocado, según diseño). Nada fuera de scope detectado.

---

## Hallazgos

### CRITICAL
Ninguno.

### WARNING
1. **RPI-S5 no prueba el escenario literal del spec.** El spec (`RPI-S5`) describe "destruir un módulo feature
   individual mientras los otros dos siguen vivos, sin shutdown completo de la app" → el browser compartido no
   debe cerrarse. El test implementado ejercita una app *aislada y separada* que nunca generó un PDF, cerrada por
   completo — una propiedad más débil (el guard `if(this.browserPromise)` ya existente). No es un fallo de
   ejecución: `tasks.md`/`design.md` documentan explícitamente esta decisión (NestJS no expone una API pública
   para "destruir un submódulo mientras la app sigue corriendo", así que el escenario literal no es testeable de
   forma aislada con las herramientas del framework). Recomendado para el archive: dejar constancia explícita de
   que RPI-S5 se cubre por *inferencia arquitectónica* (un solo owner del provider ⇒ ningún módulo feature puede
   disparar su `onModuleDestroy`) + el guard de clase, no por un test que reproduzca el escenario tal como está
   redactado. No bloquea el archive porque la garantía real (browser único, un solo `onModuleDestroy`) sí está
   demostrada por RPI-S1 + RPI-S4 en conjunto.

### SUGGESTION
1. Ninguna acción de código requerida. Si en el futuro se agrega un mecanismo de destrucción parcial de submódulos
   (fuera de scope hoy), reforzar RPI-S5 con un test que lo ejercite literalmente.
2. `tasks.md` describe la ubicación de `configure-app.ts` de forma ambigua en su resumen inicial ("archivo NUEVO...
   no dentro de `main.ts`" sin mencionar la carpeta) aunque el detalle técnico posterior sí la fija correctamente
   en `infrastructure/config/`. Sin impacto — el código quedó donde correspondía.

---

## Tasks vs código

Los 13 tasks de `tasks.md` están marcados `[x]` y el código coincide con cada uno tras inspección directa:
WU1 (Tasks 1-3), WU2 (Tasks 4-8), WU3 (Tasks 9-12), WU4 (Task 13) — todos verificados contra archivos reales,
no solo contra el checklist.

## Resultado de test/typecheck (esta corrida)

- `pnpm --filter api test`: **202 archivos / 2075 tests, 0 fallos, 0 skips** (51.29s).
- `pnpm --filter api typecheck`: **limpio**.
