# Archive Report — tipos-asistencia-nivel-e-impresion

- **Change name:** `tipos-asistencia-nivel-e-impresion`
- **Archived:** 2026-07-01
- **Store:** hybrid (engram `sdd/tipos-asistencia-nivel-e-impresion/archive-report` + este archivo)
- **Status: CLOSED.** Verified PASS WITH WARNINGS, 0 CRITICAL, ambos WARNING cerrados antes de este
  archive (commit `5cadf15`, confirmado con `pnpm --filter api test` = 2041/2041 verde en este
  archive run).

## Traceability (Engram observation IDs)

| Artifact | Observation ID | Topic key |
|----------|-----------------|-----------|
| Proposal | #1666 | `sdd/tipos-asistencia-nivel-e-impresion/proposal` |
| Spec (delta) | #1667 | `sdd/tipos-asistencia-nivel-e-impresion/spec` |
| Design | #1668 | `sdd/tipos-asistencia-nivel-e-impresion/design` |
| Tasks | #1669 | `sdd/tipos-asistencia-nivel-e-impresion/tasks` |
| Apply progress (post-verify fixup) | #1670 | `sdd/tipos-asistencia-nivel-e-impresion/apply-progress` |
| Verify report | #1671 (PASS WITH WARNINGS) | `sdd/tipos-asistencia-nivel-e-impresion/verify-report` |
| Archive report (this doc) | — | `sdd/tipos-asistencia-nivel-e-impresion/archive-report` |

## Summary

Scope de nivel base (backend-first, 403 real nunca 200-vacío) para `AttendanceType`: listar, crear,
editar, eliminar y obtener por id quedan restringidos al conjunto de niveles base del usuario
autenticado (`resolveAccessScope`, colapso de modalidad), salvo `allLevels = true` (ROOT/ADMIN).
Selector de nivel del front (`attendance-types.tsx`) reemplaza `LEVEL_OPTIONS` hardcodeado por los
niveles derivados del usuario (1 nivel → visible+deshabilitado; N niveles → limitado a esos; 0
niveles → estado vacío explícito). Impresión nueva: `GET /attendance-types/print` genera PDF
server-side (Puppeteer/Handlebars, reusa `PdfGeneratorService`) respetando EXACTAMENTE el mismo
cálculo de scope/filtro que el listado.

Entregado en 5 PRs encadenados secuenciales (auto-chain, TDD estricto) sobre
`feat/attendance-types-web-selector-print`: PR1 (`baseLevels` en domain), PR2 (scope Listar/Crear),
PR3 (scope Editar/Eliminar/Get-by-id — cierre de un riesgo abierto por el delta original), PR4
(impresión PDF), PR5 (front). Más un commit de cierre post-verify (`5cadf15`).

## Verificación (verify-report #1671)

**Veredicto: PASS WITH WARNINGS. 0 CRITICAL.**

Gates verdes: `pnpm --filter @educandow/domain test` (110 archivos/1275 tests), `pnpm --filter api
test` (199 archivos/2039 tests), `pnpm --filter web test` (50 archivos/612 tests), `pnpm --filter
api typecheck` limpio, `pnpm --filter web build` limpio.

Cobertura de requerimientos verificada contra código real (file:line) para: colapso de modalidad,
scope de Listar/Crear/Editar/Eliminar/Get-by-id, impresión PDF con mismo scope que el listado,
validación de transporte antes de scope, ruta `/print` registrada antes de `:id`, selector web
1/N/0/ROOT, botón Imprimir con fix de `institutionId` para ROOT. Los 4 criterios de aceptación
transversales de la spec se verifican funcionalmente (sin sustituir 403 por 200-vacío;
`resolveAccessScope` única fuente de verdad; front nunca es la única barrera; impresión usa el mismo
cálculo que el listado).

### WARNINGs — ambos cerrados antes de este archive

1. **`tasks.md` no estaba en 41/41 `[x]`** (T40/T41 sin marcar) y los 4 checkboxes de "Criterios de
   aceptación transversales" del delta spec tampoco. Cerrado en el commit de fixup `5cadf15`
   (`test(attendance-type): add e2e 403 coverage for create out-of-scope + close transversal
   checklist`) — confirmado en este archive: `tasks.md` tiene 41/41 `[x]`, sin ningún `[ ]` restante
   en `tasks.md` ni en `specs/attendance-types/spec.md` del change.
2. **Sin test e2e real (pipeline HTTP completo) para `POST /attendance-types` fuera de scope**
   (create solo tenía cobertura unitaria). Cerrado en el mismo commit `5cadf15`: se agregaron 38
   líneas de cobertura e2e nueva en `attendance-type.controller.e2e.test.ts` para el caso de create
   fuera de scope.

Confirmado en este archive run: `pnpm --filter api test` → **199 archivos / 2041 tests verde**
(2039 + 2 del follow-up e2e de `5cadf15`), sin regresiones.

## Merge de spec canónica (delta → main, sin pérdida)

El delta (`specs/attendance-types/spec.md`, ADDED + MODIFIED) se integró en
`openspec/specs/attendance-types/spec.md`. Ningún contenido preexistente se perdió — la spec
canónica creció de **534 a 867 líneas** (verificado por diff estructural, todos los REQ-1..REQ-15
originales permanecen intactos).

| Tipo | REQ | Título | Cambio |
|------|-----|--------|--------|
| MODIFIED (en el lugar, sin renumerar) | REQ-3 | Crear tipo no-sistema | Agrega validación de scope de nivel al `level` del payload (Escenarios 3.3–3.5 nuevos; 3.1–3.2 intactos) |
| MODIFIED (en el lugar, sin renumerar) | REQ-4 | Editar tipo no-sistema | Agrega validación de scope de nivel al `level` del registro objetivo (Escenarios 4.3–4.5 nuevos; 4.1–4.2 intactos) |
| MODIFIED (en el lugar, sin renumerar) | REQ-8 | Listar y filtrar | Agrega scope de nivel base al listado — 403 real, nunca 200-vacío ante `?level` fuera de scope (Escenarios 8.5–8.9 nuevos; 8.1–8.4 intactos) |
| ADDED | REQ-16 | Nivel base — colapso de modalidad | Deriva `baseLevels` de `user.levels`, colapsando modalidad |
| ADDED | REQ-17 | Selector de nivel en el front adaptado al scope | Reemplaza `LEVEL_OPTIONS` hardcodeado; 1/N/0/ROOT |
| ADDED | REQ-18 | Impresión de tipos de asistencia respetando el scope | `GET /attendance-types/print`, mismo scope que REQ-8 |
| ADDED | REQ-19 | Rechazo HTTP 403 fuera de scope, nunca 200-vacío | Generaliza la regla de 403 a todas las operaciones |
| ADDED | REQ-20 | Scope de nivel extendido a Eliminar y Obtener por id | Ver nota de mérge abajo |

También se agregó la fila `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE` (403) a la tabla de "Errores de
dominio requeridos", y una subsección "Adición — tipos-asistencia-nivel-e-impresion (2026-07-01)"
con los 4 criterios de aceptación transversales del delta (marcados `[x]`, verificados).

### Nota de mérge — REQ-20 (extensión más allá del delta formal)

El delta original (`specs/attendance-types/spec.md` de este change) dejaba explícitamente DELETE
(REQ-6/REQ-7) y GET por id **fuera de alcance** como "riesgo abierto pendiente de decisión" (nota de
alcance bajo su sección MODIFIED de REQ-4). `tasks.md` PR3 documenta que esa decisión se cerró
durante `apply`: "Decisión ya tomada (no diferir): Update/Delete/Get-by-id quedan level-scoped igual
que Listar/Crear." `verify-report.md` (#1671) confirma esto implementado y verificado con tests e2e
reales (filas "Delete scopeado" y "Get-by-id scopeado", cierre de riesgo design §9).

Esto es una extensión real de comportamiento shippeada y verificada, pero no cubierta formalmente
por las secciones ADDED/MODIFIED del delta spec original — un gap entre spec-delta y
código/verify-report, no una contradicción entre requisitos. Se resolvió agregando **REQ-20** como
requisito ADDED nuevo (no se tocó REQ-6/REQ-7, que permanecen sin cambios formales), documentando
explícitamente el origen de la extensión y las fuentes (tasks.md T12–T19, verify-report). No fue
necesario un STOP por conflicto — no hay ningún requisito que contradiga a otro, solo un documento
delta incompleto respecto a lo efectivamente implementado y verificado.

No se tocaron otras specs canónicas (`attendance-recording/spec.md`, `asistencia-reporting/spec.md`)
— el delta de este change solo modifica el contrato de `attendance-types` (confirmado por grep, sin
referencias cruzadas de este change en esos archivos).

## Consolidación

- Branch de trabajo (tip, cumulativo PR1–PR5 + fixup): `feat/attendance-types-web-selector-print`
  (commit de cierre `5cadf15`).
- Este archive se commitea en la misma branch (`feat/attendance-types-web-selector-print`); el
  orquestador maneja push/PR por separado — este archive NO pushea ni abre PR.
- Este archive NO modifica código de la feature (ya implementado y verificado) — solo consolida
  artefactos openspec (merge de spec canónica + movimiento de carpeta) y el registro en engram.

## Archivo movido

`openspec/changes/tipos-asistencia-nivel-e-impresion/` →
`openspec/changes/archive/2026-07-01-tipos-asistencia-nivel-e-impresion/` (copia verbatim vía `cp`,
verificada byte-a-byte con `diff` antes de borrar la carpeta activa: `design.md`, `proposal.md`,
`specs/attendance-types/spec.md`, `tasks.md`, `verify-report.md`, más este `archive-report.md`
nuevo). La carpeta activa ya NO existe en `openspec/changes/` (solo `archive/` permanece).

## Next steps

Ninguno pendiente para este change — ciclo SDD completo (`proposal → spec → design → tasks → apply
→ verify → archive`). El orquestador maneja push/PR de la branch
`feat/attendance-types-web-selector-print` (que incluye este commit de archive) por separado.
