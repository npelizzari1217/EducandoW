# Spec: Attendance Recording

> Capability area: recording of subject-level absences (per group) and daily presence (per course-cycle)
> Changes:
>   docente-ciclo-grupos · Fase 6 (archived 2026-06-16) — ATR-R1, ATR-R2, ATR-R3
>   asistencia-desde-alumnos-curso (archived 2026-06-23) — ATR-R4, ATR-R5
>   asistencia-dias-bloqueados (archived 2026-06-23) — ATR-R6, ATR-R7, ATR-R8, ATR-R9
> IDs: ATR-R* / ATR-S*
> Cross-references:
>   ACC-R1 (`asignacion-curso-ciclo/spec.md`) — preceptor assignment basis for daily attendance
>   `attendance-types/spec.md` — defines the AttendanceType codes used when recording (SAB/DOM/P/X and assignable flag)

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

---

### ATR-R6 — Domain calendar utility (asistencia-dias-bloqueados, 2026-06-23)

The module `packages/domain/src/asistencia/utils/calendar-utils.ts` SHALL be the single source of truth for all calendar derivation in the attendance domain. No other package or layer MAY duplicate the logic for counting days in a month, determining day-of-week, or computing which days are blocked.

The following functions MUST be exported from this module and re-exported from the domain package barrel (`packages/domain/src/index.ts`):

- `daysInMonth(year: number, month: number): number` — MUST return the correct number of days in the given Gregorian year/month, including leap-year handling for February. Months are 1-based (January = 1).
- `dayOfWeek(year: number, month: number, day: number): number` — MUST return the ISO-compatible weekday index where 0 = Sunday and 6 = Saturday. Implementation MUST use the component constructor `new Date(year, month - 1, day)` (never ISO string parsing) to avoid timezone shifts in CI.
- `buildLockedDayMap(year: number, month: number): Record<string, string>` — MUST return an object with: one entry per Saturday with value `"SAB"`, one entry per Sunday with value `"DOM"`, one entry per day d where d > daysInMonth(year, month) AND d ≤ 31 with value `"X"`, and no entries for hábil (weekday) days.

Any existing local `daysInMonth` implementations scattered in the codebase MUST be removed and replaced with a single import from this module.

#### ATR-S25 — daysInMonth — February non-leap

- GIVEN the daysInMonth utility
- WHEN called with year=2025, month=2
- THEN it MUST return 28

#### ATR-S26 — daysInMonth — February leap

- GIVEN the daysInMonth utility
- WHEN called with year=2024, month=2
- THEN it MUST return 29

#### ATR-S27 — daysInMonth — 30-day month

- GIVEN the daysInMonth utility
- WHEN called with year=2025, month=4
- THEN it MUST return 30

#### ATR-S28 — daysInMonth — 31-day month

- GIVEN the daysInMonth utility
- WHEN called with year=2025, month=12
- THEN it MUST return 31

#### ATR-S29 — dayOfWeek — Saturday

- GIVEN the dayOfWeek utility
- WHEN called with year=2025, month=1, day=4 (January 4 2025 is a Saturday)
- THEN it MUST return 6

#### ATR-S30 — dayOfWeek — Sunday

- GIVEN the dayOfWeek utility
- WHEN called with year=2025, month=1, day=5 (January 5 2025 is a Sunday)
- THEN it MUST return 0

#### ATR-S31 — dayOfWeek — weekday

- GIVEN the dayOfWeek utility
- WHEN called with year=2025, month=1, day=6 (January 6 2025 is a Monday)
- THEN it MUST return 1

#### ATR-S32 — buildLockedDayMap — January 2025 (31 days, no X)

- GIVEN buildLockedDayMap is called with year=2025, month=1
- THEN the result MUST contain { 4:"SAB", 11:"SAB", 18:"SAB", 25:"SAB" } and { 5:"DOM", 12:"DOM", 19:"DOM", 26:"DOM" }
- AND the result MUST NOT contain entries for weekday keys (1, 2, 3, 6, 7, …)
- AND the result MUST NOT contain any "X" entries (January has 31 days)

#### ATR-S33 — buildLockedDayMap — February 2025 (28 days, 3 X entries)

- GIVEN buildLockedDayMap is called with year=2025, month=2
- THEN the result MUST contain { 1:"SAB", 8:"SAB", 15:"SAB", 22:"SAB" }, { 2:"DOM", 9:"DOM", 16:"DOM", 23:"DOM" }, and { 29:"X", 30:"X", 31:"X" }
- AND MUST NOT contain an entry for key 28 (day 28 is a Friday — hábil)

#### ATR-S34 — buildLockedDayMap — February 2024 (29 days, 2 X entries)

- GIVEN buildLockedDayMap is called with year=2024, month=2
- THEN the result MUST contain { 30:"X", 31:"X" }
- AND MUST NOT contain an entry for key 29 (day 29 exists in 2024)

#### ATR-S35 — buildLockedDayMap — April 2025 (30 days, 1 X entry)

- GIVEN buildLockedDayMap is called with year=2025, month=4
- THEN the result MUST contain { 31:"X" }
- AND MUST NOT contain an entry for key 30 (day 30 exists in April)

#### ATR-S36 — buildLockedDayMap — December 2025 (31 days, no X)

- GIVEN buildLockedDayMap is called with year=2025, month=12
- THEN the result MUST contain SAB and DOM entries for all Saturdays and Sundays in December 2025
- AND MUST NOT contain any "X" entries (December has 31 days)

---

### ATR-R7 — Monthly attendance generation — locked-day pre-loading and upsert/merge (asistencia-dias-bloqueados, 2026-06-23)

When the use case `generate-monthly-attendance` is invoked for CourseCycle C, year Y, month M, the generation layer MUST pre-load all weekend and non-existent days as locked entries in the `days` JSONB field of each attendance row.

**Generation (first-time):** The `generateMany` port MUST receive a `days` parameter containing the locked-day map built by `buildLockedDayMap(Y, M)`. Each created row's `days` JSONB MUST contain SAB/DOM/X entries for all weekend and non-existent days. The `days` JSONB MUST NOT contain entries for hábil days at creation time (those are recorded later via PATCH). The locked-day map MUST be computed once per invocation by the use case and injected into the port call; the infrastructure layer MUST NOT re-derive it independently. The requirement applies identically to both General and Por Materia generation modes.

**Re-generation (upsert/merge):** When generation is invoked for a CourseCycle/year/month that already has attendance rows, the operation MUST update existing rows (not replace them). The `days` JSONB MUST be merged: locked entries (SAB/DOM/X) are added or corrected. Any existing key mapping to an assignable code (e.g., `"1":"P"`) MUST be preserved as-is. A day that is a weekday in the given year/month MUST NOT have its JSONB value overwritten to SAB, DOM, or X during re-generation. The prior `createMany skipDuplicates` strategy MUST be replaced by a read-merge-write pattern. Students with no existing row MUST receive a new row with the full locked-day map applied (same as initial generation).

#### ATR-S37 — GEN General — January 2025 locked days

- GIVEN a CourseCycle with 2 students and no attendance rows for year=2025, month=1
- WHEN generate-monthly-attendance (General) is invoked
- THEN 2 rows MUST be created and each row's days JSONB MUST include { "4":"SAB", "11":"SAB", "18":"SAB", "25":"SAB" } and { "5":"DOM", "12":"DOM", "19":"DOM", "26":"DOM" }
- AND each row's days MUST NOT include keys for weekdays (e.g., "1", "2", "3", "6") or any "X" key

#### ATR-S38 — GEN General — February 2025 (non-leap, 3 X entries)

- GIVEN a CourseCycle with 1 student and no attendance rows for year=2025, month=2
- WHEN generate-monthly-attendance (General) is invoked
- THEN the row's days MUST include { "29":"X", "30":"X", "31":"X" }
- AND the row's days MUST NOT include a key "28" (Friday — hábil)

#### ATR-S39 — GEN General — February 2024 (leap, 2 X entries)

- GIVEN a CourseCycle with 1 student and no attendance rows for year=2024, month=2
- WHEN generate-monthly-attendance (General) is invoked
- THEN the row's days MUST include { "30":"X", "31":"X" }
- AND MUST NOT include "29":"X" (day 29 exists in 2024)

#### ATR-S40 — GEN Por Materia — April 2025 (1 X entry)

- GIVEN a CourseCycle with 1 student, subject S, and no attendance rows for year=2025, month=4
- WHEN generate-monthly-attendance (Por Materia) is invoked for year=2025, month=4, subject=S
- THEN the row's days MUST include { "31":"X" }
- AND MUST NOT include "30":"X" (day 30 exists in April)

#### ATR-S41 — GEN — December 2025 (no X entries)

- GIVEN a CourseCycle with 1 student and no attendance rows for year=2025, month=12
- WHEN generate-monthly-attendance (General) is invoked
- THEN the row's days MUST include SAB and DOM entries for December 2025
- AND MUST NOT include any "X" key

#### ATR-S42 — REGEN — hábil entry preserved

- GIVEN a row for student S in year=2025, month=1 exists with days={ "1":"P" } and missing SAB/DOM entries
- WHEN generate-monthly-attendance is re-invoked for year=2025, month=1
- THEN the row MUST be updated (not replaced)
- AND days MUST include all SAB/DOM entries for January 2025
- AND days MUST still contain "1":"P" (Monday — hábil, preserved)

#### ATR-S43 — REGEN — already-correct locked entry not duplicated

- GIVEN a row with days={ "4":"SAB", "1":"P" } for January 2025
- WHEN generate-monthly-attendance is re-invoked
- THEN "4":"SAB" MUST remain unchanged, "1":"P" MUST remain unchanged, and remaining SAB/DOM entries MUST be added

#### ATR-S44 — REGEN — locked code never written to hábil day

- GIVEN a row with days={ "6":"P" } (day 6 is Monday in January 2025 — hábil)
- WHEN generate-monthly-attendance is re-invoked for year=2025, month=1
- THEN "6":"P" MUST remain "P"
- AND "6" MUST NOT be set to "SAB", "DOM", or "X"

#### ATR-S45 — REGEN — new student after partial generation gets full pre-load

- GIVEN attendance rows already exist for year=2025, month=2 for student-A AND student-B has no row
- WHEN generate-monthly-attendance is re-invoked for year=2025, month=2
- THEN a new row for student-B MUST be created with all SAB/DOM/X entries for February 2025
- AND student-A's existing row MUST be merged (not replaced)

---

### ATR-R8 — Backend guard — PATCH rejection on blocked days (asistencia-dias-bloqueados, 2026-06-23)

Both `record-general-attendance-day` and `record-subject-attendance-day` use cases MUST enforce a double guard before recording attendance:

- **Day guard (422):** If the target day d satisfies `dayOfWeek(year, month, d) ∈ {0, 6}` (Sunday or Saturday) OR `d > daysInMonth(year, month)` (non-existent day), the use case MUST throw a typed domain error `DayNotAssignableError` with code `DAY_NOT_ASSIGNABLE`, which MUST map to HTTP 422 at the controller boundary.
- **StatusCode guard (400):** If the provided `statusCode` maps to an attendance type with `assignable === false`, the use case MUST throw a typed domain error `StatusNotAssignableError` with code `STATUS_NOT_ASSIGNABLE`, which MUST map to HTTP 400.

The day guard MUST call `dayOfWeek` and `daysInMonth` from `calendar-utils` (domain layer). The guard MUST NOT read the `days` JSONB field of the student row to determine whether a day is blocked. Both guards MUST be applied identically to the General and Por Materia use cases — no mode SHALL bypass either guard. A PATCH targeting a weekday that exists in the month, with an assignable statusCode, MUST succeed (HTTP 200).

All guard rejections MUST use the error envelope (ADR-D6):
```json
{ "error": { "status": <HTTP code>, "code": "<ERROR_CODE>", "message": "<description>" } }
```
The `status` field is an additive backward-compatible extension; the canonical required fields are `code` and `message`. `DayNotAssignableError` and `StatusNotAssignableError` MUST be registered in `DOMAIN_STATUS` of `AppExceptionFilter` with statuses 422 and 400 respectively.

#### ATR-S46 — Saturday rejected — 422 DAY_NOT_ASSIGNABLE

- GIVEN a PATCH request to record attendance on day=4, year=2025, month=1 (January 4 2025 is a Saturday)
- WHEN the use case processes the request
- THEN the response MUST be HTTP 422 with body `{ "error": { "code": "DAY_NOT_ASSIGNABLE", "message": "…" } }`

#### ATR-S47 — Sunday rejected — 422 DAY_NOT_ASSIGNABLE

- GIVEN a PATCH request for day=5, year=2025, month=1 (Sunday)
- WHEN the use case processes the request
- THEN the response MUST be HTTP 422 with code "DAY_NOT_ASSIGNABLE"

#### ATR-S48 — Non-existent day (Feb 2025) rejected — 422

- GIVEN a PATCH request for day=29, year=2025, month=2 (February 2025 has 28 days)
- WHEN the use case processes the request
- THEN the response MUST be HTTP 422 with code "DAY_NOT_ASSIGNABLE"

#### ATR-S49 — Non-existent day (April 2025) rejected — 422

- GIVEN a PATCH request for day=31, year=2025, month=4 (April has 30 days)
- WHEN the use case processes the request
- THEN the response MUST be HTTP 422 with code "DAY_NOT_ASSIGNABLE"

#### ATR-S50 — Non-assignable statusCode SAB rejected — 400 STATUS_NOT_ASSIGNABLE

- GIVEN a PATCH request for day=1, year=2025, month=1 (Monday — hábil) with statusCode="SAB" (assignable=false)
- WHEN the use case processes the request
- THEN the response MUST be HTTP 400 with code "STATUS_NOT_ASSIGNABLE"

#### ATR-S51 — Non-assignable statusCode DOM rejected — 400

- GIVEN a PATCH request for any hábil day with statusCode="DOM" (assignable=false)
- WHEN the use case processes the request
- THEN the response MUST be HTTP 400 with code "STATUS_NOT_ASSIGNABLE"

#### ATR-S52 — Non-assignable statusCode X rejected — 400

- GIVEN a PATCH request for any hábil day with statusCode="X" (assignable=false)
- WHEN the use case processes the request
- THEN the response MUST be HTTP 400 with code "STATUS_NOT_ASSIGNABLE"

#### ATR-S53 — Happy path — weekday with assignable code succeeds

- GIVEN a PATCH request for day=1, year=2025, month=1 (Monday — hábil) with statusCode="P" (assignable=true)
- WHEN the use case processes the request
- THEN the response MUST be HTTP 200
- AND the student's days JSONB MUST be updated with "1":"P"

#### ATR-S54 — Guard uses calendar derivation, not JSONB

- GIVEN a student's days JSONB does NOT contain a key for day=4 (January 2025 — Saturday)
- AND a PATCH request targets day=4, year=2025, month=1
- WHEN the use case processes the request
- THEN the response MUST be HTTP 422 with code "DAY_NOT_ASSIGNABLE"
- AND the rejection MUST be based on dayOfWeek(2025, 1, 4) === 6, not on JSONB content

#### ATR-S55 — Guard symmetry — Por Materia use case mirrors General

- GIVEN a PATCH request for day=4, year=2025, month=1 (Saturday) processed by record-subject-attendance-day
- WHEN the use case processes the request
- THEN the response MUST be HTTP 422 with code "DAY_NOT_ASSIGNABLE" — identical to ATR-S46

---

### ATR-R9 — Frontend attendance grid — 31-column layout with locked cells (asistencia-dias-bloqueados, 2026-06-23)

The monthly attendance grid in `asistencia-mensual.tsx` MUST render exactly 31 day columns (1 through 31) for all months, regardless of the actual number of days in that month.

A grid cell displaying a code with `assignable === false` (SAB, DOM, or X) MUST:
- Render the code as static read-only text (visually distinct from editable cells).
- NOT render a combo/select element.
- NOT accept user input, keyboard focus for editing, or trigger any API call when interacted with.

The decision to render a cell as blocked MUST be based on the `assignable` field of the status code returned by the backend — NOT on a hardcoded list of codes or a calculation of column position. Columns 29, 30, 31 for short months are blocked because the backend pre-loads them with non-assignable code "X"; the frontend reads the `assignable` flag and locks accordingly. The combo for editable cells MUST list only attendance types where `assignable === true`; this filtering MUST use the `assignable` field from the attendance types API response (no hardcoded exclusion list). No new API endpoints are introduced; the existing attendance types endpoint already exposes `assignable` in its response.

#### ATR-S56 — Grid renders exactly 31 day columns for any month

- GIVEN the attendance grid is displayed for any CourseCycle, year Y, month M (including M=2, M=4, M=12)
- WHEN the page renders
- THEN the grid MUST contain exactly 31 day columns (1 through 31)

#### ATR-S57 — Locked cell for SAB — read-only, no combo

- GIVEN the attendance grid is displayed for January 2025 AND the backend returned rows with "4":"SAB"
- WHEN the grid renders column 4
- THEN the cell MUST display "SAB" as read-only text, MUST NOT render a combo/select element, and MUST be visually distinguishable from editable cells

#### ATR-S58 — Locked cell for DOM — read-only, no combo

- GIVEN the backend returned rows with "5":"DOM" for column 5 (January 2025)
- WHEN the grid renders column 5
- THEN the cell MUST display "DOM" as read-only and MUST NOT render a combo/select element

#### ATR-S59 — Locked cells for X — columns 29/30/31 in February 2025

- GIVEN the backend returned rows with "29":"X", "30":"X", "31":"X" for February 2025
- WHEN the grid renders columns 29, 30, 31
- THEN each cell MUST display "X" as read-only and MUST NOT render a combo/select element

#### ATR-S60 — Editable cell on hábil day shows combo with only assignable codes

- GIVEN the attendance grid is displayed for January 2025 AND column 6 (Monday) has no assigned code
- WHEN the user clicks the cell
- THEN a combo/select element MUST appear with options including only codes where assignable === true
- AND the combo options MUST NOT include "SAB", "DOM", or "X"

#### ATR-S61 — Combo filtering uses assignable flag, not hardcoded code list

- GIVEN the attendance types API returns [P (assignable:true), A (assignable:true), SAB (assignable:false), DOM (assignable:false), X (assignable:false)]
- WHEN the combo for an editable cell is populated
- THEN only "P" and "A" MUST appear
- AND the filtering MUST be applied via the assignable field, not by matching code names

#### ATR-S62 — Blocked cell interaction triggers no API call

- GIVEN a cell is blocked (displays "SAB", "DOM", or "X")
- WHEN the user clicks on the blocked cell
- THEN no API call MUST be triggered
- AND the cell MUST remain in its read-only state

---

## ADR cross-reference (asistencia-dias-bloqueados)

| ADR | Decision | Satisfies |
|-----|----------|-----------|
| ADR-1 | Stored mark — SAB/DOM/X persisted in `days` JSONB at generation time; frontend reads stored value, not re-computed | ATR-R7, ATR-R9 |
| ADR-2 | Re-generation = upsert/merge; replaces `createMany skipDuplicates` | ATR-R7 |
| ADR-3 | Double backend guard (day + statusCode) — calendar is the authority, not JSONB | ATR-R8 |
| ADR-4 | Calendar utils in domain (`calendar-utils.ts`) — single source of truth, eliminates duplication | ATR-R6 |
| ADR-D6 | Error envelope `{ error: { status, code, message } }` — `status` is additive/backward-compat; canonical fields are `code` + `message` | ATR-R8 |

## Edge case reference (asistencia-dias-bloqueados)

| Month | Year | Days | Non-existent (X) | Notes |
|-------|------|------|------------------|-------|
| February non-leap | 2025 | 28 | 29, 30, 31 | 3 X entries |
| February leap | 2024 | 29 | 30, 31 | 2 X entries; day 29 is NOT locked |
| 30-day month (April) | 2025 | 30 | 31 | 1 X entry |
| 31-day month (January) | 2025 | 31 | none | weekends only |
| 31-day month (December) | 2025 | 31 | none | weekends only |
