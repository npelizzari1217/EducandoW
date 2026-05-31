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

`GET /v1/study-plans` MUST return plans scoped to the user's institution. An optional `level` query parameter SHALL filter results. ROOT users MUST specify `institutionId` as a query parameter, and the study-plan list UI MUST default that institution filter to the first option in the dropdown, not an empty or "all" value. Non-ROOT users SHALL see a disabled text input showing their institution name. `GET /v1/study-plans/:id/courses` MUST return course data including `courseGrade` and `courseDivision` fields for each course. The plan list MUST render each plan as a collapsible accordion. Multiple plans MAY be expanded simultaneously. Courses SHALL be collapsed by default; clicking a course toggles its subjects. Subjects SHALL be collapsed by default within each course. Chevron icons (▶) SHALL rotate 90° when expanded. All expansion state MUST be managed via a `Set<string>` of expanded IDs in React.

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

#### Scenario: ROOT defaults to the first institution in the dropdown

- GIVEN a ROOT user and a loaded institution dropdown with multiple institutions
- WHEN the study-plan list screen renders
- THEN the institution filter MUST select the first institution by default
- AND it MUST NOT default to an empty or "all" value

#### Scenario: Non-ROOT sees a disabled institution name input

- GIVEN a non-ROOT user assigned to "Inst A"
- WHEN the study-plan list screen renders
- THEN the institution filter MUST be shown as a disabled text input
- AND it MUST display "Inst A"

#### Scenario: Courses include grade and division

- GIVEN plan `sp-1` with course `cs-1` (grade "3ro", division "A")
- WHEN `GET /v1/study-plans/sp-1/courses` is called
- THEN each course item includes `courseGrade: "3ro"` and `courseDivision: "A"`

#### Scenario: Multiple plans expanded simultaneously

- GIVEN plans `sp-1` and `sp-2` displayed as accordions
- WHEN user expands `sp-1` then expands `sp-2`
- THEN both plans remain expanded

#### Scenario: Chevron rotates on expand

- GIVEN plan `sp-1` is collapsed with ▶ icon
- WHEN user clicks to expand `sp-1`
- THEN the ▶ icon rotates 90° clockwise

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

The study plan view MUST display a print button. Clicking it SHALL trigger `window.print()`. The `@media print` CSS MUST hide sidebar, navigation, form controls, and the print button itself via `.no-print` class. All accordion content MUST be visible when printing — expanded state applies to all plans, courses, and subjects regardless of on-screen collapse state. Each course row MUST apply `break-inside: avoid`. Printed output SHALL include the plan name, level, modality, academic year, and courses with their subjects.

#### Scenario: Print produces clean plan output

- GIVEN a user viewing study plan `sp-1` with courses and subjects loaded
- WHEN they click the print button
- THEN browser print dialog opens showing full plan header and course/subject details — no navigation or controls visible

#### Scenario: Course blocks avoid page-break splits

- GIVEN a plan with many courses spanning multiple printed pages
- WHEN the print preview renders
- THEN each course row uses `break-inside: avoid`

#### Scenario: All accordion content visible in print

- GIVEN plans with collapsed courses on screen
- WHEN user triggers print
- THEN all plans, courses, and subjects are expanded and visible

#### Scenario: Action buttons hidden in print

- GIVEN action buttons on screen with `.no-print` class
- WHEN user triggers print
- THEN all `.no-print` elements are hidden

### Requirement: PATCH Course Section

`PATCH /v1/course-sections/:id` MUST accept partial updates for `grade` (preserves case, trims), `division` (uppercased, trims), and `name` (optional). If `name` is absent, the system MUST auto-generate it as `{grade} {division}`. Response SHALL be HTTP 200 with updated data, or 404 if not found.

#### Scenario: Auto-generate name from grade and division

- GIVEN course section `cs-1`
- WHEN `PATCH /v1/course-sections/cs-1` with `{ grade: "3ro", division: "a" }`
- THEN division is uppercased to "A", name becomes "3ro A", HTTP 200 returned

#### Scenario: Explicit name skips auto-generation

- GIVEN course section `cs-1`
- WHEN `PATCH /v1/course-sections/cs-1` with `{ grade: "3ro", division: "a", name: "Custom" }`
- THEN name remains "Custom"

### Requirement: PATCH Subject

`PATCH /v1/subjects/:id` MUST accept partial updates for `name` (preserves case, trims whitespace only). Response SHALL be HTTP 200 with updated data, or 404 if not found.

#### Scenario: Update subject name preserving case

- GIVEN subject `sub-1` with name "Matemática"
- WHEN `PATCH /v1/subjects/sub-1` with `{ name: "Matemática Avanzada" }`
- THEN name is stored as "Matemática Avanzada", HTTP 200 returned

### Requirement: DTO Field Casing Rules

Subject `name` MUST use textField validation (trim only, no uppercase). Course `grade` MUST use textField validation (trim only, no uppercase). Only `division` MUST use codeField validation (uppercase + trim).

#### Scenario: Subject name preserves original casing

- GIVEN a request with subject `name: "Lengua y Literatura"`
- WHEN processed through DTO validation
- THEN name is stored as "Lengua y Literatura" (trimmed, not uppercased)

#### Scenario: Division is uppercased via codeField

- GIVEN a request with `division: "a"`
- WHEN processed through DTO validation
- THEN division is stored as "A"

### Requirement: Visual Hierarchy Styling

The plan UI MUST render three nesting depths with distinct visual treatment. Plan cards: white bg, left border `#6366f1` 4px, border-radius 12px. Course rows: white bg, left border `#a5b4fc` 3px, border-radius 8px, indented. Subject items: bg `#f8fafc`, indented twice, font-size 0.82rem. Level badges MUST be rounded 20px, color-coded: INICIAL=green, PRIMARIO=blue, SECUNDARIO=amber, TERCIARIO=purple.

#### Scenario: Plan card renders with indigo left border

- GIVEN a study plan at any level
- WHEN the plan card is displayed
- THEN it renders white bg, 4px `#6366f1` left border, 12px border-radius

#### Scenario: Level badge color matches educational level

- GIVEN a SECUNDARIO-level plan
- WHEN rendered
- THEN the level badge is amber, border-radius 20px
