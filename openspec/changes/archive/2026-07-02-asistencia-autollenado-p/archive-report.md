# Archive Report — asistencia-autollenado-p

- **Fecha de archive:** 2026-07-02
- **Rama:** `feat/asist-autollenado-p-4-presentation`
- **Estado final:** CERRADO — PASS_WITH_WARNINGS en verify (0 CRITICAL, 3 WARNING, 3 SUGGESTION), las 3 WARNING atendidas en este archive.
- **Artefactos de origen:** proposal.md, design.md, specs/spec.md (delta), tasks.md, verify-report.md — todos en `openspec/changes/archive/2026-07-02-asistencia-autollenado-p/` tras el archive. Engram: `sdd/asistencia-autollenado-p/proposal` (#1677), `.../spec` (#1678), `.../design` (#1679), `.../tasks` (#1680), `.../verify-report` (#1682).

## Resumen ejecutivo

Generar asistencia mensual ahora autollena con Presente ("P") toda celda de día HÁBIL vacía, en
ambos ejes (General y Por Materia), sin pisar jamás un valor ya cargado por un docente/preceptor.
18/18 tasks completas en 4 PRs encadenados (Domain → Infra → Application → Presentation). Verify
fresco confirmó cada requisito contra código real, sin asumir lo reportado por apply. El change
queda archivado con la spec canónica reconciliada para reflejar la implementación real.

## W1 — Reconciliación de la spec canónica (ATR-R11.5)

**Divergencia encontrada:** la spec delta original (`specs/spec.md`, ATR-R11.5) definía la
resolución del `AttendanceType` Presente en 4 ramas con prioridad en cascada:
1. `code = "P"` exacto → usar.
2. Sin "P", pero exactamente un custom con `behavior = NO_COMPUTA` → usar ese.
3. Sin "P", 2+ customs con `behavior = NO_COMPUTA` → rechazar con `PresenteTypeAmbiguousError`
   (`PRESENTE_TYPE_AMBIGUOUS`, HTTP 422).
4. Sin "P" ni ningún `NO_COMPUTA` → rechazar con `PresenteTypeNotFoundError`.

**Implementación real** (`findPresenteByLevel`, `attendance-type-repository.ts` +
`prisma-attendance-type.repository.ts:80-86`, confirmado por verify con código real, no inferencia):
una única consulta `isPresent = true AND isSystem = true AND active = true AND deletedAt = null`
para el nivel, `findFirst` — sin cascada de prioridad, sin evaluar `behavior` en absoluto. Esta
consulta es unívoca por construcción: `@@unique([level, code])` del schema Prisma más la
protección `ATTENDANCE_TYPE_SYSTEM_PROTECTED` sobre tipos de sistema garantizan que nunca exista
más de un `AttendanceType` de sistema con `isPresent=true` por nivel. La ambigüedad de negocio de
la rama 3 es estructuralmente imposible con este diseño — no puede ocurrir, no hay nada que
rechazar. El fallback a custom de las ramas 1/2 tampoco se implementó (la query nunca considera
tipos custom, solo `isSystem=true`).

**Acción tomada:** se reescribió ATR-R11.5 (y las secciones asociadas: escenarios ATR-S77-S79,
tabla de errores) tanto en la spec canónica (`openspec/specs/attendance-recording/spec.md`) como en
la spec delta archivada (`specs/spec.md` del change), para describir la resolución real de 2 ramas
(encontrado / no encontrado). Cambios de detalle:
- `PRESENTE_TYPE_AMBIGUOUS` eliminado de la tabla de errores de dominio — no existe ese código en
  el repo (`rg PRESENTE_TYPE_AMBIGUOUS` sin matches fuera de las notas explicativas de reconciliación).
- ATR-S77 reescrito para describir el comportamiento real (solo tipos de sistema cuentan; un custom
  con el mismo `behavior` se ignora, no compite por prioridad).
- ATR-S78 (fallback a custom NO_COMPUTA único) marcado **VOID** — no implementado.
- ATR-S79 (rechazo por ambigüedad) marcado **VOID** — no implementado, estructuralmente imposible.
- Se agregó una nota de reconciliación explícita al inicio de ATR-R11 (canónica) y al inicio del
  archivo delta, para que cualquier lector futuro entienda el porqué del cambio sin tener que
  reconstruir el razonamiento.

**Nota de alcance:** el pedido original de reconciliación (W1 del verify-report) mencionaba
explícitamente solo `PresenteTypeAmbiguousError`/ATR-R11.5.3 y el escenario ATR-S79. Se decidió
también corregir ATR-S77/S78, porque dejarlos intactos habría seguido describiendo un mecanismo de
resolución (cascada de prioridad `code="P"` → fallback a `behavior=NO_COMPUTA` único) que tampoco
existe en el código real — la propia spec_coverage del verify-report (#1682) marca los tres
escenarios (S77/S78/S79) como "NO aplican / NO testeados". Dejar S77/S78 sin tocar habría violado
el mismo principio que motivó W1 ("la spec archivada NO debe describir un error/mecanismo
inexistente"). Este es un juicio de alcance ampliado respecto del pedido literal — señalado aquí
para que el usuario pueda revisar/revertir si lo prefiere más ajustado al pedido original.

## W2 — Trail de artefactos commiteado

`proposal.md`, `design.md` y `specs/spec.md` (delta) estaban `??` (untracked) al momento de verify
— nunca se habían commiteado en la cadena de 4 PRs, solo `tasks.md` estaba trackeado. Se
commitearon como parte de este cierre, junto con `verify-report.md`, este `archive-report.md`, la
reconciliación de la spec canónica, y el movimiento a `archive/`. Ver `artifacts_committed` en el
result contract para el detalle de archivos y hash.

## W3 — Sign-off de ADR-1 registrado

**Decisión:** ADR-1 del design (`design.md`) invierte el merge de infra de "locked-wins" (incoming
pisa) a "fill-only" (existing gana): `{ ...incoming, ...existing }`. Este flip es la única forma de
topear hábiles vacíos en filas ya existentes sin pisar el valor cargado por un docente, reusando el
mismo camino `generateMany` para creación y regeneración.

**Tradeoff conocido y aceptado:** se pierde la "corrección" de un locked-key ya guardado
incorrectamente (ej. una "P" legacy mal cargada en una key SAB/DOM/X) — un test viejo cubría ese
caso de auto-corrección, y con fill-only ese comportamiento ya no ocurre (el valor existente, aunque
esté mal, ya no se corrige por Generar). El design documenta esto como "efectivamente dead-code" (los
valores locked son determinísticos y las celdas bloqueadas son read-only en UI), mitigado con test
explícito de la nueva semántica.

**Sign-off:** el usuario aprobó verbalmente este flip durante la fase de planificación (conversación
de la sesión SDD, no capturada en un artefacto SDD dedicado previo a este archive). Se registra
formalmente aquí, en el archive-report, como la evidencia de aprobación de ADR-1. No hubo objeción
ni pedido de alternativa en ese momento.

## Deuda de verificación conocida (NO oculta — pendiente post-archive)

Los tests de integración `api/test/integration/asistencia/generate-monthly.db.test.ts`
(GEN-DB-01..10) cubren ATR-S71..S82, incluido el invariante crítico de no-sobrescritura end-to-end
contra Postgres real. Estos tests están **escritos pero NUNCA corridos**: `nc -z 127.0.0.1 5433`
confirma que no hay Postgres tenant disponible en ningún entorno donde se ejecutó verify (ni en
sesiones previas). El resto de la suite (`pnpm --filter @educandow/domain test` — 111
archivos/1284 tests, `pnpm --filter api exec vitest run` — 199 archivos/2059 tests) está GREEN,
pero excluye explícitamente `*.db.test.ts` por configuración.

**Acción recomendada antes de considerar el change 100% probado:** levantar Postgres tenant en
`:5433` (o el entorno de CI correspondiente) y correr `generate-monthly.db.test.ts` contra DB real.
Hasta entonces, la cobertura end-to-end del invariante de no-sobrescritura (el más crítico del
change) descansa en unit tests + tests de use-case con mocks, no en integración real contra Postgres.

## Deuda adicional (no bloqueante, ya documentada en verify)

- S1 (verify-report): toast específico para `PRESENTE_TYPE_NOT_FOUND` en el frontend — diferido,
  documentado como opcional en `design.md` (sección Frontend), no requerido por la regla central.
- S3 (verify-report): modificación preexistente y ajena en `web/src/pages/dashboard/attendance-types.tsx`
  — permanece sin tocar y sin commitear por este archive (fuera de alcance de este change; ver
  `untracked_button_edit_left_untouched` en el result contract).

## Trazabilidad engram

| Artefacto | Topic key | Observation ID |
|---|---|---|
| Proposal | `sdd/asistencia-autollenado-p/proposal` | #1677 |
| Spec (delta) | `sdd/asistencia-autollenado-p/spec` | #1678 |
| Design | `sdd/asistencia-autollenado-p/design` | #1679 |
| Tasks | `sdd/asistencia-autollenado-p/tasks` | #1680 |
| Verify report | `sdd/asistencia-autollenado-p/verify-report` | #1682 |
| Archive report | `sdd/asistencia-autollenado-p/archive-report` | (esta observación) |
