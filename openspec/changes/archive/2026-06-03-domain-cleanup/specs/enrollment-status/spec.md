# EnrollmentStatus Specification

## Purpose

Self-validating Value Object that represents the lifecycle state of a student's enrollment.
Replaces the `EnrollmentStatus` string union type in `enrollment/entities/enrollment.ts`.

## Requirements

### Requirement: EnrollmentStatus Value Object

The domain MUST provide an `EnrollmentStatus` Value Object in `enrollment/value-objects/`.
It MUST be immutable and self-validating via a `create()` factory that returns `Result`.
Valid status values are: `ACTIVE`, `INACTIVE`, `GRADUATED`, `TRANSFERRED`.
Any other value MUST be rejected with `ValidationError`.
A `reconstruct()` factory MUST be provided for infrastructure hydration (no validation).

#### Scenario: Valid status accepted

- GIVEN a valid status string `"ACTIVE"`, `"INACTIVE"`, `"GRADUATED"`, or `"TRANSFERRED"`
- WHEN `EnrollmentStatus.create(value)` is called
- THEN it returns `Result.ok` containing the `EnrollmentStatus` instance
- AND `status.value` equals the input string

#### Scenario: Invalid status rejected

- GIVEN a string not in the valid set, e.g. `"PENDING"` or `""`
- WHEN `EnrollmentStatus.create(value)` is called
- THEN it returns `Result.fail` with a `ValidationError`
- AND the error message identifies the invalid value

#### Scenario: Empty string rejected

- GIVEN an empty string `""`
- WHEN `EnrollmentStatus.create("")` is called
- THEN it returns `Result.fail` with a `ValidationError`

#### Scenario: Reconstruct bypasses validation

- GIVEN a raw string value from a persisted record (e.g. `"GRADUATED"`)
- WHEN `EnrollmentStatus.reconstruct(value)` is called
- THEN it returns an `EnrollmentStatus` instance directly without Result wrapping

#### Scenario: Equality between two instances

- GIVEN two `EnrollmentStatus` instances with the same value
- WHEN `a.equals(b)` is called
- THEN it returns `true`

---

### Requirement: Enrollment entity uses EnrollmentStatus VO

The `Enrollment` entity MUST use the `EnrollmentStatus` VO instead of the string union type.
`EnrollmentProps.status` MUST be typed as `EnrollmentStatus` VO.
`Enrollment.create()` MUST initialize `status` to `EnrollmentStatus.reconstruct("ACTIVE")`.
`Enrollment.changeStatus()` MUST accept `EnrollmentStatus` VO.
The getter `enrollment.status` MUST return `EnrollmentStatus` VO.

#### Scenario: New enrollment has ACTIVE status

- GIVEN valid enrollment creation props
- WHEN `Enrollment.create(props)` is called
- THEN `enrollment.status.value` equals `"ACTIVE"`

#### Scenario: Status changed via VO

- GIVEN an existing enrollment with status `ACTIVE`
- AND a valid `EnrollmentStatus` VO for `"GRADUATED"`
- WHEN `enrollment.changeStatus(graduatedStatus)` is called
- THEN `enrollment.status.value` equals `"GRADUATED"`

#### Scenario: Backward-compatible re-export

- GIVEN existing code importing `EnrollmentStatus` from `enrollment/entities/enrollment.ts`
- WHEN that import is used
- THEN it resolves to the VO class (re-exported from entities index) without breaking
