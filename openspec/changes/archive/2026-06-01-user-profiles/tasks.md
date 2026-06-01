# Tasks: User Profiles (Backend)

**Change**: user-profiles
**Mode**: hybrid (TDD enabled)

---

## Phase 1: Schema + Migration

- [x] **T1.1** — Agregar modelos a `schema_master.prisma`
  - Modelo `Profile`: id, name, active, deletedAt, createdAt, updatedAt
  - Modelo `ProfileModulePermission`: id, profileId, moduleId, canRead, canCreate, canEdit, canDelete, canPrint + @@unique + @@map
  - Agregar `profileId String?` + relación a User
  - Ejecutar migración

## Phase 2: Seed Data

- [x] **T2.1** — Seed SQL: perfiles por defecto
  - Perfil "Administrador": todos los módulos con todos los permisos
  - Perfil "Docente": STUDENTS(READ), TEACHERS(READ), GRADES(READ,CREATE,UPDATE), ATTENDANCE(READ,CREATE,UPDATE), REPORTS(READ)
  - Perfil "Preceptor": STUDENTS(READ), ATTENDANCE(READ,CREATE,UPDATE)

- [x] **T2.2** — Seed TS: reflejar cambios

## Phase 3: Profiles Module (6 archivos nuevos)

- [x] **T3.1** — DTOs (3 archivos)
  - `create-profile.dto.ts`: name (string, 1-100)
  - `update-profile.dto.ts`: name (optional)
  - `update-permissions.dto.ts`: permissions array con moduleId + 5 booleanos

- [x] **T3.2** — `profiles.use-cases.ts`
  - `listProfiles()` — activos, con conteo de módulos asignados
  - `getProfile(id)` — perfil con matriz de permisos
  - `createProfile(name)` — crear perfil
  - `updateProfile(id, name)` — actualizar nombre
  - `deleteProfile(id)` — soft delete
  - `getPermissions(profileId)` — TODOS los módulos con booleanos (false si no asignado)
  - `updatePermissions(profileId, permissions)` — upsert: crear si no existe, actualizar si existe

- [x] **T3.3** — `profiles.controller.ts`
  - `GET /v1/profiles` — listar
  - `GET /v1/profiles/:id` — detalle con permisos
  - `POST /v1/profiles` — crear
  - `PATCH /v1/profiles/:id` — actualizar
  - `DELETE /v1/profiles/:id` — soft delete
  - `GET /v1/profiles/:id/permissions` — matriz completa
  - `PUT /v1/profiles/:id/permissions` — guardar matriz
  - Protección: `@Roles('ROOT', {module:'USERS',action:'READ'})` para GET, `CREATE/UPDATE/DELETE` para escritura

- [x] **T3.4** — `profiles.module.ts` — registrar controller + use cases

- [x] **T3.5** — Registrar `ProfilesModule` en `app.module.ts`

## Phase 4: User Integration

- [x] **T4.1** — Agregar `profileId` a create-user.dto.ts (opcional)
- [x] **T4.2** — Agregar `profileId` a update-user.dto.ts (opcional)
- [x] **T4.3** — `users.use-cases.ts`: lógica de asignación de perfil
  - Si `profileId` viene en create/update:
    1. Cargar permisos del perfil
    2. Convertir booleanos → `String[] actions`: canRead→READ, canCreate→CREATE, canEdit→UPDATE, canDelete→DELETE, canPrint→PRINT
    3. Pasar por `filterModuleAccess()` (seguridad)
    4. Crear/actualizar UserModule records
    5. Guardar `profileId` en el usuario

## Phase 5: Verify

- [x] **T5.1** — `pnpm --filter api build` (0 errores)
- [x] **T5.2** — `pnpm test` (todos los tests pasan)
- [x] **T5.3** — Migración aplicada correctamente
