# CourseCycle Specification

## Purpose

Vincula un Curso (`CourseSection`) con un `StudyPlan` y un `AcademicCycle` formando la entidad `CourseCycle`. Permite organizar, filtrar y cerrar los cursos por ciclo lectivo. Un ciclo cerrado (`active=false`) bloquea toda modificación propia y de sus dependencias.

---

## Requirements

### Requirement: CourseCycle Data Model

The system MUST persist each `CourseCycle` with the following fields:

| Field | Type | Constraint |
|-------|------|------------|
| `id` | Int PK | autoincrement |
| `courseId` | String FK | → CourseSection (UUID) |
| `studyPlanId` | String FK | → StudyPlan (UUID) |
| `cycleId` | String FK | → AcademicCycle (UUID) |
| `courseName` | String | UPPERCASE always |
| `level` | Enum | Inicial \| Primario \| Secundario \| Terciario |
| `active` | Boolean | default `true` |
| `passingGrade` | Float | 1..10 inclusive |
| `promotionText` | String | free text |
| `firstBimonthStart/End` | DateTime pair | end > start |
| `secondBimonthStart/End` | DateTime pair | end > start |
| `thirdBimonthStart/End` | DateTime pair | end > start |
| `fourthBimonthStart/End` | DateTime pair | end > start |
| `lastModifiedAt` | DateTime | auto-updated on write |

The system MUST enforce a unique constraint on `(courseId, cycleId)`.

#### Scenario: Create a valid CourseCycle

- GIVEN a valid `courseId`, `studyPlanId`, `cycleId`, and all required fields
- WHEN `POST /v1/course-cycles` is called
- THEN the record is persisted with `active=true` and `courseName` in UPPERCASE
- AND `lastModifiedAt` is set to the current timestamp

#### Scenario: Reject duplicate (courseId, cycleId)

- GIVEN a `CourseCycle` already exists for `(courseId, cycleId)`
- WHEN `POST /v1/course-cycles` is called with the same pair
- THEN the system returns `CourseCycleAlreadyExistsError` (HTTP 409)
- AND no record is created

---

### Requirement: Value Object — CourseName

The system MUST normalize `courseName` to uppercase before persistence. The system MUST reject empty or whitespace-only names.

#### Scenario: Name with lowercase letters is normalized

- GIVEN a create or update request with `courseName: "matemática"`
- WHEN the use case processes the input
- THEN `courseName` is stored as `"MATEMÁTICA"`

#### Scenario: Empty name is rejected

- GIVEN a create request with `courseName: ""`
- WHEN the use case processes the input
- THEN the system returns a validation error
- AND no record is created

---

### Requirement: Value Object — PassingGrade

The system MUST accept `passingGrade` values between 1 and 10 inclusive. The system MUST reject values outside this range.

#### Scenario: Valid passing grade is accepted

- GIVEN `passingGrade: 6`
- WHEN a CourseCycle is created
- THEN the grade is stored without modification

#### Scenario: Out-of-range grade is rejected

- GIVEN `passingGrade: 0` or `passingGrade: 11`
- WHEN a CourseCycle is created or updated
- THEN the system returns a validation error
- AND no record is written

---

### Requirement: Value Object — BimonthPeriod

Each bimonth pair MUST satisfy `end > start`. The system MUST reject pairs where `end <= start`.

#### Scenario: Valid bimonth period is accepted

- GIVEN `firstBimonthStart: 2026-03-01` and `firstBimonthEnd: 2026-04-30`
- WHEN a CourseCycle is created
- THEN both dates are stored

#### Scenario: Invalid bimonth period is rejected

- GIVEN `firstBimonthStart: 2026-04-30` and `firstBimonthEnd: 2026-03-01` (end ≤ start)
- WHEN a CourseCycle is created or updated
- THEN the system returns a `BimonthPeriodInvalidError`
- AND no record is written

---

### Requirement: Active/Inactive Guard

The system MUST reject any modification to a `CourseCycle` where `active=false` with a `CourseCycleClosedError` (HTTP 409). The only allowed operations on a closed record are read and explicit reactivation via `PATCH /:id/activate`.

#### Scenario: Update blocked when cycle is closed

- GIVEN a `CourseCycle` with `active=false`
- WHEN `PATCH /v1/course-cycles/:id` is called
- THEN the system returns `CourseCycleClosedError` (HTTP 409)
- AND the record is not modified

#### Scenario: Delete blocked when cycle is closed

- GIVEN a `CourseCycle` with `active=false`
- WHEN `DELETE /v1/course-cycles/:id` is called
- THEN the system returns `CourseCycleClosedError` (HTTP 409)

#### Scenario: Deactivate an active CourseCycle

- GIVEN a `CourseCycle` with `active=true`
- WHEN `PATCH /v1/course-cycles/:id/deactivate` is called
- THEN `active` is set to `false` and `lastModifiedAt` is updated

#### Scenario: Reactivate a closed CourseCycle

- GIVEN a `CourseCycle` with `active=false`
- WHEN `PATCH /v1/course-cycles/:id/activate` is called
- THEN `active` is set to `true` and `lastModifiedAt` is updated

---

### Requirement: Bulk Generate CourseCycles

The system MUST expose `POST /v1/course-cycles/generate`. Given a `studyPlanId` and `cycleId`, it MUST create one `CourseCycle` per course in the plan for that cycle, skipping pairs that already exist. It MUST return `{ created, skipped, total }`.

#### Scenario: All courses generated successfully

- GIVEN a `StudyPlan` with 5 courses and a valid `AcademicCycle`, and none are registered yet
- WHEN `POST /v1/course-cycles/generate` is called with `{ studyPlanId, cycleId }`
- THEN 5 `CourseCycle` records are created
- AND the response is `{ created: 5, skipped: 0, total: 5 }`

#### Scenario: Some courses already exist — skipped without error

- GIVEN a `StudyPlan` with 5 courses and 2 already have a `CourseCycle` for `cycleId`
- WHEN `POST /v1/course-cycles/generate` is called
- THEN 3 new records are created, 2 are skipped
- AND the response is `{ created: 3, skipped: 2, total: 5 }`
- AND no error is raised for the skipped pairs

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
- AND no records are created

---

### Requirement: CRUD Endpoints

The system MUST expose the following REST endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/course-cycles` | List with filters; paginated; ordered by `courseName ASC` |
| GET | `/v1/course-cycles/:id` | Get by ID |
| POST | `/v1/course-cycles` | Create |
| PATCH | `/v1/course-cycles/:id` | Update (blocked if `active=false`) |
| DELETE | `/v1/course-cycles/:id` | Soft delete (blocked if `active=false`) |
| PATCH | `/v1/course-cycles/:id/deactivate` | Set `active=false` |
| PATCH | `/v1/course-cycles/:id/activate` | Set `active=true` |
| POST | `/v1/course-cycles/generate` | Bulk generate |

`GET /v1/course-cycles` MUST support query filters: `?level=`, `?cycleId=`, `?active=`. Filters SHOULD be combinable.

#### Scenario: List with combined filters

- GIVEN CourseCycles with mixed levels and cycles
- WHEN `GET /v1/course-cycles?level=Primario&cycleId=abc&active=true` is called
- THEN only records matching all three filters are returned
- AND results are ordered by `courseName ASC`
- AND the response includes pagination metadata (`page`, `pageSize`, `total`)

#### Scenario: Get by ID — not found

- GIVEN no `CourseCycle` exists with `id=999`
- WHEN `GET /v1/course-cycles/999` is called
- THEN the system returns HTTP 404 with `CourseCycleNotFoundError`

---

### Requirement: Frontend CRUD Page

The system MUST provide a page at `/course-cycles` with:
- A filterable table: columns `courseName`, `level`, `cycle name`, `active` (badge), `passingGrade`, action buttons (edit, toggle active)
- Filter controls: combobox for `level`, combobox for `cycleId`, toggle for `active/inactive`
- A "Generar cursos" button that opens a modal/dialog with `StudyPlan` selector + `AcademicCycle` selector + confirm button
- A create/edit form with all fields
- The table MUST always display `courseName`; it MUST NOT display internal IDs

#### Scenario: "Generar cursos" modal submits successfully

- GIVEN the user selects a `StudyPlan` and an `AcademicCycle` in the modal
- WHEN the user confirms
- THEN `POST /v1/course-cycles/generate` is called
- AND the table refreshes showing the created records
- AND a success toast displays `{ created, skipped, total }`

#### Scenario: Table filters update results

- GIVEN the page is loaded with results
- WHEN the user selects `level=Secundario` and toggles `active=true`
- THEN the table re-fetches with `?level=Secundario&active=true`
- AND only matching records are displayed
