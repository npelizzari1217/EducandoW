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
