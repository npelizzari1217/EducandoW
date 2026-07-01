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
wrapped in `{ data: [...] }`. For TEACHER-role callers, the returned rows are
further filtered to the teacher's assigned group(s). See SFG-R11.

#### SFG-S12 — GET returns all types for all students

- GIVEN 5 students, each with a FINAL row and 2 with a DICIEMBRE row
- WHEN GET is called for that courseCycle+subject
- THEN response is `{ data: [7 rows total] }`

---

### SFG-R11 — Group-scoped read for TEACHER role

> Declared by: `docente-ciclo-grupos/specs/notas/delta.md` ("Requirement: Grade Scope Narrowed to Group")
> Implemented (read path) by: `notas-get-authz-grupo` · 2026-06-16
> Change: notas-get-authz-grupo · IDs: SFG-R11 / SFG-S13–S15

A TEACHER MUST see only the `SubjectFinalGrade` rows for students in their
assigned `GrupoXCursoXMateriaXCiclo`(s). Administrative roles (SECRETARIO, DIRECTOR,
ADMIN, ROOT) with GRADES:READ access MUST see all rows across all groups.

Scope resolution follows the same `getAllowedStudentIds` tri-state model as SPG-R10
(`'all'` / `string[]` / `null`). The behavior, edge cases, and deduplication rules
are identical; only the target entity (`SubjectFinalGrade` vs `SubjectPeriodGrade`) differs.

#### SFG-S13 — TEACHER sees only their grupo's students (final grades)

- GIVEN a course-cycle CC1 with subject M split into G1 (teacher D1, students S1–S15)
  and G2 (teacher D2, students S16–S30) and FINAL rows for all students
- WHEN D1 calls GET final grades for subject M in CC1
- THEN response includes only rows for S1–S15 (all types)
- AND rows for S16–S30 are absent

#### SFG-S14 — TEACHER with no assignment is forbidden (final grades)

- GIVEN teacher D3 has no group assignment for subject M in CC1
- WHEN D3 calls GET final grades for subject M in CC1
- THEN HTTP 403 is returned and no grade data is included

#### SFG-S15 — Empty grupo → HTTP 200 with empty data (not forbidden)

- GIVEN teacher D1 is assigned to GrupoXCursoXMateriaXCiclo G1 for subject M in CC1
- AND G1 has zero enrolled students
- WHEN D1 calls GET final grades for subject M in CC1
- THEN HTTP 200 is returned with `{ data: [] }`
- AND the response MUST NOT be HTTP 403 — an assigned teacher with an empty grupo is not forbidden

---

### SFG-R12 — Co-docencia: one shared final grade record per (student, subject, type)

> Declared by: `docente-ciclo-grupos/specs/notas/delta.md` ("Requirement: One Record per (Student, Subject, Period) Shared Across Group Teachers")
> Change: docente-ciclo-grupos · Fase 5

There SHALL be at most one `SubjectFinalGrade` row per
`(institutionId, studentId, courseCycleId, subjectId, type)` tuple, regardless of the
number of teachers assigned to the group via `GrupoXCursoXMateriaXCiclo`. ANY teacher
assigned to the group MAY create or overwrite that shared record. This shared-edit behavior
is intentional and MUST NOT be blocked.

#### SFG-S16 — Co-docencia: second teacher overwrites the shared final grade record

- GIVEN a GrupoXCursoXMateriaXCiclo G with teachers D1 and D2 (co-docencia)
- AND D1 has already saved a FINAL grade with gradeCode = "MB" for student S
- WHEN D2 saves a FINAL grade with gradeCode = "B" for the same student S
- THEN the row is updated to gradeCode = "B"; no duplicate FINAL row is created
- AND the operation is accepted without error

---

### SFG-R13 — Write authorization validates group assignment

> Declared by: `docente-ciclo-grupos/specs/notas/delta.md` ("Requirement: Write Operations Validate Group Assignment")
> Change: docente-ciclo-grupos · Fase 5

`upsert-subject-final-grades` MUST verify that the authenticated user is assigned as
teacher to the `GrupoXCursoXMateriaXCiclo` being written to, BEFORE persisting any data.
If the user is NOT assigned to that group, the write MUST be rejected with HTTP 403 and
NO record is written or modified. Administrative roles (SECRETARIO, DIRECTOR, ADMIN, ROOT)
with GRADES:CREATE access bypass this group-assignment check.

#### SFG-S17 — Assigned teacher writes final grades successfully

- GIVEN teacher D1 is assigned to GrupoXCursoXMateriaXCiclo G1 for subject M in cycle C1
- WHEN D1 submits an upsert for a final grade for a student in G1
- THEN the grade is persisted and the response is HTTP 200

#### SFG-S18 — Unassigned teacher is rejected on final grade write

- GIVEN teacher D2 is NOT assigned to any group for subject M in CursoXCiclo CC1
- WHEN D2 attempts to upsert a final grade for a student in CC1's subject M
- THEN the system returns HTTP 403 Forbidden
- AND no final grade record is written or modified

#### SFG-S19 — Secretario / Directivo can write final grades without group assignment

- GIVEN user U has SECRETARIO role and GRADES:CREATE module access
- WHEN U submits an upsert for any final grade in their institution and level scope
- THEN the system accepts the write (management scope overrides the group-assignment gate)

---

### SFG-R14 — Grading phase guard — CIERRE-only writes

> Declared by: `fase-bimestre-cierre-asistencia/specs/spec.md` (AC-A-11, AC-A-12, AC-A-13)
> Change: fase-bimestre-cierre-asistencia (archived 2026-07-01)
> Cross-reference: `course-cycle/spec.md` — Requirement: Grading Phase

`upsert-subject-final-grades` MUST additionally verify, after existing authorization (SFG-R13),
that the parent `CourseCycle.gradingPhase = CIERRE` (via `GradingPhaseAuthorizerPort.canGradeFinal()`)
before accepting a write. When `gradingPhase` is `NULL` or any `BIM_n`, ALL final-grade writes
(FINAL, DICIEMBRE, MARZO, DEFINITIVA) MUST be rejected — final grades are editable ONLY during
`CIERRE`.

#### SFG-S20 — CIERRE permits all four final grade types

- GIVEN a `CourseCycle` with `gradingPhase = CIERRE`
- WHEN an authorized user submits a final grade of type FINAL, DICIEMBRE, MARZO, or DEFINITIVA
- THEN the system accepts the write for all four types

#### SFG-S21 — BIM_n and NULL reject final grade writes

- GIVEN a `CourseCycle` with `gradingPhase = BIM_1` or `gradingPhase = NULL`
- WHEN an authorized user submits a final grade of any type
- THEN the system rejects the write because final grades are only editable in `CIERRE`
