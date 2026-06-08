# Spec — competency-grading-grid

> **New capability spec**: the `/competency-grading` page, the `CompetencyGradingGrid`
> component, and the full save contract (per-cell PATCH + "Guardar todo" batch).

---

## Scope

**In**: `/competency-grading` route and sidebar entry; `CompetencyGradingGrid` component;
data loading from four existing/new endpoints; period navigation; locked-cell display;
`internalStatus` badge; per-cell PATCH; "Guardar todo" batch; all empty/loading/error states.  
**Out**: report-card rendering (Fase 4); grade history / audit log; bulk CSV import;
libreta/boletín; `CourseCycleSubjectSelector` behavior (spec'd in its own file).

---

## Requirement: Grading Page — Route and Sidebar

A `/competency-grading` route MUST exist in the application.  
A "Calificación de Competencias" entry MUST appear in the Académico section of the sidebar
and navigate to that route.

---

## Requirement: CompetencyGradingGrid Component

The `CompetencyGradingGrid` MUST:

1. Accept `{ courseCycleId, studyPlanId, studyPlanSubjectId, level, modality }` as input
   (produced by `CourseCycleSubjectSelector`).
2. Load data from these endpoints on mount / input change:
   - `GET /v1/competency-valuations?courseCycleId=&studyPlanSubjectId=` → cell values
   - `GET /v1/course-cycles/:uuid/students` → row headers
   - `GET /v1/grading/period-templates?level=&modality=` → period columns / navigation tabs
   - `GET /v1/grading/scales?level=&modality=` → GradeScaleValue dropdown options
3. Render a matrix: **rows = enrolled students**, **columns = competencies of the subject**,
   **cells = GradeScaleValue dropdown** for the currently active period.
4. Provide period navigation (tabs or top-level selector) that switches the active period.
5. Render locked cells (`modificable=false`) as disabled dropdowns with a lock icon.
6. Render `internalStatus` as a colored badge per cell:
   `APROBADO=green`, `NO_APROBADO=red`, `EN_PROCESO=yellow`, `LIBRE=grey`, absent badge for `null`.
7. On dropdown value change: issue
   `PATCH /v1/competency-valuations/:uuid/periods/:periodItemId` with `{ gradeScaleValueId }`,
   update the cell on success, and clear its dirty flag.
8. Track dirty cells (changed but not yet confirmed saved).
9. Provide a "Guardar todo" button that sends PATCH requests for all dirty cells.
10. Handle gracefully: no students, no competencies, no period template, no grade scale.
11. Handle gracefully: loading state during initial data fetch.
12. Handle gracefully: per-cell PATCH failure with a cell-level error indicator.

---

### Scenario CGG-1: Happy path — matrix renders with existing grades

- GIVEN `courseCycleId="cc-1"`, `studyPlanSubjectId=10`: 3 students, 2 competencies
- AND the period template has 4 items; grade scale has 5 values
- AND the active period is item 1; cell (s-1, c-1) already has `gradeCode="MB"` for period 1
- WHEN the grid loads
- THEN a 3-row × 2-column grid is displayed for period 1
- AND cell (s-1, c-1) shows "MB" as its current value
- AND cells without existing grades show an empty/placeholder dropdown

### Scenario CGG-2: Period navigation switches the displayed period

- GIVEN the grid is showing period 1; cell (s-1, c-1) shows `gradeCode="MB"` for period 1
- AND the same cell has `gradeCode="B"` for period 2
- WHEN the user navigates to period 2
- THEN cell (s-1, c-1) shows "B"
- AND NOT "MB"

### Scenario CGG-3: Locked cell is disabled with a lock icon

- GIVEN cell (s-1, c-1) for the active period has `modificable=false`
- WHEN the grid renders that cell
- THEN the GradeScaleValue dropdown is disabled (non-interactive)
- AND a lock icon is visible on the cell
- AND no PATCH is issued for that cell under any user interaction

### Scenario CGG-4: internalStatus badge colors

- GIVEN cells in the active period with `internalStatus` values:
  APROBADO, NO_APROBADO, EN_PROCESO, LIBRE, and null (no badge)
- WHEN the grid renders
- THEN the APROBADO cell shows a green badge
- AND the NO_APROBADO cell shows a red badge
- AND the EN_PROCESO cell shows a yellow badge
- AND the LIBRE cell shows a grey badge
- AND the null cell shows no badge

### Scenario CGG-5: Per-cell PATCH on dropdown change

- GIVEN cell (s-1, c-1) for the active period is editable (`modificable=true`)
- WHEN the user selects grade value "MB" (gradeScaleValueId="gsv-mb") in the dropdown
- THEN `PATCH /v1/competency-valuations/:uuid/periods/:periodItemId` is issued
  with body `{ "gradeScaleValueId": "gsv-mb" }`
- AND on HTTP 200 the cell updates to show "MB" and its new `internalStatus` badge
- AND the cell is no longer marked as dirty

### Scenario CGG-6: Per-cell PATCH failure shows cell-level error indicator

- GIVEN cell (s-1, c-1) is editable and the user selects a new grade
- WHEN the PATCH request returns a non-2xx response
- THEN the cell shows an error indicator (e.g. warning icon)
- AND the cell retains its previous value or preserves the dirty state for retry

### Scenario CGG-7: "Guardar todo" sends PATCHes for all dirty cells

- GIVEN cells (s-1, c-1), (s-1, c-2), and (s-2, c-1) have been changed and are dirty
- WHEN the user clicks "Guardar todo"
- THEN 3 PATCH requests are issued, one per dirty cell
- AND on all successes the cells are no longer marked as dirty

### Scenario CGG-8: Empty state — no students enrolled

- GIVEN `GET /v1/course-cycles/:uuid/students` returns `[]`
- WHEN the grid renders
- THEN no student rows are displayed
- AND an empty-state message is shown (e.g. "No hay alumnos inscriptos")

### Scenario CGG-9: Empty state — no competencies for subject

- GIVEN `GET /v1/subject-competencies?studyPlanSubjectId=` returns an empty list
- WHEN the grid renders
- THEN no competency columns are displayed
- AND an empty-state message is shown (e.g. "Sin competencias configuradas")

### Scenario CGG-10: Empty state — no period template configured

- GIVEN `GET /v1/grading/period-templates?level=&modality=` returns no template
- WHEN the grid renders
- THEN no period navigation is shown
- AND an empty-state message is shown indicating periods are not configured

### Scenario CGG-11: Empty state — no grade scale configured

- GIVEN `GET /v1/grading/scales?level=&modality=` returns no scale
- WHEN the grid renders
- THEN the GradeScaleValue dropdowns have no selectable options
- AND an empty-state message is shown indicating no grade scale is configured

### Scenario CGG-12: Loading state during initial data fetch

- GIVEN all four data endpoints are in-flight simultaneously
- WHEN the grid is first mounted with valid input
- THEN a loading skeleton or spinner is displayed
- AND no interactive elements (dropdowns, "Guardar todo") are available until all data resolves

---

## Backend calls issued by the grid

| Grid action              | Endpoint                                                    | Expected on success |
|--------------------------|-------------------------------------------------------------|---------------------|
| Initial load (cell data) | GET /v1/competency-valuations?courseCycleId=&studyPlanSubjectId= | 200 → populate cells |
| Initial load (rows)      | GET /v1/course-cycles/:uuid/students                        | 200 → row headers   |
| Cell grade change        | PATCH /v1/competency-valuations/:uuid/periods/:periodItemId | 200 → update cell   |
| "Guardar todo"           | PATCH × N (one per dirty cell)                              | 200 each → clear dirty |
