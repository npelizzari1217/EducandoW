# Proposal: Asignación Directa de Módulos a Usuarios

## Intent

DIRECTOR, SECRETARIO y PRECEPTOR —definidos en el dominio pero sin `role_modules` en BD— dejan usuarios sin permisos. Permitir asignación directa de módulos vía `user_modules` (tabla YA existente) al crear/editar usuarios. Los roles persisten; `user_modules` sobrescribe `role_modules` (merge en `PrismaUserRepository.toDomain`).

## Scope

### In Scope
- `GET /v1/modules`: accesible a cualquier autenticado, retorna módulos con sus 5 acciones (READ, CREATE, UPDATE, DELETE, PRINT)
- `POST /v1/users` y `PATCH /v1/users/:id`: procesan `moduleAccess` → upsert en `user_modules`
- No-ROOT solo asigna módulos que él mismo posee (filtrado automático vía JWT `modules`)
- Frontend: checkbox grid módulos × acciones debajo de radio buttons de roles

### Out of Scope
- CRUD de módulos (ROOT-only, sin cambios)
- Seed de roles DIRECTOR/SECRETARIO/PRECEPTOR (trabajo de seed preexistente)
- Migraciones (tabla `user_modules` ya existe en schema_master.prisma)

## Capabilities

### New Capabilities
- `user-module-access`: asignación directa de módulos, endpoint de catálogo público, UI grid módulo×acción

### Modified Capabilities
- `system-modules-crud`: `GET /v1/modules` pasa de ROOT-only a autenticado, incluye `actions`
- `user-management`: create/update aceptan y persisten `moduleAccess`
- `auth-access`: regla de filtrado — no-ROOT solo asigna módulos que posee

## Approach

**Backend**: `CreateUserUseCase`/`UpdateUserUseCase` procesan `moduleAccess` haciendo upsert en `user_modules`. Para no-ROOT, intersectar con `req.user.modules`. `GET /v1/modules` cambia `@Roles('ROOT')` por `@Roles('ROOT', { module: 'USERS', action: 'READ' })` e incluye `module_actions`.

**Frontend**: grid con filas=módulos del creador y columnas=5 acciones con checkboxes. Serializar a `moduleAccess: [{ moduleCode, actions }]`.

## Affected Areas

- `api/.../users.use-cases.ts` — procesar moduleAccess en create/update
- `api/.../users.controller.ts` — pasar moduleAccess y creatorModules del request
- `api/.../dto/{create,update}-user.dto.ts` — ya tienen ModuleAccessSchema (hotfix previo)
- `api/.../modules.controller.ts` — @Roles de ROOT a autenticado, incluir actions
- `api/.../modules.use-cases.ts` — ListModulesUseCase incluye module_actions
- `web/.../users.tsx` — grid módulo×acción, enviar moduleAccess

Pedagogical level: ALL. Roles, módulos y user_modules son transversales a todos los niveles.

## Risks

- `moduleAccess: []` limpia permisos — Low. Si no se envía, no se toca `user_modules`.
- No-ROOT asigna módulo no poseído — Low. Intersección forzada en use-case.
- Cambio de GET /v1/modules rompe UI ROOT — Low. `actions` es campo nuevo, no usado.

## Rollback Plan

1. Revertir `@Roles` en ModulesController
2. Quitar upsert de `user_modules` en use-cases
3. Revertir formulario frontend
4. Datos residuales en `user_modules` son inocuos

## Dependencies

- `ModuleAccessSchema` en DTOs (hotfix previo)
- Seed DIRECTOR/SECRETARIO/PRECEPTOR (deuda preexistente, no bloquea)

## Success Criteria

- [ ] `GET /v1/modules` → 200 con `actions` para cualquier autenticado
- [ ] `POST /v1/users` con `moduleAccess` persiste en `user_modules`; login subsiguiente incluye el módulo en JWT
- [ ] No-ROOT asigna módulo que no posee → ignorado silenciosamente
- [ ] `PATCH /v1/users/:id` con `moduleAccess` actualiza `user_modules`
- [ ] Frontend: grid visible, envía datos correctos, filtrado por creatorModules para no-ROOT
