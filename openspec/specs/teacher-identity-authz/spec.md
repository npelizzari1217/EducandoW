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

### TIA-R5 — "Alumnos por curso" resolves via AsignacionCursoXCiclo(rol=TITULAR)

_(Supersedes legacy `homeroomTeacherId` path — updated by S3a `retiro-homeroom-titular-s3a`, 2026-06-17; column dropped by S3b-0 `retiro-homeroom-column-s3b0`, 2026-06-17)_

`GET /course-cycles?teacherUserId=:userId&role=homeroom` MUST return only the CourseCycles
for which the authenticated user is the homeroom titular, resolved via:
`userId → DocenteXCiclo(active=true) → AsignacionCursoXCiclo(rol=TITULAR) → courseCycleId[]`.
The `Teacher` table MUST NOT be queried during this resolution.
Results MUST pass the Primario decade filter (`Math.floor(level / 10) === 2`).
The `CourseCycle.homeroomTeacherId` column and its FK/index no longer exist in the schema
(dropped by migration `20260617120000_drop_homeroom_teacher_id`).

#### TIA-S5 — Only TITULAR CourseCycles returned for homeroom mode

- GIVEN user U has AsignacionCursoXCiclo(rol=TITULAR, docenteXCiclo.userId=U, docenteXCiclo.active=true) for CourseCycle C
  AND no TITULAR assignment for CourseCycle D
- WHEN GET /course-cycles?teacherUserId=U&role=homeroom is called
- THEN response contains CourseCycle C only; CourseCycle D is absent
- AND the Teacher table is not queried

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

---

### TIA-R10 — `/teachers` admin CRUD retired; docente persona management via `/users` + `/docentes-x-ciclo`

_(Added by S3b-2 `retiro-teachers-admin-s3b2`, 2026-06-17 — Decision #3)_

The five `/teachers` REST endpoints (POST, GET collection, GET/:id, PATCH, DELETE) MUST NOT
be registered in the NestJS application. All associated source files — controller, module, DTOs,
use-cases, Prisma repository, and repository spec — MUST NOT exist under `api/src/`.

**Docente persona management is served exclusively by:**
- `POST /users`, `GET /users`, `PATCH /users/:id` — create and update docente persona (UP-R1)
- `GET /docentes-x-ciclo?cycleId=` — list enrolled docentes per cycle

**Preserved intentionally (not retired in this change):**
- Prisma `Teacher` model — FK target for `MesaExamen.presidenteId`, `ActaExamen.presidenteId`,
  and `SubjectAssignment.teacherId`. No schema migration was applied.
- Domain `Teacher` entity and `TeacherRepository` interface — retained as dead code (build-safe);
  removal deferred to S3b-final.
- `TEACHERS` module-permission record in the master database — consumed by the
  `GET /docentes-x-ciclo` guard (`@Roles('ROOT', { module: 'TEACHERS', action: 'READ' })`).
  This record MUST NOT be deleted.

**R-GAP (accepted operational window, closes in S3b-3):** After S3b-2 no code path
creates new `Teacher` table rows. Creating a `MesaExamen` or `ActaExamen` with a
`presidenteId` that has no existing `Teacher` row will be rejected by Postgres (FK Restrict
violation). This affects only new docentes created via `/users` after S3b-2 is deployed
when acting as `presidente`. Existing `Teacher` rows continue to work. The gap closes when
S3b-3 migrates `presidenteId` from FK → Teacher to a User reference.

**Deferred:**
- S3b-3: migrate `MesaExamen.presidenteId` and `ActaExamen.presidenteId` FK → User/DocenteXCiclo
  (closes R-GAP)
- S3b-final: drop `Teacher` table, domain entity, and `TeacherRepository` interface

#### TIA-S10 — `/teachers` endpoints return 404

- GIVEN the NestJS application has started successfully after S3b-2
- WHEN a client sends any of POST/GET/GET/:id/PATCH/DELETE to `/teachers`
- THEN the server MUST respond with HTTP 404
- AND no controller handler for `/teachers` MUST be reached

#### TIA-S11 — Docente persona management via `/users` unaffected

- GIVEN S3b-2 has been applied
- WHEN `POST /users`, `GET /users`, or `PATCH /users/:id` are called
- THEN those endpoints MUST continue to respond with the same HTTP status codes and payload
  shapes as before S3b-2

#### TIA-S12 — `/docentes-x-ciclo` guard still enforces TEACHERS:READ

- GIVEN a user with `TEACHERS:READ` permission
- WHEN `GET /docentes-x-ciclo?cycleId=<valid-id>` is called
- THEN the server MUST respond with HTTP 200 and the expected payload
