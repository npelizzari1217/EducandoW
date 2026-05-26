# Proposal: Corrección de permisos y completitud del módulo Instituciones

## Intent

Corregir brechas de autorización en el módulo de Instituciones: ADMIN tiene permisos que solo debería tener ROOT (DELETE, PRINT, CREATE), ROOT no puede ver botones en el frontend, y la lista no filtra por tenant. Completar con endpoint de impresión y confirmación de borrado.

Pedagogical level: **ALL**.

## Scope

### In Scope
- Corregir `@Roles()` del controller para alinearlos con ROOT=total, ADMIN=solo propia
- Agregar filtro por tenant en `GET /institutions` y validación en `PATCH`
- Renombrar endpoint `PATCH` (admin edita propia → usa `/me`) y ajustar use case
- Agregar `GET /institutions/:id/print`
- Corregir seed: r-admin acciones m-inst de `ALL` → `READ,UPDATE`
- Frontend: cambiar condicionales `user?.role === 'ADMIN'` a permisos correctos
- Frontend: agregar botón Imprimir y modal de confirmación para delete

### Out of Scope
- Multi-tenant DB per institution (ya está planificado en exploración previa)
- Campos adicionales del modelo (ya están implementados los 25 campos)
- InstitutionContext y branding dinámico
- Migración a schema Prisma separado

## Capabilities

### New Capabilities
- **institution-print**: endpoint `GET /institutions/:id/print` accesible solo por ROOT

### Modified Capabilities
- **institution-lifecycle**: `DELETE` restringido a ROOT (no ADMIN). `GET /institutions` filtra por tenant para no-ROOT. `PATCH` valida que ADMIN solo edite su propia institución.

## Approach

**Fix permisos en controller**, no en la arquitectura. El `RolesGuard` ya soporta bypass de ROOT — el problema es que los decoradores `@Roles()` del controller están mal configurados. Se usa el patrón `@Roles('ROOT', { module: 'INSTITUTIONS', action: 'X' })` (como en users.controller) para que ROOT pase por bypass y otros roles pasen por module-action.

**Seed**: cambiar `r-admin` en `m-inst` de `ALL_ACTIONS` a `['READ', 'UPDATE']` en `seed.ts` y `seed-rbac.sql`.

**Frontend**: reemplazar `user?.role === 'ADMIN'` por `user?.role === 'ROOT' || user?.role === 'ADMIN'` donde aplique, y usar permisos de módulo para acciones específicas.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/src/presentation/institution/institution.controller.ts` | Modified | `@Roles()` corregidos, nuevo endpoint print |
| `api/src/application/institution/use-cases/institution.use-cases.ts` | Modified | Tenant filter en list, validación admin-own en update |
| `api/prisma/seed.ts` | Modified | r-admin m-inst: `ALL_ACTIONS` → `['READ','UPDATE']` |
| `api/prisma/seed-rbac.sql` | Modified | r-admin m-inst: quitar DELETE,PRINT |
| `web/src/pages/dashboard/institutions.tsx` | Modified | Condicionales de rol, botón imprimir, modal confirmación |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Regresión: ADMIN pierde acceso a su propia institución | Low | `/me` sigue sin `@Roles` (AuthGuard basta). ADMIN usa `/me`, no el list. |
| Seed idempotente: datos existentes no se corrigen | Low | Seed usa `upsert`. Para datos existentes, script manual de migración. |
| Frontend: ROOT ve botones que antes no veía | None | Cambio deseado. No hay riesgo de regresión. |

## Rollback Plan

Revertir commit. Los cambios son aditivos (nuevo endpoint) y correctivos (permisos). No hay migración de datos destructiva. El seed se corrige para nuevas instalaciones; instalaciones existentes requieren `UPDATE role_modules SET actions = ARRAY['READ','UPDATE'] WHERE id = 'rm-r-admin-m-inst'`.

## Dependencies

Ninguna. Los cambios son autónomos dentro del módulo Institutions.

## Success Criteria

- [ ] ROOT puede listar, crear, modificar, borrar e imprimir cualquier institución
- [ ] ADMIN solo ve y modifica SU institución vía `/me`, no puede borrar ni imprimir
- [ ] `GET /institutions` sin tenant filter devuelve todas para ROOT, vacío para ADMIN
- [ ] `DELETE /institutions/:id` devuelve 403 para ADMIN
- [ ] Seed `r-admin` en `m-inst` solo tiene `READ,UPDATE`
- [ ] Frontend muestra botones "Nueva", "Editar", "Eliminar", "Imprimir" para ROOT; solo "Editar" para ADMIN
- [ ] Eliminar muestra modal de confirmación antes de ejecutar
- [ ] Tests existentes pasan (`pnpm test`)
