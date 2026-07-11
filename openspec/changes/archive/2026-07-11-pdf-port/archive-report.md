# Archive Report — pdf-port (Inversión de Dependencia, ADR-06)

- Change: `pdf-port`
- Archivado: 2026-07-11
- Rama: `refactor/pdf-port` — **stackeada sobre `refactor/reporting-module-compartido` (PR #107, aún OPEN, sin mergear)**
- Store: hybrid (openspec + engram)
- **Veredicto final: PASS WITH WARNINGS (0 CRITICAL) → ARCHIVADO**

---

## Resultado

Los 4 use-cases de `application/` (reportes, asistencia-reporting, attendance-type) ya NO importan ni
tipan la clase concreta `PdfGeneratorService`. Dependen del contrato `PdfPort` (interface) vía token
`PDF_PORT = Symbol('PDF_PORT')`, resuelto por `@Inject(PDF_PORT)`. La flecha prohibida
`application → infrastructure` sobre el motor de PDF quedó eliminada — DIP aplicado. `PdfGeneratorService`
implementa `PdfPort` y sigue siendo el único singleton que gestiona el `Browser` de Puppeteer
(`useExisting`, no `useClass`), preservando la invariante RPI-R1 del PR #107.

## Requisitos cumplidos (PDP-R1..R6)

| Requisito | Escenario | Estado | Evidencia |
|-----------|-----------|--------|-----------|
| PDP-R1 — Existe el contrato `PdfPort` | PDP-S1 | GREEN | `pdf.port.ts` + `pdf.port.test.ts` |
| PDP-R2 — `application/` no importa infra | PDP-S2 | GREEN | `no-infra-pdf-import.arch.test.ts`, path-based, 0 coincidencias |
| PDP-R3 — Los 4 use-cases dependen del port | PDP-S3 | GREEN (paridad estructural vía tests reales con `new` + mock; test DI-level literal quedó opcional, no bloqueante — ver Deuda) | constructores + `inject: [PDF_PORT, ...]` en los 3 módulos feature |
| PDP-R4 — Infra implementa el port | PDP-S4 | GREEN (técnica de test cambiada — ver Desviación WU3) | `pdf-generator.service.ts` `implements PdfPort` |
| PDP-R5 — Una sola instancia preservada | PDP-S5 | GREEN | `reporting.module.test.ts`, `moduleRef.get(PDF_PORT) === moduleRef.get(PdfGeneratorService)` |
| PDP-R6 — Sin regresión de comportamiento | PDP-S6 | GREEN | 9 archivos / 158 tests de los 4 use-cases, mocks sin cambio de forma |

Capability extendida: **`openspec/specs/reporting-infrastructure/spec.md`** — se agregaron PDP-R1..R6
/ PDP-S1..S6 y una tabla ADR cross-reference (pdf-port) nueva, SIN tocar los RPI-R1..R6 existentes del
PR #107. Out of Scope y Follow-up del archivo canónico actualizados: se removió el ítem "introducir
PdfPort" de Out of Scope (ya resuelto por este change) y se agregó el follow-up de
`Result<Buffer, PdfError>` (ver abajo).

## Commits (6, sin atribución IA)

| Hash | Mensaje |
|------|---------|
| `657abfd` | `feat(reporting): add PdfPort contract and PDF_PORT token` |
| `b62ab40` | `feat(reporting): expose PDF_PORT from ReportingModule via useExisting` |
| `cca8279` | `refactor(reporting): PdfGeneratorService implements PdfPort` |
| `ceeafb0` | `refactor(reporting): invert application dependency on PdfPort (PDP-R2/R3)` |
| `e3b4ec5` | `refactor(reporting): wire feature modules to PDF_PORT` |
| (6º) | `docs(sdd): archive pdf-port, extend reporting-infrastructure capability` (este commit) |

`git diff --stat refactor/reporting-module-compartido..HEAD -- . ':!openspec'`: 14 archivos,
193 insertions(+), 38 deletions(-) — muy por debajo del budget de 400 líneas. Un solo PR, sin
chained-PR, sin `size:exception`.

## Tests

`pnpm --filter api test`: **204/204 archivos, 2083/2083 tests GREEN**.
`pnpm --filter api typecheck`: limpio, 0 errores.

---

## Deuda documentada (no bloquea, queda registrada)

### 1. WARNING de coverage — 70.2% < target 80% (PRE-EXISTENTE, confirmado por verify)

`verify` corrió `pnpm --filter api test:coverage` en ambas ramas y comparó:

| Rama | Statements |
|------|-----------|
| `refactor/reporting-module-compartido` (base) | 70.2% (5973/8508) |
| `refactor/pdf-port` (esta rama) | 70.2% (5974/8509) |

Coverage global **idéntico** entre base y rama — delta de exactamente +1 statement (la constante
`export const PDF_PORT = Symbol(...)`; las interfaces `PdfPort`/`GeneratePdfOptions` son type-only,
se borran en runtime). El gap es 100% preexistente y estructural, impulsado por `presentation/*`
controllers sin tests unitarios — fuera de scope de `pdf-port`. Cobertura puntual de todo lo tocado
por este change: 83–100% (`pdf.port.ts` 100%, `reporting.module.ts` 100%,
`pdf-generator.service.ts` 83.33%, use-cases 92.96–99.14%). No bloquea archive. Se deja como ticket
de deuda separado (ver Follow-up).

### 2. Desviación WU3 (PDP-S4) — legítima, ya corregida en `design.md`

`tasks.md`/`design.md` describían originalmente el test de PDP-S4 como un "type-assignability check"
(`const x: PdfPort = service`). `apply` detectó que esa técnica NO puede fallar nunca: el structural
typing de TS hace asignable cualquier clase con la misma forma a `PdfPort` sin `implements` explícito,
y Vitest transpila con esbuild sin type-check en tiempo de test. `verify` reprodujo el hallazgo
empíricamente (clase `implements`-less estructuralmente compatible, `pnpm typecheck` → 0 errores) y lo
clasificó **legítimo**. Se reemplazó por inspección de código fuente (mismo patrón que el arch test de
PDP-S2/WU4): lee `pdf-generator.service.ts` como texto y verifica `implements ... PdfPort` + import de
`GeneratePdfOptions` desde el port + ausencia de la definición local. La firma exacta de `generatePdf`
queda cubierta por el compilador (`implements PdfPort` fuerza TS2420 si diverge), no por Vitest.
`design.md` fue corregido antes de archivar (nota agregada antes de §6) para que el ADR archivado no
describa una técnica que nunca se implementó.

---

## Follow-ups (NO implementados en este change — tickets separados)

1. **Migrar `PdfPort.generatePdf` de `Promise<Buffer>` a `Result<Buffer, PdfError>`** — alinea con la
   convención de error-handling del proyecto. Tocaría los 4 call-sites (use-cases) y sus tests.
   Registrado en `openspec/specs/reporting-infrastructure/spec.md` (Follow-up #1).
2. Ticket de deuda de coverage para `presentation/*` controllers (llevar el global de 70.2% a ≥80%) —
   no introducido por este change, preexistente.
3. (Heredado de #107) Si NestJS permite en el futuro destruir un submódulo sin cerrar la app completa,
   reforzar RPI-S5 con un test literal — sigue sin acción, ver `reporting-infrastructure/spec.md`
   Follow-up #2.

## Dependencia de stack

Este change está **stackeado sobre PR #107** (`refactor/reporting-module-compartido`), que sigue
**OPEN, sin mergear a `main`**. El merge de `pdf-port` a `main` **DEPENDE** de que #107 mergee primero
— `refactor/pdf-port` no es mergeable de forma independiente hasta entonces. Sin push, sin PR abierto
para `pdf-port` (commits locales, según instrucción explícita del usuario).

---

## Trazabilidad de artefactos (Engram)

| Artefacto | Topic key | Observation ID |
|-----------|-----------|-----------------|
| Proposal | `sdd/pdf-port/proposal` | #1775 |
| Spec (delta) | `sdd/pdf-port/spec` | #1776 |
| Design | `sdd/pdf-port/design` | #1777 |
| Tasks | `sdd/pdf-port/tasks` | #1778 |
| Verify report | `sdd/pdf-port/verify-report` | #1780 |
| Archive report | `sdd/pdf-port/archive-report` | (este documento) |

## Archivo movido

`openspec/changes/pdf-port/` → `openspec/changes/archive/2026-07-11-pdf-port/` (vía `git mv`).
`openspec/changes/` solo contiene `archive/` — sin changes activos pendientes.

## SDD Cycle Complete

El change `pdf-port` fue planificado, implementado, verificado y archivado de punta a punta. La
capability `reporting-infrastructure` queda actualizada como fuente de verdad (RPI-R1..R6 +
PDP-R1..R6). Listo para el próximo change (sujeto a la dependencia de stack sobre #107 documentada
arriba).
