# Spec: Subject Final Grades

> Capability area: four final grade instances (FINAL, DICIEMBRE, MARZO, DEFINITIVA) per (student, courseCycle, subject)
> Change: grading-primario · Fase 4, Etapa 1
> IDs: SFG-R* / SFG-S*

## Purpose

Define what MUST be true after this change regarding the four typed final grade instances
for Primario subjects.

## Requirements

### SFG-R1 — Typed row model

A `SubjectFinalGrade` MUST associate one `GradeScaleValue` with a unique
`(institutionId, studentId, courseCycleId, subjectId, type)` tuple,
where `type` is one of `{ FINAL, DICIEMBRE, MARZO, DEFINITIVA }`.
At most one row of each type exists per (student, courseCycle, subject).

#### SFG-S1 — Save a FINAL grade

- GIVEN a valid (studentId, courseCycleId, subjectId) reference
  and type = FINAL and a valid gradeScaleValueId
- WHEN the grade is submitted
- THEN response is HTTP 200 with `{ data: { id, studentId, courseCycleId, subjectId,
  type: "FINAL", gradeScaleValueId, gradeCode, internalStatus, passed } }`

---

### SFG-R2 — On-demand row creation

`SubjectFinalGrade` rows are NOT pre-scaffolded for all four types.
DICIEMBRE and MARZO rows are optional; their absence is a valid state (not an error).
DEFINITIVA is also optional until the teacher manually closes the subject.

#### SFG-S2 — Absent DICIEMBRE row is valid

- GIVEN a student's subject has only a FINAL row with no DICIEMBRE row
- WHEN the subject final grades are fetched
- THEN the response contains only the FINAL row; there is no null/empty DICIEMBRE entry
  and no 404 error

---

### SFG-R3 — Conditional lifecycle enforced by the use case

The use case MUST NOT create a DICIEMBRE row if the student's FINAL row already
has `passed = true`. Similarly, MARZO MUST NOT be created if DICIEMBRE has `passed = true`.
The database schema does NOT enforce this constraint; the use case does.
The API returns HTTP 400 if this condition is violated.

#### SFG-S3 — DICIEMBRE blocked when FINAL passed

- GIVEN studentId A has a FINAL row with passed = true for subject S
- WHEN a request to create a DICIEMBRE grade for that student/subject is submitted
- THEN response is HTTP 400 with a message indicating FINAL was already passed

#### SFG-S4 — DICIEMBRE allowed when FINAL not passed

- GIVEN studentId B has a FINAL row with passed = false for subject S
- WHEN a DICIEMBRE grade is submitted for that student/subject
- THEN response is HTTP 200 and the DICIEMBRE row is created

---

### SFG-R4 — DEFINITIVA carries a passed boolean

A `SubjectFinalGrade` row of type `DEFINITIVA` MUST include a `passed: Boolean` field.
`passed` is provided by the teacher and records the final promotion verdict for that subject.
No server-side formula computes it automatically.

#### SFG-S5 — DEFINITIVA saved with passed = true

- GIVEN type = DEFINITIVA and passed = true in the request body
- WHEN saved
- THEN the row has passed = true in the response

#### SFG-S6 — DEFINITIVA saved with passed = false

- GIVEN type = DEFINITIVA and passed = false
- WHEN saved
- THEN the row has passed = false; the student is not promoted for that subject

---

### SFG-R5 — Upsert semantics

Submitting a grade for an existing
`(institutionId, studentId, courseCycleId, subjectId, type)` MUST overwrite (upsert) the
previous row, not create a duplicate.

#### SFG-S7 — Re-save FINAL overwrites previous value

- GIVEN a FINAL row with gradeCode = "A" for student A, subject S
- WHEN the teacher saves gradeCode = "B" for the same tuple
- THEN the single row is updated to gradeCode = "B"; no second FINAL row exists

---

### SFG-R6 — GradeScale validation

The `gradeScaleValueId` MUST belong to the GradeScale active for the CourseCycle's
level/modality. A mismatched value → HTTP 400.

#### SFG-S8 — Wrong scale rejected

- GIVEN a gradeScaleValueId from a different level scale
- WHEN submitted for a Primario subject final grade
- THEN response is HTTP 400

---

### SFG-R7 — Not-found references

Non-existent `studentId`, `courseCycleId`, `subjectId`, or `gradeScaleValueId`
within the institution → HTTP 404.

#### SFG-S9 — Non-existent subjectId returns 404

- GIVEN a subjectId that does not exist in the institution
- WHEN a final grade is submitted
- THEN response is HTTP 404

---

### SFG-R8 — Invalid type enum → 400

An unknown `type` value (e.g., `"ENERO"`) → HTTP 400.

#### SFG-S10 — Invalid type enum rejected

- GIVEN type = "ENERO" in the request body
- WHEN submitted
- THEN response is HTTP 400

---

### SFG-R9 — Multi-tenant scoping

ALL reads and writes scoped by `institutionId` from the JWT.
Cross-tenant data access → HTTP 404.

#### SFG-S11 — Cross-tenant isolation

- GIVEN a courseCycleId from institution A
- WHEN institution B's JWT requests final grades for that courseCycleId
- THEN response is HTTP 404

---

### SFG-R10 — Bulk read by courseCycle + subject

`GET /subject-final-grades?courseCycleId=:id&subjectId=:id` MUST return all
existing `SubjectFinalGrade` rows (all types, all students) for that combination,
wrapped in `{ data: [...] }`.

#### SFG-S12 — GET returns all types for all students

- GIVEN 5 students, each with a FINAL row and 2 with a DICIEMBRE row
- WHEN GET is called for that courseCycle+subject
- THEN response is `{ data: [7 rows total] }`
