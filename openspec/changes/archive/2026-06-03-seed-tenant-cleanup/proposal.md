# Proposal: Cleanup de seed no idempotente y documentación de db push

## Intent

Dos ítems de deuda técnica del audit del proyecto:
- `seed-tenant-data.ts` usa `create()`/`createMany()` en lugar de `upsert()` — re-ejecutar el seed crasha con unique constraint violations.
- Archivos de archive documentan `prisma db push` como workflow aceptable, práctica que ya causó problemas de migraciones.

## Scope

### In Scope
- Eliminar `api/prisma/seed-tenant-data.ts` si es redundante, o convertirlo a `upsert()`
- Agregar advertencia en 3 archive files que documentan `prisma db push` como deprecated

### Out of Scope
- No modificar `seed.ts` ni `seed-tenant.ts` — ya son idempotentes
- No modificar migrations existentes

## Capabilities

### Modified Capabilities
- `tenant-database`: Agregar requerimiento explícito de que todos los seed scripts de tenant DB usen `upsert()` y sean re-ejecutables sin error

### New Capabilities
- `db-migration-policy`: Proyecto prohíbe `prisma db push` en workflows documentados; solo `prisma migrate deploy` o `prisma migrate dev`

## Approach

1. **seed-tenant-data.ts**: Las funciones de referencia (`seedAttendanceStatuses`, `seedGradeScales`) ya existen en `seed.ts` con `upsert()` y son usadas por `seed-tenant.ts`. Los datos demo (student, teacher, enrollment, etc.) son fixtures no esenciales. El archivo no es importado por nadie → **DELETE**.
2. **Archive files**: Insertar comentario `<!-- ADVERTENCIA: prisma db push está DEPRECATED. Usar prisma migrate deploy. -->` al inicio de los 3 archivos que lo mencionan.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/prisma/seed-tenant-data.ts` | Delete | Redundante, no idempotente, 0 imports |
| `openspec/changes/archive/2026-06-02-curso-por-ciclo/archive-report.md` | Modified | Agregar warning db push |
| `openspec/changes/archive/2026-05-26-06-planes-de-estudio/tasks.md` | Modified | Agregar warning db push |
| `openspec/changes/archive/2026-05-26-06-planes-de-estudio/design.md` | Modified | Agregar warning db push |
| `openspec/specs/tenant-database/spec.md` | Modified | Agregar req de seed idempotente |
| `openspec/specs/db-migration-policy/spec.md` | Create | Nueva spec de política |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Alguien depende de seed-tenant-data.ts no documentado | Low | grep confirma 0 referencias en código y docs |
| Archive modificado rompe parse de alguna herramienta | Low | Solo insertamos comentario HTML al inicio, sin tocar contenido |

## Rollback Plan

- `git revert` del commit
- Recuperar `seed-tenant-data.ts` del commit anterior si fuera necesario

## Dependencies

None — standalone cleanup.

## Success Criteria

- [ ] `seed-tenant-data.ts` eliminado del filesystem
- [ ] `pnpm test` pasa sin regresiones
- [ ] Seed de tenant (`seed-tenant.ts`) corre dos veces sin crash
- [ ] Los 3 archive files tienen warning visible de db push deprecated
- [ ] Specs actualizadas reflejan los nuevos requerimientos
