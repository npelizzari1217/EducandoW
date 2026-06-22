# Spec: Materia / Grupo por Ciclo

> Capability: materia-grupo-ciclo
> Change: docente-ciclo-grupos · Fase 3
> IDs: MGC-R* / MGC-S*

## Purpose

Define the materialization of subjects from a study plan into a `CursoXCiclo`, the
student-subject universe (`AlumnosXMateriaXCursoXCiclo`), and the group model
(Modelo 1) that associates one teacher with a subset of those students per subject
per cycle. Establishes the hard containment invariant and the overlap rule for
co-teaching.

## Requirements

### MGC-R1 — Subjects materialized on CursoXCiclo generation only

`MateriaXCursoXCiclo` records SHALL be created when a user explicitly generates a
`CursoXCiclo` by selecting a `CicloLectivo`, a study plan, and confirming the action
("Generar"). Creating a `CicloLectivo` alone MUST NOT produce any `MateriaXCursoXCiclo`.

#### MGC-S1 — Generation creates one row per plan subject

- GIVEN a CicloLectivo C1 and a StudyPlan with 8 subjects (Matemática, Lengua, Historia…)
- WHEN a user selects C1 + that plan and presses "Generar"
- THEN 8 MateriaXCursoXCiclo records are created, one per subject in the plan,
  all linked to the new CursoXCiclo

#### MGC-S2 — Creating the cycle alone does not create subjects

- GIVEN a new CicloLectivo is created with no CursoXCiclo attached
- WHEN the CicloLectivo is saved
- THEN zero MateriaXCursoXCiclo records are created

#### MGC-S3 — Two courses from the same plan produce independent subject sets

- GIVEN StudyPlan P with 6 subjects
- WHEN course "3A" is generated with C1 + P and course "3B" is also generated with C1 + P
- THEN "3A" has 6 MateriaXCursoXCiclo rows and "3B" has 6 independent rows (12 total)
- AND modifying a subject row of "3A" does not affect "3B"

---

### MGC-R2 — Student-subject universe managed manually

Students enrolled in a subject for a cycle are tracked via `AlumnosXMateriaXCursoXCiclo`,
which is the authoritative universe for that subject. Students MUST be added individually
by an authorized user, selecting from the students already enrolled in the institution.
The ingresantes / new-enrollment flow is NOT a valid source. Bulk/batch assignment
to a subject is OUT OF SCOPE for this change.

#### MGC-S4 — Enrolled student added manually to a subject

- GIVEN student S is already enrolled in institution I1 (present in the student registry)
- AND a MateriaXCursoXCiclo M exists for cycle C1 in I1
- WHEN an authorized user adds S to M
- THEN an AlumnosXMateriaXCursoXCiclo record is created for (S, M)

#### MGC-S5 — Student from ingresantes flow cannot be added

- GIVEN student S2 exists only in the ingresantes / enrollment flow and is not yet in the enrolled registry
- WHEN an authorized user attempts to add S2 to a MateriaXCursoXCiclo
- THEN the operation is rejected — S2 is not a valid source student

#### MGC-S6 — Bulk assignment endpoint does not exist

- GIVEN a MateriaXCursoXCiclo M with 0 enrolled students
- WHEN a client attempts a batch-add of all course students to M in a single request
- THEN the system SHALL NOT expose such an endpoint; students are added one at a time

---

### MGC-R3 — Group model: Modelo 1

A `GrupoXCursoXMateriaXCiclo` SHALL associate exactly one `DocenteXCiclo` with a
subset of students drawn from `AlumnosXMateriaXCursoXCiclo`. For a non-split subject
there is exactly one group covering all enrolled students. For a split subject (materia
partida) there are multiple groups, each with its own `DocenteXCiclo` and a distinct
student subset.

#### MGC-S7 — Normal subject: one group covers all students

- GIVEN MateriaXCursoXCiclo M (non-split) with 30 students in its universe
- WHEN a single group is created with DocenteXCiclo D and all 30 students
- THEN 1 GrupoXCursoXMateriaXCiclo exists for M, with D as teacher and 30 members

#### MGC-S8 — Split subject: multiple groups, each with a distinct teacher

- GIVEN MateriaXCursoXCiclo M (partida) with 30 students in its universe
- WHEN group G1 is created with DocenteXCiclo D1 and students S1–S15
- AND group G2 is created with DocenteXCiclo D2 and students S16–S30
- THEN 2 GrupoXCursoXMateriaXCiclo records exist for M
- AND G1 → D1, G2 → D2; each group has its own teacher and its own student list

---

### MGC-R4 — Hard containment: grupo ⊆ materia ⊆ curso

Students added to a `GrupoXCursoXMateriaXCiclo` (`AlumnosXGrupoXCursoXMateriaXCiclo`)
MUST already exist in `AlumnosXMateriaXCursoXCiclo` for that subject. A group MUST
NOT contain any student whose `CursoXCiclo` differs from the group's `CursoXCiclo`.
Both constraints are enforced at write time and MUST return an error if violated.

#### MGC-S9 — Student in subject universe can be added to a group

- GIVEN student S is in AlumnosXMateriaXCursoXCiclo for subject M in CursoXCiclo CC1
- WHEN S is added to a GrupoXCursoXMateriaXCiclo of M in CC1
- THEN the AlumnosXGrupoXCursoXMateriaXCiclo record is created successfully

#### MGC-S10 — Student from a different course is rejected (hard constraint)

- GIVEN student S2 is enrolled in CursoXCiclo CC2 (different course) and NOT in CC1
- WHEN an attempt is made to add S2 to any group belonging to CC1
- THEN the operation is rejected with an error — cross-course group membership is forbidden

#### MGC-S11 — Student not in subject universe is rejected

- GIVEN student S3 is in AlumnosXMateriaXCursoXCiclo of CC1 but NOT for subject M
- WHEN an attempt is made to add S3 to a group of subject M in CC1
- THEN the operation is rejected — S3 is not in the universe for M in CC1

---

### MGC-R5 — Overlap permitted (co-docencia)

A student MAY appear in more than one `GrupoXCursoXMateriaXCiclo` of the same
`MateriaXCursoXCiclo`. This represents a co-teaching scenario and MUST be accepted
without error.

#### MGC-S12 — Same student in two groups of the same subject (co-docencia)

- GIVEN MateriaXCursoXCiclo M with groups G1 (D1) and G2 (D2)
- AND student S is in AlumnosXMateriaXCursoXCiclo for M
- WHEN S is added to both G1 and G2
- THEN both AlumnosXGrupoXCursoXMateriaXCiclo records are created successfully
- AND no uniqueness error is raised; the overlap is valid

---

### MGC-R6 — Multi-tenant and cycle scoping

All entities in this capability (`MateriaXCursoXCiclo`, `AlumnosXMateriaXCursoXCiclo`,
`GrupoXCursoXMateriaXCiclo`, `AlumnosXGrupoXCursoXMateriaXCiclo`) MUST be scoped by
`institutionId` and `cycleId`. Records from a different institution or a different cycle
MUST NOT be accessible across those boundaries.

#### MGC-S13 — Cross-institution isolation

- GIVEN MateriaXCursoXCiclo M exists in institution I1, cycle C1
- WHEN institution I2's tenant queries its subject list for cycle C1
- THEN M does not appear in the result

---

### MGC-R7 — `esOptativa` attribute on `MateriaXCursoXCiclo`

`MateriaXCursoXCiclo` MUST carry a boolean attribute `esOptativa`. The default value
SHALL be `false`. All rows created by `CursoXCiclo` generation (MGC-R1) MUST receive
`esOptativa = false` unless explicitly set otherwise after generation. No backfill is
applied to pre-existing rows; they retain whatever default the migration assigns.

#### MGC-S14 — Generated subjects default to esOptativa = false

- GIVEN a StudyPlan with 5 subjects and none pre-marked as optativa
- WHEN a user generates a CursoXCiclo with that plan
- THEN all 5 MateriaXCursoXCiclo records have `esOptativa = false`

---

### MGC-R8 — Cascade enrollment excludes optativa materias

The cascade use case (`CascadeStudentMateriasCompetenciasUseCase`,
`POST /course-cycles/:ccId/alumnos/:id/cascade`) MUST filter out any
`MateriaXCursoXCiclo` where `esOptativa = true` before executing the student-materia
upsert. No `AlumnosXMateriaXCursoXCiclo` record SHALL be created for an optativa materia
as a result of a cascade call. Non-optativa (obligatoria) materias MUST continue to be
enrolled normally by the same cascade call (no regression).

#### MGC-S15 — Cascade skips optativa materia

- GIVEN CursoXCiclo CC1 has 4 materias: M1, M2 (obligatoria), M3, M4 (esOptativa = true)
- WHEN cascade is called for student S on CC1
- THEN AlumnosXMateriaXCursoXCiclo records are created for M1 and M2 only
- AND no records are created for M3 or M4

#### MGC-S16 — Cascade continues to enroll obligatoria materias (regression guard)

- GIVEN CursoXCiclo CC1 has 3 materias all with esOptativa = false
- WHEN cascade is called for student S
- THEN AlumnosXMateriaXCursoXCiclo records are created for all 3 materias
- AND behavior is identical to the behavior before this change

#### MGC-S17 — All-optativa CC produces zero cascade enrollments without error

- GIVEN CursoXCiclo CC1 has 2 materias both with esOptativa = true
- WHEN cascade is called for student S
- THEN 0 AlumnosXMateriaXCursoXCiclo records are created
- AND the cascade operation completes successfully with no error

---

### MGC-R9 — Manual per-student enrollment and removal for optativa materias

An authorized user MUST be able to add a student to an optativa materia manually
using the existing add endpoint (`POST /course-cycles/:ccId/materias/:materiaId/alumnos`).
An authorized user MUST ALSO be able to remove a student from any materia — optativa
or obligatoria — via a new delete endpoint
(`DELETE /course-cycles/:ccId/materias/:materiaId/alumnos/:id`, where `:id` is the
`AlumnosXMateriaXCursoXCiclo` enrollment-record id, mirroring the grupo-removal URL).
A `RemoveStudentFromMateriaUseCase` SHALL back the delete endpoint. Both operations
MUST be idempotent: adding an already-enrolled student MUST NOT produce a duplicate row
or an error, and removing an enrollment record that does not exist MUST be a no-op that
succeeds (HTTP 204) WITHOUT modifying data — it MUST NOT return an error.

#### MGC-S18 — Authorized user adds student to optativa materia manually

- GIVEN MateriaXCursoXCiclo M with esOptativa = true
- AND student S is enrolled in the institution (in the student registry)
- AND an authorized user initiates a manual add
- WHEN POST /course-cycles/:ccId/materias/:materiaId/alumnos is called with studentId S
- THEN an AlumnosXMateriaXCursoXCiclo record is created for (S, M)
- AND the response is HTTP 201

#### MGC-S19 — Authorized user removes student from optativa materia

- GIVEN AlumnosXMateriaXCursoXCiclo record E (id = eId) exists for student S in optativa materia M
- WHEN DELETE /course-cycles/:ccId/materias/:materiaId/alumnos/:id is called with id = eId
- THEN record E is deleted
- AND the response is HTTP 204

#### MGC-S20 — Removing the last enrolled student is valid

- GIVEN optativa materia M has exactly 1 enrolled student S
- WHEN DELETE is called for S in M
- THEN the record is deleted; M now has 0 enrolled students
- AND M itself is NOT deleted; an empty enrollment list is a valid state
- AND the response is HTTP 200 (or 204)

#### MGC-S21 — Adding an already-enrolled student is idempotent

- GIVEN student S is already enrolled in materia M (any esOptativa value)
- WHEN POST .../alumnos is called again with the same studentId S
- THEN no duplicate AlumnosXMateriaXCursoXCiclo row is created
- AND the operation succeeds without error (HTTP 200 or 201)

#### MGC-S22 — Removing a non-existent enrollment record is an idempotent no-op

- GIVEN no AlumnosXMateriaXCursoXCiclo record exists for the given id in materia M
- WHEN DELETE /course-cycles/:ccId/materias/:materiaId/alumnos/:id is called with that id
- THEN no data is modified
- AND the operation succeeds without error (HTTP 204)

---

### MGC-R10 — Admin can toggle `esOptativa` via PATCH

An authorized admin MUST be able to change `esOptativa` on a `MateriaXCursoXCiclo`
via `PATCH /course-cycles/:ccId/materias/:materiaId`. The PATCH body SHALL accept
`{ esOptativa: boolean }`. The toggle MUST be reversible: a materia MAY be toggled
from obligatoria to optativa and back without restriction. Other fields on the materia
(description, studyPlanSubjectId, etc.) SHALL remain unchanged by a toggle-only PATCH.

#### MGC-S23 — Toggle obligatoria materia to optativa

- GIVEN MateriaXCursoXCiclo M with esOptativa = false
- WHEN PATCH /course-cycles/:ccId/materias/:materiaId is called with `{ esOptativa: true }`
- THEN M.esOptativa is updated to true
- AND the response includes the updated materia with esOptativa = true
- AND all other fields of M are unchanged

#### MGC-S24 — Toggle optativa materia back to obligatoria

- GIVEN MateriaXCursoXCiclo M with esOptativa = true
- WHEN PATCH /course-cycles/:ccId/materias/:materiaId is called with `{ esOptativa: false }`
- THEN M.esOptativa is updated to false
- AND future cascade calls for M will enroll students again (behavior reverts to MGC-R8 normal path)

---

### MGC-R11 — No auto-cleanup on retroactive toggle to optativa

Marking a `MateriaXCursoXCiclo` as `esOptativa = true` after students have already
been cascade-enrolled MUST NOT automatically remove those enrolled students. Existing
`AlumnosXMateriaXCursoXCiclo` records MUST be preserved. Removal of previously
enrolled students after a retroactive toggle is exclusively manual via the delete
endpoint defined in MGC-R9. Additionally, a subsequent cascade call for a NEW student
after the toggle MUST respect the `esOptativa = true` flag and skip enrollment in that
materia (consistent with MGC-R8).

#### MGC-S25 — Enrolled students are retained after retroactive toggle to optativa

- GIVEN CursoXCiclo CC1 with materia M (esOptativa = false)
- AND students S1, S2 are enrolled in M via previous cascade calls
- WHEN an admin toggles M to esOptativa = true via PATCH
- THEN M.esOptativa = true
- AND the AlumnosXMateriaXCursoXCiclo records for S1 and S2 in M are UNCHANGED
- AND no automatic removal occurs

#### MGC-S26 — Subsequent cascade for a new student skips the retroactively-flagged optativa

- GIVEN materia M was retroactively toggled to esOptativa = true (from MGC-S25)
- AND students S1, S2 are still enrolled in M (no cleanup was performed)
- WHEN cascade is called for new student S3 on CC1
- THEN S3 is NOT enrolled in M
- AND S3 is enrolled in all obligatoria materias of CC1 normally

---

### MGC-R12 — `GET .../materias` response exposes `esOptativa`

Every endpoint that returns `MateriaXCursoXCiclo` data — specifically
`GET /course-cycles/:ccId/materias` and any aggregate that includes materia details —
MUST include `esOptativa` in the response payload (`MateriaResponse` DTO). Consumers
MUST be able to distinguish obligatoria from optativa materias without a separate
request.

#### MGC-S27 — GET materias includes esOptativa field for each entry

- GIVEN CursoXCiclo CC1 has materia M1 (esOptativa = false) and M2 (esOptativa = true)
- WHEN GET /course-cycles/:ccId/materias is called
- THEN the response includes both M1 and M2
- AND M1's payload contains `esOptativa: false`
- AND M2's payload contains `esOptativa: true`
