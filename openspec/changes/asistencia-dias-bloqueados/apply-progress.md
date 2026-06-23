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

| PR | Fases | Descripción |
|----|-------|-------------|
| PR2 | Ph4 | Infra `generateMany` read-merge-write (Prisma repos) |
| PR3a | Ph5 + Ph7 | App generate (inyectar lockedMap) + exception filter |
| PR3b | Ph6 | App guards en record-day use cases |
| PR4 | Ph8 | Frontend grid 31 cols + assignable + celda lock |
