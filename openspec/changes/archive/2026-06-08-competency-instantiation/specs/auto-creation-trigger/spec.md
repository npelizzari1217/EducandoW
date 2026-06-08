# Delta Spec — auto-creation-trigger

> **Delta spec**: describes what MUST be true after the change is applied.
> Base: `openspec/specs/competency-valuations/spec.md` (Auto-Creation requirements).
> This delta moves the auto-creation trigger from `SubjectAssignment` creation to
> `CourseCycle` instantiation, and introduces cycle-awareness.

---

## Scope

**In**: `AutoCreateCompetencyValuationsUC` rewrite (receives `courseCycleId`); hook into
`GenerateCourseCyclesUseCase` (or equivalent instantiation entry point); neutering of
the `executeForSubjectAssignment` path.
**Out**: front-end concerns, `Enrollment→CourseCycle` FK (Fase 4).

---

## MODIFIED: Auto-Creation Trigger Point

Auto-creation of `CompetencyValuation` PARENT records MUST fire at `CourseCycle`
instantiation/generation, NOT at `SubjectAssignment` creation.

`AutoCreateCompetencyValuationsUC` MUST:
- Accept `courseCycleId` as an explicit required parameter.
- Create one `CompetencyValuation` parent record per
  `(enrolled student in the cycle's course section) × (active SubjectCompetency
  reachable via CourseCycle → StudyPlan → StudyPlanCourse → StudyPlanSubject)`.
- Use batch insert with `skipDuplicates: true` for idempotency.
- Fire as a fire-and-forget side effect of cycle instantiation: a failure MUST NOT
  roll back or block the `CourseCycle` creation (logged, not propagated).

### Scenario ACT-1: Cycle instantiation creates parents for enrolled students × active competencies

- GIVEN a `CourseCycle` linked to 3 enrolled students
- AND the cycle's study plan subjects have 4 active `SubjectCompetency` entries total
- WHEN the `CourseCycle` is instantiated/generated
- THEN 12 `CompetencyValuation` parent records are created (3 × 4)
- AND each record carries `courseCycleId` = the newly instantiated cycle's uuid

### Scenario ACT-2: Idempotency — re-instantiation skips existing parents

- GIVEN 12 `CompetencyValuation` parents already exist for `courseCycleId="cc-1"`
- WHEN auto-creation is triggered again for the same `CourseCycle`
- THEN no new records are created (`skipDuplicates` behavior)
- AND existing records are unchanged

### Scenario ACT-3: No enrolled students — no parents created

- GIVEN a `CourseCycle` with 0 enrolled students
- WHEN the `CourseCycle` is instantiated
- THEN no `CompetencyValuation` records are created
- AND the instantiation succeeds (no error)

### Scenario ACT-4: Subjects with zero active competencies contribute nothing

- GIVEN a `CourseCycle` with 2 subjects: subject A has 3 active competencies, subject B has 0
- AND 2 enrolled students
- WHEN the `CourseCycle` is instantiated
- THEN 6 `CompetencyValuation` parents are created (2 students × 3 competencies from A)
- AND subject B contributes 0 records

### Scenario ACT-5: Auto-creation failure does not block CourseCycle instantiation

- GIVEN auto-creation of `CompetencyValuation` parents throws or returns a failure
- WHEN a `CourseCycle` is instantiated
- THEN the `CourseCycle` generation still succeeds (no HTTP error propagation)
- AND the failure is logged, not re-thrown to the caller

---

## MODIFIED: SubjectAssignment Creation — valuation side effect removed

The `CreateSubjectAssignmentUC` fire-and-forget hook that triggered
`AutoCreateCompetencyValuationsUC.executeForSubjectAssignment(...)` MUST be removed.

Creating a `SubjectAssignment` MUST NOT auto-create any `CompetencyValuation` records.
The `executeForSubjectAssignment` method (or equivalent cycle-less path) MUST be
removed or made permanently inactive.

### Scenario ACT-6: SubjectAssignment creation does NOT create valuation records

- GIVEN a course section with 3 enrolled students
- AND a subject being assigned has 2 active competencies
- WHEN a `SubjectAssignment` is created
- THEN NO `CompetencyValuation` records are created
- AND the `SubjectAssignment` is created successfully (HTTP 2xx)

### Scenario ACT-7: Failure isolation preserved on SubjectAssignment (unchanged)

- GIVEN SubjectAssignment creation proceeds normally
- WHEN no valuation auto-creation hook fires
- THEN `SubjectAssignment` creation still returns success (no regression in behavior)

---

## REMOVED: Auto-Creation on SubjectAssignment

The requirement "Auto-Creation on SubjectAssignment" from
`openspec/specs/competency-valuations/spec.md` is SUPERSEDED by this delta.
The `executeForSubjectAssignment` path no longer exists after this change.

> The fire-and-forget isolation requirement (failure must not block the main operation)
> is preserved and migrated to the CourseCycle instantiation hook (Scenario ACT-5).
