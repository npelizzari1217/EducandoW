# Proposal: Gestión de Usuarios con Jerarquía de Roles

## Intent

CRUD completo de usuarios del sistema con control de acceso basado en jerarquía de roles (no nivel educativo). Un usuario solo administra usuarios con roles de jerarquía estrictamente inferior. ROOT omite toda restricción.

## Scope

### In Scope
- API REST `/v1/users`: GET (list con filtros), POST, PATCH, DELETE (soft-delete)
- Guards `@Roles('ROOT', {module:'USERS', action:READ|CREATE|UPDATE|DELETE})`
- `ROLE_HIERARCHY` y `canManageUser()` como concepto de dominio independiente del nivel educativo
- Sincronización de tabla `UserRole` en create/update, soft-delete (`active=false` + `deletedAt`)
- Página web `/users`: tabla, formulario, filtros (institución, inactivos), botones condicionales ("Jerarquía superior")

### Out of Scope
- Migración del campo `role` legacy a `roles[]` general
- Auditoría de cambios, importación masiva

## Capabilities

### New Capabilities
- `user-management`: CRUD de usuarios con filtros por institución, toggle inactivos, soft-delete
- `role-hierarchy`: Jerarquía de roles como concepto de dominio (`ROLE_HIERARCHY`, `canManageUser`)

### Modified Capabilities
- `auth-access`: incorpora `canManageUser` como regla adicional de autorización en casos de uso

## Approach

Backend: controlador NestJS con 4 endpoints, casos de uso en `application/`, regla `canManageUser` en `packages/domain/`. Frontend: duplica constantes de jerarquía (domain no se importa en web).

**Pedagogical level**: ALL.

## Affected Areas

| Area | Impact |
|------|--------|
| `packages/domain/src/auth/role-hierarchy.ts` | New |
| `packages/domain/src/auth/index.ts` | Modified |
| `packages/domain/src/index.ts` | Modified |
| `api/src/presentation/users/` | New (controller, module, DTOs) |
| `api/src/application/users/use-cases/` | New (4 use cases) |
| `api/src/app.module.ts` | Modified |
| `web/src/pages/dashboard/users.tsx` | New |
| `web/src/App.tsx` | Modified |
| `web/src/components/layout/sidebar.tsx` | Modified |
| `web/src/hooks/use-api.ts` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Duplicación de constantes domain↔frontend | Med | Documentado; frontend no depende de domain. Sincronizar manualmente si cambia jerarquía |
| Filtro `canManageUser` en memoria | Low | <1000 usuarios por institución. Migrar a SQL si escala |
| Soft-delete no revoca sesiones activas | Med | JWT access de 15min. Refresh token falla si `active=false` |

## Rollback Plan

Eliminar `UsersModule` de `app.module.ts`, carpetas `users/` de API, ruta `/users` de `App.tsx` y sidebar, página `users.tsx`. Revertir exports de domain. Sin migraciones estructurales que deshacer.

## Dependencies

- Auth guards (`AuthGuard`, `RolesGuard`, `@Roles`)
- Tablas `User`, `Role`, `UserRole` existentes
- `GET /v1/institutions` para dropdown en frontend

## Success Criteria

- [ ] CRUD `/v1/users` funcional con jerarquía de roles (no nivel educativo) como restricción
- [ ] `ROLE_HIERARCHY`: ROOT=99, ADMIN=60, DIRECTOR=50, SECRETARIO=40, PRECEPTOR=30, TEACHER=20, TUTOR=10, STUDENT=0
- [ ] `canManageUser(creatorRoles, targetRoles)`: solo si creatorRank > targetRank (ROOT omite)
- [ ] ROOT gestiona cualquier usuario; ADMIN gestiona DIRECTOR y menores (no ADMIN ni ROOT)
- [ ] Soft-delete (`active=false` + `deletedAt`) al eliminar
- [ ] Página `/users`: tabla, filtros, formulario, botones "Editar"/"Eliminar" o "Jerarquía superior"
- [ ] Sidebar muestra "Usuarios" solo para ROOT, ADMIN, MANAGER
