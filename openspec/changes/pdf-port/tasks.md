# Tasks — PDF Port (Inversión de Dependencia, ADR-06)

- Change: `pdf-port`
- Store: hybrid (engram `sdd/pdf-port/tasks` + este archivo)
- Lee: `specs/spec.md` (PDP-R1..R6 / PDP-S1..S6) + `design.md` (§8 Orden TDD, §7 wiring, §9 estimación)
- Orden: TDD estricto — RED antes que GREEN, en el orden exacto de `design.md §8`.
- `strict_tdd: true` · `test_command: pnpm test` · coverage ≥ 80%.
- Delivery strategy: `ask-on-risk`.

---

## Checklist

### WU1 — Contrato `PdfPort` (PDP-R1 / PDP-S1)

- [x] 1. **RED** — nuevo `api/src/application/shared/ports/__tests__/pdf.port.test.ts`: asegura que el módulo exporta la interface `PdfPort` (`generatePdf(html: string, options?: GeneratePdfOptions): Promise<Buffer>`), la constante `PDF_PORT` (symbol) y el tipo `GeneratePdfOptions`. Falla: el archivo `pdf.port.ts` no existe. → PDP-S1.
- [x] 2. **GREEN** — nuevo `api/src/application/shared/ports/pdf.port.ts`: exporta `PdfPort`, `PDF_PORT = Symbol('PDF_PORT')`, `GeneratePdfOptions` (`landscape?: boolean`, `margin?: Partial<{top,bottom,left,right}>`). Sin `@Injectable` (application puro). Deja verde la task 1. → PDP-S1 GREEN.

### WU2 — Instancia única vía `ReportingModule` (PDP-R5 / PDP-S5)

- [x] 3. **RED** — editar `api/src/infrastructure/reporting/__tests__/reporting.module.test.ts`: agregar `it('resolves PDF_PORT and PdfGeneratorService to the same instance (PDP-S5)', ...)`, reusando el mock de `puppeteer` y el `beforeEach` ya presentes; `expect(moduleRef.get(PDF_PORT)).toBe(moduleRef.get(PdfGeneratorService))`. Falla: `PDF_PORT` aún no lo provee `ReportingModule`. → PDP-S5.
- [x] 4. **GREEN** — editar `api/src/infrastructure/reporting/reporting.module.ts`: importar `PDF_PORT` desde `../../application/shared/ports/pdf.port`; agregar `{ provide: PDF_PORT, useExisting: PdfGeneratorService }` a `providers` (NO `useClass` — crearía un segundo `PdfGeneratorService`/segundo `Browser`, rompe RPI-R1 de #107); agregar `PDF_PORT` a `exports`. Deja verde la task 3. → PDP-S5 GREEN.

### WU3 — Infra implementa el port (PDP-R4 / PDP-S4)

- [x] 5. **RED** — editar `api/src/infrastructure/reporting/__tests__/pdf-generator.service.test.ts`: agregar aserción de que `PdfGeneratorService implements PdfPort` (chequeo de asignabilidad de tipo) y de que `GeneratePdfOptions` se importa desde `application/shared/ports/pdf.port` (no definición propia). Falla contra el código actual. → PDP-S4.
  - **Nota de ejecución (bug de test detectado y corregido):** la redacción literal ("chequeo de asignabilidad de tipo", ej. `const x: PdfPort = service`) NO puede dar RED — TS structural typing ya hace asignable `PdfGeneratorService` a `PdfPort` hoy (mismo shape) sin `implements`, y Vitest transpila con esbuild sin type-check en tiempo de test (tampoco `tsc --noEmit` marcaba error). Se implementó en su lugar una aserción por inspección de código fuente (mismo patrón que el arch test de WU4): lee `pdf-generator.service.ts` y verifica `class PdfGeneratorService implements ... PdfPort` + import de `GeneratePdfOptions` desde `application/shared/ports/pdf.port` + ausencia de `export interface GeneratePdfOptions` local. RED confirmado (2 tests fallando) antes del refactor.
- [x] 6. **GREEN** — editar `api/src/infrastructure/reporting/pdf-generator.service.ts`: `class PdfGeneratorService implements PdfPort, OnModuleDestroy` (se SUMA a `OnModuleDestroy`, no lo reemplaza — fuera de alcance tocar el lifecycle); borrar el `export interface GeneratePdfOptions {...}` local; agregar `import type { PdfPort, GeneratePdfOptions } from '../../application/shared/ports/pdf.port'`. Deja verde la task 5. → PDP-S4 GREEN.

### WU4 — Inversión de dependencia en los 4 use-cases + arch test (PDP-R2 / PDP-R3 / PDP-S2 / PDP-S3)

- [ ] 7. **RED** — nuevo `api/src/application/__tests__/no-infra-pdf-import.arch.test.ts`: lee recursivamente `*.ts` bajo `api/src/application` (excluye `__tests__`).
  - Aserción **primaria** (robusta, path-based): ninguna línea de import matchea `FORBIDDEN_PATH = /from\s+['"][^'"]*infrastructure\/reporting\/pdf-generator\.service['"]/`.
  - Aserción **secundaria**: ninguna línea que empiece con `import` matchea `FORBIDDEN_IMPORT = /^\s*import\b[^;]*\bPdfGeneratorService\b/m` (restringido a líneas `import`, NO un `\bPdfGeneratorService\b` a secas sobre todo el archivo).
  - **CRÍTICO**: NO implementar como búsqueda del nombre de clase `PdfGeneratorService` sin restringir a la línea de import. El JSDoc de `generate-attendance-types-pdf.use-case.ts:13` y `generate-asistencia-mensual-pdf.use-case.ts:14` contiene el texto literal `PdfGeneratorService.generatePdf` en un comentario — un test por-nombre-de-clase matchearía esos comentarios y quedaría en rojo PARA SIEMPRE, incluso después del refactor. La aserción primaria debe ser por PATH del import.
  - Falla hoy: los 4 use-cases importan la clase. → PDP-S2.
- [ ] 8. **GREEN** — editar `api/src/application/attendance-type/use-cases/generate-attendance-types-pdf.use-case.ts`: quitar `import { PdfGeneratorService } from '../../../infrastructure/reporting/pdf-generator.service'`; agregar `import { Inject } from '@nestjs/common'` (si falta) + `import { PdfPort, PDF_PORT } from '../../shared/ports/pdf.port'` (un `../` extra — el archivo vive un nivel más profundo, en `use-cases/`); constructor: `@Inject(PDF_PORT) private readonly pdfGenerator: PdfPort`. **Higiene**: corregir el JSDoc línea 13 — `PdfGeneratorService.generatePdf(html)` → `PdfPort.generatePdf(html)`. → PDP-R3 (este use-case).
- [ ] 9. **GREEN** — mismo patrón en `api/src/application/reportes/generate-constancia-regular.use-case.ts`. → PDP-R3.
- [ ] 10. **GREEN** — mismo patrón en `api/src/application/reportes/generate-boletin.use-case.ts`. → PDP-R3.
- [ ] 11. **GREEN** — mismo patrón en `api/src/application/asistencia-reporting/generate-asistencia-mensual-pdf.use-case.ts`. **Higiene**: corregir el JSDoc línea 14 — `PdfGeneratorService.generatePdf` → `PdfPort.generatePdf`. → PDP-R3.
- [ ] 12. **VERIFY** — tras 8-11, confirmar que el arch test de la task 7 (PDP-S2) queda en verde y que PDP-S3 se sostiene (cada use-case resuelve `PdfPort` por token, sin provider bajo la clase).

### WU5 — Wiring runtime en los 3 módulos feature (PDP-R5 completado en runtime · PDP-S6 sin regresión)

> Nota (R2 del design, anotado para quien lea el módulo después): con `useFactory`, Nest NO lee `@Inject` del constructor — resuelve el array `inject` posicionalmente. Lo que invierte la dependencia en runtime es cambiar el `inject` array de estos 3 módulos, no el `@Inject(PDF_PORT)` del use-case (ese es documental/future-proof bajo `useFactory`, se agrega igual porque el spec lo exige y es inocuo).

- [ ] 13. **GREEN** — editar `api/src/presentation/reportes/reportes.module.ts`: quitar `import { PdfGeneratorService } from '../../infrastructure/reporting/pdf-generator.service'`; agregar `import { PdfPort, PDF_PORT } from '../../application/shared/ports/pdf.port'`; en el provider de `GenerateBoletinUseCase` — param del factory `pdfGen: PdfGeneratorService` → `pdfGen: PdfPort`, `inject: [PdfGeneratorService, ...]` → `inject: [PDF_PORT, ...]`; en el provider de `GenerateConstanciaRegularUseCase` — mismo cambio (2 factories en este módulo).
- [ ] 14. **GREEN** — editar `api/src/presentation/asistencia-reporting/asistencia-reporting.module.ts`: mismo patrón, 1 factory (`GenerateAsistenciaMensualPdfUseCase`).
- [ ] 15. **GREEN** — editar `api/src/presentation/attendance-type/attendance-type.module.ts`: mismo patrón, 1 factory (`GenerateAttendanceTypesPdfUseCase`).

### WU6 — Verificación final (sin diff de producción)

- [ ] 16. **VERIFY** — `pnpm test` (raíz) o `pnpm --filter api test`: confirmar suite completa en verde, en particular SIN tocar su código fuente: `generate-attendance-types-pdf.use-case.test.ts`, `generate-asistencia-mensual-pdf.use-case.test.ts`, `generate-asistencia-mensual-pdf.use-case.materia.test.ts`, `generate-constancia-regular.use-case.test.ts`, `generate-boletin.use-case.test.ts` (+ variantes que instancian el mismo use-case: `generate-boletin.docente-s2.test.ts`, `generate-boletin.terciario.test.ts`, `generate-boletin.inicial.test.ts`, `generate-boletin-batch.use-case.test.ts`) — todos con el mock `{ generatePdf: vi.fn() }` intacto. → PDP-S6.
- [ ] 17. **VERIFY** — `pnpm --filter api typecheck` sin errores (el cambio de tipo `PdfGeneratorService`→`PdfPort` en factories y use-cases debe tipar limpio).
- [ ] 18. **VERIFY** — coverage ≥ 80% (comando cacheado `pnpm test` / `test:coverage`).

### Opcional (no computado en la estimación de líneas, fuera del critical path)

- [ ] 19. **OPCIONAL** — test DI-level con `TestingModule` + `{ provide: PDF_PORT, useValue: { generatePdf: vi.fn() } }` para paridad literal con la redacción de PDP-S3 (el spec lo describe así, pero los tests reales de use-case instancian con `new` + mock estructural — H2 del design — y ya cubren el requisito sin este test adicional). A criterio de quien aplique; no bloquea ninguna task previa.

---

## Cobertura spec → task

| Requisito | Escenario | Tasks |
|-----------|-----------|-------|
| PDP-R1 | PDP-S1 | 1, 2 |
| PDP-R2 | PDP-S2 | 7, 8, 9, 10, 11, 12 |
| PDP-R3 | PDP-S3 | 8, 9, 10, 11, 12 (+ 19 opcional) |
| PDP-R4 | PDP-S4 | 5, 6 |
| PDP-R5 | PDP-S5 | 3, 4, 13, 14, 15 |
| PDP-R6 | PDP-S6 | 16 |

---

## Work units / commits (conventional, sin atribución IA)

| WU | Tasks | Mensaje de commit sugerido |
|----|-------|------------------------------|
| WU1 | 1, 2 | `feat(reporting): add PdfPort contract and PDF_PORT token` |
| WU2 | 3, 4 | `feat(reporting): expose PDF_PORT from ReportingModule via useExisting` |
| WU3 | 5, 6 | `refactor(reporting): PdfGeneratorService implements PdfPort` |
| WU4 | 7, 8, 9, 10, 11, 12 | `refactor(reporting): invert application dependency on PdfPort (PDP-R2/R3)` |
| WU5 | 13, 14, 15 | `refactor(reporting): wire feature modules to PDF_PORT` |
| WU6 | 16, 17, 18 | (sin commit propio — verificación previa al push/PR; si se quiere dejar rastro: `chore(reporting): verify pdf-port refactor — tests, typecheck, coverage`) |

Cada WU es un cambio lógico coherente (test + código que lo satisface viajan juntos, por convención `work-unit-commits`). Secuencial: WU1 → WU2 → WU3 → WU4 → WU5 → WU6 (WU2 y WU3 dependen de WU1 vía el import de `pdf.port.ts`; WU4 depende de WU1; WU5 depende de WU4). Sin paralelismo real entre WUs — dependencia lineal por diseño (todas cuelgan del mismo port). Dentro de WU4, las tasks 8-11 (4 use-cases) SÍ son independientes entre sí y paralelizables si hay más de un ejecutor; igual con 13-15 en WU5.

---

## Review Workload Forecast

- **Estimación total de líneas**: ~138 (producción ~61 + tests ~77), heredada de `design.md §9`.
- **Chained PRs recommended**: No.
- **400-line budget risk**: Low (~138 / 400 ≈ 35% del budget).
- **Decision needed before apply**: No — cabe en UN SOLO PR sin `size:exception`.
- **Delivery strategy aplicable**: `ask-on-risk` (cacheada) — no se dispara el guard porque no hay riesgo de budget ni de PR encadenado.

---

## Fuera de alcance (heredado del spec/design)

- `Result<Buffer, PdfError>` en el port.
- `onModuleDestroy` como parte del contrato del port.
- Unificar la convención de tokens legados (`'AttendanceTypeRepository'` string-literal en `attendance-type.module.ts` queda intacta — no forma parte de este change).
