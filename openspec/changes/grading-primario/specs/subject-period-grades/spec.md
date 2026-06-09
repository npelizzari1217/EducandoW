# Spec: Subject Period Grades

> Capability area: alphanumeric period grade per (student, courseCycle, subject, period)
> Change: grading-primario · Fase 4, Etapa 1
> IDs: SPG-R* / SPG-S*

## Purpose

Define what MUST be true after this change regarding the storage and retrieval of alphanumeric
subject-level period grades for Primario students.

## Requirements

### SPG-R1 — Grade tuple

A `SubjectPeriodGrade` MUST associate one `GradeScaleValue` with a unique
`(institutionId, studentId, courseCycleId, subjectId, periodOrdinal)` tuple.
At most one row per tuple exists.

#### SPG-S1 — Save a valid period grade

- GIVEN a valid (studentId, courseCycleId, subjectId, periodOrdinal) tuple
  and a gradeScaleValueId belonging to the active GradeScale for the courseCycle's level/modality
- WHEN a create/upsert request is submitted
- THEN the response is HTTP 200 with `{ data: { id, studentId, courseCycleId, subjectId,
  periodOrdinal, periodName, gradeScaleValueId, gradeCode, internalStatus } }`

---

### SPG-R2 — Snapshotted period structure

Each `SubjectPeriodGrade` row MUST carry a snapshotted `periodOrdinal` (Int) and
`periodName` (String) copied from the period configuration at the time the first grade
in the CourseCycle×Subject is written. There is NO live FK to `GradingPeriodTemplateItem`;
the grade is immune to future period-plan changes.

#### SPG-S2 — Period name is preserved after plan change

- GIVEN a SubjectPeriodGrade saved with periodName = "1° Trimestre"
- WHEN the institution later renames its period plan
- THEN the SubjectPeriodGrade still reads periodName = "1° Trimestre"

---

### SPG-R3 — GradeScale validation

The `gradeScaleValueId` MUST belong to the GradeScale active for the `CourseCycle.level`
and `CourseCycle.modality`. A value from a different level/modality scale → HTTP 400.

#### SPG-S3 — Scale mismatch rejected

- GIVEN a gradeScaleValueId that belongs to the SECUNDARIO scale
- WHEN submitted for a PRIMARIO courseCycle
- THEN response is HTTP 400

---

### SPG-R4 — Upsert semantics

Submitting grades for an existing `(institutionId, studentId, courseCycleId, subjectId,
periodOrdinal)` MUST overwrite (upsert) the previous value, not create a second row.

#### SPG-S4 — Re-save overwrites, not duplicates

- GIVEN a SubjectPeriodGrade with gradeCode = "MB" for student A, period 1
- WHEN the teacher saves gradeCode = "B" for the same tuple
- THEN the row is updated to gradeCode = "B" and no duplicate row exists

---

### SPG-R5 — Period ordinal bounds

The `periodOrdinal` MUST be within the valid range of the snapshotted period structure
for the given `courseCycleId×subjectId`. Out-of-range ordinals → HTTP 400.

#### SPG-S5 — Out-of-range periodOrdinal rejected

- GIVEN a CourseCycle×Subject snapshotted with 3 periods (ordinals 1–3)
- WHEN a grade is submitted with periodOrdinal = 5
- THEN response is HTTP 400

---

### SPG-R6 — Not-found references

References to non-existent `studentId`, `courseCycleId`, `subjectId`, or
`gradeScaleValueId` within the institution → HTTP 404.

#### SPG-S6 — Non-existent studentId returns 404

- GIVEN a studentId that does not belong to the institution
- WHEN a grade is submitted for that student
- THEN response is HTTP 404

---

### SPG-R7 — Multi-tenant scoping

ALL reads and writes MUST be scoped by `institutionId` derived from the JWT.
A grade belonging to a different institution MUST NOT be returned or modified.

#### SPG-S7 — Cross-tenant isolation

- GIVEN studentId X exists in institution A but not institution B
- WHEN institution B's JWT submits a grade for studentId X
- THEN response is HTTP 404

---

### SPG-R8 — Bulk read by courseCycle + subject

`GET /subject-period-grades?courseCycleId=:id&subjectId=:id` MUST return all
`SubjectPeriodGrade` rows for every enrolled student in that combination,
wrapped in `{ data: [...] }`.

#### SPG-S8 — GET returns grades for all students

- GIVEN a CourseCycle with 20 enrolled students, 3 periods, subject "Matemática"
  and grades recorded for 15 of the 20 students
- WHEN GET /subject-period-grades?courseCycleId=X&subjectId=Y is called
- THEN response is `{ data: [array of 15 rows] }` (only rows that exist)

---

### SPG-R9 — Missing required fields → 400

A request body missing `studentId`, `courseCycleId`, `subjectId`, `periodOrdinal`,
or `gradeScaleValueId` MUST return HTTP 400.

#### SPG-S9 — Missing gradeScaleValueId rejected

- GIVEN a request body without gradeScaleValueId
- WHEN submitted to the create/upsert endpoint
- THEN response is HTTP 400
