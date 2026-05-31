# Archive Report: user-module-access

**Change**: Asignación Directa de Módulos a Usuarios
**Archived at**: 2026-05-31
**Archive path**: `openspec/changes/archive/2026-05-31-user-module-access/`
**Archive mode**: openspec

## Verification Results

- **Build API**: ✅ 0 TypeScript errors
- **Build Web**: ✅ 0 TypeScript errors
- **Tests Domain**: ✅ 500 tests pass
- **Tests API**: ✅ 136 tests pass
- **Total tests**: 636 passing
- **Tasks completed**: 10/10

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| system-modules-crud | Updated | Requirement "List Active Modules" — relaxed access to any authenticated user, added `actions` field, replaced scenarios (4 new: authenticated user with actions, module actions populated, soft-deleted excluded, unauth rejected) |
| user-management | Updated | Requirement "Create User" — added `moduleAccess` parameter, `user_modules` persistence, filtering rules, 2 new scenarios. Requirement "Update User" — added `moduleAccess` replacement, `user_modules` clear/preserve rules, 3 new scenarios. Fixed scenario: Role reassignment now correctly says "accepts" instead of "rejects" |
| auth-access | Updated | Added new requirement "Module-Level Assignment Authorization" with 4 scenarios (non-ROOT possess, non-ROOT lacks, mixed, ROOT bypass) |
| user-module-access | Created | New domain spec: module assignment rules (ROOT any, non-ROOT owned, empty clears, absent preserves), Module Access UI Grid scenarios (ROOT all, non-ROOT filtered, serialization) |

## Archive Contents

| Artifact | Status |
|----------|--------|
| proposal.md | ✅ |
| specs/auth-access/spec.md | ✅ |
| specs/system-modules-crud/spec.md | ✅ |
| specs/user-management/spec.md | ✅ |
| specs/user-module-access/spec.md | ✅ |
| design.md | ✅ |
| tasks.md | ✅ (10/10 tasks complete) |
| apply-plan.md | ✅ |

## Source of Truth Updated

The following specs now reflect the new behavior:
- `openspec/specs/system-modules-crud/spec.md` — List Active Modules returns `actions`, accessible to any authenticated user
- `openspec/specs/user-management/spec.md` — Create/Update accept `moduleAccess`, persist/update `user_modules`
- `openspec/specs/auth-access/spec.md` — Module-Level Assignment Authorization rule for non-ROOT filtering
- `openspec/specs/user-module-access/spec.md` — New domain: direct module-to-user assignment rules and UI grid

## Implementation Summary

- **T1**: `filter-module-access.ts` — pure function for module/action intersection
- **T2**: `modules.controller.ts` — relaxed GET /modules from ROOT-only to any authenticated
- **T3**: `ListModulesUseCase` — added `moduleActions` include, returns `actions` array
- **T4**: `users.controller.ts` — passes `creatorModules` from JWT and `moduleAccess` from body
- **T5**: `CreateUserUseCase` — upserts `user_modules` with filtering for non-ROOT
- **T6**: `UpdateUserUseCase` — deleteMany+createMany replace `user_modules`
- **T7**: `auth-context.tsx` — exposes `modules` field in User interface
- **T8**: `module-access-grid.tsx` — checkbox grid component (rows=modules, cols=5 actions)
- **T9**: `users.tsx` — integrates grid, serializes `moduleAccess` in create/update
- **T10**: Build + tests verification — all passing

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
Ready for the next change.
