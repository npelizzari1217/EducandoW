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
wrapped in `{ data: [...] }`. For TEACHER-role callers, the returned rows are
further filtered to the teacher's assigned group(s). See SPG-R10.

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

---

### SPG-R10 — Group-scoped read for TEACHER role

> Declared by: `docente-ciclo-grupos/specs/notas/delta.md` ("Requirement: Grade Scope Narrowed to Group")
> Implemented (read path) by: `notas-get-authz-grupo` · 2026-06-16
> Change: notas-get-authz-grupo · IDs: SPG-R10 / SPG-S10–S13

A TEACHER MUST see only the `SubjectPeriodGrade` rows for students in their
assigned `GrupoXCursoXMateriaXCiclo`(s). Administrative roles (SECRETARIO, DIRECTOR,
ADMIN, ROOT) with GRADES:READ access MUST see all rows across all groups.

The scope is resolved via `AssignmentAuthorizerPort.getAllowedStudentIds(userId, roles, courseCycleId, subjectId)`:
- Returns `'all'` for administrative roles → no filtering applied.
- Returns `string[]` for teachers → rows filtered to students whose `studentId` is in the set; an empty array is valid (teacher has a group with no enrolled students).
- Returns `null` if the caller has no valid assignment → HTTP 403, no data returned.

When a TEACHER is assigned to multiple grupos for the same (courseCycle, subject), the
returned set is the deduplicated union of all assigned grupos' students.

#### SPG-S10 — TEACHER sees only their grupo's students

- GIVEN a course-cycle CC1 with subject M split into G1 (teacher D1, students S1–S15)
  and G2 (teacher D2, students S16–S30)
- WHEN D1 calls GET grades for subject M in CC1
- THEN response includes only rows for S1–S15
- AND rows for S16–S30 are absent

#### SPG-S11 — Administrative user sees all groups

- GIVEN a split subject with G1 and G2
- AND user U has SECRETARIO role with GRADES:READ access
- WHEN U calls GET grades for that subject and course-cycle
- THEN response includes rows for all students across G1 and G2
- AND the response shape is identical to a teacher's response — only row count differs

#### SPG-S12 — TEACHER with no assignment is forbidden

- GIVEN teacher D3 has no group assignment for subject M in CC1
- WHEN D3 calls GET grades for subject M in CC1
- THEN HTTP 403 is returned and no grade data is included in the response

#### SPG-S13 — TEACHER assigned to multiple grupos receives deduplicated union

- GIVEN course-cycle CC1 with subject M having G1 (students S1–S10) and G2
  (students S8–S15), where S8, S9, S10 appear in both grupos
- AND teacher D1 is assigned to both G1 and G2
- WHEN D1 calls GET grades for subject M in CC1
- THEN response contains rows for S1–S15 with no duplicate rows (S8, S9, S10 appear once)

---

### SPG-R11 — Co-docencia: one shared grade record per (student, subject, period)

> Declared by: `docente-ciclo-grupos/specs/notas/delta.md` ("Requirement: One Record per (Student, Subject, Period) Shared Across Group Teachers")
> Change: docente-ciclo-grupos · Fase 5

There SHALL be at most one `SubjectPeriodGrade` row per
`(studentId, materiaXCursoXCicloId, periodOrdinal)` tuple, regardless of the number
of teachers assigned to the group via `GrupoXCursoXMateriaXCiclo`. ANY teacher assigned
to the group MAY create or overwrite that shared record. This shared-edit behavior is
intentional and MUST NOT be blocked.

#### SPG-S14 — Co-docencia: second teacher overwrites the shared record

- GIVEN a GrupoXCursoXMateriaXCiclo G with teachers D1 and D2 (co-docencia)
- AND D1 has already saved gradeCode = "MB" for student S in period 1
- WHEN D2 saves gradeCode = "B" for the same student S in period 1
- THEN the row is updated to gradeCode = "B"; no duplicate row is created
- AND the operation is accepted without error

---

### SPG-R12 — Write authorization validates group assignment

> Declared by: `docente-ciclo-grupos/specs/notas/delta.md` ("Requirement: Write Operations Validate Group Assignment")
> Change: docente-ciclo-grupos · Fase 5

`upsert-subject-period-grades` MUST verify that the authenticated user is assigned as
teacher to the `GrupoXCursoXMateriaXCiclo` being written to, BEFORE persisting any data.
If the user is NOT assigned to that group, the write MUST be rejected with HTTP 403 and
NO record is written or modified. Administrative roles (SECRETARIO, DIRECTOR, ADMIN, ROOT)
with GRADES:CREATE access bypass this group-assignment check (Door 2 is scope, not group).

#### SPG-S15 — Assigned teacher writes period grades successfully

- GIVEN teacher D1 is assigned to GrupoXCursoXMateriaXCiclo G1 for subject M in cycle C1
- WHEN D1 submits an upsert for a student in G1
- THEN the grade is persisted and the response is HTTP 200

#### SPG-S16 — Unassigned teacher is rejected on write

- GIVEN teacher D2 is NOT assigned to any group for subject M in CursoXCiclo CC1
- WHEN D2 attempts to upsert a period grade for a student in CC1's subject M
- THEN the system returns HTTP 403 Forbidden
- AND no grade record is written or modified

#### SPG-S17 — Secretario / Directivo can write without group assignment

- GIVEN user U has SECRETARIO role and GRADES:CREATE module access
- WHEN U submits an upsert for any period grade in their institution and level scope
- THEN the system accepts the write (management scope overrides the group-assignment gate)
