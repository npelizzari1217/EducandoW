# Spec — course-cycle-subject-selector

> **New capability spec**: `CourseCycleSubjectSelector` — a three-level cascading selector
> (AcademicCycle → CourseCycle → Subject) that emits the full grading context needed
> to render the CompetencyGradingGrid.

---

## Scope

**In**: `CourseCycleSubjectSelector` component — cascade behavior, emission contract,
loading/empty/error states.  
**Out**: grading grid rendering (spec'd in `competency-grading-grid`); plan-only flows
that do not need courseCycleId (those use the existing `PlanCourseSubjectSelector`).

---

## Requirement: CourseCycleSubjectSelector Component

The `CourseCycleSubjectSelector` MUST:

1. Present three dependent dropdowns in order:
   - Level 1: AcademicCycle
   - Level 2: CourseCycle (options driven by selected AcademicCycle)
   - Level 3: Subject / StudyPlanSubject (options driven by selected CourseCycle's studyPlan)
2. Reset Level 2 and Level 3 when Level 1 changes.
3. Reset Level 3 when Level 2 changes.
4. Emit the event `{ courseCycleId, studyPlanId, studyPlanSubjectId, level, modality }` ONLY
   when all three levels have been selected.
5. Show a loading indicator on each dropdown while its options are being fetched.
6. Show an empty-state message when a dropdown resolves with zero options.
7. Show an error indicator when a fetch fails, with a retry affordance.
8. Be a controlled component — caller can reset state externally.

The component MUST NOT emit partial selections (e.g. only cycle + course, without subject).

---

### Scenario CCSS-1: Happy path — full cascade selection emits complete context

- GIVEN AcademicCycle options are loaded
- WHEN user selects AcademicCycle "A", then CourseCycle "CC-1", then Subject "S-1"
- THEN the component emits `{ courseCycleId, studyPlanId, studyPlanSubjectId, level, modality }`
- AND all five fields are non-null

### Scenario CCSS-2: Changing AcademicCycle resets CourseCycle and Subject

- GIVEN user has selected AcademicCycle "A", CourseCycle "CC-1", Subject "S-1"
- WHEN user changes AcademicCycle to "B"
- THEN the CourseCycle dropdown reverts to its placeholder (unselected)
- AND the Subject dropdown reverts to its placeholder (unselected)
- AND no selection event is emitted

### Scenario CCSS-3: Changing CourseCycle resets Subject

- GIVEN user has selected AcademicCycle "A", CourseCycle "CC-1", Subject "S-1"
- WHEN user changes CourseCycle to "CC-2"
- THEN the Subject dropdown reverts to its placeholder (unselected)
- AND no selection event is emitted

### Scenario CCSS-4: Loading state while fetching CourseCycle options

- GIVEN the user has selected an AcademicCycle, triggering a CourseCycle fetch
- WHEN the fetch is in-flight
- THEN the CourseCycle dropdown shows a loading indicator
- AND the CourseCycle dropdown is non-interactive until the fetch resolves

### Scenario CCSS-5: Empty state — no CourseCycles for selected AcademicCycle

- GIVEN a valid AcademicCycle is selected but has no associated CourseCycles
- WHEN the CourseCycle fetch resolves with an empty list
- THEN the CourseCycle dropdown displays an empty-state message (e.g. "Sin ciclos")
- AND the Subject dropdown remains in its initial disabled state
- AND no selection event is emitted

### Scenario CCSS-6: Error state — CourseCycle fetch fails

- GIVEN a valid AcademicCycle is selected, triggering a CourseCycle fetch
- WHEN the fetch fails (network or server error)
- THEN the CourseCycle dropdown shows an error indicator
- AND the user has a retry affordance (e.g. a retry button or interaction that re-triggers the fetch)

### Scenario CCSS-7: Partial selection does not emit

- GIVEN the user has selected AcademicCycle + CourseCycle but has not yet selected a Subject
- THEN no selection event is emitted by the component

---

## Accessibility

- Each dropdown MUST be keyboard-navigable.
- Disabled/loading dropdowns MUST convey their state to screen readers (aria-disabled / aria-busy).
