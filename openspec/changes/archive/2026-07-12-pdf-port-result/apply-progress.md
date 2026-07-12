# Apply Progress: pdf-port-result

**Status**: done — 12/12 work units complete, full suite GREEN, typecheck clean.
**Mode**: Strict TDD (RED→GREEN per commit; RED confirmed at runtime where the
production behavior actually diverges, at typecheck level where a pure-propagation
use-case's runtime behavior was already correct due to JS's dynamic typing — see
TDD Cycle Evidence below).
**Delivery**: single PR, **`size:exception`** applied (see Nota de cierre in
`tasks.md` and Risks below) — real diff (~890 lines) exceeds the ~308-line design
estimate and the 400-line budget, but the port's atomicity (design.md §6, ALTO risk)
makes a clean vertical split infeasible without an adapter the design explicitly
rejects as riskier than the size overage.

## TDD Cycle Evidence

| # | Task | Test File | Layer | RED | GREEN | Notes |
|---|------|-----------|-------|-----|-------|-------|
| 1 | 1.1/1.2 | `application/shared/errors/__tests__/pdf.error.test.ts` | Unit | ✅ module not found | ✅ 5/5 passed | New class, leaf |
| 2 | 1.3/1.4 | `application/shared/ports/__tests__/pdf.port.test.ts` | Unit | ✅ typecheck RED (`isOk` on `Buffer`) | ✅ 3/3 passed, 0 typecheck errors | Runtime RED not possible — vitest doesn't type-check; typecheck is the real gate here (documented deviation, matches design intent) |
| 3 | 1.5/1.6 | `infrastructure/reporting/__tests__/pdf-generator.service.test.ts` | Unit | ✅ 4/4 new tests failed (threw instead of resolving err) | ✅ 11/11 passed | Real runtime RED — service actually threw before the fix |
| 4 | 2.1/2.2 | `application/reportes/__tests__/generate-constancia-regular.use-case.test.ts` | Unit | ✅ typecheck RED only (pure propagation — mock port already returned `ok(...)`, so runtime already matched) | ✅ 25/25 passed, 0 typecheck errors | Investigated per "stop if RED passes unexpectedly" rule — confirmed as inherent to pure pass-through (design.md ADR-4 calls this "cero lógica nueva") |
| 5 | 2.3/2.4 | `application/attendance-type/__tests__/generate-attendance-types-pdf.use-case.test.ts` | Unit | ✅ typecheck RED only (same pure-propagation reason) | ✅ 12/12 passed, 0 typecheck errors | |
| 6 | 2.5/2.6 | `generate-asistencia-mensual-pdf.use-case.test.ts` + `.materia.test.ts` | Unit | ✅ typecheck RED only (same reason, 2 entrypoints + shared render) | ✅ 23/23 passed, 0 typecheck errors | |
| 7 | 2.7/2.8 | `application/reportes/__tests__/generate-boletin.use-case.test.ts` | Unit | ✅ 4/4 new tests failed (save called with Result instead of Buffer; err still triggered save; cache-hit returned raw Buffer without `.isOk()`) | ✅ 107/107 passed (4 files) | Real runtime RED — post-process logic actually needed the unwrap→save→ok rewrite |
| 8 | 3.1/3.2 | `application/reportes/__tests__/generate-boletin-batch.use-case.test.ts` | Unit | ✅ 2/2 new tests failed (3 ZIP entries instead of 2 — Result object appended as garbage, exactly the PPR-S10 concern) | ✅ 11/11 passed | Real runtime RED — proved the ADR-5 finding materializes without the fix |
| 9 | 4.1/4.2 | `presentation/shared/http/__tests__/unwrap-result-or-throw.test.ts` | Unit | ✅ module not found | ✅ 2/2 passed | New helper, leaf |
| 10 | 5.1/5.2 | `presentation/reportes/__tests__/reportes.controller.test.ts` | Unit | ✅ 4/4 new tests failed (`Cannot read properties of undefined (reading 'toString')` — Result treated as Buffer) | ✅ 6/6 passed | New test file (didn't exist before) |
| 11 | 5.3/5.4 | `presentation/attendance-type/__tests__/attendance-type.controller.test.ts` + `.e2e.test.ts` | Unit + Integration (real HTTP pipeline) | ✅ 3/3 unit + would-be e2e failures on same TypeError | ✅ 30/30 unit + 15/15 e2e passed | e2e test hits the REAL NestJS pipeline (guards → controller → AppExceptionFilter) — added a new err(PdfError)→real HTTP 500 case |
| 12 | 5.5/5.6 | `presentation/asistencia-reporting/__tests__/asistencia-reporting.controller.test.ts` | Unit | ✅ 5/5 tests failed (2 pre-existing happy-path + 3 new PPR-S8/S9 assertions) | ✅ 11/11 passed | |
| — | (discovered, not in original task list) | `presentation/reportes/__tests__/constancia-controller.test.ts` | Unit | ✅ 2/2 failed on full-suite run (`result.isErr is not a function`) | ✅ 6/6 passed | Legacy T-11 test file, missed during commit 10 because it wasn't found by the initial file search; caught by the mandatory full-suite run before declaring done |

### Test Summary
- **Total tests in touched files**: ~230 (new + modified assertions across 16 test files)
- **Full suite**: 2119/2119 passed, 208/208 files passed (`pnpm --filter api test`)
- **Typecheck**: `tsc --noEmit` — 0 errors
- **Layers used**: Unit (all) + 1 real-HTTP integration test extended (attendance-type e2e)
- **New PdfError/PdfPort/helper unit tests**: 5 + 3 + 2 = 10
- **New PPR-S4/S5 propagation tests across the 5 consumers**: 10 (2 per use-case × 4, +2 for batch's dual-channel test)
- **New PPR-S11/S12/S13 tests (boletin post-process)**: 3
- **New PPR-S8/S9 tests across 3 controllers**: 10 (err+ok per endpoint, 5 endpoints total: getBoletin, createConstanciaRegular, printList, printGeneral, printMateria) + 1 real-HTTP e2e case

## Atomicidad del port — cómo se manejó

`PdfPort.generatePdf` cambia de firma en el commit 2 (`feat(pdf): pdf port returns Result`)
y esto rompe la compilación de TODOS los consumidores (5 use-cases + 3 controllers)
simultáneamente — no existe un estado intermedio compilable. Estrategia aplicada:

1. RED se escribió por archivo, en el orden lógico de las work units (foundation → 4
   use-cases → batch → helper → 3 controllers), verificando el RED real (runtime o
   typecheck, según el caso — ver TDD Cycle Evidence) antes de cada GREEN.
2. Entre el commit 2 (port) y el commit 12 (último controller), el árbol NO compila
   completo — `pnpm typecheck` muestra errores en archivos aún no migrados. Esto es
   esperado y documentado, no un bug.
3. El punto de verificación real fue el ESTADO FINAL, tras el commit 12: `pnpm typecheck`
   limpio y `pnpm --filter api test` completo en verde (2119/2119).
4. Los commits se hicieron en el orden de las work units aunque los intermedios no
   compilaran — cumple la instrucción del prompt de apply.

## Deviaciones de diseño

Ninguna deviación de fondo. Una nota de orden (ya documentada en design.md §4):
el diseño sugería "service primero"; se implementó `PdfError` primero por dependencia
de compilación del propio test del service (el design ya anticipaba y aceptaba esta
posible reordenación menor).

## Riesgos

1. **[ALTO, ya conocido] Atomicidad del port sin chained-PR limpio** — confirmado en
   la práctica: 12 commits secuenciales, árbol intermedio no compilable hasta el final,
   exactamente como predijo design.md §6.
2. **[NUEVO] Presupuesto de 400 líneas excedido (~890 reales vs ~308 estimadas)** —
   `size:exception` aplicado (pre-autorizado por el prompt de apply). Causas
   documentadas en tasks.md "Nota de cierre". NO se introdujo adapter throwaway ni se
   partió el PR — ambas alternativas descartadas explícitamente por design.md §6.
3. **[BAJO, ya conocido] `code` del PdfError no viaja en el body HTTP** — decisión
   consciente de ADR-6 (opción minimalista), no se tocó `AppExceptionFilter`.
4. **[BAJO, ya conocido] Coexistencia throw/Result en cada use-case** — deuda
   transitoria reconocida por ADR-3, follow-up `app-error-model` fuera de este scope.

## Archivos tocados (30, sin openspec)

Producción (10): `pdf.error.ts` (nuevo), `pdf.port.ts`, `pdf-generator.service.ts`,
`generate-constancia-regular.use-case.ts`, `generate-attendance-types-pdf.use-case.ts`,
`generate-asistencia-mensual-pdf.use-case.ts`, `generate-boletin.use-case.ts`,
`generate-boletin-batch.use-case.ts`, `unwrap-result-or-throw.ts` (nuevo),
`reportes.controller.ts`, `attendance-type.controller.ts`, `asistencia-reporting.controller.ts`
(11, corrección: 10 prod + 1 nuevo helper ya contado).

Tests (19): los `__tests__` correspondientes a cada archivo de producción arriba, más
`generate-boletin.docente-s2.test.ts`, `.inicial.test.ts`, `.terciario.test.ts` (mock-only),
`attendance-type.controller.e2e.test.ts`, y el hallazgo `constancia-controller.test.ts`.
