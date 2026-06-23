# Apply Progress — asistencia-dias-bloqueados

**Slice:** PR1 — domain (Ph1 + Ph2 + Ph3)
**Date:** 2026-06-23
**Mode:** Strict TDD (test-first, RED → GREEN)
**Status:** COMPLETE

---

## Tasks completadas

### Phase 1 — calendar-utils.ts
- [x] T1.1 Tests escritos PRIMERO: `calendar-utils.spec.ts` — cubre UTIL-1..12 + timezone safety
- [x] T1.2 Implementación: `calendar-utils.ts` — `daysInMonth`, `dayOfWeek`, `buildLockedDayMap`
- [x] T1.3 Exports: `asistencia/index.ts` + root `index.ts`

### Phase 2 — Domain errors
- [x] T2.1 Tests escritos PRIMERO: `domain-errors.spec.ts` — instanceof checks, codes, type safety
- [x] T2.2 Implementación: `day-not-assignable-error.ts` + `status-not-assignable-error.ts`
- [x] T2.3 Exports: `asistencia/index.ts` + root `index.ts`

### Phase 3 — Ports +days?
- [x] T3.1 `GenerateGeneralInput` + JSDoc actualizado (read-merge-write semantics)
- [x] T3.2 `GenerateMateriaInput` + JSDoc actualizado
- [x] T3.3 Verificado: `pnpm --filter api typecheck` sin errores + `pnpm --filter api test` verde

---

## Archivos creados

| Archivo | Tipo |
|---------|------|
| `packages/domain/src/asistencia/utils/calendar-utils.ts` | NUEVO |
| `packages/domain/src/asistencia/utils/__tests__/calendar-utils.spec.ts` | NUEVO |
| `packages/domain/src/asistencia/errors/day-not-assignable-error.ts` | NUEVO |
| `packages/domain/src/asistencia/errors/status-not-assignable-error.ts` | NUEVO |
| `packages/domain/src/asistencia/errors/__tests__/domain-errors.spec.ts` | NUEVO |

## Archivos editados

| Archivo | Cambio |
|---------|--------|
| `packages/domain/src/asistencia/index.ts` | +exports utils + errors |
| `packages/domain/src/index.ts` | +re-exports utils + errors |
| `packages/domain/src/asistencia/repositories/asistencia-general-repository.ts` | +days? + JSDoc |
| `packages/domain/src/asistencia/repositories/asistencia-materia-repository.ts` | +days? + JSDoc |

---

## Resultado de gates finales

| Gate | Resultado |
|------|-----------|
| `pnpm --filter @educandow/domain test` | 101 archivos, 1140 tests — GREEN |
| `pnpm build` | GREEN (3 workspaces) |
| `pnpm --filter api typecheck` | 0 errores |
| `pnpm --filter api test` | 163 archivos, 1574 tests — GREEN |

---

## Contrato de errores implementado

| Error | Code | HTTP |
|-------|------|------|
| `DayNotAssignableError` | `DAY_NOT_ASSIGNABLE` | 422 (mapeo en Ph7) |
| `StatusNotAssignableError` | `STATUS_NOT_ASSIGNABLE` | 400 (mapeo en Ph7) |

---

## Qué queda (PR2 en adelante)

| PR | Fases | Descripción | Estado |
|----|-------|-------------|--------|
| PR2 | Ph4 | Infra `generateMany` read-merge-write (Prisma repos) | COMPLETO |
| PR3a | Ph5 + Ph7 | App generate (inyectar lockedMap) + exception filter | pendiente |
| PR3b | Ph6 | App guards en record-day use cases | pendiente |
| PR4 | Ph8 | Frontend grid 31 cols + assignable + celda lock | pendiente |

---

# Slice PR2 — infra (Ph4)

**Slice:** PR2 — infra repos (Ph4)
**Date:** 2026-06-23
**Mode:** Strict TDD (test-first, RED → GREEN)
**Status:** COMPLETE

---

## Tasks completadas (PR2)

### Phase 4 — Infra `generateMany` read-merge-write

- [x] T4.1 Tests escritos PRIMERO: `mergeLocked` + `daysChanged` puras — 7 tests
- [x] T4.2 Tests escritos PRIMERO: `generateMany` General repo — GEN-1,2,3 + REGEN-1,2,3,4 + idempotencia + empty input — 12 tests
- [x] T4.3 Tests escritos PRIMERO: `generateMany` Materia repo — GEN-4 + REGEN-4 + idempotencia — 6 tests
- [x] T4.4 Implementación: `prisma-asistencia-general.repository.ts` — read-merge-write transaccional
- [x] T4.5 Implementación: `prisma-asistencia-materia.repository.ts` — misma lógica, natural key `materiaXCursoXCicloId`

---

## Archivos creados (PR2)

| Archivo | Tipo |
|---------|------|
| `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-asistencia-general.repository.spec.ts` | NUEVO |
| `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-asistencia-materia.repository.spec.ts` | NUEVO |

## Archivos editados (PR2)

| Archivo | Cambio |
|---------|--------|
| `api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-general.repository.ts` | `generateMany` → read-merge-write + `mergeLocked`/`daysChanged` exported |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-materia.repository.ts` | mismo algoritmo, natural key `materiaXCursoXCicloId` |
| `openspec/changes/asistencia-dias-bloqueados/tasks.md` | T4.1..T4.5 marcados `[x]` |

---

## Decisiones de implementación (PR2)

- `mergeLocked` y `daysChanged` exportados con `@internal` para testabilidad directa (T4.1).
- `$transaction` mock: callback recibe `txClient` — firma coincide con Prisma real (evita falsos positivos).
- `daysChanged` usa `Object.keys().sort()` para comparación order-independent.
- `findMany` usa `select: { id, studentId, days }` para evitar over-fetch.
- Cuando `toCreate.length === 0`, el bloque `createMany` se saltea (no DB call innecesaria).
- Returns `{ created: toCreate.length, skipped: toUpdate.length }` — computed ANTES de la transacción (no depende del count de Prisma).

---

## Resultado de gates finales (PR2)

| Gate | Resultado |
|------|-----------|
| `pnpm --filter api test` | 165 archivos, 1601 tests — GREEN |
| `pnpm build` | GREEN (3 workspaces) |
| `pnpm --filter api typecheck` | 0 errores |

---

# Slice PR3 — backend app + presentation (Ph5 + Ph6 + Ph7)

**Slice:** PR3 — app use cases + exception filter (Ph5 + Ph6 + Ph7)
**Date:** 2026-06-23
**Mode:** Strict TDD (test-first, RED → GREEN)
**Status:** COMPLETE

---

## Tasks completadas (PR3)

### Phase 5 — App `generate-monthly-attendance` + lockedMap

- [x] T5.1 Tests escritos PRIMERO: GEN-1..5 + same-reference — 6 tests — `generate-monthly-attendance.use-case.test.ts`
- [x] T5.2 Implementación: importar `buildLockedDayMap`, computar `lockedMap` una vez por ejecución, inyectar `days: lockedMap` en `generalRows` y `subjectRows`

### Phase 6 — App guards en record-day use cases

- [x] T6.1 Tests escritos PRIMERO: GUARD-1..9 + order-check — 13 tests — `record-general-attendance-day.use-case.test.ts` (también actualizado: `day=31` June → DayNotAssignableError, `assignable` en fixture)
- [x] T6.2 Tests escritos PRIMERO: GUARD-10 + mirror SAB/happy path + order-check — 5 tests — `record-subject-attendance-day.use-case.test.ts`
- [x] T6.3 Implementación: guards en `record-general-attendance-day.use-case.ts` — 6-step guard (eliminar `daysInMonth` local, step 2 `1..31`, step 3 `daysInMonth`, step 4 `dayOfWeek`, step 5 catálogo, step 6 assignable)
- [x] T6.4 Implementación: guards en `record-subject-attendance-day.use-case.ts` — misma lógica

### Phase 7 — Presentation exception filter

- [x] T7.1 Tests escritos PRIMERO: FILTER-1..5 — 7 tests — `exception.filter.spec.ts` (archivo nuevo)
- [x] T7.2 Implementación: `DOMAIN_STATUS` + `DAY_NOT_ASSIGNABLE: 422` + `STATUS_NOT_ASSIGNABLE: 400`; extrae `code = exception.code` en rama DomainError; envelope `{ error: { status, code, message } }` (aditivo)

---

## Archivos creados (PR3)

| Archivo | Tipo |
|---------|------|
| `api/src/presentation/shared/filters/__tests__/exception.filter.spec.ts` | NUEVO |

## Archivos editados (PR3)

| Archivo | Cambio |
|---------|--------|
| `api/src/application/asistencia/generate-monthly-attendance.use-case.ts` | +`buildLockedDayMap`, `days: lockedMap` en generalRows y subjectRows |
| `api/src/application/asistencia/__tests__/generate-monthly-attendance.use-case.test.ts` | +GEN-1..5 + same-reference tests |
| `api/src/application/asistencia/record-general-attendance-day.use-case.ts` | guard 6-step, remove local daysInMonth, imports domain errors |
| `api/src/application/asistencia/__tests__/record-general-attendance-day.use-case.test.ts` | +GUARD-1..9, +fullCatalog, update day=31 → DayNotAssignableError, +assignable in fixture |
| `api/src/application/asistencia/record-subject-attendance-day.use-case.ts` | guard 6-step, remove local daysInMonth, imports domain errors |
| `api/src/application/asistencia/__tests__/record-subject-attendance-day.use-case.test.ts` | +GUARD-10 + mirror, +fullCatalog, update day=31 → DayNotAssignableError |
| `api/src/presentation/shared/filters/exception.filter.ts` | +DAY_NOT_ASSIGNABLE/STATUS_NOT_ASSIGNABLE, +code en envelope (aditivo) |
| `openspec/changes/asistencia-dias-bloqueados/tasks.md` | T5.1..T7.2 marcados `[x]` |

---

## Decisiones de implementación (PR3)

- `daysInMonth` local eliminado de ambos use cases → REQ-UTIL-4 completado; ahora solo el domain es la fuente.
- Step 2 usa `day > 31` (rango sintáctico del grid): `day=0` o `day=99` → ValidationError; `day=31` en Jun → step 3 → DayNotAssignableError.
- `types.some()` reemplazado por `types.find()` para poder acceder a `type.assignable` sin segundo lookup.
- Exception filter: `code: undefined` para HttpException (serializado como ausente en JSON — no rompe consumers de `error.status`).
- Tests de fixture: `validAttendanceTypes` actualizado con `assignable: true`; `fullCatalog` agrega SAB/DOM/X con `assignable: false` para tests GUARD-5/6/7.
- `beforeEach` en exception.filter.spec.ts usa dynamic import para asegurar que el módulo importa fresh (el `@Catch()` decorator requiere reflect-metadata que está disponible en el entorno Vitest).

---

## Resultado de gates finales (PR3)

| Gate | Resultado |
|------|-----------|
| `pnpm --filter api test` | 166 archivos, 1631 tests — GREEN |
| `pnpm build` | GREEN (3 workspaces) |
| `pnpm --filter api typecheck` | 0 errores |

---

## Qué queda

| PR | Fases | Descripción | Estado |
|----|-------|-------------|--------|
| PR4 | Ph8 | Frontend grid 31 cols + assignable + celda lock | pendiente |
