# Study Plans Specification

## Purpose

Curricular management via Study Plans that group CourseSections and their associated Subjects. Institution staff define and print plans per level; ROOT admins browse cross-institution. Pedagogical level: ALL.

## Requirements

### Requirement: Create Study Plan

`POST /v1/study-plans` MUST create a plan with `name` (required, 1–200 chars), `modality` (required), `academicYear` (required), `level` (required), and `institutionId` (required). Non-ROOT users SHALL have `institutionId` and `level` auto-filled from JWT claims and those fields MUST be readonly. ROOT users SHALL select `institutionId` from a dropdown (fetched via `GET /v1/institutions?active=true`) and `level` from a level dropdown.

#### Scenario: Non-ROOT creates plan with auto-filled context

- GIVEN a DIRECTOR user with `institutionId="inst-1"` and `level=2` (PRIMARIO) in JWT
- WHEN they submit a new plan with `name="Plan 2025"`, `modality="PRESENCIAL"`, `academicYear=2025`
- THEN the system persists `institutionId="inst-1"`, `level=2` from JWT and returns HTTP 201

#### Scenario: ROOT creates plan selecting institution and level

- GIVEN a ROOT user
- WHEN they select institution "Inst A" and level SECUNDARIO from dropdowns, then submit
- THEN the system persists the selected `institutionId` and `level` and returns HTTP 201

#### Scenario: Missing required fields rejected

- GIVEN a user creating a plan
- WHEN the request omits `name` or `modality` or `academicYear`
- THEN the system MUST return HTTP 400 with validation errors

### Requirement: List Study Plans

`GET /v1/study-plans` MUST return plans scoped to the user's institution. An optional `level` query parameter SHALL filter results. ROOT users MUST specify `institutionId` as a query parameter; non-ROOT users are scoped to their JWT `institutionId` automatically.

#### Scenario: Non-ROOT lists plans for own institution

- GIVEN a DIRECTOR user with `institutionId="inst-1"`
- WHEN `GET /v1/study-plans` is called
- THEN only plans where `institutionId="inst-1"` are returned

#### Scenario: Filter by level

- GIVEN plans exist for PRIMARIO and SECUNDARIO at the user's institution
- WHEN `GET /v1/study-plans?level=2` is called
- THEN only PRIMARIO-level plans are returned

#### Scenario: ROOT lists plans for a specific institution

- GIVEN a ROOT user
- WHEN `GET /v1/study-plans?institutionId=inst-1` is called
- THEN plans for `inst-1` only are returned

### Requirement: Update Study Plan

`PATCH /v1/study-plans/:id` MUST allow partial updates to `name`, `modality`, `academicYear`. The `institutionId` and `level` fields MUST NOT be modifiable after creation. Response SHALL be HTTP 200 with updated data, or `{ data: null }` if not found.

#### Scenario: Update plan name

- GIVEN a plan with `id="sp-1"`, `name="Old Plan"`
- WHEN `PATCH /v1/study-plans/sp-1` with `{ name: "New Plan" }`
- THEN the system returns HTTP 200 with `{ data: { id: "sp-1", name: "New Plan", ... } }`

#### Scenario: Level and institution immutable

- GIVEN a plan with `level=2`, `institutionId="inst-1"`
- WHEN `PATCH /v1/study-plans/sp-1` with `{ level: 3, institutionId: "inst-2" }`
- THEN the system MUST ignore `level` and `institutionId` fields — only mutable fields update

### Requirement: Delete Study Plan

`DELETE /v1/study-plans/:id` MUST soft-delete the plan and cascade-delete all associated `StudyPlanCourse` and `StudyPlanSubject` junction records. Response SHALL be HTTP 204.

#### Scenario: Soft-delete plan with cascading junctions

- GIVEN a plan `sp-1` with 3 courses and 5 subject associations
- WHEN `DELETE /v1/study-plans/sp-1` is called
- THEN the plan is soft-deleted (`deletedAt` set) and all 8 junction records are removed

### Requirement: Manage Courses in Study Plan

`POST /v1/study-plans/:id/courses` MUST associate CourseSections to a plan by creating `StudyPlanCourse` junction records. Request body SHALL contain `courseSectionIds` (array of IDs, at least one). Duplicate associations MUST be silently skipped. `DELETE /v1/study-plans/:id/courses/:courseId` MUST remove the junction and cascade-delete its `StudyPlanSubject` records.

#### Scenario: Add courses to plan

- GIVEN a plan `sp-1` with no courses
- WHEN `POST /v1/study-plans/sp-1/courses` with `{ courseSectionIds: ["cs-1", "cs-2"] }`
- THEN two `StudyPlanCourse` junctions are created and HTTP 201 is returned

#### Scenario: Duplicate course skipped

- GIVEN a plan `sp-1` already associated with `cs-1`
- WHEN `POST /v1/study-plans/sp-1/courses` with `{ courseSectionIds: ["cs-1", "cs-3"] }`
- THEN `cs-1` is skipped, `cs-3` is added, and no error is returned

#### Scenario: Remove course cascades subjects

- GIVEN plan `sp-1` with course `cs-1` that has 3 subject associations
- WHEN `DELETE /v1/study-plans/sp-1/courses/cs-1`
- THEN the `StudyPlanCourse` junction and all 3 `StudyPlanSubject` junctions are deleted

### Requirement: Manage Subjects in Plan Course

`POST /v1/study-plans/:id/courses/:courseId/subjects` MUST associate Subjects to a plan-course by creating `StudyPlanSubject` junction records. Request body SHALL contain `subjectIds` (array, at least one). Duplicate associations MUST be silently skipped. `DELETE /v1/study-plans/:id/courses/:courseId/subjects/:subjectId` MUST remove the junction record.

#### Scenario: Add subjects to plan course

- GIVEN plan `sp-1` with course `cs-1` and no subjects
- WHEN `POST` with `{ subjectIds: ["sub-1", "sub-2"] }`
- THEN two `StudyPlanSubject` junctions are created

#### Scenario: Remove subject from plan course

- GIVEN plan `sp-1` with course `cs-1` associated with `sub-1`
- WHEN `DELETE /v1/study-plans/sp-1/courses/cs-1/subjects/sub-1`
- THEN the `StudyPlanSubject` junction is deleted

### Requirement: Print Study Plan

The study plan view MUST display a print button. Clicking it SHALL trigger `window.print()`. The `@media print` CSS MUST hide sidebar, navigation, form controls, and the print button itself. Each course block MUST apply `page-break-inside: avoid`. Printed output SHALL include the plan name, level, modality, academic year, and a table of courses with their associated subjects.

#### Scenario: Print produces clean plan output

- GIVEN a user viewing study plan `sp-1` with courses and subjects loaded
- WHEN they click the print button
- THEN the browser print dialog opens showing plan header and course/subject tables — no navigation or controls visible

#### Scenario: Course blocks avoid page-break splits

- GIVEN a plan with many courses spanning multiple printed pages
- WHEN the print preview renders
- THEN each course block uses `page-break-inside: avoid` to prevent mid-course splits
