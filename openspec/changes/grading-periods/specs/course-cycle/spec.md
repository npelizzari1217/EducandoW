# Delta for CourseCycle

## ADDED Requirements

### Requirement: CourseCycle — activeGradingPeriod Field

The system MUST persist `activeGradingPeriod` as a nullable integer on `CourseCycle`. This field stores an explicit period override set by the user. When `null`, the resolved period is calculated from effective bimester dates via `GradingPeriodCalculator`. The field MUST be writable only through `PATCH /v1/course-cycles/:id/grading-period`.

| Field | Type | Constraint |
|-------|------|------------|
| `activeGradingPeriod` | Int? | nullable, 1–4; set via grading-period endpoint only |

#### Scenario: CourseCycle created — activeGradingPeriod defaults to null

- GIVEN a valid create request for `CourseCycle`
- WHEN `POST /v1/course-cycles` is called
- THEN the new record has `activeGradingPeriod=null`

#### Scenario: General PATCH does not accept activeGradingPeriod

- GIVEN a `PATCH /v1/course-cycles/:id` request body that includes `activeGradingPeriod`
- WHEN the use case processes the input
- THEN `activeGradingPeriod` is ignored and NOT persisted via this endpoint
- AND the field MUST only be set through `PATCH /v1/course-cycles/:id/grading-period`

---

### Requirement: CourseCycle — getCurrentPeriod() Domain Method

The system MUST provide a `getCurrentPeriod()` method on the `CourseCycle` entity. It MUST return `activeGradingPeriod` if set (non-null). If `activeGradingPeriod` is `null`, it MUST delegate to `GradingPeriodCalculator.currentPeriod()` using the effective bimester dates (own dates if set, otherwise AcademicCycle dates). It MUST return `null` when no period can be resolved.

#### Scenario: getCurrentPeriod returns explicit value

- GIVEN a `CourseCycle` with `activeGradingPeriod=3`
- WHEN `courseCycle.getCurrentPeriod()` is called
- THEN it returns `3` without invoking the calculator

#### Scenario: getCurrentPeriod delegates to calculator when no override

- GIVEN a `CourseCycle` with `activeGradingPeriod=null` and today within bimester 2 range
- WHEN `courseCycle.getCurrentPeriod()` is called
- THEN it returns `2` (from the calculator)

#### Scenario: getCurrentPeriod returns null when outside all ranges

- GIVEN a `CourseCycle` with `activeGradingPeriod=null` and today outside all bimester ranges
- WHEN `courseCycle.getCurrentPeriod()` is called
- THEN it returns `null`

---

## MODIFIED Requirements

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
| `firstBimonthStart/End` | DateTime pair | **optional** (nullable), end > start when provided |
| `secondBimonthStart/End` | DateTime pair | **optional** (nullable), end > start when provided |
| `thirdBimonthStart/End` | DateTime pair | **optional** (nullable), end > start when provided |
| `fourthBimonthStart/End` | DateTime pair | **optional** (nullable), end > start when provided |
| `activeGradingPeriod` | Int? | nullable; explicit period override (1–4) |
| `lastModifiedAt` | DateTime | auto-updated on write |

The system MUST enforce a unique constraint on `(courseId, cycleId)`.
(Previously: `activeGradingPeriod` field did not exist)

#### Scenario: Create a valid CourseCycle

- GIVEN a valid `courseId`, `studyPlanId`, `cycleId`, and all required fields
- WHEN `POST /v1/course-cycles` is called
- THEN the record is persisted with `active=true`, `courseName` in UPPERCASE, and `activeGradingPeriod=null`
- AND `lastModifiedAt` is set to the current timestamp

#### Scenario: Reject duplicate (courseId, cycleId)

- GIVEN a `CourseCycle` already exists for `(courseId, cycleId)`
- WHEN `POST /v1/course-cycles` is called with the same pair
- THEN the system returns `CourseCycleAlreadyExistsError` (HTTP 409)
- AND no record is created

#### Scenario: Create CourseCycle without bimester dates — dates inherited from AcademicCycle

- GIVEN a valid `cycleId` pointing to an `AcademicCycle` that has all 8 bimester dates set
- AND the request body does NOT include any bimester date fields
- WHEN `POST /v1/course-cycles` is called
- THEN the record is persisted with all 8 bimester date fields as `null`
- AND the effective bimester dates in GET responses are those from the AcademicCycle

#### Scenario: Create CourseCycle with own bimester dates — own dates take precedence

- GIVEN a valid `cycleId` pointing to an `AcademicCycle` that has bimester dates set
- AND the request body includes all 8 bimester dates
- WHEN `POST /v1/course-cycles` is called
- THEN the record is persisted with the provided bimester dates
- AND the effective bimester dates in GET responses are those from the CourseCycle itself

---

### Requirement: CRUD Endpoints

The system MUST expose the following REST endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/course-cycles` | List with filters; paginated; ordered by `courseName ASC` |
| GET | `/v1/course-cycles/:id` | Get by ID — returns effective bimester dates |
| POST | `/v1/course-cycles` | Create |
| PATCH | `/v1/course-cycles/:id` | Update (blocked if `active=false`) |
| DELETE | `/v1/course-cycles/:id` | Soft delete (blocked if `active=false`) |
| PATCH | `/v1/course-cycles/:id/deactivate` | Set `active=false` |
| PATCH | `/v1/course-cycles/:id/activate` | Set `active=true` |
| POST | `/v1/course-cycles/generate` | Bulk generate |
| GET | `/v1/course-cycles/:id/grading-period` | Get active grading period with source |
| PATCH | `/v1/course-cycles/:id/grading-period` | Set or clear explicit period override |

`GET /v1/course-cycles` MUST support query filters: `?level=`, `?cycleId=`, `?active=`. Filters SHOULD be combinable. The response for GET (single and list) MUST include `effectiveBimonthDates` — the CourseCycle's own dates if not null, otherwise those of the linked AcademicCycle.
(Previously: grading-period endpoints did not exist)

#### Scenario: GET CourseCycle without own dates — returns AcademicCycle dates as effective

- GIVEN a `CourseCycle` with all bimester fields `null`
- AND its linked `AcademicCycle` has `firstBimStart: 2026-03-01` and `firstBimEnd: 2026-04-30`
- WHEN `GET /v1/course-cycles/:id` is called
- THEN `effectiveBimonthDates.firstBimonthStart` is `2026-03-01`
- AND `effectiveBimonthDates.firstBimonthEnd` is `2026-04-30`
- AND `ownBimonthDates` fields are all `null`

#### Scenario: GET CourseCycle with own dates — returns own dates as effective

- GIVEN a `CourseCycle` with `firstBimonthStart: 2026-04-01` and `firstBimonthEnd: 2026-05-15`
- AND its linked `AcademicCycle` has different dates for the first bimester
- WHEN `GET /v1/course-cycles/:id` is called
- THEN `effectiveBimonthDates.firstBimonthStart` is `2026-04-01`
- AND `effectiveBimonthDates.firstBimonthEnd` is `2026-05-15`

#### Scenario: List with combined filters

- GIVEN CourseCycles with mixed levels and cycles
- WHEN `GET /v1/course-cycles?level=Primario&cycleId=abc&active=true` is called
- THEN only records matching all three filters are returned
- AND results are ordered by `courseName ASC`
- AND the response includes pagination metadata (`page`, `pageSize`, `total`)
- AND each record includes `effectiveBimonthDates`

#### Scenario: Get by ID — not found

- GIVEN no `CourseCycle` exists with `id=999`
- WHEN `GET /v1/course-cycles/999` is called
- THEN the system returns HTTP 404 with `CourseCycleNotFoundError`
