# Delta Spec — Competency Scope Re-model

## Purpose

`SubjectCompetency` must be scoped to `StudyPlanSubject` (the Plan×Course×Subject triple) instead of the global `Subject`. This aligns the domain with the master-plan hierarchy decision and enables distinct competency sets per course.

---

## Requirement 1: SubjectCompetency is scoped to StudyPlanSubject

`SubjectCompetency` SHALL carry a `studyPlanSubjectId` FK referencing `StudyPlanSubject.id`. The `subjectId` FK SHALL be removed. The unique constraint SHALL be `(studyPlanSubjectId, name)`.

### Scenario: Competency created under a StudyPlanSubject

- GIVEN a valid `studyPlanSubjectId` that refers to an existing `StudyPlanSubject`
- WHEN a competency is created with that `studyPlanSubjectId` and a unique name
- THEN the `SubjectCompetency` record SHALL be persisted with `studyPlanSubjectId` set and `subjectId` absent

### Scenario: Duplicate name within same StudyPlanSubject is rejected

- GIVEN a `StudyPlanSubject` that already has a competency named "Resolución de problemas"
- WHEN a second competency with the same name is created for the same `studyPlanSubjectId`
- THEN creation SHALL fail with a domain error indicating the name is already taken for that subject

### Scenario: Same name allowed across different StudyPlanSubjects

- GIVEN two distinct `StudyPlanSubject` rows (same subject name, different courses)
- WHEN a competency named "Resolución de problemas" is created for each
- THEN both SHALL be persisted without conflict

---

## Requirement 2: Cascading delete from StudyPlanSubject

When a `StudyPlanSubject` is deleted, all its `SubjectCompetency` rows SHALL be deleted automatically via the database-level `onDelete: Cascade` constraint.

### Scenario: Deleting a StudyPlanSubject removes its competencies

- GIVEN a `StudyPlanSubject` with three associated competencies
- WHEN the `StudyPlanSubject` is deleted
- THEN all three `SubjectCompetency` rows SHALL no longer exist in the database

### Scenario: Cascade does not affect other subjects' competencies

- GIVEN two `StudyPlanSubject` rows each with competencies
- WHEN one `StudyPlanSubject` is deleted
- THEN only its competencies SHALL be removed; the other subject's competencies SHALL remain

---

## Requirement 3: Domain entity reflects new scope

The `SubjectCompetency` domain entity SHALL expose `studyPlanSubjectId` and SHALL NOT expose `subjectId`. The `periodActive` field SHALL be removed from the entity.

### Scenario: Entity construction with valid data

- GIVEN valid `studyPlanSubjectId`, `name`, and `active` values
- WHEN a `SubjectCompetency` entity is constructed
- THEN `entity.studyPlanSubjectId` SHALL equal the provided value
- AND `entity.periodActive` SHALL NOT be accessible

---

## Requirement 4: Repository port updated to domain language

The `SubjectCompetencyRepository` port SHALL expose:
- `findActiveByStudyPlanSubject(studyPlanSubjectId: string): Promise<SubjectCompetency[]>`
- `findByStudyPlanSubjectAndName(studyPlanSubjectId: string, name: string): Promise<SubjectCompetency | null>`

The old `findActiveBySubject(subjectId)` and `findBySubjectAndName(subjectId, name)` methods SHALL be removed.

### Scenario: Find active competencies for a StudyPlanSubject

- GIVEN a `StudyPlanSubject` with two active and one soft-deleted competency
- WHEN `findActiveByStudyPlanSubject` is called with its ID
- THEN the result SHALL contain exactly the two active competencies
- AND the soft-deleted competency SHALL NOT appear

### Scenario: Find by StudyPlanSubject and name — found

- GIVEN a competency named "Análisis" under a known `studyPlanSubjectId`
- WHEN `findByStudyPlanSubjectAndName` is called with that ID and name
- THEN the matching entity SHALL be returned

### Scenario: Find by StudyPlanSubject and name — not found

- GIVEN no competency named "Síntesis" exists under a `studyPlanSubjectId`
- WHEN `findByStudyPlanSubjectAndName` is called with that ID and name
- THEN `null` SHALL be returned

---

## Requirement 5: Schema marker for Fase 3 UNIQUE change

The `CompetencyValuation` schema block SHALL include a code comment marking that `UNIQUE(studentId, competencyId)` must be changed to `UNIQUE(studentId, competencyId, courseCycleId)` in Fase 3 before data is populated under the current unique.

### Scenario: Comment is present in schema

- GIVEN the migrated schema file
- WHEN the `CompetencyValuation` model definition is read
- THEN a comment SHALL appear before or on the unique constraint noting the Fase 3 obligation

---

## Out of Scope (Fase 3)

- Adding `courseCycleId` to `CompetencyValuation`
- Changing `CompetencyValuation` UNIQUE constraint
- Integrating `GradeScaleValue` into valuations
- Removing `periodActive` from `CompetencyValuation`
- Restructuring valuation columns into per-period rows
