# Apply Progress — institucion-activa-global

**Status**: done  
**Date**: 2026-06-19  
**Mode**: Strict TDD (RED → GREEN per task)  
**Test run**: pnpm --filter web test → 415 passed, 0 failed  
**Typecheck**: tsc --noEmit → 0 errors  

## Tasks

- [x] T-01: NEW `web/src/api/__tests__/active-institution.test.ts` — 3 store tests (get null, set+get, clear)
- [x] T-02: NEW `web/src/api/active-institution.ts` — getActiveInstitutionId / setActiveInstitutionId / clearActiveInstitutionId + applyActiveInstitution (KEY=`educandow:activeInstitutionId`)
- [x] T-03: EXTEND test file — 4 applyActiveInstitution cases: inject / preserve explicit / preserve '' / no-op when store empty
- [x] T-04: EXTEND active-institution.ts — applyActiveInstitution(config) implemented (inject only when config.params.institutionId == null)
- [x] T-05: MODIFY `web/src/api/client.ts` — added import + `return applyActiveInstitution(config)` replacing `return config` in request interceptor
- [x] T-06: NEW `web/src/context/__tests__/active-institution-context.test.tsx` — 4 cases (lazy init, setActive write-through, reload trigger, auth:logout clears)
- [x] T-07: NEW `web/src/context/active-institution-context.tsx` — ActiveInstitutionProvider + useActiveInstitution (lazy useState, setActive writes through + reload, auth:logout listener)
- [x] T-08: MODIFY `web/src/App.tsx` — import ActiveInstitutionProvider, wrapped under InstitutionProvider
- [x] T-09: MODIFY `web/src/__tests__/App.test.tsx` — added vi.mock for active-institution-context
- [x] T-10: NEW `web/src/components/layout/__tests__/active-institution-selector.test.tsx` — 4 cases (non-ROOT null, ROOT placeholder, ROOT list, onChange calls setActive)
- [x] T-11: NEW `web/src/components/layout/active-institution-selector.tsx` — ROOT guard, GET /institutions, select bound to activeId, placeholder when null
- [x] T-12: MODIFY `web/src/components/layout/dashboard-layout.tsx` — import + render ActiveInstitutionSelector adjacent to ThemeToggle
- [x] T-13: Tests: 409/409 passed. Coverage on new files ≥80%. TypeScript: 0 errors.
- [x] T-14 (S-02): Allow deselect — context exposes `clear()`, selector calls it on empty value. Test: selecting '' calls `clear`. Test: `clear()` removes localStorage, sets activeId null, no reload.
- [x] T-15 (W-02): Tenant guard in DashboardLayout — `MASTER_ROUTES` constant, `isMasterRoute()` helper, `showTenantGuard` logic. ROOT + no activeId + tenant route → prompt shown + inline selector. Master routes always pass through. Tests: 4 cases covering all scenarios.
- [x] T-16: Tests: 415/415 passed. TypeScript: 0 errors.

## Files Changed

- NEW `web/src/api/active-institution.ts`
- NEW `web/src/api/__tests__/active-institution.test.ts`
- NEW `web/src/context/active-institution-context.tsx`
- NEW `web/src/context/__tests__/active-institution-context.test.tsx`
- NEW `web/src/components/layout/active-institution-selector.tsx`
- NEW `web/src/components/layout/__tests__/active-institution-selector.test.tsx`
- NEW `web/src/components/layout/__tests__/dashboard-layout.test.tsx`
- MODIFIED `web/src/api/client.ts`
- MODIFIED `web/src/App.tsx`
- MODIFIED `web/src/__tests__/App.test.tsx`
- MODIFIED `web/src/components/layout/dashboard-layout.tsx`
- MODIFIED `web/src/components/layout/active-institution-selector.tsx`

## Deviations / Notes

- T-03 and T-04 were implemented together with T-01 and T-02 (applyActiveInstitution included in the initial active-institution.ts)
- window.location.reload spy: vi.spyOn() fails in jsdom (non-configurable property). Used Object.defineProperty to replace location with a mock — documented in test file.
- ESLint errors in lint output are all pre-existing (materia-grupos.tsx hooks violations, gestion-grupos.test.tsx prefer-const). Zero new lint issues from this change.
- S-02: `clear()` does NOT reload (unlike setActive). The tenant guard reacts to the null state change, showing the prompt without a full page reload. This is intentional — cleaner UX.
- W-02: MASTER_ROUTES mirrors the backend isMasterRoute() in tenant.middleware.ts. The `/` (dashboard home) is explicitly in MASTER_ROUTES since DashboardPage renders no tenant API calls. An inline selector is rendered in the guard prompt as a secondary pick point (top-bar selector remains as primary).

## MASTER_ROUTE Allowlist (W-02)

Frontend MASTER_ROUTES (mirrors api/src/infrastructure/auth/tenant.middleware.ts):
- `/`             → DashboardPage (static, no tenant API)
- `/institutions` → InstitutionsPage (institution CRUD, master DB)
- `/users`        → UsersPage (user management, master DB)
- `/modules`      → ModulesPage (module management, master DB)
- `/profiles`     → ProfilesPage (profile management, master DB)

All other dashboard routes (`/students`, `/enrollments`, `/attendance`, `/legajos`,
`/study-plans`, `/inicial/*`, `/primario/*`, `/secundario/*`, `/terciario/*`,
`/course-cycles`, `/academic-cycles`, `/observations`, `/observations-by-cycle`,
`/attendance-types`, `/grading-scales`, `/grading-periods`, `/competency-grading`,
`/grading/by-course`, `/ingresantes`, `/grupos`) are TENANT-scoped and blocked
when ROOT has no active institution.
