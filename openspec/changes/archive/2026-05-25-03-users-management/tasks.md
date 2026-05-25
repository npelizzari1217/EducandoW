# Tasks: Gestión de Usuarios con Jerarquía de Roles

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650–700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (domain + application) → PR 2 (infrastructure/API) → PR 3 (presentation/web) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain role hierarchy + 4 use cases | PR 1 | Foundation: hierarchy constants, canManageUser, all use cases with hierarchy guards |
| 2 | API controller, module, DTOs, app.module wiring | PR 2 | Depends on PR 1; HTTP layer + NestJS wiring |
| 3 | Web page, hooks, route, sidebar | PR 3 | Depends on PR 2; UI layer with hierarchy-aware buttons |

## Phase 1: Domain — Role Hierarchy

- [ ] 1.1 Create `packages/domain/src/auth/role-hierarchy.ts` with `ROLE_HIERARCHY` constant (ROOT=99, ADMIN=60, DIRECTOR=50, SECRETARIO=40, PRECEPTOR=30, TEACHER=20, TUTOR=10, STUDENT=0)
- [ ] 1.2 Add `ROLE_LABELS` mapping to Spanish labels in `role-hierarchy.ts`
- [ ] 1.3 Implement `getHighestRoleRank(roles: string[]): number` — returns highest rank or -1 for empty/unrecognized
- [ ] 1.4 Implement `canManageUser(creatorRoles: string[], targetRoles: string[]): boolean` — ROOT bypass, strict greater-than rank check
- [ ] 1.5 Update `packages/domain/src/auth/index.ts` to re-export role-hierarchy symbols
- [ ] 1.6 Update `packages/domain/src/index.ts` to re-export role-hierarchy symbols

## Phase 2: Application — Use Cases

- [ ] 2.1 Create `ListUsersUseCase` — fetch users with Prisma, apply `canManageUser` in-memory filter, support `institutionId` and `includeInactive` params
- [ ] 2.2 Create `CreateUserUseCase` — validate email uniqueness, check `canManageUser` against assigned roles, bcrypt.hash password, create user + `createMany` UserRole
- [ ] 2.3 Create `UpdateUserUseCase` — check `canManageUser` for existing roles AND new roles, sync UserRole via `deleteMany` + `createMany`, return `{ data: null }` if not found
- [ ] 2.4 Create `DeleteUserUseCase` — check `canManageUser`, set `active=false` + `deletedAt=now()`, return 204

## Phase 3: Infrastructure — API Layer

- [ ] 3.1 Create `api/src/presentation/users/dto/create-user.dto.ts` with Zod validation (email, password min 6, name, institutionId, level, roles min 1)
- [ ] 3.2 Create `api/src/presentation/users/dto/update-user.dto.ts` with Zod validation (optional fields + active toggle)
- [ ] 3.3 Create `api/src/presentation/users/users.controller.ts` — 4 endpoints (GET/POST/PATCH/DELETE `/v1/users`) with `@Roles` guards, extract `creatorRoles` from JWT
- [ ] 3.4 Create `api/src/presentation/users/users.module.ts` — NestJS module with `useFactory` per use case, imports PrismaService
- [ ] 3.5 Update `api/src/app.module.ts` — import `UsersModule`

## Phase 4: Presentation — Web UI

- [ ] 4.1 Add `useApiUpdate` hook to `web/src/hooks/use-api.ts` for PATCH/DELETE operations
- [ ] 4.2 Create `web/src/pages/dashboard/users.tsx` — table with name/email/institution/level/role(active status), institution filter, inactive toggle, inline form with institution dropdown + educational level select + role checkboxes showing hierarchy ranks
- [ ] 4.3 Implement hierarchy-aware action buttons in users page — "Edit"/"Delete" for manageable users, "Jerarquía superior" label for higher-ranked users
- [ ] 4.4 Add `/users` route to `web/src/App.tsx`
- [ ] 4.5 Add "Usuarios" sidebar item to `web/src/components/layout/sidebar.tsx` — visible only for ROOT, ADMIN, MANAGER roles
