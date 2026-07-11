# Archive Report — reporting-module-compartido (issue #101)

**Fecha de archive**: 2026-07-09 · **Change**: `reporting-module-compartido` ·
**Rama**: `refactor/reporting-module-compartido` (5 commits sobre `main`, sin push)
**Veredicto final**: **PASS WITH WARNINGS** (0 CRITICAL, 1 WARNING, 2 SUGGESTION) → archivado.

---

## Resultado

Se consolidó `PdfGeneratorService` en un único `ReportingModule` compartido (`infrastructure/reporting/`),
importado por los tres módulos feature que antes registraban su propia copia del provider
(`AsistenciaReportingModule`, `ReportesModule`, `AttendanceTypeModule`). Se agregó
`app.enableShutdownHooks()` al bootstrap (vía `configureApp`, extraído de `main.ts`) como pre-requisito
para que el cierre del browser Puppeteer se dispare ante SIGTERM/SIGINT en producción, no solo en tests.

## Capability creada

`openspec/specs/reporting-infrastructure/spec.md` — **capability NUEVA**, no existía antes de este
change. Migra los 6 requisitos y 10 escenarios del delta spec en forma canónica (sin notas de
reconciliación de fases SDD, texto estable):

| Requisito | Escenarios | Estado |
|-----------|-----------|--------|
| RPI-R1 (instancia única de DI) | RPI-S1 | Cumplido, test real |
| RPI-R2 (a lo sumo 1 Browser vivo, lazy) | RPI-S2, RPI-S3 | Cumplido, test real |
| RPI-R3 (shutdown cierra el browser 1 vez) | RPI-S4, RPI-S5 | RPI-S4 cumplido, test real. RPI-S5 cumplido por **inferencia arquitectónica** — ver WARNING abajo |
| RPI-R4 (sin regresión funcional en las 3 features) | RPI-S6, RPI-S7, RPI-S8 | Cumplido, tests existentes sin cambios, siguen verdes |
| RPI-R5 (ningún módulo feature registra el provider) | RPI-S9 | Cumplido, aserción de metadata sobre los 3 módulos reales |
| RPI-R6 (enableShutdownHooks en el bootstrap) | RPI-S10 | Cumplido, test real |

Las capabilities existentes `asistencia-reporting`, `report-cards` y `attendance-types` (contenido de
PDF) **no se modificaron** — son consumidoras del módulo compartido, sin cambios de contenido.

## Deuda / WARNING dejado constancia (no bloqueante)

**RPI-S5 — "destruir un módulo feature en aislamiento no cierra el browser".**
NestJS no expone una API pública para destruir un submódulo mientras la aplicación sigue corriendo, por
lo que el escenario literal del spec no es reproducible de forma aislada con las herramientas del
framework. Se cubre por **inferencia arquitectónica**, no por un test literal:

- `ReportingModule` es el único owner registrado de `PdfGeneratorService` (demostrado por RPI-S9:
  ningún módulo feature lo lista en `providers`).
- Un solo owner ⇒ un solo `onModuleDestroy` para ese provider (demostrado por RPI-S1: instancia única
  compartida, + RPI-S4: el cierre del browser ocurre exactamente una vez al apagar la app completa).
- Por lo tanto, ningún módulo feature individual puede disparar el cierre del browser al ser destruido
  — no posee el provider, no posee su `onModuleDestroy`.

El test implementado (`reporting.module.test.ts`) ejercita una propiedad más débil pero relacionada:
una app aislada que nunca lanzó un browser, cerrada por completo, no invoca `close()` (válido por el
guard `if (this.browserPromise)` de `pdf-generator.service.ts`) — no reproduce el escenario literal de
"destruir un módulo mientras los otros dos siguen vivos en el mismo proceso". Esta constancia queda
también en `openspec/specs/reporting-infrastructure/spec.md`, nota bajo RPI-S5, para que quede
explícita y no escondida.

## Commits (rama `refactor/reporting-module-compartido`, sin push)

| Commit | Mensaje |
|--------|---------|
| `5aa7649` | `feat(reporting): add shared ReportingModule to dedupe PdfGeneratorService instance` |
| `c111f61` | `refactor(reporting): consume shared ReportingModule from feature modules` |
| `9deb59e` | `fix(bootstrap): extract configureApp so RPI-S10 shutdown-hook wiring is test-enforced` |
| `b25b6d4` | `docs(reporting): mark Task 13 regression gate complete` |
| `bbb0927` | `docs(reporting): record apply-progress for reporting-module-compartido` |

Ninguno contiene "Co-Authored-By" ni atribución de IA (confirmado en verify vía grep).

## Tests

- `pnpm --filter api test`: **202/202 archivos, 2075/2075 tests, 0 fallos, 0 skips** (51.29s, corrida
  real confirmada en verify).
- `pnpm --filter api typecheck`: limpio, 0 errores.
- Los 13 tasks de `tasks.md` verificados contra el código real (no solo el checklist), 4 work units.

## Follow-ups (registrados, NO implementados en este change)

1. **Introducir `PdfPort`** (token `Symbol`) en `application/` + implementación concreta en
   `infrastructure/`, y hacer que los 4 use-cases (`GenerateAsistenciaMensualPdfUseCase`,
   `GenerateAttendanceTypesPdfUseCase`, `GenerateBoletinUseCase`, `GenerateConstanciaRegularUseCase`)
   inyecten el port en vez de la clase concreta `PdfGeneratorService` → resuelve la violación de ADR-06
   del proyecto (application importa infraestructura concreta). Este era el enfoque **(c)** evaluado
   durante `sdd-design` y descartado explícitamente por scope — no forma parte de
   `reporting-module-compartido`. Ticket separado.
2. **Reforzar RPI-S5 con un test literal** si en algún momento NestJS (o un mecanismo propio del repo)
   permite destruir/desmontar un submódulo sin cerrar la aplicación completa. Hoy no es alcanzable con
   las herramientas del framework — ver WARNING arriba.

## Trazabilidad (observation IDs en engram, `project: educandow`)

| Artefacto | topic_key | observation ID |
|-----------|-----------|-----------------|
| Proposal | `sdd/reporting-module-compartido/proposal` | #1763 |
| Spec (delta) | `sdd/reporting-module-compartido/spec` | #1764 |
| Design | `sdd/reporting-module-compartido/design` | #1765 |
| Tasks | `sdd/reporting-module-compartido/tasks` | #1767 |
| Apply progress | `sdd/reporting-module-compartido/apply-progress` | #1769 |
| Verify report | `sdd/reporting-module-compartido/verify-report` | #1770 |
| Archive report | `sdd/reporting-module-compartido/archive-report` | (este documento — ver mem_save) |

## Estado final de `openspec/changes/`

Solo queda `openspec/changes/archive/` — no hay ningún change activo en curso. El change completo
(proposal, spec delta, design, tasks, apply-progress, verify-report, archive-report) vive en
`openspec/changes/archive/2026-07-09-reporting-module-compartido/`.
