# Tasks: Legajos de Alumnos

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200-280 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Per-section error handling + print CSS polish + route RBAC | PR 1 | All frontend, single scope |
| 2 | Component + integration tests | PR 1 | Same PR, test suite |

## Phase 1: Error Handling Refactor (Partial Legajo)

- [ ] 1.1 Replace `Promise.all` + single `catch` in `selectStudent()` (`web/src/pages/dashboard/legajos.tsx` lines 134-153) with individual `try/catch` per endpoint call — each section loads independently, failure in one does not block others.
- [ ] 1.2 Add per-section error state: `studentError`, `enrollmentsError`, `notasError`, `attendanceError` — boolean flags set when individual calls fail.
- [ ] 1.3 Render error indicator on failed sections (e.g., `<p className="section-error">No se pudieron cargar los datos</p>`) while successful sections display normally — aligns with spec scenario "Partial data renders with error indicator".
- [ ] 1.4 Remove global `error` state and its Card block (lines 223-228) — errors are now per-section, not global.

## Phase 2: Print CSS Polish

- [ ] 2.1 Add `@page { size: A4; margin: 1.5cm; }` rule to the inline `<style>` block in `legajos.tsx` — spec requires A4 margins.
- [ ] 2.2 Add `page-break-inside: avoid` to table rows and section containers in print media — spec scenario "Page break avoids splitting sections".
- [ ] 2.3 Add print header with student name + DNI: create a `.print-header` div visible only in `@media print` containing `selectedStudent.fullName` and `selectedStudent.dni`.
- [ ] 2.4 Hide empty sections in print: add `.legajo-section-empty { display: none; }` in `@media print` and apply class to sections with zero data — spec scenario "Empty sections are omitted in print".
- [ ] 2.5 Ensure search UI, sidebar, and top nav are hidden in print (verify existing `body * { visibility: hidden }` + selective visibility covers all interactive elements).

## Phase 3: Route RBAC

- [ ] 3.1 Wrap `/legajos` route in `App.tsx` (line 42) with `<ProtectedRoute roles={['ADMIN', 'MANAGER', 'TEACHER']}>` — spec requires only these 3 roles can access.
- [ ] 3.2 Add `roles: ['ADMIN', 'MANAGER', 'TEACHER']` to the Legajos nav item in `sidebar.tsx` (line 20) — sidebar visibility should also be role-gated, not just level-gated.

## Phase 4: Testing

- [ ] 4.1 Write Vitest + RTL test: search debounce fires after 300ms, not before — mock `GET /students/search` and verify call timing.
- [ ] 4.2 Write Vitest + RTL test: selecting student triggers 4 parallel API calls — mock all endpoints, verify each is called with correct `studentId`.
- [ ] 4.3 Write Vitest + RTL test: partial legajo renders — mock `/attendance` to return 500, other 3 succeed; verify 3 sections show data, Asistencia shows error indicator (spec scenario "Partial data renders with error indicator").
- [ ] 4.4 Write Vitest + RTL test: empty states display — mock each endpoint returning empty array, verify "Sin matrículas registradas", "Sin calificaciones registradas", "Sin registros de asistencia" messages appear.
- [ ] 4.5 Write Vitest + RTL test: print button calls `window.print()` only when student is selected — spy on `window.print`, verify not called in search state.
