# Spec: Entry Screens — Alumnos por Materia & Alumnos por Curso

> Capability area: grading entry screens replacing /competency-grading
> Change: grading-primario · Fase 4, Etapa 1
> IDs: ES-R* / ES-S*

## Purpose

Define what MUST be true after this change regarding the two teacher-facing grading
entry screens. Both screens replace the Fase 3b `/competency-grading` route for
Primario level.

## Requirements

### ES-R1 — "Alumnos por materia" loads the full subject data grid

"Alumnos por materia" MUST display, for a selected subject+courseCycle, a grid of
all enrolled students (rows) with:
- All period grades (`SubjectPeriodGrade`) for each period in the snapshotted structure
- The four final grade instances (`SubjectFinalGrade`, all types) for each student
- Competency valuations filtered to `imprimible=true` (`CompetencyPeriodValuation`)
- PA/PPI/PP flags per student per period (`PedagogicalFlag`)

#### ES-S1 — Grid loads full student data

- GIVEN teacher T selects CourseCycle A and subject "Matemática" in the "por materia" screen
- WHEN the screen loads
- THEN it shows all enrolled students with their period grades, final grade instances,
  imprimible competencies, and PA/PPI/PP flags per period; no error state

---

### ES-R2 — "Alumnos por curso" loads the full student data grid

"Alumnos por curso" MUST display, for a selected student within the teacher's homeroom
CourseCycle, all subjects in that CourseCycle (rows) with:
- All period grades (`SubjectPeriodGrade`) for each period
- The four final grade instances (`SubjectFinalGrade`) for each subject
- Competency valuations filtered to `imprimible=true`
- PA/PPI/PP flags per subject per period

#### ES-S2 — Grid loads full subject data for one student

- GIVEN teacher T (homeroom of CourseCycle A) selects student S in the "por curso" screen
- WHEN the screen loads
- THEN it shows all subjects in CourseCycle A with their period grades, final grades,
  competencies, and PA/PPI/PP flags per period

---

### ES-R3 — /competency-grading replaced

The Fase 3b `/competency-grading` route MUST be replaced by (or redirected to) the
"Alumnos por materia" screen. The old page must not render as a standalone page for
Primario level after this change ships.

#### ES-S3 — Old route is replaced

- GIVEN a user navigates to the previous /competency-grading URL
- WHEN the page loads
- THEN the "Alumnos por materia" screen is shown (redirect or route replacement),
  NOT the old Fase 3b page

---

### ES-R4 — Teacher-filtered selector in "por materia"

The academic-cycle → CourseCycle → Subject selector on "Alumnos por materia"
MUST show only CourseCycles and subjects where the logged-in teacher has a
`SubjectAssignment`. Courses/subjects outside the teacher's assignments are hidden.

#### ES-S4 — Selector shows only teacher's assigned subjects

- GIVEN teacher T is assigned to Math in CourseCycle A but not Science
- WHEN the selector is rendered on "por materia"
- THEN only Math appears under CourseCycle A; Science does not appear

---

### ES-R5 — Teacher-filtered course selector in "por curso"

The CourseCycle selector on "Alumnos por curso" MUST show only CourseCycles where the
logged-in teacher is the homeroom teacher (`CourseCycle.homeroomTeacherId`).

#### ES-S5 — Selector shows only homeroom CourseCycle

- GIVEN teacher T is homeroom of CourseCycle C but not CourseCycle D
- WHEN the selector is rendered on "por curso"
- THEN only CourseCycle C appears; CourseCycle D is not listed

---

### ES-R6 — Empty state for teacher with no assignments

When the resolved teacher has no SubjectAssignments (for "por materia") or no homeroom
CourseCycle (for "por curso"), the screen MUST show an explicit empty state message —
NOT a spinner, NOT an error, NOT a crash.

#### ES-S6 — Empty state on no assignments

- GIVEN teacher T has no SubjectAssignments
- WHEN the "por materia" screen loads
- THEN an empty state UI is shown (e.g., "No tenés materias asignadas")

---

### ES-R7 — Inline save without page reload

Saving a period grade, final grade, or pedagogical flag from either screen MUST call
the respective API endpoint and update the UI cell/row on success — no full-page reload.

#### ES-S7 — Grade save updates cell inline

- GIVEN the teacher changes a period grade cell to "MB"
- WHEN save is confirmed
- THEN the API is called, the cell shows "MB", and no page reload occurs

---

### ES-R8 — Grade scale dropdowns from active GradeScale

Grade value cells in both screens MUST use dropdowns populated from the active
`GradeScale` for the selected CourseCycle's level/modality, consistent with the
Fase 3 `useGradingGrid` hook pattern.

#### ES-S8 — Dropdown options match active scale

- GIVEN a Primario CourseCycle with GradeScale values [E, MB, B, R, I]
- WHEN a grade cell dropdown is opened
- THEN it shows exactly [E, MB, B, R, I] as options

---

### ES-R9 — Competency sub-grid reuses Fase 3 behavior

The competency section in both screens MUST reuse the Fase 3 `CompetencyGradingGrid`
behavior: period tabs, dense-cells Map, bounded-parallel save, and scale-value dropdowns.
The only change is the filter to `imprimible=true`.

#### ES-S9 — Competency grid renders with imprimible filter

- GIVEN subject "Matemática" has 5 competencies, 3 with imprimible=true and 2 with imprimible=false
- WHEN the "por materia" screen loads the competency sub-grid
- THEN only the 3 imprimible competencies are shown in the grid

---

### ES-R10 — Primario-only screens

Both entry screens MUST be shown only for CourseCycles with a Primario level.
Non-Primario levels MUST NOT be presented in the selector and MUST NOT reach these screens.

#### ES-S10 — Non-Primario CourseCycle not in selector

- GIVEN the logged-in teacher has assignments in both a Primario and a Secundario CourseCycle
- WHEN the "por materia" selector is rendered
- THEN only the Primario CourseCycle appears

---

### ES-R11 — PA/PPI/PP flag column per period

"Alumnos por materia" MUST display the PA, PPI, and PP flags for each student per period
as toggleable controls. Changing a flag triggers a save to `PedagogicalFlag` via the API.

#### ES-S11 — PA flag toggle triggers API call

- GIVEN student B has PA=false in period 2 for subject "Lengua"
- WHEN the teacher toggles PA to true for that student+period in the "por materia" screen
- THEN the PedagogicalFlag API is called and the toggle reflects true on success
