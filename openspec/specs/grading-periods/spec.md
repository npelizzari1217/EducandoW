# Grading Periods Specification

## Purpose

Permite determinar qué período de evaluación (bimestre 1–4 o trimestre 1–3) está activo en un `CourseCycle`. La resolución sigue el orden: override explícito > cálculo por fechas > ninguno. Afecta ALL niveles pedagógicos (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO).

---

## Requirements

### Requirement: Value Object — GradingPeriod

The system MUST represent a grading period as an immutable Value Object wrapping an integer. For BIMESTER type, valid values are 1–4. For TRIMESTER type, valid values are 1–3. The system MUST reject 0, negative values, and values exceeding the type's maximum.

| Field | Type | Constraint |
|-------|------|------------|
| `value` | Int | 1–4 (BIMESTER) or 1–3 (TRIMESTER) |
| `periodType` | Enum | `BIMESTER \| TRIMESTER` |

#### Scenario: Create valid bimester period

- GIVEN `GradingPeriod.create(2, "BIMESTER")`
- WHEN the factory is called
- THEN a valid VO is returned with `value=2` and `periodType=BIMESTER`

#### Scenario: Reject value zero

- GIVEN `GradingPeriod.create(0, "BIMESTER")`
- WHEN the factory is called
- THEN a `GradingPeriodInvalidError` is returned
- AND no VO is created

#### Scenario: Reject value exceeding bimester maximum

- GIVEN `GradingPeriod.create(5, "BIMESTER")`
- WHEN the factory is called
- THEN a `GradingPeriodInvalidError` is returned

#### Scenario: Reject value exceeding trimester maximum

- GIVEN `GradingPeriod.create(4, "TRIMESTER")`
- WHEN the factory is called
- THEN a `GradingPeriodInvalidError` is returned

---

### Requirement: Domain Service — GradingPeriodCalculator

The system MUST provide a `GradingPeriodCalculator` domain service. Given an ordered list of `DateRange` pairs (start/end), it MUST return the 1-indexed position of the range that contains the current date (`new Date()`). When the current date falls outside all ranges, it MUST return `null`. The calculator MUST sort ranges by start date before evaluating. The calculator MUST return the first matching range when ranges overlap.

#### Scenario: Current date within the second range

- GIVEN date ranges `[{Mar–Apr}, {May–Jun}, {Aug–Sep}, {Oct–Nov}]`
- AND today's date falls within `{May–Jun}`
- WHEN `GradingPeriodCalculator.currentPeriod(ranges)` is called
- THEN it returns `2`

#### Scenario: Current date outside all ranges

- GIVEN date ranges covering only Q1 and Q2
- AND today's date is in July (a gap between ranges)
- WHEN `GradingPeriodCalculator.currentPeriod(ranges)` is called
- THEN it returns `null`

#### Scenario: Empty range list

- GIVEN an empty `ranges` array
- WHEN `GradingPeriodCalculator.currentPeriod([])` is called
- THEN it returns `null`

#### Scenario: Overlapping ranges — returns first match

- GIVEN ranges `[{Mar–Sep}, {May–Jun}]` and today is in May
- WHEN `GradingPeriodCalculator.currentPeriod(ranges)` is called
- THEN it returns `1` (first range sorted by start date)

---

### Requirement: Grading Period API Endpoints

The system MUST expose two endpoints on `CourseCycle`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/course-cycles/:id/grading-period` | Returns current active period with source |
| PATCH | `/v1/course-cycles/:id/grading-period` | Sets or clears explicit override |

`GET` MUST return `{ activeGradingPeriod: number | null, source: "explicit" | "calculated" | "none" }`.

`PATCH` MUST accept `{ activeGradingPeriod: number | null }`. Passing `null` MUST clear the override and revert to calculated resolution.

Both endpoints MUST be blocked for `CourseCycle` records with `active=false`.

#### Scenario: GET returns explicit override

- GIVEN a `CourseCycle` with `activeGradingPeriod=3` stored explicitly
- WHEN `GET /v1/course-cycles/:id/grading-period` is called
- THEN the response is `{ activeGradingPeriod: 3, source: "explicit" }`

#### Scenario: GET returns calculated period

- GIVEN a `CourseCycle` with `activeGradingPeriod=null` and effective bimester dates covering today in period 2
- WHEN `GET /v1/course-cycles/:id/grading-period` is called
- THEN the response is `{ activeGradingPeriod: 2, source: "calculated" }`

#### Scenario: GET returns none when outside all ranges

- GIVEN a `CourseCycle` with `activeGradingPeriod=null` and today outside all bimester ranges
- WHEN `GET /v1/course-cycles/:id/grading-period` is called
- THEN the response is `{ activeGradingPeriod: null, source: "none" }`

#### Scenario: PATCH sets explicit override

- GIVEN a `CourseCycle` with `activeGradingPeriod=null`
- WHEN `PATCH /v1/course-cycles/:id/grading-period` is called with `{ activeGradingPeriod: 2 }`
- THEN `activeGradingPeriod=2` is persisted on `CourseCycle`
- AND subsequent GET returns `{ activeGradingPeriod: 2, source: "explicit" }`

#### Scenario: PATCH clears override

- GIVEN a `CourseCycle` with `activeGradingPeriod=3` (explicit)
- WHEN `PATCH /v1/course-cycles/:id/grading-period` is called with `{ activeGradingPeriod: null }`
- THEN `activeGradingPeriod` is set to `null`
- AND subsequent GET resolves via calculation or returns `source: "none"`

#### Scenario: PATCH blocked on closed CourseCycle

- GIVEN a `CourseCycle` with `active=false`
- WHEN `PATCH /v1/course-cycles/:id/grading-period` is called
- THEN the system returns `CourseCycleClosedError` (HTTP 409)
- AND no change is persisted

#### Scenario: GET on non-existent CourseCycle

- GIVEN no `CourseCycle` with `id=999`
- WHEN `GET /v1/course-cycles/999/grading-period` is called
- THEN the system returns HTTP 404 with `CourseCycleNotFoundError`

---

### Requirement: Enrollment — activeGradingPeriod Denormalization

The system MUST store `activeGradingPeriod` as a nullable integer on the `Enrollment` model. When an `Enrollment` is created or updated, the system MUST copy the current `activeGradingPeriod` from the parent `CourseCycle` (resolved value, not raw field). This value is advisory — it MUST NOT block enrollment operations if it is `null`.

#### Scenario: Enrollment created inherits period from CourseCycle

- GIVEN a `CourseCycle` whose resolved `activeGradingPeriod` is `2`
- WHEN `POST /v1/enrollments` is called for that `CourseCycle`
- THEN the created `Enrollment` has `activeGradingPeriod=2`

#### Scenario: Enrollment created when CourseCycle has no active period

- GIVEN a `CourseCycle` whose resolved `activeGradingPeriod` is `null`
- WHEN `POST /v1/enrollments` is called
- THEN the created `Enrollment` has `activeGradingPeriod=null`
- AND the enrollment is persisted without error

#### Scenario: Enrollment updated reflects current CourseCycle period

- GIVEN an `Enrollment` with `activeGradingPeriod=1`
- AND the parent `CourseCycle` now resolves to period `2`
- WHEN the enrollment is updated via `PATCH /v1/enrollments/:id`
- THEN `Enrollment.activeGradingPeriod` is updated to `2`
