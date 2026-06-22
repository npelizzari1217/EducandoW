# Delta: materia-grupo-ciclo — Optativas Inscripción

> Capabilities: materia-grupo-ciclo (MODIFIED)
> Change: optativas-inscripcion
> Base spec: openspec/specs/materia-grupo-ciclo/spec.md
> Pedagogical level: ALL — generic; applies to every level using the grupo model (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO)
> IDs added: MGC-R7–MGC-R12 / MGC-S14–MGC-S27

## Context

The current model auto-enrolls a student into EVERY `MateriaXCursoXCiclo` of a
`CursoXCiclo` when the cascade endpoint fires. There is no concept of an elective
(optativa) subject: every materialized subject behaves identically. This delta
introduces the `esOptativa` flag and the enrollment rules that depend on it.

---

## ADDED Requirements

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
- AND the response includes the updated materia with esOptativa = false
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
