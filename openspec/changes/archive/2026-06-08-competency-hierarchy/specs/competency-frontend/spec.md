# Delta Spec — Competency Front-End

## Purpose

Both tabs in `web/src/pages/dashboard/competencies.tsx` are broken today due to calls to non-existent routes. This spec covers: fixing the broken routes, replacing the flat subject selector with a Plan→Course→Subject drill-down, and the "copy competencies from another course" UI action.

---

## Requirement 1: Broken route — Tab 1 (Competencias por Materia) fixed

Tab 1 SHALL call `GET /subject-competencies?studyPlanSubjectId={id}` instead of the non-existent `GET /subjects/:id/competencies`.

### Scenario: Tab 1 loads competencies after subject is selected

- GIVEN the user has drilled down to a specific `StudyPlanSubject`
- WHEN tab 1 is active
- THEN the page SHALL call `GET /subject-competencies?studyPlanSubjectId={id}` with the selected subject's ID
- AND display the returned competencies in the list

### Scenario: Old route is never called

- GIVEN any user interaction on the competencies page
- WHEN the page makes API calls
- THEN no call to `/subjects/:id/competencies` SHALL occur

---

## Requirement 2: Broken route — Tab 2 (Valoraciones por Alumno) fixed

Tab 2 SHALL call `GET /competency-valuations?studentId={id}&studyPlanSubjectId={id}` instead of the non-existent `GET /students/:id/competency-valuations`.

### Scenario: Tab 2 loads valuations after student and subject are selected

- GIVEN the user has selected a student and a `StudyPlanSubject`
- WHEN tab 2 is active
- THEN the page SHALL call `GET /competency-valuations?studentId={id}&studyPlanSubjectId={id}`
- AND display the returned valuations

### Scenario: Old route is never called

- GIVEN any user interaction on the competencies page
- WHEN the page makes API calls
- THEN no call to `/students/:id/competency-valuations` SHALL occur

---

## Requirement 3: Plan→Course→Subject drill-down replaces flat subject selector

The flat subject selector that previously loaded ALL subjects SHALL be replaced by a three-step drill-down:
1. Select a `StudyPlan`
2. Select a `StudyPlanCourse` (filtered to the chosen plan)
3. Select a `StudyPlanSubject` (filtered to the chosen course)

### Scenario: Plans load on page mount

- GIVEN the competencies page is opened
- WHEN the page mounts
- THEN the first selector SHALL display available `StudyPlan` options
- AND the Course and Subject selectors SHALL be disabled until a plan is chosen

### Scenario: Selecting a plan populates courses

- GIVEN the user selects a `StudyPlan`
- WHEN the plan is selected
- THEN the Course selector SHALL load courses belonging to that plan
- AND the Subject selector SHALL remain disabled

### Scenario: Selecting a course populates subjects

- GIVEN the user has selected a plan and then selects a `StudyPlanCourse`
- WHEN the course is selected
- THEN the Subject selector SHALL load subjects belonging to that course

### Scenario: Changing the plan resets downstream selectors

- GIVEN the user previously selected plan, course, and subject
- WHEN the user changes the plan selection
- THEN both the Course and Subject selectors SHALL be reset to empty

---

## Requirement 4: "Copy competencies from another course" UI action

A UI action SHALL be available on Tab 1 that lets the user copy all competencies from another `StudyPlanSubject` into the currently selected one. The action SHALL call `POST /subject-competencies/copy`.

### Scenario: Copy action button is visible when a subject is selected

- GIVEN the user has selected a `StudyPlanSubject` via the drill-down
- WHEN tab 1 is displayed
- THEN a "Copy from another course" button SHALL be visible

### Scenario: Copy opens a source selector

- GIVEN the user clicks "Copy from another course"
- WHEN the dialog opens
- THEN it SHALL present a drill-down (or searchable selector) to choose a source `StudyPlanSubject`

### Scenario: Confirming copy calls the API and refreshes the list

- GIVEN the user has selected a source `StudyPlanSubject` in the copy dialog
- WHEN the user confirms the copy action
- THEN `POST /subject-competencies/copy` SHALL be called with the source and target IDs
- AND the competency list SHALL refresh showing the newly copied items
- AND the dialog SHALL close

### Scenario: Copy with zero results shows informative feedback

- GIVEN the source has no active competencies
- WHEN the copy is confirmed and the API returns `{ copied: 0, skipped: 0 }`
- THEN the UI SHALL display a message indicating no competencies were available to copy (e.g. "No active competencies found in the source course")

---

## Out of Scope (Fase 3)

- Cycle-based valuation selection in Tab 2
- GradeScale integration in the valuations UI
- Removing `periodActive` from CompetencyValuation display
