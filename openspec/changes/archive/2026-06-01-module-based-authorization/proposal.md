# Proposal: Module-Based Authorization

**Pedagogical level**: ALL

## Intent

Replace ALL role-based access restrictions (except ROOT) with module-based checks across sidebar, API guards, and frontend routes. ROOT continues to bypass everything. Non-ROOT users access resources SOLELY via `{module, action}` permissions. Roles persist for hierarchy (`canManageUser`) and user grouping — they do NOT grant direct access.

## Scope

### In Scope
- Sidebar: add `moduleCode` to NavItem, replace `item.roles` whitelist with module READ permission check; ROOT bypass stays
- API: convert all `@Roles('ADMIN','MANAGER','TEACHER',...)` to `@Roles('ROOT', {module:'X', action:'READ'})` (or CREATE/UPDATE/DELETE/PRINT) across all 20 controllers
- Seed: add missing modules (STUDY_PLANS, CLASSROOMS) and role_module entries for DIRECTOR, SECRETARIO, PRECEPTOR roles
- Frontend: fix `ProtectedRoute` to check module permission via `user.hasPermission(module, action)` instead of `user.role`
- Frontend pages: fix `user.role === 'ADMIN'` and similar checks to use module permissions or ROOT array check

### Out of Scope
- Removing roles from DB or User entity
- Changing `canManageUser`/`canViewUser` hierarchy logic
- Removing `role` column or `UserRole` type
- Changing role hierarchy constants

## Capabilities

### Modified Capabilities
- **auth-access**: Guard-Based Route Protection broadens to ALL controllers using module+action exclusively; role strings removed from `@Roles()`
- **sidebar-navigation**: NavItem gains `moduleCode`; filter switches from role whitelist to module READ check
- **nivel-inicial**, **nivel-primario**, **nivel-secundario**, **nivel-terciario**: Authorization rules switch from role names to module+action
- **student-profile**: `/me`, `/my-children`, PATCH authorization switches to module+action
- **legajo-view**, **study-plans**, **user-management**: Authorization rules switch to module+action

### New Capabilities
None.

## Approach

1. **Module mapping**: Map each controller to its semantically closest module. Seed modules: INSTITUTIONS, USERS, STUDENTS, TEACHERS, SUBJECTS, COURSES, ENROLLMENTS, GRADES, ATTENDANCE, REPORTS. Add STUDY_PLANS and CLASSROOMS where needed. Add missing role_module entries for DIRECTOR, SECRETARIO, PRECEPTOR.

2. **Sidebar**: `NavItem` gains `moduleCode: string`. Filter replaces `item.roles.includes(user.role)` with `isRoot(user) || userHasModuleRead(user, item.moduleCode)`.

3. **Controllers**: Replace every `@Roles(roleString, ...)` with `@Roles('ROOT', {module, action})`. Read endpoints → READ. Write endpoints → CREATE/UPDATE/DELETE. ModulesController stays `@Roles('ROOT')` only.

4. **ProtectedRoute**: Props change from `roles?: string[]` to `moduleCode? + action?`. Guard via `user.hasPermission()`. ROOT bypass built-in.

## Affected Areas

| Area | Impact |
|------|--------|
| `web/src/components/layout/sidebar.tsx` | NavItem + filter logic |
| `web/src/components/layout/protected-route.tsx` | Route guard |
| `api/src/presentation/**/*.controller.ts` | 20 controllers, ~50 `@Roles` |
| `api/prisma/seed-rbac.sql` | New modules + role_module rows |
| `web/src/pages/dashboard/*.tsx` | ~8 pages, inline role checks |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| DIRECTOR/SECRETARIO/PRECEPTOR lose access (missing seed entries) | Medium | Add role_module seed before conversion |
| Missing modules for level-specific content | Low | Add STUDY_PLANS, CLASSROOMS via seed |

## Success Criteria

- [ ] No `@Roles('ADMIN',...)` / `@Roles('MANAGER',...)` / `@Roles('TEACHER',...)` remain in any controller
- [ ] Sidebar filters items by module READ permission, not role name
- [ ] ProtectedRoute checks `hasPermission(module, action)`, not `user.role`
- [ ] All existing tests pass after conversion
- [ ] Seed includes module assignments for all 9 roles across all relevant modules
