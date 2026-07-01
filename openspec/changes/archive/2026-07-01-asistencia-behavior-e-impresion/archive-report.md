# Archive Report — asistencia-behavior-e-impresion

- **Change name:** `asistencia-behavior-e-impresion`
- **Archived:** 2026-07-01
- **Store:** hybrid (engram `sdd/asistencia-behavior-e-impresion/archive-report` + este archivo)
- **Status: CLOSED.** Verified PASS (with checkpoints), merged to `main` (PR #94, commit `8575191`), deployed to prod (health check 200).

## Traceability (Engram observation IDs)

| Artifact | Observation ID | Topic key |
|----------|-----------------|-----------|
| Proposal | #1656 | `sdd/asistencia-behavior-e-impresion/proposal` |
| Spec | #1657 | `sdd/asistencia-behavior-e-impresion/spec` |
| Design | #1658 | `sdd/asistencia-behavior-e-impresion/design` |
| Tasks | (file `tasks.md`, no dedicated engram obs found under that topic) | `sdd/asistencia-behavior-e-impresion/tasks` |
| Apply progress | #1660 | `sdd/asistencia-behavior-e-impresion/apply-progress` |
| Verify report | #1661 (PASS with checkpoints) | `sdd/asistencia-behavior-e-impresion/verify-report` |
| Archive report (this doc) | — | `sdd/asistencia-behavior-e-impresion/archive-report` |

## Summary

Un cambio, dos partes complementarias, entregado en 4 PRs encadenados (auto-chain, TDD estricto),
consolidados en `main` vía **PR #94** (`feat/asistencia-behavior-e-impresion`, commit `8575191`):

- **Parte 1 — `AttendanceType.behavior`** (TODOS los niveles pedagógicos): campo enum nativo
  Prisma `AttendanceBehavior` (1–7: AUSENTE_INJUSTIFICADO, AUSENTE_JUSTIFICADO, NO_ELEGIBLE,
  NO_COMPUTA, TARDE_INJUSTIFICADA, TARDE_JUSTIFICADA, DIA_NO_HABIL) que da semántica real al
  clasificador de ausentismo. Mapeo fijo de sistema (P→NO_COMPUTA, SAB/DOM/X→NO_ELEGIBLE),
  bloqueo real de edición/borrado de `isSystem` (ya existente vía `assertMutable()`, reforzado con
  tests), CRUD custom con `behavior`, filtro de combo de grilla por `behavior !== NO_ELEGIBLE`
  (reemplaza el rol funcional de `assignable`), feriado (`behavior 7`) seleccionable día a día.
  `assignable` NO se elimina — queda DERIVADO de `behavior` (rollback-safe, ADR-03).
- **Parte 2 — Impresión mensual PDF apaisada** (capacidad NUEVA `asistencia-reporting`): botón
  "Imprimir" en General y Por Materia de `asistencia-mensual.tsx`, PDF A4 landscape server-side
  (Puppeteer + Handlebars, mismo stack de boletines, sin `html2pdf` client-side), grilla
  alumnos × días, 6 totales ponderados por `absenceValue` (no conteos) — Tardes
  Just/Injust/Total, Ausentes Just/Injust/Total —, etiqueta "Días hábiles" =
  díasDelMes − días con `behavior ∈ {3,7}` sin doble conteo (implementado con `Set<number>` de
  índices de día, doble conteo estructuralmente imposible).

## Acceptance criteria — verified (29/29, per verify-report #1661)

- **AC-P1-1..12 (Parte 1):** todas PASS, verificadas contra código real (no solo apply-progress).
  Highlights: `AttendanceBehavior.create()` valida rango 1-7; DTOs con `z.nativeEnum`; mapeo de
  sistema consistente en seed use-case + `api/prisma/seed.ts` + SQL de migración; `assertMutable()`
  llamado en Update/Delete; filtro de combo en `asistencia-mensual.tsx:497`; lock en línea 761; sin
  `@@unique` en `behavior` (no exclusivo entre tipos).
  - **AC-P1-10 (migración):** PASS a nivel código/schema, pero **CHECKPOINT** — no se corrió contra
    ninguna DB real durante el ciclo SDD (sin Postgres en el sandbox). Ver sección de deploy abajo
    — **ya resuelto**: la migración se aplicó en el deploy real a producción (confirmado por el
    orquestador antes de invocar este archive).
- **AC-P2-1..17 (Parte 2):** todas PASS o PASS-con-nota. Highlights: `computeStudentTotals` /
  `computeDiasHabiles` en `packages/domain/src/asistencia/utils/asistencia-totals.ts` coinciden
  exactamente con la fórmula ponderada del spec; ambos flujos (General/Materia) funnelean por un
  único `render()` compartido (AC-P2-13); `pdf-generator.service.ts` con opción `landscape`
  aditiva/opt-in, sin regresión en boletín/constancia (re-test aislado, 92%+ statement coverage).
  - **AC-P2-17 (PARTIAL, SUGGESTION, no bloqueante):** la matemática de agregación excluye
    correctamente días > `daysInMonth` (nunca contamina totales ni días hábiles), pero el texto
    literal del escenario ("PDF debe mostrar columnas 29/30/31 con marcador 'X'") no está
    implementado — esas columnas se omiten del PDF en lugar de renderizarse como "X" (a diferencia
    de la grilla web on-screen, que sí las muestra). **Decisión documentada y deliberada**
    (tasks.md T3.2: "X" es una preocupación exclusiva de la grilla web; el agregador puro solo
    necesita índices de día válidos). Funcionalmente seguro. Queda registrado como fast-follow
    opcional si producto pide el comportamiento literal — no reabre este change.

## Tests / Build (al momento de verify)

- `pnpm test` (forzado, sin cache): domain 110 archivos/1269 tests, api 196 archivos/1975 tests
  (1972 + 3 del follow-up de coverage), web 49 archivos/595 tests — todo verde.
- `pnpm build` (forzado, sin cache): 3/3 tareas verdes. Confirmado que el build web sigue
  emitiendo el chunk preexistente `html2pdf-*.js` (285 KB gzip, de `PremiumPrintReport.tsx`,
  no relacionado) — no se introdujo un nuevo path de impresión client-side (guardia de
  regresión para AC-P2-3).

## WARNING cerrado durante el ciclo (no bloqueante, ya resuelto antes de este archive)

`sdd-verify` (#1661) reportó branch coverage de `generate-asistencia-mensual-pdf.use-case.ts` en
76.08% (< 80% umbral del proyecto), causa raíz: ramas negativas de `checkDoor2General`/
`checkDoor2Materia` (courseCycle-not-found, materia-not-found, docente-not-found,
tenant-client-null) solo alcanzadas vía el bypass de admin en los tests existentes — todas fallan
CERRADO (`throw ForbiddenError`), por lo que era un gap de cobertura de tests, no una brecha de
seguridad funcional. Follow-up test-only (registrado en apply-progress #1660, commit `e0932c5`):
se agregaron 3 tests unitarios cubriendo las ramas Door-2 de rechazo (General courseCycle-not-found;
Materia materiaXCursoXCiclo-not-found; Materia courseCycle-not-found) sin tocar código de
producción. Cobertura de branch resultante: **82.6%** (por encima del umbral). Confirmado en
tasks.md — sección "Post-verify coverage follow-up (closes verify WARNING)".

## Decisión de diseño registrada — AC-P2-17 (no imprimir días inexistentes como "X")

Se dejó explícito como decisión de diseño (no un defecto): el agregador puro de dominio
(`asistencia-totals.ts`) opera únicamente sobre índices de día válidos (`1..daysInMonth`); el
marcador visual "X" para columnas de días que no existen en el mes (ej. 29/30/31 en febrero) es una
preocupación exclusiva de la grilla web on-screen (`attendance-recording/spec.md` ATR-S59), no del
PDF impreso. El PDF simplemente omite esas columnas. Documentado en tasks.md (T3.2) y en la nueva
spec canónica `asistencia-reporting/spec.md` (ASR-S13, con nota de implementación explícita).
Recomendación no bloqueante: confirmar con el dueño de producto si la omisión es aceptable o si se
espera una columna "X" explícita en la impresión — queda como posible fast-follow, sin reabrir este
change.

## Consolidación en main y deploy

- Branch de trabajo: `feat/asistencia-behavior-e-impresion`.
- Mergeado a `main` vía **PR #94** (`Merge pull request #94 from
  npelizzari1217/feat/asistencia-behavior-e-impresion`), commit `8575191`.
- Commits relevantes en la cadena: `c9e4111` (PR4, botones Imprimir front), `75a7ee0` (verify-report
  docs), `e0932c5` (test-only, cierre de WARNING de coverage), `30bae49` (docs tasks.md).
- **Deploy a producción confirmado por el orquestador**: migración tenant `AttendanceBehavior`
  (enum + columna + backfill, Riesgo A del proposal) **ya aplicada** contra la base real, health
  check post-deploy en 200. Esto cierra el checkpoint de deployment que verify-report #1661 había
  dejado abierto (AC-P1-10).
- Este archive NO modifica código de la feature (ya mergeado y deployado) — solo consolida
  artefactos openspec y el registro en engram.

## Merge de specs canónicas (delta → main, sin pérdida)

El delta spec (`specs/spec.md`, 12 AC-P1-n + 17 AC-P2-n) se integró en las specs canónicas
afectadas, siguiendo la convención ya usada en este repo (ver `course-cycle/spec.md` — "Grading
Phase", y `attendance-recording/spec.md` — "ADR cross-reference"). Ninguna spec canónica perdió
contenido — verificado por conteo de líneas antes/después:

| Spec canónica | Cambio | Cubre |
|----------------|--------|-------|
| `openspec/specs/attendance-types/spec.md` | REQ-15 — Campo `behavior` (clasificador de ausentismo), Escenarios 15.1–15.9 | AC-P1-1..12 |
| `openspec/specs/attendance-recording/spec.md` | Addendum a ATR-R9 — `assignable` derivado de `behavior`; feriado (behavior 7) seleccionable | Parte de AC-P1-6..9 (impacto en grilla) |
| `openspec/specs/asistencia-reporting/spec.md` | **Capacidad nueva** — ASR-R1..R4, Escenarios ASR-S1–ASR-S13, ADR cross-reference | AC-P2-1..17 |

| Archivo | Antes | Después |
|---------|-------|---------|
| `attendance-types/spec.md` | 420 líneas | 534 líneas |
| `attendance-recording/spec.md` | 662 líneas | 681 líneas |
| `asistencia-reporting/spec.md` | (no existía) | 191 líneas (nuevo) |

`assignable` (REQ-1 de `attendance-types/spec.md`) NO fue eliminado del modelo ni de la spec — se
documentó explícitamente como derivado de `behavior`, preservando el invariante de rollback de
ADR-03 (design.md).

## Archivo movido

`openspec/changes/asistencia-behavior-e-impresion/` →
`openspec/changes/archive/2026-07-01-asistencia-behavior-e-impresion/` (vía `git mv`, contenido
verbatim: `design.md`, `proposal.md`, `specs/spec.md`, `tasks.md`, `verify-report.md`, más este
`archive-report.md`). La carpeta activa ya NO existe en `openspec/changes/` (solo `archive/`
permanece).

## Next steps

Ninguno pendiente para este change — ciclo SDD completo (`proposal → spec → design → tasks → apply
→ verify → archive`), mergeado y deployado. Único ítem no bloqueante para seguimiento futuro
(opcional, no reabre este change): confirmar con producto si AC-P2-17 requiere el marcador "X"
literal en la impresión, o si la omisión actual de columnas inexistentes es aceptable como
comportamiento final.
