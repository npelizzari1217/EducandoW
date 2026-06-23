# Apply Progress — asistencia-desde-alumnos-curso

Batches: PR 1 (Backend Slice) + PR 2 (Frontend Slice) — BOTH COMPLETE
TDD: Strict — test first, then impl, then green.
Date: 2026-06-23

## Test Results

### PR 1 — Backend
pnpm --filter api test: 163 test files passed, 1574 tests passed (0 failures)
pnpm build: 3 packages successful, 0 TypeScript errors

### PR 2 — Frontend
pnpm --filter web test: 43 test files passed, 451 tests passed (0 failures)
  - Baseline was 444; 7 new tests added: WM-10, WM-11, WM-12, WM-13, W-19, W-20, W-21
pnpm build: web build successful (198 modules, 0 TypeScript errors)

---

## Backend Tasks (PR 1) — COMPLETE

- [x] T-BE-1: Domain port — EnrichedGeneralAttendance + EnrichedMateriaAttendance interfaces + findByScopeAndMonthEnriched signatures
- [x] T-BE-2a: General repo — findByScopeAndMonthEnriched (new test file + impl)
- [x] T-BE-2b: Materia repo — findByScopeAndMonthEnriched (new test file + impl)
- [x] T-BE-3a: ListGeneralAttendanceUseCase — swapped to findByScopeAndMonthEnriched, returns EnrichedGeneralAttendance[]
- [x] T-BE-3b: ListSubjectAttendanceUseCase — swapped to findByScopeAndMonthEnriched, returns EnrichedMateriaAttendance[]
- [x] T-BE-4: DTOs (studentName: string added to both response interfaces) + controller (toGeneralResponse/toMateriaResponse now take studentName param; list paths pass e.studentName; PATCH paths pass '')

## Frontend Tasks (PR 2) — COMPLETE

- [x] T-FE-1: asistencia-mensual — AsistenciaGeneralRow + AsistenciaMateriaRow interfaces gain studentName:string; grid cell renders row.studentName (not row.studentId); test WM-10 asserts name visible, UUID not visible
- [x] T-FE-2: asistencia-mensual — useSearchParams reads ccId on mount; mount effect guards auto-select with !ccIdParam; separate effect keyed [courseCycles, ccIdParam] with useRef one-shot guard pre-selects matching CC and sets mode='general'; WM-11 (pre-select), WM-12 (silent fallback), WM-13 (no-param regression) all pass; renderPage() now wraps in MemoryRouter (atomic change, all existing WM-01..09 continue to pass)
- [x] T-FE-3: AlumnosCursoCicloPanel — imports useNavigate + useCan; "Ver asistencia" button gated by can('ATTENDANCE','READ') in the header div; navigates to /asistencia-mensual?ccId=${ccId}; tests W-19 (visible), W-20 (hidden), W-21 (navigate call) all pass

---

## Files Changed

### PR 1 — Backend

#### Domain
- packages/domain/src/asistencia/repositories/asistencia-general-repository.ts — EnrichedGeneralAttendance + findByScopeAndMonthEnriched
- packages/domain/src/asistencia/repositories/asistencia-materia-repository.ts — EnrichedMateriaAttendance + findByScopeAndMonthEnriched
- packages/domain/src/asistencia/index.ts — export new types
- packages/domain/src/index.ts — re-export new types

#### Infrastructure
- api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-asistencia-general.repository.test.ts [NEW]
- api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-general.repository.ts — findByScopeAndMonthEnriched
- api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-asistencia-materia.repository.test.ts [NEW]
- api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-materia.repository.ts — findByScopeAndMonthEnriched

#### Application
- api/src/application/asistencia/__tests__/list-general-attendance.use-case.test.ts — updated mock + return type assertions
- api/src/application/asistencia/list-general-attendance.use-case.ts — returns EnrichedGeneralAttendance[]
- api/src/application/asistencia/__tests__/list-subject-attendance.use-case.test.ts — updated mock + return type assertions
- api/src/application/asistencia/list-subject-attendance.use-case.ts — returns EnrichedMateriaAttendance[]

#### Presentation
- api/src/presentation/asistencia/dto/asistencia.dto.ts — studentName: string in both response interfaces
- api/src/presentation/asistencia/__tests__/asistencia.controller.test.ts — enriched wrapper mocks + studentName assertions
- api/src/presentation/asistencia/asistencia.controller.ts — mappers take studentName; list uses e.studentName; PATCH uses ''

### PR 2 — Frontend

- web/src/pages/dashboard/__tests__/asistencia-mensual.test.tsx — MemoryRouter wrapper; studentName in fixtures; 4 new tests (WM-10..13)
- web/src/pages/dashboard/asistencia-mensual.tsx — useSearchParams + useRef imports; studentName in row interfaces; row.studentName in grid; mount effect guarded; ccIdParam pre-selection effect
- web/src/pages/dashboard/__tests__/alumnos-curso-ciclo-panel.test.tsx — mockNavigate + react-router-dom mock; configurable mockModules; 3 new tests (W-19, W-20, W-21)
- web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx — useNavigate + useCan imports; "Ver asistencia" button in header

---

## ADR-5 Applied (PR 1)
PATCH /dia record handlers pass studentName: '' to the mapper.
Frontend optimistic merge reads only updated.days on that path — never the name.

## No Migration
No new Prisma migration files created (REQ-B5 confirmed — student relation pre-exists).

## Key Implementation Notes

### T-FE-2 Race-Free Pattern
The ccIdParam pre-selection uses a `useRef(false)` one-shot guard so that once applied,
user-driven selector changes don't get overridden if courseCycles somehow re-renders.
The mount effect guards with `!ccIdParam` so it never fights the param effect.

### T-FE-3 useCan Mocking in Tests
Existing alumnos-curso-ciclo-panel tests use `mockModules = []` (default, no ATTENDANCE).
The auth mock now reads mockModules at render time via closure. Tests W-19/W-21 set
`mockModules = [{ moduleCode: 'ATTENDANCE', actions: ['READ'] }]` before render.

### Test File Location
New tests added to EXISTING test file at:
  web/src/pages/dashboard/__tests__/alumnos-curso-ciclo-panel.test.tsx
(not a new file; the tasks artifact mentioned a new components/__tests__/ path, but the
existing test file already covers the panel and was the correct place to add coverage)
