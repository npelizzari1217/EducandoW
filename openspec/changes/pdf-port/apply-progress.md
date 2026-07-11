# Apply Progress — PDF Port (Inversión de Dependencia, ADR-06)

- Change: `pdf-port`
- Status: **done** — 18/19 tasks completadas (task 19 es opcional, no bloqueante, no ejecutada por criterio del diseño).
- Rama: `refactor/pdf-port` (sobre `refactor/reporting-module-compartido` / PR #107). Sin push, sin PR — commits locales.

## Commits (5, uno por work unit, sin atribución IA)

| Hash | Mensaje |
|------|---------|
| `657abfd` | `feat(reporting): add PdfPort contract and PDF_PORT token` (incluye artefactos SDD del change, hasta entonces untracked) |
| `b62ab40` | `feat(reporting): expose PDF_PORT from ReportingModule via useExisting` |
| `cca8279` | `refactor(reporting): PdfGeneratorService implements PdfPort` |
| `ceeafb0` | `refactor(reporting): invert application dependency on PdfPort (PDP-R2/R3)` |
| `e3b4ec5` | `refactor(reporting): wire feature modules to PDF_PORT` |

## TDD evidence (RED confirmado antes de cada GREEN)

1. **WU1** — `pdf.port.test.ts`: RED = `Cannot find module '../pdf.port'` (archivo no existía). GREEN tras crear `pdf.port.ts`.
2. **WU2** — `reporting.module.test.ts` (+1 it): RED = `Nest could not find Symbol(PDF_PORT) element (this provider does not exist in the current context)`. GREEN tras agregar `{ provide: PDF_PORT, useExisting: PdfGeneratorService }` + export.
3. **WU3** — `pdf-generator.service.test.ts` (+2 it): **bug de test detectado y corregido** — la redacción original del tasks.md ("chequeo de asignabilidad de tipo", `const x: PdfPort = service`) NO puede dar RED nunca: TS structural typing ya hace asignable `PdfGeneratorService` a `PdfPort` hoy (mismo shape de `generatePdf`) sin `implements` explícito, y Vitest transpila con esbuild sin type-check en tiempo de test — confirmado también que `tsc --noEmit` no marcaba error. Se reemplazó por una aserción de inspección de código fuente (mismo patrón que el arch test de WU4): lee `pdf-generator.service.ts` y verifica `class PdfGeneratorService implements ... PdfPort` + import de `GeneratePdfOptions` desde el port + ausencia del `export interface GeneratePdfOptions` local. RED confirmado: 2 tests fallando. GREEN tras el refactor de la clase.
4. **WU4** — `no-infra-pdf-import.arch.test.ts` (nuevo): RED confirmado — 2 aserciones fallando, listando los 4 use-cases que importan el path de infra. Path-based (no name-based) para evitar falso positivo con el JSDoc `PdfGeneratorService.generatePdf` en 2 archivos. GREEN tras repuntar los 4 use-cases a `PdfPort`/`PDF_PORT` + `@Inject`. Suite de los 4 use-cases (+ variantes de boletín): 9 archivos, 158 tests, GREEN — sin tocar la forma de los mocks (PDP-S6).
5. **WU5** — sin test propio (wiring runtime de `inject` arrays en 3 módulos feature); verificado por typecheck limpio + suite completa GREEN.

## Verificación final (WU6)

- `pnpm --filter api test`: **204 archivos / 2083 tests, todos GREEN**. Baseline previo (sesión) 2075/2075 + 8 tests nuevos (WU1: 3, WU2: 1, WU3: 2, WU4: 2) = 2083, coincide exacto. 0 fallos, 0 skips.
- `pnpm --filter api typecheck`: limpio, 0 errores.
- Coverage global (`pnpm test:coverage`): 70.2% statements — por debajo del 80% pero **preexistente, no causado por este diff** (impulsado por `presentation/*` controllers sin unit tests, fuera del scope de `pdf-port`). Coverage acotado a `application/reportes` (los use-cases tocados): 92.96% statements. Los `*.module.ts` de wiring tienen baja cobertura de "Functions" porque los factories `useFactory` no se ejecutan en tests unitarios — patrón preexistente en todo el repo (tests usan `new UseCase(...)` directo), no una regresión de este cambio.
- `git diff --stat refactor/reporting-module-compartido..refactor/pdf-port`: 18 archivos, +712/-38. Descontando los 4 artefactos SDD (design.md 237, proposal.md 71, spec.md 105, tasks.md 106 = 519 líneas), el diff de código+tests es ~193 líneas (estimación original ~138; se disparó por: el fix del bug de test de WU3 sumó ~15 líneas extra de inspección de fuente en vez del check trivial original, y el arch test terminó en 57 líneas vs. 30 estimadas por el helper recursivo `collectTsFiles`). Sigue muy por debajo del budget de 400 → sin `size:exception`, un solo PR.

## Trazabilidad requisito → estado

| Requisito | Escenario | Estado |
|-----------|-----------|--------|
| PDP-R1 | PDP-S1 | GREEN |
| PDP-R2 | PDP-S2 | GREEN |
| PDP-R3 | PDP-S3 | GREEN (paridad estructural vía H2, no test DI-level explícito — task 19 opcional no ejecutada) |
| PDP-R4 | PDP-S4 | GREEN |
| PDP-R5 | PDP-S5 | GREEN |
| PDP-R6 | PDP-S6 | GREEN |

## Artefactos modificados/creados

**Nuevos:**
- `api/src/application/shared/ports/pdf.port.ts`
- `api/src/application/shared/ports/__tests__/pdf.port.test.ts`
- `api/src/application/__tests__/no-infra-pdf-import.arch.test.ts`

**Editados:**
- `api/src/infrastructure/reporting/reporting.module.ts`
- `api/src/infrastructure/reporting/__tests__/reporting.module.test.ts`
- `api/src/infrastructure/reporting/pdf-generator.service.ts`
- `api/src/infrastructure/reporting/__tests__/pdf-generator.service.test.ts`
- `api/src/application/attendance-type/use-cases/generate-attendance-types-pdf.use-case.ts`
- `api/src/application/reportes/generate-constancia-regular.use-case.ts`
- `api/src/application/reportes/generate-boletin.use-case.ts`
- `api/src/application/asistencia-reporting/generate-asistencia-mensual-pdf.use-case.ts`
- `api/src/presentation/reportes/reportes.module.ts`
- `api/src/presentation/asistencia-reporting/asistencia-reporting.module.ts`
- `api/src/presentation/attendance-type/attendance-type.module.ts`
- `openspec/changes/pdf-port/tasks.md` (marcado `[x]` a medida que se completó cada task)

## Pendiente

- Task 19 (opcional, DI-level test con `TestingModule`) — no ejecutada, no bloquea `sdd-verify`.
- Sin push, sin PR — commits locales en `refactor/pdf-port`, listos para `sdd-verify`.

## Riesgos / desviaciones del diseño

- **Bug de test en WU3 (documentado arriba)** — desviación necesaria de la redacción literal de tasks.md/design.md, técnica de reemplazo idéntica a la ya usada en WU4 (source-inspection), sin impacto en el resultado final (PDP-S4 sigue verificado, solo cambia el mecanismo de aserción).
- Ninguna otra desviación del diseño. Los 3 matices confirmados por el orquestador (arch test path-based, `@Inject(PDF_PORT)` documental bajo `useFactory`, JSDoc actualizado) se respetaron tal cual.
