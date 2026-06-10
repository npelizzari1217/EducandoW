# Spec: Entry Screens — Secundario Grade Capture

> Capability area: teacher-facing screens for Secundario grade entry
> Change: grading-secundario · Fase 4, Etapa 2
> Basis: NEW behavior (UX structure deferred to design phase)
> IDs: ESS-R* / ESS-S*

## Purpose

Define what MUST be true after this change regarding the teacher's ability to
capture Secundario grades, condición, and competencies. This spec describes
BEHAVIOR only — the exact component structure (whether these reuse the Primario
screens or introduce new Secundario-specific routes) is an open design decision
and is NOT prescribed here.

## Requirements

### ESS-R1 — Teacher can enter period grades for Secundario subjects (NEW)

A teacher MUST be able to select a Secundario CourseCycle and a subject from their
assigned subjects and enter `SubjectPeriodGrade` values for each enrolled student.
The entry experience MUST present a grid of students × periods, with each cell
accepting a value from the `gs-secundaria` grade scale (numeric 1–10).
Absent grades render as blank cells (no pre-creation of rows on load).

#### ESS-S1 — Period grade grid loads for a Secundario subject

- GIVEN teacher T is assigned to subject "Matemática" in a Secundario CourseCycle
- WHEN teacher T opens the grade entry screen for that subject
- THEN a grid of enrolled students × trimester periods is shown,
  each cell showing the current grade from SubjectPeriodGrade (or blank if absent);
  the dropdown options match the gs-secundaria scale (1–10)

---

### ESS-R2 — Teacher can enter final grades for Secundario subjects (NEW)

A teacher MUST be able to enter the four typed final grade instances
(FINAL, DICIEMBRE, MARZO, DEFINITIVA) for each student in their assigned
Secundario subjects. Each final grade cell accepts a value from gs-secundaria.
Absent final grade instances render as blank (no pre-creation on load).

#### ESS-S2 — Final grade cells present for each student

- GIVEN teacher T opens the grade entry screen for a Secundario subject
- WHEN the screen loads
- THEN four final grade cells (FINAL, DICIEMBRE, MARZO, DEFINITIVA) are visible
  per student; cells with no row in SubjectFinalGrade are blank

---

### ESS-R3 — Teacher can set condición per student per subject (NEW)

A teacher MUST be able to explicitly set `condicion` (REGULAR / PREVIA / LIBRE)
for each student's subject on the same entry screen (or adjacent to the final
grade entry area). The condicion selector MUST present exactly three options:
REGULAR, PREVIA, and LIBRE. Leaving the condicion unset is a valid state (NULL).

#### ESS-S3 — Condición selector shows REGULAR, PREVIA, LIBRE

- GIVEN teacher T opens the grade entry screen for a Secundario subject
- WHEN teacher T inspects the condición control for student A
- THEN the control presents exactly three options: REGULAR, PREVIA, LIBRE
  (plus a blank/unset option if applicable)

#### ESS-S4 — Setting condicion LIBRE triggers API call

- GIVEN teacher T sets condicion = LIBRE for student A, subject "Historia"
- WHEN the save action is confirmed
- THEN the API is called with condicion = "LIBRE"; the cell reflects LIBRE on success;
  no page reload occurs

---

### ESS-R4 — Teacher can enter competency valuations for Secundario subjects (REUSED)

The competency sub-grid MUST be available on the Secundario entry screen for all
subjects that have competencies defined. The sub-grid MUST show ALL competency
rows (not filtered by imprimible), with the `imprimible` field exposed per row as a
toggleable control. The `imprimible=true` filter applies ONLY to the boletín (BSS-R6).

#### ESS-S5 — All competencies shown on Secundario entry screen

- GIVEN subject "Biología" has 5 CompetencyValuation rows: 3 imprimible=true,
  2 imprimible=false
- WHEN the entry screen loads the competency sub-grid for "Biología"
- THEN all 5 rows are present; the 2 non-imprimible rows are visible
  (they may be visually distinguished but are not filtered out)

#### ESS-S6 — imprimible toggle saves to API inline

- GIVEN a CompetencyValuation row with imprimible = false
- WHEN teacher T toggles it to imprimible = true
- THEN the API is called; the row reflects imprimible = true on success;
  no page reload

---

### ESS-R5 — Secundario-only level gating on entry screens (NEW)

Entry screens for Secundario grading MUST show only CourseCycles where
`Math.floor(level / 10) === 3`. CourseCycles of other levels MUST NOT appear in
the Secundario entry screen selector.

#### ESS-S7 — Primario CourseCycle absent from Secundario entry screen selector

- GIVEN teacher T has SubjectAssignments in both a Primario CourseCycle (level = 20)
  and a Secundario CourseCycle (level = 30)
- WHEN the Secundario entry screen selector is rendered
- THEN only the Secundario CourseCycle (level = 30) appears;
  the Primario CourseCycle is absent

#### ESS-S8 — Secundario CourseCycle absent from Primario entry screens

- GIVEN the same teacher T
- WHEN the Primario entry screens (ES-R*) render their selectors
- THEN only the Primario CourseCycle appears; the Secundario CourseCycle is absent
  (regression: ES-R10 remains in force)

---

### ESS-R6 — Teacher-filtered selector shows only assigned subjects (REUSED)

The entry screen selector MUST show only CourseCycles and subjects where the
logged-in teacher has a SubjectAssignment for Secundario. Subjects outside the
teacher's assignments are hidden. Inherits TIA-R3 / TIA-R4 behavior for level-3.

#### ESS-S9 — Only assigned Secundario subjects appear in selector

- GIVEN teacher T is assigned to "Matemática" in Secundario CourseCycle C
  but not to "Biología" in the same CourseCycle
- WHEN the entry screen selector is rendered
- THEN only "Matemática" appears for CourseCycle C; "Biología" is absent

---

### ESS-R7 — Inline save without page reload (REUSED)

Saving a period grade, final grade, condicion, or competency valuation MUST call
the respective API endpoint and update the affected cell/control on success —
no full-page reload.

#### ESS-S10 — Period grade save updates cell inline

- GIVEN teacher T changes a period 2 cell for student A to "8"
- WHEN save is confirmed
- THEN the API is called, the cell shows "8", and no page reload occurs

---

### ESS-R8 — Empty state for teacher with no Secundario assignments (REUSED)

When the resolved teacher has no SubjectAssignments in any Secundario CourseCycle,
the entry screen MUST show an explicit empty state message — not a spinner, not an
error, not a crash.

#### ESS-S11 — Empty state on no Secundario assignments

- GIVEN teacher T has SubjectAssignments only in Primario CourseCycles
- WHEN the Secundario entry screen loads
- THEN an empty state message is shown (e.g., "No tenés materias asignadas
  en Secundario")

---

### ESS-R9 — Grade scale dropdown from gs-secundaria (NEW)

All period grade and final grade cells on Secundario entry screens MUST use
dropdowns populated from the `gs-secundaria` GradeScale (numeric 1–10).
No alphanumeric Primario values appear on Secundario screens.

#### ESS-S12 — Dropdown options are 1–10 for Secundario

- GIVEN a Secundario CourseCycle with gs-secundaria active
- WHEN a period grade cell dropdown is opened
- THEN it shows exactly the numeric values defined in gs-secundaria (e.g., 1 through 10)
  and no Primario-scale values (E, MB, B, R, I)
