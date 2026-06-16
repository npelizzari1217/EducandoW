# Delta for Notas (Subject Grades)

> Capabilities: subject-period-grades, subject-final-grades (MODIFIED)
> Change: docente-ciclo-grupos · Fase 5
> Base specs: openspec/specs/subject-period-grades/spec.md,
>             openspec/specs/subject-final-grades/spec.md

## MODIFIED Requirements

### Requirement: Grade Scope Narrowed to Group

Grade reads and writes SHALL be scoped to a `GrupoXCursoXMateriaXCiclo`.
The system MUST use the group — not the full CursoXCiclo × Subject combination —
as the unit of access for teachers.
(Previously: scoped to CourseCycle × Subject globally, no group distinction.)

#### Scenario: Teacher sees only grades for their assigned group

- GIVEN a split subject with G1 (teacher D1, students S1–S15) and G2 (teacher D2, students S16–S30)
- WHEN D1 requests grades for that subject
- THEN only grades for students in G1 (S1–S15) are returned
- AND grades for S16–S30 (G2) are not visible to D1

#### Scenario: Secretario / Directivo sees all groups

- GIVEN a split subject with G1 and G2
- AND user U has SECRETARIO role with GRADES:READ module access
- WHEN U requests grades for that subject in the CursoXCiclo
- THEN grades for all students across G1 and G2 are returned (Door 2 grants full level scope)

---

### Requirement: One Record per (Student, Subject, Period) Shared Across Group Teachers

There SHALL be at most one grade record per `(studentId, materiaXCursoXCicloId, periodOrdinal)`
tuple, regardless of the number of teachers assigned to the group. ANY teacher assigned
to the group MAY create or overwrite that shared record. This shared-edit behavior is
intentional and MUST NOT be blocked.
(Previously: single record existed, but no explicit shared-edit policy was stated.)

#### Scenario: Co-docencia — second teacher edits the shared grade record

- GIVEN a GrupoXCursoXMateriaXCiclo G with teachers D1 and D2 (co-docencia)
- AND D1 has already saved gradeCode = "MB" for student S in period 1
- WHEN D2 saves gradeCode = "B" for the same student S in period 1
- THEN the record is updated to gradeCode = "B"; no duplicate row is created
- AND the operation is accepted without error

---

## ADDED Requirements

### Requirement: Write Operations Validate Group Assignment (Security Bug Fix)

`upsert-subject-period-grades` and `upsert-subject-final-grades` MUST verify that the
authenticated user is assigned as teacher to the `GrupoXCursoXMateriaXCiclo` being
written to, BEFORE persisting any data. If the user is NOT assigned to that group,
the write MUST be rejected with HTTP 403 Forbidden and NO record is written.

This closes a security bug where only the GET path validated assignment; upsert paths
did not — allowing any teacher to write grades for any subject.

#### Scenario: Assigned teacher writes grades successfully

- GIVEN teacher D1 is assigned to GrupoXCursoXMateriaXCiclo G1 for subject M in cycle C1
- WHEN D1 submits an upsert for a student in G1
- THEN the grade is persisted and the response is HTTP 200

#### Scenario: Unassigned teacher is rejected on write (bug closed)

- GIVEN teacher D2 is NOT assigned to any group for subject M in CursoXCiclo CC1
- WHEN D2 attempts to upsert a grade for a student in CC1's subject M
- THEN the system returns HTTP 403 Forbidden
- AND no grade record is written or modified

#### Scenario: Same-institution teacher with a different subject assignment is rejected

- GIVEN teacher D3 is assigned to group G2 for subject M2 in CC1, but NOT to any group for subject M1
- WHEN D3 attempts to write a grade for subject M1 in CC1
- THEN the system returns HTTP 403 — being in the same institution and cycle is not sufficient;
  group-level assignment for that specific subject is required

#### Scenario: Secretario / Directivo with GRADES:CREATE can write without group assignment

- GIVEN user U has SECRETARIO role and GRADES:CREATE module access
- WHEN U submits an upsert for any grade in their institution and level scope
- THEN the system accepts the write — management scope (Door 2 for SECRETARIO/DIRECTOR)
  overrides the group-assignment gate that applies only to TEACHER-rank users
