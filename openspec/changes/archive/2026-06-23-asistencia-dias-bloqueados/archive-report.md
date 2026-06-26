# Archive Report: asistencia-dias-bloqueados

**Fecha de archivado:** 2026-06-23
**Proyecto:** EducandoW
**Change:** `asistencia-dias-bloqueados`
**Estado:** ARCHIVED AND CLOSED

---

## Resumen ejecutivo

El change `asistencia-dias-bloqueados` ha sido implementado completamente, verificado (PASS, 0 CRITICAL, 0 WARNING) y archivado. Pre-carga y bloquea días no laborables (sábados, domingos y días inexistentes del mes) en la grilla mensual de asistencia, tanto en el backend (guard de PATCH) como en el frontend (celdas read-only). Deliverable: 4 PRs encadenados que cubren dominio, infraestructura, aplicación+presentación y frontend.

---

## Capacidades entregadas

### Nuevas

- **`calendar-utils` (domain):** `daysInMonth`, `dayOfWeek`, `buildLockedDayMap` en `packages/domain/src/asistencia/utils/calendar-utils.ts`. Única fuente de verdad de lógica de calendario; elimina 3 duplicaciones previas.
- **`DayNotAssignableError` / `StatusNotAssignableError`:** Errores de dominio tipados; `DAY_NOT_ASSIGNABLE → 422`, `STATUS_NOT_ASSIGNABLE → 400`.
- **Locked-day pre-loading en generación:** `generateMany` en ambos repos Prisma implementa lectura-merge-escritura; filas nuevas reciben mapa completo, filas existentes fusionan sin pisar días hábiles.
- **Backend guard double:** `record-general-attendance-day` y `record-subject-attendance-day` rechazan PATCH en días bloqueados (calendario, no JSONB) y en statusCodes no-assignable.
- **Frontend 31 columnas fijas + celdas bloqueadas:** `asistencia-mensual.tsx` renderiza siempre 31 columnas; celdas con `assignable=false` son read-only; combo filtrado por flag `assignable` de la API.

### Modificadas

- **`attendance-recording`** (main spec): ATR-R6, ATR-R7, ATR-R8, ATR-R9 + ATR-S25..ATR-S62 + ADR cross-reference + edge case matrix integrados en `openspec/specs/attendance-recording/spec.md`.
- **`AppExceptionFilter`:** `DOMAIN_STATUS` ampliado con `DAY_NOT_ASSIGNABLE: 422` y `STATUS_NOT_ASSIGNABLE: 400`; envelope `{ error: { status, code, message } }` (ADR-D6).
- **Domain barrel exports:** `daysInMonth`, `dayOfWeek`, `buildLockedDayMap`, `DayNotAssignableError`, `StatusNotAssignableError` exportados desde `packages/domain/src/index.ts`.

---

## Especificación implementada

19 ACs, todos PASS:

| AC | Descripción | Verify |
|----|-------------|--------|
| AC-01 | `buildLockedDayMap` en domain, único source, testada | ✅ PASS |
| AC-02 | Duplicación de `daysInMonth` en 3 archivos eliminada | ✅ PASS |
| AC-03 | SAB/DOM/X en days JSONB en generación | ✅ PASS |
| AC-04 | Ambos modos (General + Por Materia) | ✅ PASS |
| AC-05 | Re-gen fusiona sin pisar días hábiles | ✅ PASS |
| AC-06 | Estudiantes nuevos reciben pre-carga completa en re-gen | ✅ PASS |
| AC-07 | Finde → HTTP 422 DAY_NOT_ASSIGNABLE | ✅ PASS |
| AC-08 | Día inexistente → HTTP 422 DAY_NOT_ASSIGNABLE | ✅ PASS |
| AC-09 | statusCode no-assignable → HTTP 400 STATUS_NOT_ASSIGNABLE | ✅ PASS |
| AC-10 | Día hábil + assignable → HTTP 200 (happy path) | ✅ PASS |
| AC-11 | Guard derivado del calendario, no del JSONB | ✅ PASS |
| AC-12 | Simetría de guard: General = Por Materia | ✅ PASS |
| AC-13 | Grilla siempre 31 columnas | ✅ PASS |
| AC-14 | Celdas bloqueadas read-only, sin combo | ✅ PASS |
| AC-15 | Lock por flag `assignable`, no lista hardcodeada | ✅ PASS |
| AC-16 | Combo muestra solo códigos assignable | ✅ PASS |
| AC-17 | Feb 2025: días 29/30/31 → X; Feb 2024: día 29 no bloqueado | ✅ PASS |
| AC-18 | Sin migración de DB | ✅ PASS |
| AC-19 | Envelope `{ error: { status, code, message } }` (ADR-D6) | ✅ PASS |

---

## Merge en specs principales

| Spec principal | Ruta | Cambio |
|----------------|------|--------|
| `attendance-recording` | `openspec/specs/attendance-recording/spec.md` | ATR-R6..ATR-R9 + ATR-S25..ATR-S62 agregados; header actualizado con 3 changes; ADR cross-reference y edge case matrix añadidos |

La delta spec `openspec/changes/asistencia-dias-bloqueados/specs/spec.md` (S-UTIL, S-GEN, S-REGEN, S-GUARD, S-GRID) queda consolidada en la spec principal. No se creó una spec principal nueva; el contenido se integró en la capability `attendance-recording` ya existente.

---

## Entrega: 4 PRs

| PR | Fases | Contenido | Estado |
|----|-------|-----------|--------|
| PR 1 | Ph1 + Ph2 + Ph3 | Domain: `calendar-utils`, errores tipados, `days?` en ports | Mergeado |
| PR 2 | Ph4 | Infra: `generateMany` read-merge-write (general + materia repos) | Mergeado |
| PR 3 | Ph5 + Ph6 + Ph7 | App: inyección lockedMap en generate, guards PATCH, exception filter | Mergeado |
| PR 4 | Ph8 | Frontend: 31 columnas, celdas bloqueadas, combo filtrado | Mergeado |

---

## Gate results (verify final)

| Gate | Resultado |
|------|-----------|
| `pnpm --filter @educandow/domain test` | 101 files, 1140 tests — GREEN |
| `pnpm --filter api test` | 166 files, 1631 tests — GREEN |
| `pnpm --filter web test` | 43 files, 461 tests — GREEN |
| `pnpm exec turbo run build --force` | 3 workspaces GREEN |
| `pnpm --filter api typecheck` | 0 errors |

Total: 3232 tests GREEN. 0 CRITICAL · 0 WARNING · 2 SUGGESTION (ambas no-action, documentadas en verify-report.md).

---

## Archivos entregados

### Nuevos

```
packages/domain/src/asistencia/utils/calendar-utils.ts
packages/domain/src/asistencia/utils/__tests__/calendar-utils.spec.ts
packages/domain/src/asistencia/errors/day-not-assignable-error.ts
packages/domain/src/asistencia/errors/status-not-assignable-error.ts
packages/domain/src/asistencia/errors/__tests__/domain-errors.spec.ts
api/src/infrastructure/repositories/__tests__/merge-locked.spec.ts
api/src/infrastructure/repositories/__tests__/prisma-asistencia-general.repository.spec.ts
api/src/infrastructure/repositories/__tests__/prisma-asistencia-materia.repository.spec.ts
api/src/application/asistencia/__tests__/generate-monthly-attendance.use-case.spec.ts
api/src/application/asistencia/__tests__/record-general-attendance-day.use-case.spec.ts
api/src/application/asistencia/__tests__/record-subject-attendance-day.use-case.spec.ts
api/src/presentation/shared/filters/__tests__/exception.filter.spec.ts
web/src/pages/dashboard/__tests__/asistencia-mensual.spec.tsx
```

### Modificados

```
packages/domain/src/asistencia/index.ts          (exports nuevos)
packages/domain/src/index.ts                      (re-exports nuevos)
packages/domain/src/asistencia/repositories/asistencia-general-repository.ts  (days? en GenerateGeneralInput)
packages/domain/src/asistencia/repositories/asistencia-materia-repository.ts  (days? en GenerateMateriaInput)
api/src/infrastructure/repositories/prisma-asistencia-general.repository.ts   (read-merge-write)
api/src/infrastructure/repositories/prisma-asistencia-materia.repository.ts   (read-merge-write)
api/src/application/asistencia/generate-monthly-attendance.use-case.ts        (buildLockedDayMap injection)
api/src/application/asistencia/record-general-attendance-day.use-case.ts      (guards + elimina daysInMonth local)
api/src/application/asistencia/record-subject-attendance-day.use-case.ts      (guards + elimina daysInMonth local)
api/src/presentation/shared/filters/exception.filter.ts                        (DOMAIN_STATUS + envelope code)
web/src/pages/dashboard/asistencia-mensual.tsx    (31 cols, locked cells, combo filtrado, daysInMonth domain)
```

---

## Artifact traceability

### Engram topic keys

| Artifact | Topic Key | ID |
|----------|-----------|-----|
| Proposal | `sdd/asistencia-dias-bloqueados/proposal` | #1407 |
| Spec | `sdd/asistencia-dias-bloqueados/spec` | #1409 |
| Design (reconciled) | Reconciliado design vs spec (errores guard) | #1410 |
| Apply progress | `sdd/asistencia-dias-bloqueados/apply-progress` | #1413 |
| Verify report | `sdd/asistencia-dias-bloqueados/verify-report` | #1416 |
| Archive report | `sdd/asistencia-dias-bloqueados/archive-report` | (new — this document) |

### File locations

| Artifact | Ruta |
|----------|------|
| Main spec actualizada | `openspec/specs/attendance-recording/spec.md` |
| Todos los artefactos del change (archivados) | `openspec/changes/archive/2026-06-23-asistencia-dias-bloqueados/` |
| Archive report | `openspec/changes/archive/2026-06-23-asistencia-dias-bloqueados/archive-report.md` |

---

## Estado final

**ARCHIVED** — El change está completo, verificado (PASS), sin issues bloqueantes, y todos los artefactos consolidados en el archivo. La spec principal `attendance-recording` refleja el estado canónico de la capability (ATR-R1..ATR-R9, ATR-S1..ATR-S62).

---

**Archivado por:** SDD Archive Executor
**Fecha:** 2026-06-23
**Artifact Store:** openspec (file-based)
