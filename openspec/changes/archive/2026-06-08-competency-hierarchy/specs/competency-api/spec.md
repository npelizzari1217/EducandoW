# Delta Spec — Competency API Endpoints

## Purpose

All competency CRUD endpoints SHALL be scoped to a `studyPlanSubjectId`. A "copy competencies from another course" operation SHALL be available. Validation errors return HTTP 400 (not 422). No verb in URLs.

---

## Requirement 1: List competencies scoped by StudyPlanSubject

`GET /subject-competencies?studyPlanSubjectId={id}` SHALL return all active competencies for the given `StudyPlanSubject`.

### Scenario: List returns competencies for the given subject

- GIVEN a `StudyPlanSubject` with three active competencies
- WHEN `GET /subject-competencies?studyPlanSubjectId={id}` is called
- THEN the response SHALL be HTTP 200 with a JSON array of three competency objects
- AND each object SHALL include `id`, `studyPlanSubjectId`, `name`, `active`

### Scenario: Missing studyPlanSubjectId returns 400

- GIVEN a request with no `studyPlanSubjectId` query param
- WHEN `GET /subject-competencies` is called
- THEN the response SHALL be HTTP 400

### Scenario: Unknown studyPlanSubjectId returns empty array

- GIVEN a `studyPlanSubjectId` that does not exist
- WHEN `GET /subject-competencies?studyPlanSubjectId={id}` is called
- THEN the response SHALL be HTTP 200 with an empty JSON array

---

## Requirement 2: Create a competency scoped to a StudyPlanSubject

`POST /subject-competencies` SHALL accept `{ studyPlanSubjectId, name }` and create the competency.

### Scenario: Happy path creation

- GIVEN a valid `studyPlanSubjectId` and a unique `name`
- WHEN `POST /subject-competencies` is called with the body
- THEN the response SHALL be HTTP 201 with the created competency object

### Scenario: Missing required field returns 400

- GIVEN a request body missing `name`
- WHEN `POST /subject-competencies` is called
- THEN the response SHALL be HTTP 400 with a validation error message

### Scenario: Duplicate name returns 400

- GIVEN a competency named "Comunicación oral" already exists for `studyPlanSubjectId`
- WHEN `POST /subject-competencies` is called with the same name and `studyPlanSubjectId`
- THEN the response SHALL be HTTP 400 with an error indicating the name is already taken

---

## Requirement 3: Update a competency

`PATCH /subject-competencies/{id}` SHALL accept `{ name?, active? }` and update the competency.

### Scenario: Name update succeeds

- GIVEN an existing competency with id `{id}`
- WHEN `PATCH /subject-competencies/{id}` is called with `{ "name": "Nuevo nombre" }`
- THEN the response SHALL be HTTP 200 with the updated competency

### Scenario: Update with duplicate name returns 400

- GIVEN another competency named "Nuevo nombre" already exists for the same `studyPlanSubjectId`
- WHEN `PATCH /subject-competencies/{id}` is called with `{ "name": "Nuevo nombre" }`
- THEN the response SHALL be HTTP 400

### Scenario: Updating a non-existent competency returns 404

- GIVEN an `id` that does not match any competency
- WHEN `PATCH /subject-competencies/{id}` is called
- THEN the response SHALL be HTTP 404

---

## Requirement 4: Delete (soft-delete) a competency

`DELETE /subject-competencies/{id}` SHALL soft-delete the competency by setting `deletedAt`.

### Scenario: Happy path soft-delete

- GIVEN an existing active competency with id `{id}`
- WHEN `DELETE /subject-competencies/{id}` is called
- THEN the response SHALL be HTTP 200 (or 204)
- AND the competency SHALL no longer appear in list results for its `studyPlanSubjectId`
- AND the row SHALL still exist in the database with `deletedAt` set

### Scenario: Deleting a non-existent competency returns 404

- GIVEN an `id` that does not exist
- WHEN `DELETE /subject-competencies/{id}` is called
- THEN the response SHALL be HTTP 404

---

## Requirement 5: Copy competencies from another StudyPlanSubject

`POST /subject-competencies/copy` SHALL accept `{ sourceStudyPlanSubjectId, targetStudyPlanSubjectId }` and duplicate all active competencies from source to target.

Names that already exist in the target SHALL be skipped (idempotent).

### Scenario: Happy path copy

- GIVEN a source `StudyPlanSubject` with two active competencies and a target with none
- WHEN `POST /subject-competencies/copy` is called with source and target IDs
- THEN the response SHALL be HTTP 200 with a summary `{ copied: 2, skipped: 0 }`
- AND the target `StudyPlanSubject` SHALL now have two active competencies matching the source names

### Scenario: Partial copy when target already has matching names

- GIVEN a source with competencies ["A", "B"] and a target already having ["A"]
- WHEN `POST /subject-competencies/copy` is called
- THEN the response SHALL be HTTP 200 with `{ copied: 1, skipped: 1 }`
- AND competency "A" SHALL NOT be duplicated in the target

### Scenario: Source has no active competencies — returns zero copied

- GIVEN a source with no active competencies
- WHEN `POST /subject-competencies/copy` is called
- THEN the response SHALL be HTTP 200 with `{ copied: 0, skipped: 0 }`

### Scenario: Missing required fields returns 400

- GIVEN a request body missing `sourceStudyPlanSubjectId`
- WHEN `POST /subject-competencies/copy` is called
- THEN the response SHALL be HTTP 400

---

## Out of Scope (Fase 3)

- Endpoints for `CompetencyValuation` structural changes (courseCycleId, per-period grading)
- GradeScale integration in valuation endpoints
