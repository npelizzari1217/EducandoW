# Tasks: Remove Deprecated User Fields

**Change**: remove-deprecated-user-fields
**Mode**: hybrid (TDD enabled)

---

## Phase 1: Domain

- [x] **T1.1** — Eliminar campos deprecados de `User` entity
  - Archivo: `packages/domain/src/auth/entities/user.ts`
  - Quitar de `UserProps`: `level?`, `modality?`
  - Quitar getters: `get level()`, `get modality()`
  - Quitar no-ops: `assignLevel()`, `assignModality()`
  - Actualizar constructor para no propagar `level`/`modality` al estado
  - **Gate**: `pnpm --filter @educandow/domain test`

## Phase 2: Schema

- [x] **T2.1** — Quitar columnas deprecadas de Prisma + migración
  - Archivo: `api/prisma/schema_master.prisma`
  - Quitar `level Int?` y `modality Int?` del modelo `User`
  - Ejecutar `pnpm prisma migrate dev --name drop_deprecated_user_level_modality` dentro de `api/`
  - **Gate**: `npx prisma validate` + verificar que `user_levels` no se rompe

## Phase 3: API Repository + Use Cases

- [x] **T3.1** — Limpiar `PrismaUserRepository`
  - Archivo: `api/src/infrastructure/persistence/prisma/repositories/prisma-user.repository.ts`
  - Quitar `level: number | null` y `modality: number | null` de `UserRow`
  - Actualizar `toDomain()`: no pasar `level`/`modality` a `User.create()`
  - Quitar `level`/`modality` de los `select` en queries Prisma

- [x] **T3.2** — Limpiar `users.use-cases.ts`
  - Archivo: `api/src/application/users/use-cases/users.use-cases.ts`
  - Quitar `level: number | null` y `modality: number | null` de `UserRow`
  - Reflejar cambios de `UserRow` en queries
  - **Gate**: `pnpm --filter api test`

## Phase 4: API Auth + JWT

- [x] **T4.1** — Limpiar JWT payload y guard
  - Archivos: `api/src/infrastructure/auth/jwt-auth-port.ts`, `api/src/infrastructure/auth/guards/auth.guard.ts`
  - Quitar `level?: number` de `JwtPayload` y `AuthenticatedUser`
  - Quitar `level: payload.level` del guard

- [x] **T4.2** — Limpiar `login.use-case.ts`
  - Archivo: `api/src/application/auth/use-cases/login.use-case.ts`
  - Quitar `backCompatLevel`, `level: backCompatLevel` del JWT
  - Quitar `role: user.role` del response (oportunístico)

- [x] **T4.3** — Limpiar `register-user.use-case.ts`
  - Archivo: `api/src/application/auth/use-cases/register-user.use-case.ts`
  - Quitar `modality: userLevels[0].modality` deprecado

## Phase 5: API DTOs

- [x] **T5.1** — Limpiar DTOs de usuario
  - Archivos:
    - `api/src/presentation/users/dto/create-user.dto.ts` — quitar `level`, `modality`
    - `api/src/presentation/users/dto/update-user.dto.ts` — quitar `level`, `modality`
    - `api/src/application/auth/dtos/user-profile.dto.ts` — quitar `level?`, `modality?`

- [x] **T5.2** — Build gate API
  - **Gate**: `pnpm --filter api build` (debe compilar sin errores)

## Phase 6: Frontend

- [x] **T6.1** — Limpiar `auth-context.tsx`
  - Archivo: `web/src/context/auth-context.tsx`
  - Quitar `level?: number` de interfaz `User`

- [x] **T6.2** — Limpiar página de usuarios
  - Archivo: `web/src/pages/dashboard/users.tsx`
  - Quitar `level: number | null`, `modality: number | null` de `UserForm`
  - Quitar fallbacks `u.level != null ? levelLabel(u.level) : '-'`
  - Dejar solo renderizado basado en `userLevels`

- [x] **T6.3** — Actualizar reporte de impresión
  - Archivo: `web/src/components/reports/UserPrintView.tsx`
  - Reemplazar `{u.level || '-'}` con renderizado de `userLevels`

- [x] **T6.4** — Build gate web
  - **Gate**: `pnpm --filter web build` (debe compilar sin errores)

## Phase 7: Full Verification

- [x] **T7.1** — Test suite completa
  - **Gate**: `pnpm test` (todos los tests deben pasar)
  - **Gate**: `pnpm build` (todos los paquetes compilan limpio)
