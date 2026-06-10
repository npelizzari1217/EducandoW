# Spec: Teacher Identity & Authorization

> Capability area: Teacher↔User link and teacher-filtered views
> Change: grading-primario · Fase 4, Etapa 1
> IDs: TIA-R* / TIA-S*

## Purpose

Define what MUST be true after this change regarding how the authenticated user
resolves to a Teacher record, and what data a teacher is authorized to see in the
two grading entry views.

## Requirements

### TIA-R1 — Teacher.userId link

The `Teacher` entity MUST have a nullable `userId` field that stores the `id` of the
corresponding `User` record from the master database. This field enables the system to
resolve a JWT sub to a tenant Teacher record.

#### TIA-S1 — Teacher resolved by userId

- GIVEN a JWT with sub = "user-abc"
- AND a Teacher record with userId = "user-abc" in the tenant DB
- WHEN the system resolves the teacher identity
- THEN the Teacher record with userId = "user-abc" is returned

---

### TIA-R2 — No matching Teacher returns empty, not error

If `Teacher.userId` is not populated for any teacher, or if no Teacher record matches
the JWT sub, the system MUST return an empty result set — NOT a 404 or 500.

#### TIA-S2 — Unpopulated userId returns empty list

- GIVEN no Teacher record has userId = "user-xyz"
- WHEN a teacher-filtered query is executed for userId "user-xyz"
- THEN response is HTTP 200 with `{ data: [] }`

---

### TIA-R3 — "Alumnos por materia" filters by SubjectAssignment

`GET /course-cycles?teacherUserId=:userId` MUST return only the CourseCycles in which
the resolved Teacher has at least one `SubjectAssignment`.
Subjects outside the teacher's assignments are excluded.

#### TIA-S3 — Only assigned CourseCycles returned for por-materia

- GIVEN teacher T has SubjectAssignment rows for CourseCycle A (subject Math)
  and no assignment in CourseCycle B
- WHEN GET /course-cycles?teacherUserId=T is called
- THEN response contains CourseCycle A only; CourseCycle B is absent

---

### TIA-R4 — Subject filtering within a CourseCycle for "por materia"

`GET /course-cycles/:id/subjects?teacherUserId=:userId` MUST return only the subjects
in that CourseCycle to which the teacher has a `SubjectAssignment`.

#### TIA-S4 — Only assigned subjects returned within a CourseCycle

- GIVEN teacher T is assigned to Math and Science in CourseCycle A, but not History
- WHEN GET /course-cycles/A/subjects?teacherUserId=T is called
- THEN response contains Math and Science; History is absent

---

### TIA-R5 — "Alumnos por curso" filters by homeroomTeacherId

`GET /course-cycles?homeroomTeacherUserId=:userId` MUST return only the CourseCycles
where `CourseCycle.homeroomTeacherId` equals the resolved Teacher.id.

#### TIA-S5 — Only homeroom CourseCycles returned for por-curso

- GIVEN teacher T is homeroom of CourseCycle C but not CourseCycle D
- WHEN GET /course-cycles?homeroomTeacherUserId=T is called
- THEN response contains CourseCycle C only

---

### TIA-R6 — Empty state for teacher with no assignments

A teacher with a valid `userId` link but no `SubjectAssignment` rows and no
`homeroomTeacherId` reference MUST receive an empty result set from all
teacher-filtered queries — not an error.

#### TIA-S6 — Teacher with no assignments gets empty result

- GIVEN teacher T has userId set but zero SubjectAssignments
  and is not homeroom of any CourseCycle
- WHEN GET /course-cycles?teacherUserId=T and GET /course-cycles?homeroomTeacherUserId=T are called
- THEN both return HTTP 200 with `{ data: [] }`

---

### TIA-R7 — Multi-tenant scoping

ALL teacher-filtered queries MUST be scoped to the `institutionId` from the JWT.
A teacher from institution A must not see data from institution B.

#### TIA-S7 — Cross-tenant teacher query returns empty

- GIVEN userId "user-abc" belongs to a teacher in institution A
- WHEN institution B's JWT queries with teacherUserId = "user-abc"
- THEN response is `{ data: [] }` (no cross-tenant leakage)

---

### TIA-R8 — Response format

All teacher-filtered list endpoints MUST return responses wrapped in `{ data: [...] }`.

#### TIA-S8 — Response is wrapped in data

- GIVEN a valid teacher with assignments
- WHEN any teacher-filtered query is called
- THEN the response JSON has the shape `{ data: [...] }`

---

### TIA-R9 — Non-Primario CourseCycles excluded from Primario screens

Teacher-filtered queries for the Primario grading screens MUST return only CourseCycles
with level indicating Primario (`Math.floor(level / 10) === 2`).

#### TIA-S9 — Secundario CourseCycle not shown in Primario context

- GIVEN teacher T has SubjectAssignments in both a PRIMARIO CourseCycle and a SECUNDARIO CourseCycle
- WHEN the Primario entry screen requests teacher-filtered CourseCycles
- THEN only the PRIMARIO CourseCycle is returned
