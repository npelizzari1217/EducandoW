# Verify Report — asistencia-autollenado-p

Fecha: 2026-07-02 | Rama verificada: `feat/asist-autollenado-p-4-presentation` (HEAD `c12e945`)
Verificación con contexto fresco, adversarial, contra código real (no se asumió lo reportado por apply-progress).

## Status: PASS_WITH_WARNINGS

0 CRITICAL, 3 WARNING, 3 SUGGESTION.

---

## 1. Invariante crítico (ATR-R11.3) — fill-only, nunca pisa

Confirmado en código:
- `packages/domain/src/asistencia/utils/calendar-utils.ts:71-89` — `fillHabilVacios`: `if (out[key] !== undefined) continue;` — nunca pisa una key ya presente. Puro, inmutable (copia con spread), reusa `buildLockedDayMap`.
- `api/.../prisma-asistencia-general.repository.ts:37-42` — `mergeLocked(existing, locked) → { ...(locked ?? {}), ...existing }` — existing gana.
- `api/.../prisma-asistencia-materia.repository.ts:34-39` — mismo cuerpo exacto, idéntico comportamiento (mirror).
- Filas nuevas (`createMany`) reciben `targetDays` completo tal cual (sin pasar por merge).

Verificado: invariante se cumple en AMBOS repos y en ambos caminos (creación/actualización).

## 2. Resolución del Presente

- `packages/domain/src/attendance-type/repositories/attendance-type-repository.ts:58` — puerto `findPresenteByLevel(level)`, doc explícita "no hardcodea P".
- `api/.../prisma-attendance-type.repository.ts:80-86` — `findFirst({ where: { level, isPresent:true, isSystem:true, active:true, deletedAt:null } })`, unívoco por `@@unique([level,code])` + único tipo sistema con `isPresent:true`.
- `generate-monthly-attendance.use-case.ts:156,161` — `attendanceTypeRepo.findPresenteByLevel(cc.level)` seguido de `presente.code.get()` — nivel obtenido de `cc.level` (select ampliado en el paso 2), código NUNCA hardcodeado como "P" literal en el use-case.

## 3. Result + error 422

- `use-case.ts:98` — firma `Promise<Result<GenerationResult, PresenteTypeNotFoundError>>`.
- Corte ANTES de cualquier escritura (`return err(...)` en línea 159, antes de steps 5/6 de generación).
- `asistencia.controller.ts:118` — `result.unwrap()` dentro del try existente; `Err.unwrap()` throws `this.error`, cae al catch genérico, no matchea `ForbiddenError`, re-throwea → filtro global.
- `exception.filter.ts` — `PRESENTE_TYPE_NOT_FOUND: 422` en `DOMAIN_STATUS` (línea 59). Test `FILTER-7` confirma 422 + code.

## 4. Guard mes CERRADO (ATR-R11.6)

- `use-case.ts:153-162` — `isClosed = existingStatus?.isClosed() ?? false`; si `isClosed`, `targetDays = lockedMap` (sin fillHabilVacios, sin resolver Presente, sin nuevo error). Comportamiento preexistente de Generar sobre CLOSED queda intacto (sigue llamando `generateMany`, que sigue creando filas para alumnos nuevos, pero SIN "P").
- Confirmado con test de integración GEN-DB-10 (gated, ver abajo): alumno agregado post-cierre obtiene fila sin autofill; fila ya autofilleada de otro alumno permanece intacta.

## 5. Mismo helper en ambos ejes (ATR-R11.4)

- `use-case.ts:154,169-197` — `targetDays` se calcula UNA vez y se reutiliza literalmente en `generalRows` y `subjectRows` (misma referencia de objeto, confirmado por test `GEN-9`).

## 6. Cobertura de escenarios ATR-S71..S82

| Escenario | Cubierto en | DB real corrida |
|---|---|---|
| S71 grilla nueva general | unit FILL-1/2/3, use-case GEN-1..5, DB-gated GEN-DB-04 | NO |
| S72 grilla nueva materia | use-case GEN-4/GEN-9, DB-gated GEN-DB-07 | NO |
| S73 SAB/DOM/X nunca P | unit FILL-2, use-case GEN-1..5, DB-gated GEN-DB-04 | NO |
| S74 regen general invariante | unit FILL-3, DB-gated GEN-DB-06 (crítico) | NO |
| S75 regen materia | DB-gated GEN-DB-07 | NO |
| S76 FERIADO nunca pisado | DB-gated GEN-DB-08 | NO |
| S77 "P" prioridad sobre custom NO_COMPUTA | **NO aplica / NO testeado** — divergencia (ver Warning 1) | N/A |
| S78 único NO_COMPUTA sin "P" | **NO aplica / NO testeado** — divergencia (ver Warning 1) | N/A |
| S79 ambigüedad → 422 | **NO implementado / NO testeable** — divergencia (ver Warning 1) | N/A |
| S80 sin Presente → 422 NOT_FOUND | use-case GEN-6, DB-gated GEN-DB-09 | NO |
| S81 mes cerrado no autollena | use-case GEN-7, DB-gated GEN-DB-10 | NO |
| S82 idempotencia | unit FILL-5, use-case GEN-T05, DB-gated GEN-DB-02/05 | NO |

## 7. Tasks.md

Las 18 tasks (PR-1 6/6, PR-2 6/6, PR-3 2/2, PR-4 6/6) están marcadas `[x]` y se verificó línea por línea contra el código real listado arriba — no son tildes vacíos, cada una tiene implementación y/o test correspondiente localizable.

---

## Tests ejecutados (contexto fresco, no reusa lo reportado por apply)

- `pnpm --filter @educandow/domain build` → GREEN (tsc, 0 errores).
- `pnpm --filter api typecheck` → GREEN (tsc --noEmit, 0 errores).
- `pnpm --filter @educandow/domain test` → GREEN, 111 archivos / 1284 tests.
- `pnpm --filter api exec vitest run` → GREEN, 199 archivos / 2059 tests (excluye `**/*.db.test.ts` por `vitest.config.ts:10`).
- `api/test/integration/asistencia/generate-monthly.db.test.ts` (GEN-DB-01..10) → **NO CORRIDO**. Confirmado `nc -z 127.0.0.1 5433` → DOWN (ECONNREFUSED esperado) en este entorno. Este archivo NUNCA fue ejecutado contra Postgres real en ningún entorno observado hasta ahora (ni apply ni verify).

---

## CRITICAL

Ninguno.

## WARNING

**W1 — Reconciliación de spec pendiente (ATR-R11.5.3 / PRESENTE_TYPE_AMBIGUOUS / ATR-S79 no implementados)**
El spec (`ATR-R11.5`, 4 pasos: "P" exacto → único NO_COMPUTA → ambiguo 422 → not-found 422) fue reemplazado por el design (ADR-2) con una resolución de 2 ramas: `isPresent && isSystem` (unívoco por construcción, verificado contra `@@unique([level,code])` + protección `ATTENDANCE_TYPE_SYSTEM_PROTECTED` del tipo sistema "P") → si no existe, `PresenteTypeNotFoundError`. **No existe ningún código de `PRESENTE_TYPE_AMBIGUOUS` ni `PresenteTypeAmbiguousError` en el repo** (confirmado con búsqueda exhaustiva, cero coincidencias). Esta es una decisión de ingeniería válida y bien justificada — no es un bug — pero el spec canónico que se mergeará en `sdd-archive` (`openspec/specs/attendance-recording/spec.md`) DEBE eliminar ATR-R11.5.3, ATR-S79, la fila `PRESENTE_TYPE_AMBIGUOUS` de la tabla de errores, y reescribir ATR-R11.5 para reflejar las 2 ramas reales. Si se mergea el spec tal cual está escrito hoy, quedará describiendo un error code inexistente — confusión garantizada para cualquier auditoría futura. Clasificado WARNING (no CRITICAL) porque es un problema de documentación/reconciliación, no de comportamiento del sistema en producción.

**W2 — Artefactos openspec sin commitear (design.md, proposal.md, specs/spec.md)**
`git status` confirma que SOLO `tasks.md` está trackeado y commiteado en la rama (4 commits `docs(sdd)` lo prueban). `design.md`, `proposal.md` y `specs/spec.md` existen en el working tree pero aparecen como `??` (untracked) — nunca fueron `git add`eados/commiteados en ningún commit de esta cadena de 4 PRs. El proyecto declara persistencia `hybrid` (`CLAUDE.md`: "openspec = fuente de verdad compartida... viaja por git (push/pull), tiene historial"). Si este working tree se descarta o no se sincroniza antes del archive, se pierde la fuente de verdad compartida de spec/design/proposal — solo quedaría engram local (no commiteado, no compartible entre máquinas). Deben commitearse antes o durante `sdd-archive`.

**W3 — Open question ADR-1 sin confirmar por el usuario**
El flip de merge (`locked-wins` → `fill-only`) invierte el comportamiento de un caso que el test `'corrects legacy P to SAB because locked keys win'` (ahora reescrito) SÍ cubría: una key `existing` con un valor legacy mal cargado en una posición SAB/DOM/X ya NO se corrige automáticamente al regenerar. `tasks.md` deja esto como pregunta abierta explícita para el usuario ("confirmar si ese caso es alcanzable en producción hoy o era solo defensivo") — no fue respondida en ningún artefacto revisado. Recomiendo obtener el sign-off explícito antes de cerrar el archive, dado que es un cambio de comportamiento observable (aunque de un edge-case) no cubierto por ningún escenario de la spec original.

## SUGGESTIONS

**S1** — Toast específico para `PRESENTE_TYPE_NOT_FOUND` en el frontend (`asistencia-mensual.tsx`) quedó explícitamente fuera de alcance/opcional (tasks.md 4.3.1) y no se implementó — el error genérico actual cubre el caso pero con peor UX. Baja prioridad, deferred correctamente.

**S2** — Correr `generate-monthly.db.test.ts` (10 escenarios, GEN-DB-01..10, cubre 9 de los 12 escenarios ATR-S7x/S8x) contra Postgres real (puerto 5433) antes de dar el change por completamente probado — es la única prueba que verifica semántica JSONB real bajo transacciones reales; los tests unitarios/mock son fuertes pero no sustituyen una corrida real.

**S3** — `web/src/pages/dashboard/attendance-types.tsx` tiene una modificación local preexistente en el working tree, ajena a este change (ya detectada y no tocada en PR-3/PR-4 según apply-progress). Recomendable revertir/commitear por separado antes del archive para mantener el diff del change limpio.

---

## Artefactos leídos

- Spec: engram `sdd/asistencia-autollenado-p/spec` (#1678) + `openspec/changes/asistencia-autollenado-p/specs/spec.md`
- Design: `openspec/changes/asistencia-autollenado-p/design.md`
- Tasks: engram `sdd/asistencia-autollenado-p/tasks` (#1680) + `openspec/changes/asistencia-autollenado-p/tasks.md`
- Apply-progress: engram `sdd/asistencia-autollenado-p/apply-progress` (#1681)

## next_recommended

`sdd-archive` — sin CRITICAL que bloqueen. Antes de cerrar, atender W1 (reescribir spec canónico), W2 (commitear artefactos openspec) y W3 (sign-off de usuario sobre ADR-1) como parte del propio proceso de archive.
