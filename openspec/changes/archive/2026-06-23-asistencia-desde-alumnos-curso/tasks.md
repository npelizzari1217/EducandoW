# Tasks — asistencia-desde-alumnos-curso

> Phase: tasks. Delivery: auto-chain (2 PRs: backend slice first, then frontend slice).
> TDD: Strict. `pnpm test` / `pnpm build`. Coverage ≥ 80%.
> Each task = one work-unit commit (test + impl shipped together).

---

## Review Workload Forecast

| Item | Estimated lines |
|---|---|
| Domain port types — 2 files | ~25 |
| General repo test (NEW file) | ~100 |
| General repo impl (new method) | ~35 |
| Materia repo test (NEW file) | ~100 |
| Materia repo impl (new method) | ~35 |
| List-general UC test update | ~40 |
| List-general UC impl update | ~10 |
| List-subject UC test update | ~40 |
| List-subject UC impl update | ~10 |
| DTO update (2 interfaces) | ~5 |
| Controller test update | ~40 |
| Controller impl update (mappers + list handlers) | ~25 |
| asistencia-mensual test update | ~100 |
| asistencia-mensual.tsx update (row types + cell + params) | ~60 |
| AlumnosCursoCicloPanel test (NEW file) | ~100 |
| AlumnosCursoCicloPanel impl (button) | ~30 |
| **Total estimated** | **~755 lines** |

**400-line budget risk:** High
**Chained PRs recommended:** Yes

**PR 1 — backend slice** (T-BE-1 → T-BE-4): ~465 lines, 13 files
**PR 2 — frontend slice** (T-FE-1 → T-FE-3): ~290 lines, 4 files

**Decision needed before apply:** No — auto-chain delivery mode active. Implement PR 1 first, then PR 2 once PR 1 lands.

---

## PR 1 — Backend Slice

Sequential dependency: T-BE-1 → (T-BE-2a ∥ T-BE-2b) → (T-BE-3a ∥ T-BE-3b) → T-BE-4

---

### T-BE-1 — Domain port: enriched wrapper types + method signatures
**Status:** [x]
**Must complete before:** T-BE-2a, T-BE-2b, T-BE-3a, T-BE-3b
**Parallelism:** SEQUENTIAL (unblocks all subsequent backend tasks)
**Spec:** REQ-B3, REQ-B6

**Work:**
- `packages/domain/src/asistencia/repositories/asistencia-general-repository.ts`
  — add `export interface EnrichedGeneralAttendance { attendance: AsistenciaXAlumnoXCursoXCiclo; studentName: string; }`
  — add method signature `findByScopeAndMonthEnriched(courseCycleId, year, month, studentIds?): Promise<EnrichedGeneralAttendance[]>`
- `packages/domain/src/asistencia/repositories/asistencia-materia-repository.ts`
  — add `export interface EnrichedMateriaAttendance { attendance: AsistenciaXMateriaXAlumnoXCursoXCiclo; studentName: string; }`
  — add method signature `findByScopeAndMonthEnriched(materiaXCursoXCicloId, year, month, studentIds?): Promise<EnrichedMateriaAttendance[]>`

**No test:** pure TypeScript interfaces; TypeScript compiler validates at T-BE-2a/2b/3a/3b.

**Commit:** `feat(domain): add EnrichedGeneralAttendance + EnrichedMateriaAttendance port types`

---

### T-BE-2a — General repo: enriched method (test + impl)
**Status:** [x]
**Depends on:** T-BE-1
**Parallelism:** PARALLEL with T-BE-2b
**Spec:** REQ-B3, REQ-B4, REQ-B5

**Test first** — NEW file:
`api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-asistencia-general.repository.test.ts`

Red tests to write:
- `REPO-GEN-T01`: `findByScopeAndMonthEnriched` issues a Prisma `findMany` with `include: { student: { select: { firstName: true, lastName: true } } }` and `orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }]`
- `REPO-GEN-T02`: maps each row to `{ attendance: <AsistenciaXAlumnoXCursoXCiclo>, studentName: "Apellido, Nombre" }` (lastName-first format)
- `REPO-GEN-T03`: optional `studentIds` filter still applied via `studentId: { in: studentIds }`
- `REPO-GEN-T04`: existing `findByScopeAndMonth` still returns plain domain entities (no regression)

**Impl:**
`api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-general.repository.ts`
— add `EnrichedGeneralAttendanceRow` type (extends base row, adds `student: { firstName, lastName }`)
— add `findByScopeAndMonthEnriched(courseCycleId, year, month, studentIds?)` implementing the enriched Prisma query
— `findByScopeAndMonth` is NOT touched

**Commit:** `feat(repo): add findByScopeAndMonthEnriched to PrismaAsistenciaGeneralRepository`

---

### T-BE-2b — Materia repo: enriched method (test + impl)
**Status:** [x]
**Depends on:** T-BE-1
**Parallelism:** PARALLEL with T-BE-2a
**Spec:** REQ-B3, REQ-B4, REQ-B5

**Test first** — NEW file:
`api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-asistencia-materia.repository.test.ts`

Red tests:
- `REPO-MAT-T01`: `findByScopeAndMonthEnriched` issues `findMany` with `include: { student: { select: { firstName: true, lastName: true } } }` + `orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }]`
- `REPO-MAT-T02`: maps to `{ attendance: <AsistenciaXMateriaXAlumnoXCursoXCiclo>, studentName: "Apellido, Nombre" }`
- `REPO-MAT-T03`: `studentIds?` filter applied when provided
- `REPO-MAT-T04`: `findByScopeAndMonth` unchanged (no regression)

**Impl:**
`api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-materia.repository.ts`
— symmetric with T-BE-2a, using `asistenciaXMateriaXAlumnoXCursoXCiclo` model

**Commit:** `feat(repo): add findByScopeAndMonthEnriched to PrismaAsistenciaMateriaRepository`

---

### T-BE-3a — List-general use case: switch to enriched method (test + impl)
**Status:** [x]
**Depends on:** T-BE-2a (for the enriched method to mock)
**Parallelism:** PARALLEL with T-BE-3b
**Spec:** REQ-B1, REQ-B3

**Test update:**
`api/src/application/asistencia/__tests__/list-general-attendance.use-case.test.ts`
- Replace `findByScopeAndMonth` mock with `findByScopeAndMonthEnriched` returning `EnrichedGeneralAttendance[]` wrappers
- Assert use case returns `EnrichedGeneralAttendance[]` (not plain entities)
- Auth (Door 2) assertions remain unchanged — they do not depend on return type

**Impl update:**
`api/src/application/asistencia/list-general-attendance.use-case.ts`
- Import `EnrichedGeneralAttendance` from domain port
- Change return type of `execute` to `Promise<EnrichedGeneralAttendance[]>`
- Line 50: swap `generalRepo.findByScopeAndMonth(...)` → `generalRepo.findByScopeAndMonthEnriched(...)`

**Commit:** `feat(app): list-general-attendance returns EnrichedGeneralAttendance`

---

### T-BE-3b — List-subject use case: switch to enriched method (test + impl)
**Status:** [x]
**Depends on:** T-BE-2b
**Parallelism:** PARALLEL with T-BE-3a
**Spec:** REQ-B2, REQ-B3

**Test update:**
`api/src/application/asistencia/__tests__/list-subject-attendance.use-case.test.ts`
- Replace `findByScopeAndMonth` mock with `findByScopeAndMonthEnriched`; return `EnrichedMateriaAttendance[]`
- Keep grupoId-filter assertions (now against the enriched method, `studentIds` arg still passed)
- Auth assertions unchanged

**Impl update:**
`api/src/application/asistencia/list-subject-attendance.use-case.ts`
- Import `EnrichedMateriaAttendance`
- Change return type to `Promise<EnrichedMateriaAttendance[]>`
- Line 64: swap `materiaAsistRepo.findByScopeAndMonth(...)` → `materiaAsistRepo.findByScopeAndMonthEnriched(...)`

**Commit:** `feat(app): list-subject-attendance returns EnrichedMateriaAttendance`

---

### T-BE-4 — DTOs + controller mappers (test + impl)
**Status:** [x]
**Depends on:** T-BE-3a, T-BE-3b
**Parallelism:** SEQUENTIAL (waits for both use-case tasks)
**Spec:** REQ-B1, REQ-B2 (studentName in responses), ADR-5 (PATCH returns `''`)

**Test update:**
`api/src/presentation/asistencia/__tests__/asistencia.controller.test.ts`
- List response fixtures: add `studentName: "García, Luis"` (or similar) to general and materia row wrappers
- Assert `CTR-T03` / `CTR-T07`: `response.data[0].studentName === "Apellido, Nombre"` format
- Assert `CTR-T05` / `CTR-T09` (PATCH `/dia`): `response.data.studentName === ''` (ADR-5 documented)
- Use cases now return enriched wrappers — update factory mock return values accordingly

**DTO update:**
`api/src/presentation/asistencia/dto/asistencia.dto.ts`
- `AsistenciaGeneralResponse`: add `studentName: string`
- `AsistenciaMateriaResponse`: add `studentName: string`

**Controller update:**
`api/src/presentation/asistencia/asistencia.controller.ts`
- Update import: add `EnrichedGeneralAttendance`, `EnrichedMateriaAttendance` from domain
- `toGeneralResponse(row: AsistenciaXAlumnoXCursoXCiclo, studentName: string)` — add `studentName` param
- `toMateriaResponse(row: AsistenciaXMateriaXAlumnoXCursoXCiclo, studentName: string)` — add `studentName` param
- `listGeneral` handler (line 123): `rows.map(e => this.toGeneralResponse(e.attendance, e.studentName))`
- `listSubject` handler (line 186): `rows.map(e => this.toMateriaResponse(e.attendance, e.studentName))`
- `recordGeneralDay` handler (line 155): `this.toGeneralResponse(row, '')` — ADR-5
- `recordSubjectDay` handler (line 213): `this.toMateriaResponse(row, '')` — ADR-5
- Both mappers: add `studentName` to returned object literal

**Commit:** `feat(api): expose studentName in attendance responses (Apellido, Nombre format)`

---

## PR 2 — Frontend Slice

Frontend tasks are independent of PR 1 TypeScript at build time (local row interfaces). They SHOULD be deployed after PR 1 lands so the API already returns `studentName`.

T-FE-1 and T-FE-3 can run in parallel. T-FE-2 is sequential after T-FE-1 (same file, different concern).

---

### T-FE-1 — asistencia-mensual: row types + grid cell rendering (test + impl)
**Status:** [x]
**Parallelism:** PARALLEL with T-FE-3
**Spec:** REQ-B7, REQ-B8

**Test update** (add to existing file):
`web/src/pages/dashboard/__tests__/asistencia-mensual.test.tsx`
- Add `studentName` to `generalRows` and `subjectRows` fixtures: e.g. `studentName: "García, Luis"`, `studentName: "Pérez, Ana"`
- `WM-04-name`: after rows load, grid cell renders `"García, Luis"` (not `"stu-1"` UUID) — assert `screen.getByText('García, Luis')` visible; UUID `stu-1` NOT in the name cell
- `WM-08-name-materia`: in materia mode, grid also renders `studentName` not UUID

**Impl update:**
`web/src/pages/dashboard/asistencia-mensual.tsx`
- `AsistenciaGeneralRow` interface (line 60): add `studentName: string`
- `AsistenciaMateriaRow` interface (line 69): add `studentName: string`
- Grid cell (line 543): change `{row.studentId}` → `{row.studentName}`

**Commit:** `feat(web): render studentName in attendance grid (not UUID)`

---

### T-FE-2 — asistencia-mensual: useSearchParams pre-selection (test + impl)
**Status:** [x]
**Depends on:** T-FE-1 (same file — sequential)
**Parallelism:** SEQUENTIAL after T-FE-1
**Spec:** REQ-A3, REQ-A4

**Test update** (add to existing file):
`web/src/pages/dashboard/__tests__/asistencia-mensual.test.tsx`
- Import `MemoryRouter` from `react-router-dom`; wrap `renderPage` to accept optional `initialPath`
- `WM-10-preselect-loaded`: render with `initialEntries: ['/asistencia-mensual?ccId=cc-1']`; after CC list resolves, `cc-selector` value === `'cc-1'`; mode-general tab is active
- `WM-11-preselect-async`: CC list initially empty → resolves with `cc-1` entry → assert cc-selector shows cc-1 (async settle)
- `WM-12-preselect-invalid`: `ccId=cc-unknown` + list resolves without that entry → no error thrown, no crash, first CC selected (A3-3)
- `WM-13-no-param-regression`: render without `?ccId=` → first CC auto-selected, behavior unchanged (REQ-A4)

**Impl update:**
`web/src/pages/dashboard/asistencia-mensual.tsx`
- Add `useSearchParams` import from `react-router-dom`
- Add `useRef` import (already imported with `useState` etc.; add `useRef`)
- Read `const [searchParams] = useSearchParams(); const ccIdParam = searchParams.get('ccId');`
- Mount effect (line 158): guard initial auto-select with `if (ccs.length > 0 && !selectedCCId && !ccIdParam) setSelectedCCId(ccs[0].uuid)`
- Add param-keyed effect (keyed on `[courseCycles, ccIdParam]`) with one-shot `useRef` guard:
  - if `!ccIdParam` → return early (no-op, REQ-A4)
  - once `courseCycles.length > 0`: find matching CC; if found → `setSelectedCCId(ccIdParam); setMode('general')`; if not found → fall back to first CC (A3-3); mark ref applied

**Commit:** `feat(web): pre-select course-cycle from ?ccId= query param`

---

### T-FE-3 — AlumnosCursoCicloPanel: attendance navigation button (test + impl)
**Status:** [x]
**Parallelism:** PARALLEL with T-FE-1 and T-FE-2 (different files)
**Spec:** REQ-A1, REQ-A2

**Test first** — NEW file:
`web/src/pages/dashboard/components/__tests__/AlumnosCursoCicloPanel.test.tsx`

Red tests:
- `ACP-T01`: render panel with `can('ATTENDANCE','READ') === true` → `data-testid="btn-ver-asistencia"` is in the DOM
- `ACP-T02`: render panel with `can('ATTENDANCE','READ') === false` → attendance button is NOT in the DOM
- `ACP-T03`: render panel as ROOT user (`isRoot === true`) → button is in the DOM (ROOT bypasses)
- `ACP-T04`: click button → `mockNavigate` called with `'/asistencia-mensual?ccId=cc-test-123'`
- Mock `useCan` from `../../../../hooks/use-can`; mock `useNavigate` from `react-router-dom`; mock `apiClient`

**Impl update:**
`web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx`
- Add imports: `useNavigate` from `react-router-dom`, `useCan` from `'../../../hooks/use-can'`
- Inside component: `const navigate = useNavigate(); const { can } = useCan();`
- Render (in the header or after the header section, before the loading state):
  ```tsx
  {can('ATTENDANCE', 'READ') && (
    <Button
      variant="action"
      size="sm"
      data-testid="btn-ver-asistencia"
      onClick={() => navigate(`/asistencia-mensual?ccId=${ccId}`)}
    >
      Ver asistencia
    </Button>
  )}
  ```

**Commit:** `feat(web): add attendance navigation button to AlumnosCursoCicloPanel`

---

## Summary

| Task | Depends on | Parallel with | PR |
|---|---|---|---|
| T-BE-1 | — | — (first) | PR 1 |
| T-BE-2a | T-BE-1 | T-BE-2b | PR 1 |
| T-BE-2b | T-BE-1 | T-BE-2a | PR 1 |
| T-BE-3a | T-BE-2a | T-BE-3b | PR 1 |
| T-BE-3b | T-BE-2b | T-BE-3a | PR 1 |
| T-BE-4 | T-BE-3a + T-BE-3b | — | PR 1 |
| T-FE-1 | — | T-FE-3 | PR 2 |
| T-FE-2 | T-FE-1 | T-FE-3 | PR 2 |
| T-FE-3 | — | T-FE-1, T-FE-2 | PR 2 |

**Total tasks:** 9 (6 backend, 3 frontend)
**Total new test files:** 3 (prisma-general.repo.test, prisma-materia.repo.test, AlumnosCursoCicloPanel.test)
**Total updated test files:** 3 (list-general UC, list-subject UC, controller, asistencia-mensual)
**No migration required** (REQ-B5 confirmed — student relation already exists)

---

## Files affected

### PR 1 — Backend
1. `packages/domain/src/asistencia/repositories/asistencia-general-repository.ts` — NEW types + method sig
2. `packages/domain/src/asistencia/repositories/asistencia-materia-repository.ts` — NEW types + method sig
3. `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-asistencia-general.repository.test.ts` — NEW
4. `api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-general.repository.ts` — new method
5. `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-asistencia-materia.repository.test.ts` — NEW
6. `api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-materia.repository.ts` — new method
7. `api/src/application/asistencia/__tests__/list-general-attendance.use-case.test.ts` — update
8. `api/src/application/asistencia/list-general-attendance.use-case.ts` — update
9. `api/src/application/asistencia/__tests__/list-subject-attendance.use-case.test.ts` — update
10. `api/src/application/asistencia/list-subject-attendance.use-case.ts` — update
11. `api/src/presentation/asistencia/dto/asistencia.dto.ts` — update
12. `api/src/presentation/asistencia/__tests__/asistencia.controller.test.ts` — update
13. `api/src/presentation/asistencia/asistencia.controller.ts` — update

### PR 2 — Frontend
14. `web/src/pages/dashboard/__tests__/asistencia-mensual.test.tsx` — update
15. `web/src/pages/dashboard/asistencia-mensual.tsx` — update
16. `web/src/pages/dashboard/components/__tests__/AlumnosCursoCicloPanel.test.tsx` — NEW
17. `web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx` — update
