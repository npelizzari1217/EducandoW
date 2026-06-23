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

---

### ATR-R4 — Navigation shortcut from AlumnosCursoCicloPanel (asistencia-desde-alumnos-curso, 2026-06-23)

`AlumnosCursoCicloPanel` (file: `web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx`)
SHALL render a button that navigates to `/asistencia-mensual?ccId=<ccId>`, where `<ccId>` is the
`courseCycleId` prop. The button SHALL be gated by `ATTENDANCE READ` via `useCan`. When the
permission is absent the button MUST NOT appear in the DOM (hidden, not disabled). The button
MUST be rendered OUTSIDE any `!embedded` guard — the panel is always rendered with `embedded={true}`
from `course-cycles.tsx` and the button must be visible in that production context.

The page `asistencia-mensual.tsx` SHALL: (1) read `ccId` via `useSearchParams` on mount;
(2) pre-select the matching course-cycle; (3) default the mode to GENERAL; (4) defer pre-selection
until the list resolves if loading asynchronously (effect dependency on list + param, useRef one-shot
guard prevents re-applying after user manually changes the selector). Without a `ccId` param the
page SHALL behave identically to its pre-change behavior (no regression, no forced selection).

No new route is created; `/asistencia-mensual` is reused with a query parameter. No new permission,
role, or guard is introduced.

#### ATR-S12 — Authorized user sees navigation button in embedded panel

- GIVEN user holds ATTENDANCE READ
- AND `AlumnosCursoCicloPanel` is rendered with `embedded={true}` for `ccId="cc-abc"`
- WHEN the panel mounts
- THEN the attendance navigation button SHALL be visible in the DOM
- AND its click handler navigates to `"/asistencia-mensual?ccId=cc-abc"`

#### ATR-S13 — Unauthorized user — button absent from DOM

- GIVEN user does NOT hold ATTENDANCE READ
- WHEN `AlumnosCursoCicloPanel` renders
- THEN no attendance navigation button SHALL appear in the DOM

#### ATR-S14 — Pre-selection — list already loaded

- GIVEN the course-cycle list is already loaded and contains an entry with `id="cc-xyz"`
- AND the user navigates to `"/asistencia-mensual?ccId=cc-xyz"`
- WHEN the page mounts
- THEN the selector shows `"cc-xyz"` as the selected value AND mode is GENERAL

#### ATR-S15 — Pre-selection — async list load

- GIVEN the user navigates to `"/asistencia-mensual?ccId=cc-xyz"`
- AND the course-cycle list is initially loading (empty)
- WHEN the list resolves with an entry whose `id="cc-xyz"`
- THEN the selector pre-selects `"cc-xyz"` AND the mode remains GENERAL

#### ATR-S16 — ccId not in list — graceful no-op

- GIVEN `ccId="cc-unknown"` is in the URL
- AND the resolved list contains no entry with that id
- THEN no course-cycle is pre-selected AND no error is thrown

#### ATR-S17 — No ccId param — no regression

- GIVEN `/asistencia-mensual` is loaded with no query params
- THEN behavior is identical to the pre-change baseline: no pre-selection, mode defaults to its prior initial value

---

### ATR-R5 — Student name enrichment in attendance responses (asistencia-desde-alumnos-curso, 2026-06-23)

Both `AsistenciaGeneralResponse` and `AsistenciaMateriaResponse` SHALL include a field
`studentName: string` formatted `"${lastName}, ${firstName}"` (Argentine administrative standard:
lastName-first, matching `Student.fullName`).

Both `prisma-asistencia-general.repository.ts` and `prisma-asistencia-materia.repository.ts` SHALL
use a **single** Prisma query with `include: { student: { select: { firstName: true, lastName: true } } }`.
No secondary query or batch loader is permitted. Results SHALL be ordered by
`[{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }]`; the prior
`orderBy: { studentId: 'asc' }` is removed.

Port contracts: `findByScopeAndMonthEnriched` is added as a sibling to the existing
`findByScopeAndMonth` on both `AsistenciaGeneralRepository` and `AsistenciaMateriaRepository`.
The original `findByScopeAndMonth` MUST NOT be mutated (still used by integration tests and
the generate flow). Wrapper types `EnrichedGeneralAttendance` and `EnrichedMateriaAttendance`
(composition at the repo boundary) carry the entity + studentName; the domain entity
`AsistenciaXAlumnoXCursoXCiclo` MUST NOT acquire `studentName` or any student-derived field.

Both grids (GENERAL mode and POR-MATERIA mode) SHALL render `row.studentName`; the raw UUID
(`row.studentId`) MUST NOT be displayed. No new Prisma migration is required (student relation
already present in the `asistenciaXAlumnoXCursoXCiclo` model).

**ADR-5 (recorded tradeoff):** PATCH `/dia` record paths pass `studentName: ''` to the shared
mapper. The record path carries no student join and the frontend optimistic merge never reads the
name field. This avoids scope creep into record use cases and is intentional.

**Naming note (NOT a defect):** The pre-existing `findByCourseCycleEnriched` helper (unrelated query)
returns names in `"firstName lastName"` order. ATR-R5 intentionally uses `"Apellido, Nombre"` per
`Student.fullName` and Argentine convention. These are different queries, different screens, and
different display contexts. Reviewers MUST NOT treat this divergence as a defect.

#### ATR-S18 — studentName present in general response

- GIVEN a general attendance query for `courseCycleId="cc-abc"`
- WHEN the API responds with `AsistenciaGeneralResponse[]`
- THEN each item has a `"studentName"` field formatted `"Apellido, Nombre"`

#### ATR-S19 — studentName present in subject response

- GIVEN a subject attendance query for a courseCycleId + materiaId pair
- WHEN the API responds with `AsistenciaMateriaResponse[]`
- THEN each item has a `"studentName"` field formatted `"Apellido, Nombre"`

#### ATR-S20 — Alphabetical ordering by lastName then firstName

- GIVEN students with names: `"Zelaya, Ana"`, `"García, Luis"`, `"García, Ana"`
- WHEN the attendance endpoint returns results
- THEN the order SHALL be: `"García, Ana"` → `"García, Luis"` → `"Zelaya, Ana"`

#### ATR-S21 — Grid GENERAL mode renders name, not UUID

- GIVEN mode is GENERAL AND a row has `studentName="Pérez, Juan"` AND `studentId="uuid-xxxx"`
- WHEN the grid renders
- THEN the student cell displays `"Pérez, Juan"` AND `"uuid-xxxx"` is NOT visible in that cell

#### ATR-S22 — Grid POR-MATERIA mode renders name, not UUID

- GIVEN mode is POR-MATERIA AND a row has `studentName="Pérez, Juan"` AND `studentId="uuid-xxxx"`
- WHEN the grid renders
- THEN the student cell displays `"Pérez, Juan"` AND `"uuid-xxxx"` is NOT visible in that cell

#### ATR-S23 — No migration required

- WHEN the change is applied
- THEN no new file exists in `api/prisma_tenant/migrations/`
- AND the existing student relation on `asistenciaXAlumnoXCursoXCiclo` satisfies the include query

#### ATR-S24 — Domain entity unchanged

- WHEN the change is applied
- THEN the class `AsistenciaXAlumnoXCursoXCiclo` in `packages/domain` has no `studentName` property
  and no student-name-derived field
