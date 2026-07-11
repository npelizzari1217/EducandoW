# Verify Report — PDF Port (Inversión de Dependencia, ADR-06)

- Change: `pdf-port`
- Branch: `refactor/pdf-port` (stacked on `refactor/reporting-module-compartido`, PR #107)
- Verified: 2026-07-11
- **Veredicto: PASS WITH WARNINGS**

---

## Prioridad 1 — Desviaciones reportadas por apply

### (A) Test de WU3 (PDP-S4) — técnica cambiada de type-assignability a source-inspection

**Veredicto: LEGÍTIMA. No debilita PDP-S4.**

Verificación empírica propia (no solo lectura del razonamiento de apply): escribí un archivo
temporal en `api/src/application/shared/ports/__tests__/_tmp_verify_structural.ts` con una clase
`FakePdfGeneratorService` que **no** declara `implements PdfPort` pero tiene la misma forma
(`generatePdf(html, options?): Promise<Buffer>`), y le asigné `const x: PdfPort = new
FakePdfGeneratorService()`. Corrí `pnpm --filter api typecheck` → **0 errores**. Esto confirma
que el structural typing de TS hace asignable CUALQUIER clase con la misma forma a `PdfPort`, sin
`implements`, y que un `const x: PdfPort = service` en un test Vitest jamás daría RED (esbuild
no type-checka en tiempo de test). El argumento de apply es correcto. Archivo temporal borrado
tras la verificación, working tree limpio.

El test de reemplazo (`pdf-generator.service.test.ts`, 2 `it` nuevos) SÍ detecta las dos
regresiones que importan:
- `expect(source).toMatch(/class\s+PdfGeneratorService\s+implements[^{]*\bPdfPort\b/)` — falla si
  se borra `implements PdfPort` (probado por inspección: el regex exige el identificador `PdfPort`
  en la cláusula `implements`, indistinto del orden con `OnModuleDestroy`).
- `expect(source).not.toMatch(/export\s+interface\s+GeneratePdfOptions/)` + el `toMatch` del import
  — falla si infra redefine `GeneratePdfOptions` localmente o dejara de importarla del port.

Sobre la firma exacta de `generatePdf` (que el spec también exige "estructuralmente idéntica"):
NO la chequea el test de Vitest, pero SÍ la impone el propio compilador vía la cláusula
`implements PdfPort` — si la firma de `PdfGeneratorService.generatePdf` divergiera del contrato,
`pnpm --filter api typecheck` fallaría (TS2420). La combinación test-de-fuente (Vitest, gate
`pnpm test`) + `implements`-enforcement (gate `pnpm typecheck`) cubre el requisito completo de
PDP-S4 sin dejar ventana abierta. Mismo patrón que el arch test de WU4 (path-based, ya validado
en PR #107-style).

### (B) Coverage global 70.2% < 80%

**Veredicto: WARNING, pre-existente, NO regresión de este change.**

Corrido personalmente (`pnpm --filter api test:coverage` en `refactor/pdf-port`):
```
Statements   : 70.2% ( 5974/8509 )
Branches     : 55.55% ( 2496/4493 )
Functions    : 64.31% ( 1278/1987 )
Lines        : 72.16% ( 5247/7271 )
```
Comparado contra la BASE `refactor/reporting-module-compartido` (worktree temporal, mismo
comando, `node_modules` symlinkeado — sin cambios de dependencias entre ramas, confirmado con
`git diff --stat` sobre `pnpm-lock.yaml`/`package.json` = vacío):
```
Statements   : 70.2% ( 5973/8508 )
```
**Coverage global IDÉNTICO (70.2% en ambas ramas).** El delta absoluto es exactamente +1
statement / +1 statement cubierto — el único statement nuevo real es la constante
`export const PDF_PORT = Symbol(...)` en `pdf.port.ts` (las interfaces `PdfPort`/`GeneratePdfOptions`
son type-only, se borran en runtime, no cuentan como statements). Esto confirma matemáticamente
que el gap es 100% preexistente y estructural (impulsado por `presentation/*` controllers sin
tests unitarios), no introducido por este diff.

Cobertura puntual de los archivos tocados/nuevos (HTML report, `api/coverage/`):

| Archivo | Statements |
|---|---|
| `application/shared/ports/pdf.port.ts` | 100% |
| `infrastructure/reporting/reporting.module.ts` | 100% |
| `infrastructure/reporting/pdf-generator.service.ts` | 83.33% (líneas 47-48, 73-78: catch de error log y retry de `launch()`, no tocadas por este refactor) |
| `application/reportes` (dir, 3 use-cases) | 92.96% |
| `application/asistencia-reporting` (dir) | 97.36% |
| `application/attendance-type/use-cases` (dir) | 99.14% |

**Clasificación: WARNING**, no CRITICAL — el diff de este change está bien cubierto (83-100%
en todo lo tocado); el bache global es deuda preexistente fuera de scope (confirmado, no solo
alegado). No bloquea archive por sí solo, pero el target ≥80% del `test_command` global sigue sin
cumplirse — anotar como ticket de deuda de coverage separado para `presentation/*`.

---

## Prioridad 2 — Cobertura de escenarios spec → test

| Escenario | Test | ¿Prueba lo que dice? |
|---|---|---|
| PDP-S1 | `pdf.port.test.ts` | Sí, con matiz: el chequeo de forma de `PdfPort`/`GeneratePdfOptions` vía anotación de tipo es type-erased en Vitest (esbuild); lo que realmente lo hace RED-capable es la combinación con `pnpm typecheck` (mismo patrón que S4). `typeof PDF_PORT === 'symbol'` sí es un chequeo runtime genuino. |
| PDP-S2 | `no-infra-pdf-import.arch.test.ts` | Sí. Path-based sobre TODO el árbol `application/` (excluye `__tests__`), detecta cualquiera de los 4 use-cases individualmente si se revierte uno solo (recorre archivo por archivo, no agrega en un solo booleano). Evita falso positivo del JSDoc con "PdfGeneratorService.generatePdf" en comentario (restringido a líneas `import`). |
| PDP-S3 | Constructores de los 4 use-cases (`@Inject(PDF_PORT) pdfGenerator: PdfPort`, confirmado por lectura directa) + `inject: [PDF_PORT, ...]` en los 3 módulos feature (confirmado en los 3 archivos). El test DI-level literal (`TestingModule` + `useValue`) quedó como task 19 OPCIONAL, sin marcar — decisión legítima documentada en design.md (H2): los tests reales de use-case (`new UseCase(mockPdfPort)`) ya prueban que el constructor resuelve `PdfPort` sin requerir provider por clase. |
| PDP-S4 | Ver Prioridad 1(A). Legítimo. |
| PDP-S5 | `reporting.module.test.ts`, nuevo `it` — `expect(moduleRef.get(PDF_PORT)).toBe(moduleRef.get(PdfGeneratorService))`. Confirmado que rompería con `useClass` (instanciaría un segundo `PdfGeneratorService`, referencia distinta → `toBe` fallaría). |
| PDP-S6 | Los 4 use-case tests (`generate-boletin.use-case.test.ts` spot-checked línea por línea) siguen mockeando `{ generatePdf: vi.fn().mockResolvedValue(...) }` sin `import` de `PdfGeneratorService` — forma de mock intacta. Suite completa: 204/204 archivos, 2083/2083 tests GREEN. |

---

## Prioridad 3 — Estructural

- `git diff --stat refactor/reporting-module-compartido..HEAD -- . ':!openspec'`: **14 archivos, 193 insertions(+), 38 deletions(-)** — bajo el budget de 400 líneas (~48%), sin chained-PR, sin `size:exception`. Coincide con la estimación de ~138 de `design.md §9` (algo mayor por JSDoc/comentarios adicionales, esperado).
- `GeneratePdfOptions`: movida al port (`pdf.port.ts`), infra la reimporta (`import type { PdfPort, GeneratePdfOptions } from '../../application/shared/ports/pdf.port'`). Barrel `infrastructure/reporting/index.ts` intacto — nunca re-exportó `GeneratePdfOptions`, sin cambios.
- 3 módulos feature (`reportes.module.ts`, `asistencia-reporting.module.ts`, `attendance-type.module.ts`): `inject` arrays usan `PDF_PORT` (confirmado en los 3), importan el token del port, ya NO importan `PdfGeneratorService` como clase concreta.
- `reporting.module.ts`: `{ provide: PDF_PORT, useExisting: PdfGeneratorService }` — NO `useClass`/`useValue`, confirmado.
- JSDoc actualizado en ambos use-cases: `generate-attendance-types-pdf.use-case.ts` (línea 14, "PdfPort.generatePdf(html)") y `generate-asistencia-mensual-pdf.use-case.ts` (comentario, "PdfPort.generatePdf with { landscape: true }") — sin referencias residuales a `PdfGeneratorService.generatePdf`.
- Sin atribución IA en los 6 commits (`rg -i "co-authored|claude|generated by|ai\b"` sobre los 6 mensajes → cero matches).
- `pnpm --filter api test`: **204/204 archivos, 2083/2083 tests GREEN** (corrido personalmente).
- `pnpm --filter api typecheck`: **limpio, 0 errores** (corrido personalmente).

---

## Prioridad 4 — Scope

- Sin `Result<Buffer, PdfError>` — `PdfPort.generatePdf` sigue devolviendo `Promise<Buffer>` (confirmado, leído directo de `pdf.port.ts`).
- Sin `onModuleDestroy` en el contrato del port — `PdfPort` solo declara `generatePdf`. `PdfGeneratorService implements PdfPort, OnModuleDestroy` — el `OnModuleDestroy` es la interfaz de lifecycle de NestJS, ajena al port, sigue solo en la clase concreta.
- Sin unificación de tokens legados — `attendance-type.module.ts` conserva `'AttendanceTypeRepository'` string-literal intacto.

---

## Hallazgos

**CRITICAL:** ninguno.

**WARNING:**
1. Coverage global 70.2% < target 80% — confirmado pre-existente (idéntico en la rama base), no introducido por este diff. No bloquea archive; recomendar ticket de deuda separado para `presentation/*` controllers.

**SUGGESTION:**
1. Task 19 (test DI-level literal para PDP-S3) quedó sin marcar — decisión correcta y documentada (H2 de design.md), no requiere acción.
2. El ADR de `design.md §4`/`§8` describe el test de WU3 como "type-assignability check"; el código real implementa source-inspection (documentado en tasks.md y apply-progress, pero no en design.md). Sugerido: anotar la nota de ejecución también en `design.md` para que futuros lectores del ADR no se desorienten con la redacción original.

---

## Checklist tasks.md vs código

18/19 tasks marcadas `[x]`, task 19 (opcional) `[ ]` — consistente con el estado real del código y con `apply-progress`. Sin discrepancias.
