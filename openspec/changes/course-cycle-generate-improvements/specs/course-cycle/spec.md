# Delta for CourseCycle

## MODIFIED Requirements

### Requirement: Bulk Generate CourseCycles

The system MUST expose `POST /v1/course-cycles/generate`. Given a `cycleId` and an optional `studyPlanId`, it MUST perform a per-course UPSERT: if a `CourseCycle` for `(courseId, cycleId)` already exists it MUST update `courseName`; if it does not exist it MUST create it. The system MUST derive `level` via `Level.fromParts(plan.level, plan.modality)` — it MUST NOT hardcode any level value. When `studyPlanId` is absent, the system MUST process ALL active `StudyPlan` records whose composite level matches the `level` filter. The system MUST return `{ created, updated, total }`. Generated records MUST store `null` for all bimester fields — effective dates are resolved from the AcademicCycle at read time.
(Previously: `studyPlanId` was required; duplicates were silently skipped (no update); `level` was hardcoded to `buildLevel('PRIMARIO')`; response was `{ created, skipped, total }`)

#### Scenario: All courses generated — none pre-exist

- GIVEN a `StudyPlan` with 5 courses and a valid `AcademicCycle`, and none are registered yet
- WHEN `POST /v1/course-cycles/generate` is called with `{ studyPlanId, cycleId }`
- THEN 5 `CourseCycle` records are created with bimester fields as `null`
- AND the response is `{ created: 5, updated: 0, total: 5 }`

#### Scenario: Some courses already exist — courseName is updated

- GIVEN a `StudyPlan` with 5 courses and 2 already have a `CourseCycle` for `cycleId`
- WHEN `POST /v1/course-cycles/generate` is called with `{ studyPlanId, cycleId }`
- THEN 3 new records are created and 2 existing records have `courseName` updated
- AND the response is `{ created: 3, updated: 2, total: 5 }`

#### Scenario: Level derived from plan — not hardcoded

- GIVEN a `StudyPlan` with `level=2` (PRIMARIO) and `modality=1`
- WHEN `POST /v1/course-cycles/generate` is called
- THEN each generated `CourseCycle` has `level = 21` (`Level.fromParts(2, 1)`)
- AND NOT the hardcoded `buildLevel('PRIMARIO')` value

#### Scenario: studyPlanId absent — all plans for the level are processed

- GIVEN a `level` filter value and a valid `cycleId`, and no `studyPlanId` is provided
- AND there are 3 active `StudyPlan` records matching that composite level
- WHEN `POST /v1/course-cycles/generate` is called with `{ level, cycleId }`
- THEN the system processes all courses from all 3 plans
- AND returns `{ created, updated, total }` aggregated across all plans

#### Scenario: studyPlanId absent — no plans found for level

- GIVEN a `level` filter value and no `StudyPlan` records match it
- WHEN `POST /v1/course-cycles/generate` is called with `{ level, cycleId }`
- THEN the system returns `{ created: 0, updated: 0, total: 0 }`
- AND no error is raised

#### Scenario: StudyPlan not found

- GIVEN a non-existent `studyPlanId`
- WHEN `POST /v1/course-cycles/generate` is called
- THEN the system returns HTTP 404 with `StudyPlanNotFoundError`

#### Scenario: AcademicCycle not found

- GIVEN a non-existent `cycleId`
- WHEN `POST /v1/course-cycles/generate` is called
- THEN the system returns HTTP 404 with `AcademicCycleNotFoundError`

#### Scenario: AcademicCycle is inactive

- GIVEN an `AcademicCycle` with `active=false`
- WHEN `POST /v1/course-cycles/generate` is called with that `cycleId`
- THEN the system returns `AcademicCycleClosedError` (HTTP 409)
- AND no records are created or updated

---

### Requirement: Frontend CRUD Page

The system MUST provide a page at `/course-cycles` with:
- A filterable table: columns `courseName`, `level`, `cycle name`, `active` (badge), `passingGrade`, action buttons (edit, toggle active)
- Filter controls: combobox for `level` (composite LevelType 10–40), combobox for `cycleId`, combobox for `studyPlanId` (optional), toggle for `active/inactive`
- A "Generar Cursos" button that is enabled only when both `level` and `cycleId` filters are selected; it MUST call `POST /v1/course-cycles/generate` directly using the current filter values — NO modal dialog
- A create/edit form with all fields; bimester date fields are OPTIONAL
- The table MUST always display `courseName`; it MUST NOT display internal IDs
- The form MUST indicate when bimester dates are inherited from the cycle (shown as inherited, editable to override)
- The component `GenerateCourseCyclesModal` and the "Nuevo Curso por Ciclo" button MUST NOT exist

(Previously: "Generar cursos" opened a modal with `StudyPlan` selector + `AcademicCycle` selector; `studyPlanId` filter was absent from the page; modal `GenerateCourseCyclesModal` existed; response toast showed `{ created, skipped, total }`)

#### Scenario: "Generar Cursos" button disabled without required filters

- GIVEN the page is loaded but `level` or `cycleId` filter is not selected
- THEN the "Generar Cursos" button is disabled
- AND no request is sent

#### Scenario: "Generar Cursos" submits with required filters only

- GIVEN the user has selected `level` and `cycleId` but NOT `studyPlanId`
- WHEN the user clicks "Generar Cursos"
- THEN `POST /v1/course-cycles/generate` is called with `{ level, cycleId }` (no `studyPlanId`)
- AND the table refreshes showing the created/updated records
- AND a success toast displays `{ created, updated, total }`

#### Scenario: "Generar Cursos" submits with all three filters

- GIVEN the user has selected `level`, `cycleId`, and `studyPlanId`
- WHEN the user clicks "Generar Cursos"
- THEN `POST /v1/course-cycles/generate` is called with `{ level, cycleId, studyPlanId }`
- AND the table refreshes
- AND a success toast displays `{ created, updated, total }`

#### Scenario: Table filters update results

- GIVEN the page is loaded with results
- WHEN the user selects `level=Secundario` and toggles `active=true`
- THEN the table re-fetches with `?level=Secundario&active=true`
- AND only matching records are displayed

#### Scenario: Form shows inherited dates when CourseCycle has none

- GIVEN the user opens the edit form for a CourseCycle with no own bimester dates
- THEN the bimester date fields show the AcademicCycle's dates as placeholder/inherited values
- AND the user can override them by entering own values
