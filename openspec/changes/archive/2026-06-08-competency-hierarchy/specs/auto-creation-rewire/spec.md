# Delta Spec — Auto-Creation Rewire

## Purpose

`AutoCreateCompetencyValuationsUC` currently finds competencies by direct `subjectId` lookup and finds students via Enrollment field-matching against `CourseSection` columns. Both paths must be replaced with clean StudyPlan hierarchy navigation.

---

## Requirement 1: Navigate CourseCycle → StudyPlan → StudyPlanCourse → StudyPlanSubject → SubjectCompetency

When `executeForSubjectAssignment(subjectAssignmentId)` is called, the use case SHALL derive competencies by navigating:

```
SubjectAssignment
  → CourseCycle (via courseCycleId)
    → StudyPlan (via studyPlanId on CourseCycle)
      → StudyPlanCourse (where studyPlanId matches AND courseSectionId matches)
        → StudyPlanSubject (where subjectId matches the assigned subject)
          → SubjectCompetency[]
```

No Enrollment column-matching (`level`, `grade`, `division`, `academicYear`) SHALL be used to locate students or competencies.

### Scenario: Happy path — competencies found via hierarchy

- GIVEN a `SubjectAssignment` linked to a `CourseCycle` that belongs to a `StudyPlan` containing a `StudyPlanSubject` with two active competencies
- WHEN `executeForSubjectAssignment` is called
- THEN a `CompetencyValuation` SHALL be created for each enrolled student × each of the two competencies
- AND the navigation path SHALL only use FK joins, not field-value matching on grade/division/level

### Scenario: No StudyPlanSubject found — silent skip

- GIVEN a `SubjectAssignment` whose `CourseCycle` has a `StudyPlan` that does NOT include the assigned subject
- WHEN `executeForSubjectAssignment` is called
- THEN no `CompetencyValuation` rows SHALL be created
- AND the use case SHALL return without error

### Scenario: StudyPlanSubject exists but has zero active competencies — silent skip

- GIVEN a `StudyPlanSubject` with no active `SubjectCompetency` rows
- WHEN `executeForSubjectAssignment` is called
- THEN no `CompetencyValuation` rows SHALL be created
- AND the use case SHALL return without error

---

## Requirement 2: Idempotency — existing valuations are not duplicated

If a `CompetencyValuation` already exists for a given `(studentId, competencyId)`, the use case SHALL skip creation for that pair without error.

### Scenario: Re-run does not create duplicates

- GIVEN `executeForSubjectAssignment` was already called and valuations exist
- WHEN `executeForSubjectAssignment` is called again for the same assignment
- THEN no duplicate `CompetencyValuation` rows SHALL be created
- AND the existing rows SHALL remain unchanged

---

## Requirement 3: Trigger contract with CreateSubjectAssignmentUC is preserved

`CreateSubjectAssignmentUC.execute()` SHALL still call `AutoCreateCompetencyValuationsUC` after a subject assignment is persisted. The call signature and trigger point SHALL remain identical from `CreateSubjectAssignmentUC`'s perspective.

### Scenario: Creating a subject assignment triggers valuation creation

- GIVEN a valid subject assignment creation request
- AND the linked StudyPlanSubject has competencies
- WHEN `CreateSubjectAssignmentUC.execute()` is called
- THEN `AutoCreateCompetencyValuationsUC` SHALL be invoked
- AND competency valuations SHALL be created for enrolled students

### Scenario: AutoCreate failure does not rollback the subject assignment

- GIVEN the AutoCreate step encounters a non-critical error (e.g. no competencies found)
- WHEN `CreateSubjectAssignmentUC.execute()` is called
- THEN the `SubjectAssignment` SHALL be persisted
- AND the error from AutoCreate SHALL be logged but SHALL NOT propagate as an exception to the caller

---

## Requirement 4: executeForEnrollment path also navigates hierarchy

`executeForEnrollment(studentId, courseSectionId)` SHALL find the relevant `StudyPlanSubject` rows through the hierarchy (CourseCycle → StudyPlan → StudyPlanCourse → StudyPlanSubject), not by Enrollment field matching.

### Scenario: New enrollment triggers valuations via hierarchy

- GIVEN a student is enrolled in a `CourseCycle` that has a `StudyPlan` with competency-bearing subjects
- WHEN `executeForEnrollment` is called
- THEN `CompetencyValuation` rows SHALL be created for each active competency of each subject in the plan

---

## Out of Scope (Fase 3)

- CompetencyValuation gaining `courseCycleId`
- Changing valuation UNIQUE from `(studentId, competencyId)` to `(studentId, competencyId, courseCycleId)`
