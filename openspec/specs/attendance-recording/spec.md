# Spec: Attendance Recording

> Capability area: recording of subject-level absences (per group) and daily presence (per course-cycle)
> Change: docente-ciclo-grupos · Fase 6 (archived 2026-06-16) — DEFERRED-1 resolved 2026-06-16
> IDs: ATR-R* / ATR-S*
> Cross-references:
>   ACC-R1 (`asignacion-curso-ciclo/spec.md`) — preceptor assignment basis for daily attendance
>   `attendance-types/spec.md` — defines the AttendanceType codes used when recording

## Purpose

Define what MUST be true regarding the recording of attendance in the system. Two orthogonal
axes exist: subject-level absences scoped to a teaching group (`GrupoXCursoXMateriaXCiclo`)
and daily presence scoped to a course-cycle (`CursoXCiclo`). Both axes are independent;
neither overwrites the other. This spec does NOT cover AttendanceType CRUD (see
`attendance-types/spec.md`) or absence reporting/computations (future change).

## Requirements

### ATR-R1 — Subject-level absences per teaching group

Subject-level absences SHALL be recorded per `GrupoXCursoXMateriaXCiclo`.
Only the `DocenteXCiclo` assigned to that group MAY record absences for it.
Absence records for a given group are NOT visible to TEACHER-role users of a different group
in the same subject. Administrative roles (SECRETARIO, DIRECTOR, ADMIN, ROOT) with
`ATTENDANCE:READ` access MAY read absence records across all groups in their institution
and level scope, without requiring a group assignment.

All reads and writes MUST be scoped by `institutionId` derived from the JWT.

#### ATR-S1 — Assigned teacher records absences for their group

- GIVEN teacher D1 is the assigned `DocenteXCiclo` for `GrupoXCursoXMateriaXCiclo` G1 (subject M)
- WHEN D1 records absences for students in G1 on a given date
- THEN absence records scoped to (G1, date) are persisted successfully

#### ATR-S2 — Teacher not assigned to group is rejected

- GIVEN teacher D2 is NOT assigned to group G1 for subject M
- WHEN D2 attempts to record absences for G1
- THEN the system returns HTTP 403 Forbidden — group assignment (Door 2) is required

#### ATR-S3 — Split subject: each teacher records independently for their own group

- GIVEN subject M (partida) with G1 (teacher D1) and G2 (teacher D2)
- WHEN D1 records absences for G1 and D2 records absences for G2 on the same date
- THEN both sets of records are created independently; no conflict or cross-group interference

#### ATR-S4 — Administrative role reads all groups without assignment

- GIVEN user U has SECRETARIO role with ATTENDANCE:READ module
- WHEN U reads absence records for any group in their institution and level scope
- THEN all records across all groups are returned
- AND no group assignment is required for U

---

### ATR-R2 — Daily presence per course-cycle

Daily presence SHALL be recorded per `CursoXCiclo` + date by a `DocenteXCiclo` assigned
to that course as preceptor (see ACC-R1 in `asignacion-curso-ciclo/spec.md`). This axis
is INDEPENDENT from subject-group attendance — it represents the official school-day
attendance record. Daily attendance MUST NOT route through `GrupoXCursoXMateriaXCiclo`.

Administrative roles (SECRETARIO, DIRECTOR, ADMIN, ROOT) with `ATTENDANCE:READ` access
MAY read daily attendance records across all course-cycles in their institution and level
scope without requiring a preceptor assignment.

All reads and writes MUST be scoped by `institutionId` derived from the JWT.

#### ATR-S5 — Preceptor records daily attendance for their course-cycle

- GIVEN `DocenteXCiclo` D1 is assigned to `CursoXCiclo` CC1 as preceptor (turno = "Mañana")
- WHEN D1 records daily attendance for CC1 on 2026-08-10
- THEN attendance records for (CC1, 2026-08-10) are persisted, covering all enrolled students of CC1

#### ATR-S6 — Subject teacher cannot record daily attendance

- GIVEN teacher D2 is assigned to a subject group in CC1 but is NOT a preceptor of CC1
- WHEN D2 attempts to record daily attendance for CC1
- THEN the system returns HTTP 403 Forbidden — subject teacher role does not grant daily attendance access

#### ATR-S7 — Daily attendance and subject absence are independent records

- GIVEN student S is marked absent in daily attendance on date D by the preceptor
- WHEN teacher D1 records subject attendance for S in subject M on date D
- THEN both records are persisted independently; the subject absence record does not overwrite
  the daily absence record and vice versa

---

### ATR-R3 — Three-door access model on all attendance writes

Both attendance axes (ATR-R1 and ATR-R2) MUST enforce the three-door access model on write
operations:

- Door 1: User module + action permission (`ATTENDANCE:CREATE` or equivalent)
- Door 2: Scope via assignment — group assignment for subject attendance (ATR-R1);
  CursoXCiclo-preceptor assignment for daily attendance (ATR-R2)
- Both doors MUST pass simultaneously.

Holding the module without the required assignment, or holding the assignment without the
module, MUST result in HTTP 403. Administrative roles (SECRETARIO, DIRECTOR, ADMIN, ROOT)
bypass Door 2 on read AND on write — they are not required to hold a group or preceptor
assignment to record attendance.

#### ATR-S8 — Module + assignment both satisfied: write succeeds

- GIVEN user U has module ATTENDANCE:CREATE
- AND U is assigned as preceptor to `CursoXCiclo` CC1 (Door 2 satisfied)
- WHEN U records daily attendance for CC1
- THEN the operation succeeds; HTTP 200 or 201 is returned

#### ATR-S9 — Module present, assignment absent: write rejected

- GIVEN user U has module ATTENDANCE:CREATE
- AND U is NOT assigned to `CursoXCiclo` CC1 as preceptor
- WHEN U attempts to record daily attendance for CC1
- THEN the system returns HTTP 403 — Door 2 (assignment scope) fails

#### ATR-S10 — Assignment present, module absent: write rejected

- GIVEN user U is assigned as preceptor to CC1
- AND U does NOT have the ATTENDANCE:CREATE module
- WHEN U attempts to record daily attendance for CC1
- THEN the system returns HTTP 403 — Door 1 (module check) fails

#### ATR-S11 — SECRETARIO / DIRECTIVO can write without group or preceptor assignment

- GIVEN user U has SECRETARIO role with ATTENDANCE:CREATE module
- WHEN U records attendance (daily or subject-level) for any course-cycle or group
  within their institution and level scope
- THEN the operation succeeds — administrative scope bypasses Door 2 (assignment gate)
