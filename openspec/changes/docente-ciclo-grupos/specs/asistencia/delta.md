# Delta for Asistencia (Attendance)

> Capability: attendance (MODIFIED)
> Change: docente-ciclo-grupos · Fase 6
> Base spec: openspec/specs/attendance-types/spec.md

## ADDED Requirements

### Requirement: Ausentes por Materia (Subject-Level Absence per Group)

Subject-level absences SHALL be recorded per `GrupoXCursoXMateriaXCiclo`.
Only the teacher assigned to that group as `DocenteXCiclo` MAY record absences for it.
The scope of read and write is the group; absence records are not visible across groups
for a TEACHER-rank user.

#### Scenario: Subject teacher records absences for their group

- GIVEN teacher D1 is the assigned DocenteXCiclo for GrupoXCursoXMateriaXCiclo G1 (subject M)
- WHEN D1 records absences for students in G1 on a given date
- THEN absence records scoped to (G1, date) are persisted successfully

#### Scenario: Teacher not assigned to group is rejected

- GIVEN teacher D2 is NOT assigned to group G1 for subject M
- WHEN D2 attempts to record absences for G1
- THEN the system returns HTTP 403 Forbidden — group assignment is required (Door 2)

#### Scenario: Split subject — each teacher records independently for their own group

- GIVEN subject M (partida) with G1 (teacher D1) and G2 (teacher D2)
- WHEN D1 records absences for G1 and D2 records absences for G2 on the same date
- THEN both sets of records are created independently; no conflict or cross-group interference

---

### Requirement: Presente Diario (Daily Attendance per CursoXCiclo)

Daily presence SHALL be recorded per `CursoXCiclo` + date by a preceptor assigned to
that course (via ACC-R1). This axis is INDEPENDENT from subject-group attendance —
it represents the official school-day inasistencia. It MUST NOT route through
`GrupoXCursoXMateriaXCiclo`.

#### Scenario: Preceptor records daily attendance for their course

- GIVEN DocenteXCiclo D1 is assigned to CursoXCiclo CC1 as preceptor (turno = "Mañana")
- WHEN D1 records daily attendance for CC1 on 2026-08-10
- THEN attendance records for (CC1, 2026-08-10) are persisted, covering all enrolled students of CC1

#### Scenario: Subject teacher cannot record daily attendance

- GIVEN teacher D2 is assigned to a subject group in CC1 but is NOT a preceptor of CC1
- WHEN D2 attempts to record daily attendance for CC1
- THEN the system returns HTTP 403 Forbidden — subject teacher role does not grant daily attendance access

#### Scenario: Daily attendance and subject absence are independent records

- GIVEN student S is marked absent in daily attendance on date D by the preceptor
- WHEN teacher D1 records subject attendance for S in subject M on date D
- THEN both records are persisted independently; the subject absence record does not overwrite
  the daily absence record and vice versa

---

## MODIFIED Requirements

### Requirement: Three-Door Access Model Enforced on All Attendance Writes

Both attendance types MUST enforce the three-door access model on write operations:
- Door 1: User module + action permission (`ATTENDANCE:CREATE` or equivalent)
- Door 2: Scope via assignment (group assignment for subject attendance;
  CursoXCiclo-preceptor assignment for daily attendance)
- Both doors MUST pass simultaneously. Holding the module without the required assignment,
  or holding the assignment without the module, MUST result in HTTP 403.
(Previously: only module-based check applied; assignment scope was not enforced on writes.)

#### Scenario: Module + assignment both satisfied — write succeeds

- GIVEN User U has module ATTENDANCE:CREATE
- AND U is assigned as preceptor to CursoXCiclo CC1 (Door 2 satisfied)
- WHEN U records daily attendance for CC1
- THEN the operation succeeds; HTTP 200 or 201 is returned

#### Scenario: Module present but assignment absent — write rejected

- GIVEN User U has module ATTENDANCE:CREATE
- AND U is NOT assigned to CursoXCiclo CC1 as preceptor
- WHEN U attempts to record daily attendance for CC1
- THEN the system returns HTTP 403 — Door 2 (assignment scope) fails

#### Scenario: Assignment present but module absent — write rejected

- GIVEN User U is assigned as preceptor to CC1
- AND U does NOT have the ATTENDANCE:CREATE module
- WHEN U attempts to record daily attendance for CC1
- THEN the system returns HTTP 403 — Door 1 (module check) fails

#### Scenario: Secretario / Directivo reads all attendance in their scope

- GIVEN User U has SECRETARIO role with ATTENDANCE:READ module
- WHEN U reads attendance records for any CursoXCiclo within their institution and level
- THEN all records are returned — Door 2 grants full level scope to SECRETARIO/DIRECTOR
