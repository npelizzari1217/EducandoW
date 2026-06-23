# Spec: asistencia-dias-bloqueados

**Pedagogical level:** INICIAL | PRIMARIO | SECUNDARIO | TERCIARIO — all levels that use system attendance types (SAB/DOM/P/X). Level-agnostic: attendance is per CourseCycle.

**RFC 2119 keywords apply throughout this document.**

---

## Definitions

| Term | Meaning |
|------|---------|
| **Locked day** | A day in the month grid that carries a non-assignable status code (SAB, DOM, or X). It MUST NOT be editable. |
| **Assignable code** | An attendance type whose `assignable` flag is `true` (e.g., P, A, T). |
| **Non-assignable code** | An attendance type whose `assignable` flag is `false` (system types: SAB, DOM, X). |
| **Non-existent day** | A calendar day number (1–31) that does not exist for the given year/month (e.g., day 30 in February 2025, day 31 in April 2025). |
| **Weekend day** | A Saturday (dayOfWeek = 6) or Sunday (dayOfWeek = 0) in the given year/month. |
| **Locked-day map** | The output of `buildLockedDayMap(year, month)`: a record mapping each weekend or non-existent day number to its code (SAB, DOM, or X). |
| **Generation** | The use-case action that creates attendance rows for all students in a CourseCycle for a given year/month. |
| **Re-generation** | Invoking the generation action when attendance rows already exist for that CourseCycle/year/month. |
| **Hábil day** | A weekday (Mon–Fri) that exists in the month. Its attendance code is assignable. |

---

## S-UTIL: Domain Calendar Utility

The module `packages/domain/src/asistencia/utils/calendar-utils.ts` MUST be the single source of truth for all calendar derivation. No other package or layer MAY duplicate `daysInMonth`, `dayOfWeek`, or `buildLockedDayMap` logic.

### REQ-UTIL-1: daysInMonth

`daysInMonth(year: number, month: number): number` MUST return the correct number of days in the given Gregorian year/month, including leap-year handling for February.

### REQ-UTIL-2: dayOfWeek

`dayOfWeek(year: number, month: number, day: number): number` MUST return the ISO-compatible weekday index where 0 = Sunday and 6 = Saturday.

### REQ-UTIL-3: buildLockedDayMap

`buildLockedDayMap(year: number, month: number): Record<number, 'SAB' | 'DOM' | 'X'>` MUST return an object with:
- One entry per Saturday in month M/Y with value `"SAB"`
- One entry per Sunday in month M/Y with value `"DOM"`
- One entry per day d where d > daysInMonth(year, month) AND d ≤ 31, with value `"X"`
- No entries for hábil days

### REQ-UTIL-4: No duplication

Existing `daysInMonth` implementations scattered in the codebase MUST be removed and replaced with a single import from `calendar-utils`. The existing three duplicates SHALL be eliminated during this change.

---

## Scenarios: S-UTIL

### Scenario UTIL-1: daysInMonth — February non-leap

```
Given  the daysInMonth utility
When   called with year=2025, month=2
Then   it MUST return 28
```

### Scenario UTIL-2: daysInMonth — February leap

```
Given  the daysInMonth utility
When   called with year=2024, month=2
Then   it MUST return 29
```

### Scenario UTIL-3: daysInMonth — 30-day month

```
Given  the daysInMonth utility
When   called with year=2025, month=4
Then   it MUST return 30
```

### Scenario UTIL-4: daysInMonth — 31-day month

```
Given  the daysInMonth utility
When   called with year=2025, month=12
Then   it MUST return 31
```

### Scenario UTIL-5: dayOfWeek — Saturday

```
Given  the dayOfWeek utility
When   called with year=2025, month=1, day=4   (January 4 2025 is a Saturday)
Then   it MUST return 6
```

### Scenario UTIL-6: dayOfWeek — Sunday

```
Given  the dayOfWeek utility
When   called with year=2025, month=1, day=5   (January 5 2025 is a Sunday)
Then   it MUST return 0
```

### Scenario UTIL-7: dayOfWeek — weekday

```
Given  the dayOfWeek utility
When   called with year=2025, month=1, day=6   (January 6 2025 is a Monday)
Then   it MUST return 1
```

### Scenario UTIL-8: buildLockedDayMap — January 2025 (31 days)

```
Given  buildLockedDayMap is called with year=2025, month=1
Then   the result MUST contain entries:
         { 4: "SAB", 11: "SAB", 18: "SAB", 25: "SAB" }   (all Saturdays)
         { 5: "DOM", 12: "DOM", 19: "DOM", 26: "DOM" }   (all Sundays)
And    the result MUST NOT contain entries for keys 1, 2, 3, 6, 7, 8 ... (weekdays)
And    the result MUST NOT contain entries for keys > 31
And    the result MUST NOT contain any "X" entries (31 days — no non-existent days)
```

### Scenario UTIL-9: buildLockedDayMap — February 2025 (28 days, non-leap)

```
Given  buildLockedDayMap is called with year=2025, month=2
Then   the result MUST contain entries:
         { 1: "SAB", 8: "SAB", 15: "SAB", 22: "SAB" }
         { 2: "DOM", 9: "DOM", 16: "DOM", 23: "DOM" }
         { 29: "X", 30: "X", 31: "X" }
And    MUST NOT contain an entry for key 28 (day 28 is a Friday — hábil)
```

### Scenario UTIL-10: buildLockedDayMap — February 2024 (29 days, leap)

```
Given  buildLockedDayMap is called with year=2024, month=2
Then   the result MUST contain entries:
         { 3: "SAB", 10: "SAB", 17: "SAB", 24: "SAB" }
         { 4: "DOM", 11: "DOM", 18: "DOM", 25: "DOM" }
         { 30: "X", 31: "X" }
And    MUST NOT contain an entry for key 29 (day 29 exists in 2024)
```

### Scenario UTIL-11: buildLockedDayMap — April 2025 (30 days)

```
Given  buildLockedDayMap is called with year=2025, month=4
Then   the result MUST contain:
         { 5: "SAB", 12: "SAB", 19: "SAB", 26: "SAB" }
         { 6: "DOM", 13: "DOM", 20: "DOM", 27: "DOM" }
         { 31: "X" }
And    MUST NOT contain an entry for key 30 (day 30 exists in April)
```

### Scenario UTIL-12: buildLockedDayMap — December 2025 (31 days)

```
Given  buildLockedDayMap is called with year=2025, month=12
Then   the result MUST contain:
         { 6: "SAB", 13: "SAB", 20: "SAB", 27: "SAB" }
         { 7: "DOM", 14: "DOM", 21: "DOM", 28: "DOM" }
And    MUST NOT contain any "X" entries (December has 31 days)
```

---

## S-GEN: Generation — Locked Day Pre-Loading

### REQ-GEN-1: Locked days are stored at generation time (General mode)

When the use case `generate-monthly-attendance` (General) is invoked for CourseCycle C, year Y, month M:

- The `generateMany` port MUST receive a `days` parameter containing the locked-day map for Y/M.
- Each created row's `days` JSONB field MUST contain SAB/DOM/X entries for all weekend and non-existent days derived from `buildLockedDayMap(Y, M)`.
- The `days` field MUST NOT contain entries for hábil days (they start empty; attendance is recorded later via PATCH).

### REQ-GEN-2: Locked days are stored at generation time (Por Materia mode)

The same locking requirement from REQ-GEN-1 MUST apply to the `generate-monthly-attendance` (Por Materia) use case and its corresponding `generateMany` port + Prisma implementation.

### REQ-GEN-3: Locked days are derived from domain, injected by use case

The use case layer MUST construct `buildLockedDayMap(year, month)` and inject it into the port call. The infrastructure layer (Prisma repository) MUST NOT re-derive the locked-day map independently.

---

## Scenarios: S-GEN

### Scenario GEN-1: General — January 2025 (2 students)

```
Given  a CourseCycle with students [student-A, student-B]
And    no attendance rows exist for year=2025, month=1
When   generate-monthly-attendance (General) is invoked for year=2025, month=1
Then   2 rows MUST be created (one per student)
And    each row's days JSONB MUST include:
         "4":"SAB", "11":"SAB", "18":"SAB", "25":"SAB"
         "5":"DOM", "12":"DOM", "19":"DOM", "26":"DOM"
And    each row's days MUST NOT include keys for weekdays in January 2025
         (e.g., "1", "2", "3", "6" — those are Mon/Tue/Wed/Mon)
And    each row's days MUST NOT include "X" keys (January has 31 days)
```

### Scenario GEN-2: General — February 2025 (non-leap, 28 days)

```
Given  a CourseCycle with 1 student
And    no attendance rows exist for year=2025, month=2
When   generate-monthly-attendance (General) is invoked for year=2025, month=2
Then   1 row MUST be created
And    the row's days MUST include:
         "1":"SAB", "8":"SAB", "15":"SAB", "22":"SAB"
         "2":"DOM", "9":"DOM", "16":"DOM", "23":"DOM"
         "29":"X", "30":"X", "31":"X"
And    the row's days MUST NOT include a key "28" (Friday — hábil)
```

### Scenario GEN-3: General — February 2024 (leap, 29 days)

```
Given  a CourseCycle with 1 student
And    no attendance rows exist for year=2024, month=2
When   generate-monthly-attendance (General) is invoked for year=2024, month=2
Then   1 row MUST be created
And    the row's days MUST include "30":"X", "31":"X"
And    the row's days MUST NOT include "29":"X"  (day 29 exists in 2024)
```

### Scenario GEN-4: Por Materia — April 2025 (30 days)

```
Given  a CourseCycle with 1 student and subject S
And    no attendance rows exist for year=2025, month=4, subject=S
When   generate-monthly-attendance (Por Materia) is invoked for year=2025, month=4, subject=S
Then   1 row MUST be created
And    the row's days MUST include "31":"X"
And    the row's days MUST NOT include "30":"X"  (day 30 exists in April)
```

### Scenario GEN-5: December 2025 — no X entries

```
Given  a CourseCycle with 1 student
And    no attendance rows exist for year=2025, month=12
When   generate-monthly-attendance (General) is invoked for year=2025, month=12
Then   1 row MUST be created
And    the row's days MUST include SAB and DOM entries for December 2025
And    the row's days MUST NOT include any "X" key
```

---

## S-REGEN: Re-Generation — Upsert/Merge Semantics

### REQ-REGEN-1: Re-generation merges locked days without overwriting hábil entries

When `generate-monthly-attendance` is called for a CourseCycle/year/month that already has rows:
- The operation MUST update existing rows (not replace them).
- The `days` JSONB MUST be merged: SAB/DOM/X entries are added or corrected.
- Any existing key that maps to an assignable code (e.g., `"1":"P"`) MUST be preserved as-is.
- The `createMany skipDuplicates` strategy is insufficient and MUST be replaced by upsert/merge logic.

### REQ-REGEN-2: Merge does not force locked codes onto hábil days

A day number that is a weekday in the given year/month MUST NOT have its JSONB value overwritten to SAB, DOM, or X during re-generation, regardless of what was previously stored.

### REQ-REGEN-3: New students added after initial generation receive full pre-load

If a student has no row for a CourseCycle/year/month, re-generation MUST create a new row with the full locked-day map applied (same as initial generation).

---

## Scenarios: S-REGEN

### Scenario REGEN-1: Hábil entry preserved after re-generation

```
Given  a row for student S in year=2025, month=1 exists with days={ "1":"P" }
And    the row is missing SAB/DOM entries
When   generate-monthly-attendance is re-invoked for year=2025, month=1
Then   the row MUST be updated (not replaced)
And    days MUST include all SAB/DOM entries for January 2025
And    days MUST still contain "1":"P"  (Monday — hábil, preserved)
```

### Scenario REGEN-2: Already-correct locked entry not duplicated

```
Given  a row for student S exists with days={ "4":"SAB", "1":"P" }  (January 2025)
When   generate-monthly-attendance is re-invoked for year=2025, month=1
Then   "4":"SAB" MUST remain unchanged
And    "1":"P" MUST remain unchanged
And    remaining SAB/DOM entries for January 2025 MUST be added
```

### Scenario REGEN-3: Re-generation never writes locked code to a hábil day

```
Given  a row exists with days={ "6":"P" }  (day 6 is Monday in January 2025 — hábil)
When   generate-monthly-attendance is re-invoked for year=2025, month=1
Then   "6":"P" MUST remain "P"
And    "6" MUST NOT be set to "SAB", "DOM", or "X"
```

### Scenario REGEN-4: New student after partial generation gets full pre-load

```
Given  attendance rows already exist for year=2025, month=2 for student-A
And    student-B has no row for that CourseCycle/year/month
When   generate-monthly-attendance is re-invoked for year=2025, month=2
Then   a new row for student-B MUST be created
And    student-B's row MUST include all SAB/DOM/X entries for February 2025
And    student-A's existing row MUST be merged (not replaced)
```

---

## S-GUARD: Backend Guard — PATCH Rejection

### REQ-GUARD-1: PATCH on a weekend day is rejected (422)

Both `record-general-attendance-day` and `record-subject-attendance-day` use cases MUST reject any attempt to record attendance on a day d where `dayOfWeek(year, month, d)` is 0 (Sunday) or 6 (Saturday). The rejection MUST return a typed domain error that maps to HTTP 422 at the controller boundary, with error code `DAY_NOT_ASSIGNABLE`.

### REQ-GUARD-2: PATCH on a non-existent day is rejected (422)

Both use cases MUST reject any attempt to record attendance on a day d where d > `daysInMonth(year, month)`. The rejection MUST return error code `DAY_NOT_ASSIGNABLE` and map to HTTP 422.

### REQ-GUARD-3: PATCH with a non-assignable statusCode is rejected (400)

Both use cases MUST reject any request where the provided `statusCode` maps to an attendance type with `assignable === false`. The rejection MUST return error code `STATUS_NOT_ASSIGNABLE` and map to HTTP 400.

### REQ-GUARD-4: Guard uses calendar derivation, not JSONB

The guard for REQ-GUARD-1 and REQ-GUARD-2 MUST call `dayOfWeek` and `daysInMonth` from `calendar-utils` to determine day type. The guard MUST NOT read the `days` JSONB of the student row to make this determination.

### REQ-GUARD-5: Guard symmetry — both modes

Guards MUST be applied identically to the General attendance use case and the Por Materia attendance use case. No mode SHALL bypass the guard.

### REQ-GUARD-6: Happy path unchanged

A PATCH targeting a weekday d that exists in the month, with an assignable statusCode, MUST succeed and return HTTP 200. The guard MUST NOT block valid attendance recording.

### REQ-GUARD-7: Error response envelope

All guard rejections MUST use the standard error envelope:
```json
{ "error": { "code": "<ERROR_CODE>", "message": "<human-readable description>" } }
```

---

## Scenarios: S-GUARD

### Scenario GUARD-1: Saturday rejected — January 2025

```
Given  a PATCH request to record attendance for student S on day=4, year=2025, month=1
And    January 4 2025 is a Saturday
When   the use case processes the request
Then   the response MUST be HTTP 422
And    the body MUST be { "error": { "code": "DAY_NOT_ASSIGNABLE", ... } }
```

### Scenario GUARD-2: Sunday rejected

```
Given  a PATCH request for day=5, year=2025, month=1   (Sunday)
When   the use case processes the request
Then   the response MUST be HTTP 422 with code "DAY_NOT_ASSIGNABLE"
```

### Scenario GUARD-3: Non-existent day rejected — February 2025

```
Given  a PATCH request for day=29, year=2025, month=2   (February 2025 has 28 days)
When   the use case processes the request
Then   the response MUST be HTTP 422 with code "DAY_NOT_ASSIGNABLE"
```

### Scenario GUARD-4: Non-existent day rejected — April 2025

```
Given  a PATCH request for day=31, year=2025, month=4   (April has 30 days)
When   the use case processes the request
Then   the response MUST be HTTP 422 with code "DAY_NOT_ASSIGNABLE"
```

### Scenario GUARD-5: Non-assignable statusCode rejected — SAB

```
Given  a PATCH request for day=1, year=2025, month=1 (Monday — hábil)
And    statusCode = "SAB"  (assignable === false)
When   the use case processes the request
Then   the response MUST be HTTP 400 with code "STATUS_NOT_ASSIGNABLE"
```

### Scenario GUARD-6: Non-assignable statusCode rejected — DOM

```
Given  a PATCH request for any hábil day
And    statusCode = "DOM"  (assignable === false)
When   the use case processes the request
Then   the response MUST be HTTP 400 with code "STATUS_NOT_ASSIGNABLE"
```

### Scenario GUARD-7: Non-assignable statusCode rejected — X

```
Given  a PATCH request for any hábil day
And    statusCode = "X"  (assignable === false)
When   the use case processes the request
Then   the response MUST be HTTP 400 with code "STATUS_NOT_ASSIGNABLE"
```

### Scenario GUARD-8: Happy path — weekday with assignable code

```
Given  a PATCH request for day=1, year=2025, month=1  (Monday — hábil)
And    statusCode = "P"  (assignable === true)
When   the use case processes the request
Then   the response MUST be HTTP 200
And    the student's days JSONB MUST be updated with "1":"P"
```

### Scenario GUARD-9: Guard uses calendar, not JSONB

```
Given  a student's days JSONB does NOT contain a key for day=4 (January 2025 — Saturday)
And    a PATCH request targets day=4, year=2025, month=1
When   the use case processes the request
Then   the response MUST be HTTP 422 with code "DAY_NOT_ASSIGNABLE"
And    the rejection MUST be based on dayOfWeek(2025, 1, 4) === 6, not on JSONB content
```

### Scenario GUARD-10: Guard symmetry — Por Materia mode

```
Given  a PATCH request for day=4, year=2025, month=1 (Saturday)
When   processed by record-subject-attendance-day use case
Then   the response MUST be HTTP 422 with code "DAY_NOT_ASSIGNABLE"
(identical behavior to GUARD-1 in General mode)
```

---

## S-GRID: Frontend Grid

### REQ-GRID-1: Exactly 31 day columns

The attendance grid in `asistencia-mensual.tsx` MUST render exactly 31 day columns (columns 1 through 31) for all months, regardless of the actual number of days in that month.

### REQ-GRID-2: Non-assignable cells render as blocked (read-only)

A grid cell that displays a code with `assignable === false` (SAB, DOM, or X) MUST:
- Render the code as static read-only text.
- NOT render an editable combo/select element.
- Be visually distinct from editable cells (e.g., different background, muted style).

### REQ-GRID-3: Blocked cells are not interactable

A blocked cell (non-assignable code) MUST NOT accept user input, keyboard focus for editing, or trigger any API call when the user interacts with it.

### REQ-GRID-4: Locking is driven by `assignable` flag, not by column index

The decision to render a cell as blocked MUST be based on the `assignable` field of the status code returned by the backend, NOT on a hardcoded list of codes or a calculation of column position. Day 29, 30, 31 cells for short months are blocked because the backend pre-loads them with non-assignable code "X" — the frontend reads the code's `assignable` flag and locks accordingly.

### REQ-GRID-5: Editable cell combo shows only assignable codes

When the user opens the dropdown on an editable cell (assignable day), the combo MUST list only attendance types where `assignable === true`. The combo MUST NOT include SAB, DOM, or X.

### REQ-GRID-6: Combo filtering uses `assignable` flag from API

The combo filter MUST use the `assignable` field from the attendance types API response. The list of non-assignable codes MUST NOT be hardcoded in the frontend.

### REQ-GRID-7: No new API endpoints

The grid MUST reuse the existing attendance types endpoint that already exposes `assignable` in its response (per the `toResponse()` output). No new endpoint is introduced.

---

## Scenarios: S-GRID

### Scenario GRID-1: 31 columns for any month

```
Given  the attendance grid is displayed for any CourseCycle, year Y, month M
When   the page renders
Then   the grid MUST contain exactly 31 day columns (1 through 31)
And    this MUST hold for M=2 (February), M=4 (April), M=12 (December)
```

### Scenario GRID-2: Locked cells for SAB — January 2025

```
Given  the attendance grid is displayed for January 2025
And    the backend returned rows with "4":"SAB" for each student
When   the grid renders column 4
Then   the cell MUST display "SAB" as read-only text
And    MUST NOT render a combo/select element in that cell
And    the cell MUST be visually distinguishable from editable cells
```

### Scenario GRID-3: Locked cells for DOM

```
Given  the backend returned rows with "5":"DOM" for column 5 (January 2025)
When   the grid renders column 5
Then   the cell MUST display "DOM" as read-only
And    MUST NOT render a combo/select element
```

### Scenario GRID-4: Locked cells for X — February 2025

```
Given  the backend returned rows with "29":"X", "30":"X", "31":"X" for February 2025
When   the grid renders columns 29, 30, 31
Then   each of those cells MUST display "X" as read-only
And    MUST NOT render a combo/select element in any of them
```

### Scenario GRID-5: Editable cell allows input on hábil day

```
Given  the attendance grid is displayed for January 2025
And    column 6 (Monday) has no assigned code for student S
When   the user clicks on the cell at row S, column 6
Then   a combo/select element MUST appear
And    the combo options MUST include only codes where assignable === true
And    the combo options MUST NOT include "SAB", "DOM", or "X"
```

### Scenario GRID-6: Combo uses assignable flag, not hardcoded list

```
Given  the attendance types API returns types: [P (assignable:true), A (assignable:true), SAB (assignable:false), DOM (assignable:false), X (assignable:false)]
When   the combo for an editable cell is populated
Then   the combo MUST show only "P" and "A"
And    the filtering MUST be applied via the assignable field, not by matching code names
```

### Scenario GRID-7: Blocked cell does not trigger API call

```
Given  a cell is blocked (displays "SAB", "DOM", or "X")
When   the user clicks on the blocked cell
Then   no API call MUST be triggered
And    the cell MUST remain in its read-only state
```

---

## Edge Case Reference Matrix

| Scenario | Year | Month | Days in month | Non-existent (X) | Notes |
|---|---|---|---|---|---|
| February non-leap | 2025 | 2 | 28 | 29, 30, 31 | 3 X entries |
| February leap | 2024 | 2 | 29 | 30, 31 | 2 X entries; day 29 is NOT locked |
| 30-day month (April) | 2025 | 4 | 30 | 31 | 1 X entry |
| 31-day month (January) | 2025 | 1 | 31 | none | 0 X; weekends only |
| 31-day month (December) | 2025 | 12 | 31 | none | 0 X; weekends only |

---

## Acceptance Criteria Summary

| ID | Requirement | Keyword |
|----|-------------|---------|
| AC-01 | `buildLockedDayMap` lives in domain package; single source of truth; fully unit-tested | MUST |
| AC-02 | `daysInMonth` duplication in 3 files is eliminated | MUST |
| AC-03 | Generation creates SAB/DOM/X entries in `days` JSONB for every weekend and non-existent day | MUST |
| AC-04 | Generation applies to both General and Por Materia modes | MUST |
| AC-05 | Re-generation merges SAB/DOM/X without overwriting existing assignable entries in `days` | MUST |
| AC-06 | Re-generation creates new rows with full locked-day map for students not yet in the set | MUST |
| AC-07 | PATCH on a weekend day (Sat or Sun) → HTTP 422, code `DAY_NOT_ASSIGNABLE` | MUST |
| AC-08 | PATCH on a non-existent day (e.g., Feb 29 in non-leap) → HTTP 422, code `DAY_NOT_ASSIGNABLE` | MUST |
| AC-09 | PATCH with non-assignable statusCode (SAB/DOM/X) → HTTP 400, code `STATUS_NOT_ASSIGNABLE` | MUST |
| AC-10 | PATCH with assignable code on a hábil day → HTTP 200 (happy path unblocked) | MUST |
| AC-11 | Backend guard derives day type from `calendar-utils`, NOT from `days` JSONB | MUST |
| AC-12 | Guard applies identically to General and Por Materia modes | MUST |
| AC-13 | Frontend grid renders exactly 31 day columns for all months | MUST |
| AC-14 | Cells with non-assignable codes render as blocked (read-only, no combo) | MUST |
| AC-15 | Locking decision uses `assignable` flag from API, not hardcoded code list | MUST |
| AC-16 | Combo for editable cells lists only assignable codes | MUST |
| AC-17 | February 2025: days 29/30/31 → X; February 2024: days 30/31 → X, day 29 NOT locked | MUST |
| AC-18 | No DB schema migration required | MUST |
| AC-19 | Error responses use standard envelope `{ "error": { "code": "...", "message": "..." } }` | MUST |

---

## Out of Scope (explicit non-requirements)

- Holidays and institutionally-defined non-working days (only weekends and non-existent days are in scope).
- Any changes to the attendance-type catalog or its `assignable` flag values (already configured in system).
- New `assignable` backend endpoint (already exposed via `toResponse()`).
- Any Prisma schema migration or new database column.
- Other screens or pages beyond the monthly attendance grid (`asistencia-mensual.tsx`).
- Attendance modes or screens not yet built.
