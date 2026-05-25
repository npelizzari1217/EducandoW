# Design: Gestión de Usuarios con Jerarquía de Roles

## Technical Approach

Backend: Controller NestJS con 4 endpoints CRUD bajo `/users`, módulo `UsersModule`, 4 casos de uso `@Injectable` que consumen `PrismaService.getMasterClient()`. La regla `canManageUser()` de `@educandow/domain` se aplica como guarda de negocio en cada caso de uso. Frontend: página React `/users` con tabla, formulario, filtros y botones condicionales — duplica constantes porque `web/` no depende de `@educandow/domain`.

## Architecture Decisions

| # | Decision | Options | Chosen | Rationale |
|---|----------|---------|--------|-----------|
| 1 | Role hierarchy location | DB table vs domain constant | `ROLE_HIERARCHY` in `packages/domain/src/auth/role-hierarchy.ts` | Regla inmutable, no dato configurable. Cambio de rol = cambio de código. No depende de infraestructura. |
| 2 | List filtering strategy | SQL WHERE vs in-memory `canManageUser()` | In-memory filter | Ranks no existen en DB (AD-1). <1000 usuarios/institución. Migrar a columna `rank` materializada si escala. |
| 3 | Frontend hierarchy constants | Import `@educandow/domain` vs duplicate | Duplicate `ROLE_HIERARCHY`, `ROLE_LABELS`, helpers | `web/` no declara dependencia a domain. ~20 líneas duplicadas. Riesgo mitigado por documentación. |
| 4 | UserRole sync approach | Inside `PrismaUserRepository.save()` vs use case | `deleteMany` + `createMany` en caso de uso | `User` entity no modela `UserRole` como colección. Lógica explícita donde se decide. Consistente por operación. |
| 5 | Password hashing | `PasswordHasher` port vs direct `bcrypt` | `bcrypt.hash()` directo en `CreateUserUseCase` | Sin segundo algoritmo ni necesidad de swap. Extraer puerto cuando sea necesario. |
| 6 | `@Roles` decorator format | Strings only vs modules only vs mixed | `@Roles('ROOT', {module:'USERS', action:'...'})` | `RolesGuard` bypass para ROOT; módulos para acceso granular. Semántica OR entre strings y módulos. |
| 7 | Delete pattern | Hard delete vs soft-delete | `active=false` + `deletedAt=now()` | Recuperable, preserva FKs. JWT 15min acota sesiones activas. `deletedAt` para auditoría. |

## Data Flow

```
Browser                    NestJS API                     Prisma
  │  GET /users             │                             │
  ├────────────────────────►│ AuthGuard→RolesGuard        │
  │                         │ ListUsersUseCase            │
  │                         │   findMany({include}) ─────►│
  │  ◄── {data: User[]}    │   filter canManageUser()    │
  │                         │                             │
  │  POST /users {body}    │                             │
  ├────────────────────────►│ CreateUserUseCase           │
  │                         │   email unique check ──────►│
  │                         │   canManageUser(roles)      │
  │                         │   bcrypt.hash(password)     │
  │                         │   user.create() ───────────►│
  │  ◄── {data: User}      │   userRole.createMany() ────►│
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/domain/src/auth/role-hierarchy.ts` | Create | `ROLE_HIERARCHY`, `ROLE_LABELS`, `getHighestRoleRank()`, `canManageUser()` |
| `packages/domain/src/auth/index.ts` | Modify | Re-export role-hierarchy symbols |
| `packages/domain/src/index.ts` | Modify | Re-export role-hierarchy symbols |
| `api/src/presentation/users/users.controller.ts` | Create | 4 endpoints thin controller, extrae `creatorRoles` del JWT |
| `api/src/presentation/users/users.module.ts` | Create | NestJS module con `useFactory` por caso de uso |
| `api/src/presentation/users/dto/create-user.dto.ts` | Create | Zod: email, password, name, institutionId, level, roles |
| `api/src/presentation/users/dto/update-user.dto.ts` | Create | Zod: campos opcionales + active toggle |
| `api/src/application/users/use-cases/users.use-cases.ts` | Create | List, Create, Update, Delete use cases |
| `api/src/app.module.ts` | Modify | Import `UsersModule` |
| `web/src/pages/dashboard/users.tsx` | Create | Tabla CRUD, filtros, form, roles con jerarquía visible |
| `web/src/hooks/use-api.ts` | Modify | Add `useApiUpdate` hook |
| `web/src/App.tsx` | Modify | Add `/users` route |
| `web/src/components/layout/sidebar.tsx` | Modify | Add "Usuarios" item (ROOT, ADMIN, MANAGER) |

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Domain | `canManageUser()`, `getHighestRoleRank()` | Vitest unit tests |
| Application | Use cases con Prisma mockeado | NestJS Testing Module |
| API | HTTP contracts, status codes | Vitest + supertest |
| E2E | Full CRUD flow | Playwright (out of scope) |

## Open Questions

None.
