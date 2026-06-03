# Delta for Student Profile

## ADDED Requirements

### Requirement: Student.institutionId typed as Id VO

`StudentProps.institutionId` MUST be typed as `Id` VO instead of `string`.
The getter `student.institutionId` MUST return `Id`.
`Student.create()` MUST accept `Id` for `institutionId` (optional — see R4).
`Student.reconstruct()` MUST accept `Id` for `institutionId`.
Existing callers that pass a pre-constructed `Id` instance SHALL continue to work.

#### Scenario: Student created with Id VO institutionId

- GIVEN a valid `Id` VO and all required student fields
- WHEN `Student.create({ ..., institutionId: Id.create("inst-uuid") })` is called
- THEN `student.institutionId.get()` returns `"inst-uuid"`

#### Scenario: Student reconstructed from persistence with Id VO

- GIVEN a persisted student record with `institutionId = "inst-uuid"`
- WHEN `Student.reconstruct({ ..., institutionId: Id.reconstruct("inst-uuid") })` is called
- THEN `student.institutionId.get()` returns `"inst-uuid"`

---

### Requirement: Teacher.institutionId typed as Id VO

`TeacherProps.institutionId` MUST be typed as `Id` VO instead of `string`.
The getter `teacher.institutionId` MUST return `Id`.
`Teacher.create()` MUST accept `Id` for `institutionId` (optional — see R4).
`Teacher.reconstruct()` MUST accept `Id` for `institutionId`.

#### Scenario: Teacher created with Id VO institutionId

- GIVEN a valid `Id` VO and all required teacher fields
- WHEN `Teacher.create({ ..., institutionId: Id.create("inst-uuid") })` is called
- THEN `teacher.institutionId.get()` returns `"inst-uuid"`

#### Scenario: Teacher reconstructed from persistence with Id VO

- GIVEN a persisted teacher record with `institutionId = "inst-uuid"`
- WHEN `Teacher.reconstruct({ ..., institutionId: Id.reconstruct("inst-uuid") })` is called
- THEN `teacher.institutionId.get()` returns `"inst-uuid"`

---

### Requirement: institutionId optional in tenant-scoped create() inputs

`Student.create()` MUST accept `institutionId` as optional (`Id | undefined`).
`Teacher.create()` MUST accept `institutionId` as optional (`Id | undefined`).
When `institutionId` is omitted, the entity is created without it (tenant DB is already scoped).
When `institutionId` is provided, it MUST be stored as an `Id` VO on the entity.
`reconstruct()` MUST keep `institutionId` required (infrastructure always has the value from DB).
`Enrollment.institutionId` is already typed as `Id` VO — no change required.

#### Scenario: Student created without institutionId

- GIVEN all required student fields, but no `institutionId`
- WHEN `Student.create({ firstName, lastName, dni })` is called
- THEN the student is created successfully
- AND `student.institutionId` is `undefined`

#### Scenario: Student created with institutionId still works

- GIVEN all required student fields and `institutionId: Id.create("inst-uuid")`
- WHEN `Student.create({ ..., institutionId })` is called
- THEN `student.institutionId?.get()` returns `"inst-uuid"`

#### Scenario: Teacher created without institutionId

- GIVEN all required teacher fields, but no `institutionId`
- WHEN `Teacher.create({ firstName, lastName, dni, email })` is called
- THEN the teacher is created successfully
- AND `teacher.institutionId` is `undefined`

#### Scenario: Teacher created with institutionId still works

- GIVEN all required teacher fields and `institutionId: Id.create("inst-uuid")`
- WHEN `Teacher.create({ ..., institutionId })` is called
- THEN `teacher.institutionId?.get()` returns `"inst-uuid"`

#### Scenario: Reconstruct always requires institutionId

- GIVEN a persisted record with a known institutionId
- WHEN `Student.reconstruct(props)` or `Teacher.reconstruct(props)` is called without `institutionId`
- THEN TypeScript compilation MUST fail (type-level enforcement, not runtime)
