# Spec: asistencia-behavior-e-impresion

**Pedagogical level:** ALL (INICIAL | PRIMARIO | SECUNDARIO | TERCIARIO) — `AttendanceType.behavior` and printing apply to every level; system-type seeding remains per-level.

**RFC 2119 keywords apply throughout this document.**

**Source of truth:** proposal `sdd/asistencia-behavior-e-impresion/proposal` (engram #1656); requirements `sdd/asistencia-behavior-e-impresion` (engram #1655).

---

## Definitions

| Term | Meaning |
|------|---------|
| **behavior** | New enum field 1–7 on `AttendanceType` classifying what a status code means for ausentismo/asistencia purposes. |
| **behavior 1** | Ausente Injustificado. |
| **behavior 2** | Ausente Justificado. |
| **behavior 3** | No elegible — replaces the functional role of `assignable=false` in the daily grid combo. |
| **behavior 4** | No considerar ausentismo (e.g., Presente). |
| **behavior 5** | Tarde Injustificado. |
| **behavior 6** | Tarde Justificado. |
| **behavior 7** | Día No hábil (feriado) — unlike behavior 3, it IS selectable in the grid combo. |
| **absenceValue** | Existing `Decimal(4,2)` weight field on `AttendanceType` (0, 0.25, 0.5, 0.75, 1, 1.5, ...). Preserved unchanged; all Part 2 totals are weighted sums of this field, not counts. |
| **System type** | An `AttendanceType` row with `isSystem = true` (P, SAB, DOM, X). Protected: MUST NOT be edited or deleted. |
| **Custom type** | An `AttendanceType` row with `isSystem = false`, created via CRUD (e.g., A, T, Feriado). |
| **Día hábil** | A calendar day of the month that is NOT classified as behavior 3 or behavior 7 for that student/day. |
| **Grid combo** | The dropdown of selectable status codes shown for an editable cell in the daily/monthly attendance grid. |
| **General module** | Attendance captured per CourseCycle, not tied to a subject (`asistenciaXAlumnoXCursoXCiclo`). |
| **Por Materia module** | Attendance captured per subject (`asistenciaXMateriaXAlumnoXCursoXCiclo`). |

---

## Parte 1 — `AttendanceType.behavior`

### REQ-P1-1: `behavior` field

Every `AttendanceType` row MUST have a `behavior` value that is one of the integers 1 through 7. The system MUST reject any create or update operation that supplies a `behavior` outside this range.

### REQ-P1-2: `absenceValue` preserved

The existing `absenceValue` field MUST remain on `AttendanceType`, unchanged in type, precision, and meaning. `behavior` is an additional classifier; it does NOT replace or recompute `absenceValue`.

### REQ-P1-3: System type mapping is fixed

- The system type `P` MUST have `behavior = 4` (No considerar ausentismo).
- The system types `SAB`, `DOM`, `X` MUST have `behavior = 3` (No elegible).
- This mapping MUST NOT be alterable through the CRUD UI or API for system types.

### REQ-P1-4: System types are read-only

Any attempt to edit or delete an `AttendanceType` row where `isSystem = true` MUST be rejected by the backend, regardless of caller role. This MUST hold even if the request originates from a role that can otherwise manage custom types.

### REQ-P1-5: Custom type CRUD includes `behavior`

Create, update, and delete operations on custom (`isSystem = false`) `AttendanceType` rows MUST be available to authorized roles (Secretario or higher, per existing role pattern) and MUST accept/require a `behavior` value on create and update.

### REQ-P1-6: `behavior 3` governs grid selectability, not `assignable`

An `AttendanceType` with `behavior = 3` MUST NOT appear in the grid combo of selectable codes for the daily/monthly attendance grid. All other behaviors (1, 2, 4, 5, 6, 7) MUST appear in the grid combo when the type is `active`.

### REQ-P1-7: Feriado is selectable

A custom `AttendanceType` with `behavior = 7` (e.g., "Feriado") MUST be selectable in the grid combo, allowing Secretaría to mark it day-by-day for individual students/rows — unlike `behavior 3`, which is never selectable.

### REQ-P1-8: Data migration invariant

After this change is deployed, every existing `AttendanceType` row (system and custom) MUST have a valid `behavior` populated — no row MAY be left with a null or missing `behavior`. (The specific backfill heuristic for pre-existing custom rows is a design-time decision; this spec only fixes the required end-state invariant and the deterministic system mapping in REQ-P1-3.)

---

## Scenarios: Parte 1

### Scenario P1-1: Valid behavior accepted on custom type creation

```
Given  an authorized user (Secretario+) creating a custom AttendanceType
When   the payload includes behavior = 6 (Tarde Justificado)
Then   the AttendanceType MUST be created with behavior = 6
And    absenceValue MUST be stored as provided, independent of behavior
```

### Scenario P1-2: Invalid behavior rejected

```
Given  an authorized user creating or updating a custom AttendanceType
When   the payload includes behavior = 8 (out of range) or behavior = 0
Then   the operation MUST be rejected with a validation error
And    no AttendanceType row MUST be created or modified
```

### Scenario P1-3: System type P is locked to behavior 4

```
Given  the system AttendanceType "P" for a given level
When   its behavior is inspected after migration
Then   behavior MUST equal 4 (No considerar ausentismo)
```

### Scenario P1-4: System types SAB/DOM/X are locked to behavior 3

```
Given  the system AttendanceTypes "SAB", "DOM", "X" for a given level
When   their behavior is inspected after migration
Then   each MUST equal behavior = 3 (No elegible)
```

### Scenario P1-5: Edit attempt on a system type is rejected

```
Given  the system AttendanceType "SAB" (isSystem = true)
When   a request attempts to update its description, absenceValue, or behavior
Then   the operation MUST be rejected
And    the AttendanceType row MUST remain unchanged
```

### Scenario P1-6: Delete attempt on a system type is rejected

```
Given  the system AttendanceType "P" (isSystem = true)
When   a request attempts to delete it (soft or hard delete)
Then   the operation MUST be rejected
And    the AttendanceType row MUST remain active and unchanged
```

### Scenario P1-7: Custom type edit/delete allowed

```
Given  a custom AttendanceType "A" (isSystem = false)
When   an authorized user edits its behavior or absenceValue, or deletes it
Then   the operation MUST succeed
```

### Scenario P1-8: behavior 3 excluded from grid combo

```
Given  the daily attendance grid combo for an editable (hábil) cell
And    AttendanceType "SAB" has behavior = 3
When   the combo options are computed
Then   "SAB" MUST NOT appear in the combo
```

### Scenario P1-9: behaviors 1,2,4,5,6,7 included in grid combo

```
Given  active AttendanceTypes with behavior in {1,2,4,5,6,7} (e.g., "A"=1, "AJ"=2, "P"=4, "TI"=5, "TJ"=6, "Feriado"=7)
When   the combo options are computed for an editable cell
Then   all of them MUST appear in the combo
```

### Scenario P1-10: Feriado marked day-by-day

```
Given  a custom AttendanceType "Feriado" with behavior = 7, active = true
When   Secretaría selects "Feriado" for a specific student on a specific day in the grid
Then   that day's code for that student MUST be recorded as "Feriado" (behavior 7)
And    other students'/days' codes MUST remain unaffected
```

### Scenario P1-11 (edge): Custom type created for each behavior value

```
Given  an authorized user creating 7 distinct custom AttendanceTypes, one per behavior value 1 through 7
When   each is submitted with a valid absenceValue
Then   each MUST be created successfully with its respective behavior
And    no cross-validation MUST reject a behavior value solely because another type already uses it (behavior is not unique)
```

### Scenario P1-12 (edge): Fractional absenceValue with any behavior

```
Given  a custom AttendanceType with absenceValue = 0.25 and behavior = 5 (Tarde Injustificado)
And    another custom AttendanceType with absenceValue = 0.75 and behavior = 1 (Ausente Injustificado)
When   both are created
Then   both MUST be persisted with their exact decimal absenceValue and chosen behavior
And    behavior validation MUST be independent of the absenceValue chosen
```

---

## Parte 2 — Impresión mensual (PDF apaisado, server-side)

### REQ-P2-1: Print button in both modules

A "Imprimir" (print) action MUST be available in the General module and in the Por Materia module of `asistencia-mensual.tsx`, each triggering a server-side PDF generation for the currently viewed CourseCycle/year/month (and subject, for Por Materia).

### REQ-P2-2: PDF format

The generated document MUST be a landscape (apaisado) A4 PDF, produced server-side via the existing Puppeteer + Handlebars reporting stack. Client-side PDF generation (html2pdf) MUST NOT be used for this feature.

### REQ-P2-3: Grid content

The PDF MUST render a matrix of students (rows) × days of the month (columns), using the same status codes shown on-screen in the grid for that CourseCycle/year/month (and subject, for Por Materia).

### REQ-P2-4: Six weighted total columns per student

For each student row, the PDF MUST include six total columns, each a SUM of `absenceValue` (a weighted sum, NOT a count) over the days in that row matching the stated behavior(s):

1. **Tardes Justificadas** = Σ `absenceValue` of days with `behavior = 6`.
2. **Tardes Injustificadas** = Σ `absenceValue` of days with `behavior = 5`.
3. **Total Tardes** = Σ `absenceValue` of days with `behavior ∈ {5, 6}` (equivalently, sum of totals 1 + 2).
4. **Ausentes Justificados** = Σ `absenceValue` of days with `behavior = 2`.
5. **Ausentes Injustificados** = Σ `absenceValue` of days with `behavior = 1`.
6. **Ausentes Totales** = Σ `absenceValue` of days with `behavior ∈ {1, 2}` (equivalently, sum of totals 4 + 5).

### REQ-P2-5: Días hábiles label

The PDF MUST display a "Días hábiles" label computed as: `díasDelMes − (número de días del mes clasificados como behavior 3 o behavior 7)`, counted without double-counting — a calendar day MUST be subtracted at most once even if it qualifies as behavior 3 or 7 through more than one source (e.g., a Sunday from the calendar that is also marked Feriado).

### REQ-P2-6: Días hábiles behaviors

Days classified with `behavior ∈ {1, 2, 4, 5, 6}` MUST count as día hábil (i.e., MUST NOT be subtracted from `díasDelMes` in REQ-P2-5).

### REQ-P2-7: Applies to both modules

REQ-P2-3 through REQ-P2-6 MUST apply identically to the General module (whole-CourseCycle attendance) and to the Por Materia module (per-subject attendance), using the aggregation appropriate to each model (`asistenciaXAlumnoXCursoXCiclo` and `asistenciaXMateriaXAlumnoXCursoXCiclo`, respectively).

---

## Scenarios: Parte 2

### Scenario P2-1: Print button visible and triggers PDF — General module

```
Given  the General attendance module is displaying a CourseCycle/year/month
When   the user clicks "Imprimir"
Then   a landscape A4 PDF MUST be generated server-side and returned/downloaded
```

### Scenario P2-2: Print button visible and triggers PDF — Por Materia module

```
Given  the Por Materia attendance module is displaying a CourseCycle/year/month/subject
When   the user clicks "Imprimir"
Then   a landscape A4 PDF MUST be generated server-side for that subject
```

### Scenario P2-3: Weighted totals — Tardes

```
Given  a student's month has: day 3 = behavior 6 (absenceValue 0.5), day 10 = behavior 6 (absenceValue 0.5), day 17 = behavior 5 (absenceValue 1)
When   the PDF totals are computed for that student
Then   Tardes Justificadas MUST equal 1.0
And    Tardes Injustificadas MUST equal 1.0
And    Total Tardes MUST equal 2.0
```

### Scenario P2-4: Weighted totals — Ausentes

```
Given  a student's month has: day 2 = behavior 1 (absenceValue 1), day 9 = behavior 2 (absenceValue 1), day 16 = behavior 2 (absenceValue 0.5)
When   the PDF totals are computed for that student
Then   Ausentes Justificados MUST equal 1.5
And    Ausentes Injustificados MUST equal 1.0
And    Ausentes Totales MUST equal 2.5
```

### Scenario P2-5: Días hábiles excludes behavior 3 and 7, no double count

```
Given  a 30-day month where days 6, 13, 20, 27 are Sundays (behavior 3 via system type DOM)
And    day 25 is marked Feriado (behavior 7) and day 25 is a Thursday (not otherwise behavior 3)
When   días hábiles is computed
Then   días hábiles MUST equal 30 − 5 = 25
(4 Sundays + 1 Feriado weekday, none counted twice)
```

### Scenario P2-6: Días hábiles — Feriado falls on an already non-hábil day

```
Given  a month where day 7 is a Sunday (behavior 3 via system type DOM)
And    day 7 is ALSO marked Feriado (behavior 7) for some reason
When   días hábiles is computed
Then   day 7 MUST be subtracted from díasDelMes exactly once, not twice
```

### Scenario P2-7 (edge): Month with multiple feriados marked

```
Given  a 31-day month with 4 Sundays, 4 Saturdays, and 2 additional weekday Feriados (behavior 7)
When   días hábiles is computed
Then   días hábiles MUST equal 31 − (4 + 4 + 2) = 21
```

### Scenario P2-8 (edge): Fractional absenceValue types in totals

```
Given  a student's month has: day 4 = behavior 6, absenceValue 0.25; day 11 = behavior 6, absenceValue 0.75
When   Tardes Justificadas is computed
Then   it MUST equal 1.00 (0.25 + 0.75)
```

### Scenario P2-9 (edge): Student with no marks for the month

```
Given  a student has no recorded days (empty or all-blank) for the given month
When   the PDF totals are computed for that student
Then   all six totals MUST equal 0
And    the student's row MUST print normally without error
```

### Scenario P2-10 (edge): Day index beyond días del mes

```
Given  a month with 28 days (e.g., February non-leap) rendered in a grid that shows day columns up to 31
When   the PDF renders columns 29, 30, 31
Then   each MUST display the non-hábil marker "X" (behavior 3, system type X)
And    none of columns 29, 30, 31 MUST be included in any of the six weighted totals
And    none of columns 29, 30, 31 MUST be counted as día hábil
```

### Scenario P2-11: Applies identically to Por Materia

```
Given  the same student/month data as Scenario P2-3, but recorded via the Por Materia model for subject S
When   the Por Materia PDF totals are computed
Then   Tardes Justificadas, Tardes Injustificadas, and Total Tardes MUST match the values from Scenario P2-3
```

---

## Edge Case Reference Matrix

| Scenario | Case | Expected behavior |
|---|---|---|
| P1-11 | Custom type per behavior 1–7 | All 7 created independently; behavior not unique |
| P1-12 | absenceValue 0.25 / 0.75 | Persisted exactly; independent of behavior |
| P1-5, P1-6 | Edit/delete system type | Rejected, no mutation |
| P2-7 | Month with several feriados | Each subtracted once from días hábiles |
| P2-6 | Feriado on already-locked day (e.g., Sunday) | Subtracted once, not twice |
| P2-9 | Student with zero marks | All totals = 0, no error |
| P2-10 | Day > díasDelMes | Rendered as "X", excluded from totals and días hábiles |

---

## Acceptance Criteria Summary

| ID | Requirement | Keyword |
|----|-------------|---------|
| AC-P1-1 | `behavior` MUST be one of 1–7; out-of-range values rejected on create/update | MUST |
| AC-P1-2 | `absenceValue` preserved unchanged as the ausentismo weight, independent of `behavior` | MUST |
| AC-P1-3 | System type `P` MUST map to `behavior = 4` | MUST |
| AC-P1-4 | System types `SAB`/`DOM`/`X` MUST map to `behavior = 3` | MUST |
| AC-P1-5 | Edit or delete on any `isSystem = true` row MUST be rejected | MUST |
| AC-P1-6 | Custom type CRUD (create/edit/delete) MUST succeed for authorized roles and MUST accept `behavior` | MUST |
| AC-P1-7 | `behavior = 3` types MUST be excluded from the grid combo | MUST |
| AC-P1-8 | `behavior` values 1,2,4,5,6,7 MUST appear in the grid combo | MUST |
| AC-P1-9 | Custom `behavior = 7` (Feriado) MUST be selectable and markable day-by-day | MUST |
| AC-P1-10 | Every `AttendanceType` row MUST have a valid non-null `behavior` post-migration | MUST |
| AC-P1-11 | Custom type MAY be created for each of the 7 behavior values without uniqueness conflict | MAY |
| AC-P1-12 | Fractional `absenceValue` (e.g., 0.25, 0.75) MUST be persisted exactly regardless of `behavior` | MUST |
| AC-P2-1 | "Imprimir" button MUST exist in General module and MUST trigger server-side PDF | MUST |
| AC-P2-2 | "Imprimir" button MUST exist in Por Materia module and MUST trigger server-side PDF for that subject | MUST |
| AC-P2-3 | PDF MUST be landscape A4, generated server-side (Puppeteer/Handlebars); client-side generation MUST NOT be used | MUST |
| AC-P2-4 | PDF MUST show students × days-of-month grid with on-screen status codes | MUST |
| AC-P2-5 | Tardes Justificadas MUST equal Σ `absenceValue` of `behavior = 6` days | MUST |
| AC-P2-6 | Tardes Injustificadas MUST equal Σ `absenceValue` of `behavior = 5` days | MUST |
| AC-P2-7 | Total Tardes MUST equal Σ `absenceValue` of `behavior ∈ {5,6}` days | MUST |
| AC-P2-8 | Ausentes Justificados MUST equal Σ `absenceValue` of `behavior = 2` days | MUST |
| AC-P2-9 | Ausentes Injustificados MUST equal Σ `absenceValue` of `behavior = 1` days | MUST |
| AC-P2-10 | Ausentes Totales MUST equal Σ `absenceValue` of `behavior ∈ {1,2}` days | MUST |
| AC-P2-11 | Días hábiles MUST equal díasDelMes − días con behavior 3 o 7, sin doble conteo | MUST |
| AC-P2-12 | Days with `behavior ∈ {1,2,4,5,6}` MUST count as día hábil | MUST |
| AC-P2-13 | All six totals and días hábiles MUST apply identically to General and Por Materia modules | MUST |
| AC-P2-14 | Month with multiple feriados: each subtracted exactly once from días hábiles | MUST |
| AC-P2-15 | Fractional `absenceValue` types (0.25/0.75) MUST sum exactly in totals | MUST |
| AC-P2-16 | Student with zero marks: all six totals MUST equal 0, row prints without error | MUST |
| AC-P2-17 | Day index beyond díasDelMes MUST render "X" and MUST be excluded from all totals and días hábiles | MUST |

---

## Out of Scope (explicit non-requirements)

- Rediseño del cálculo histórico de asistencia del boletín (`buildAsistencia`) — used only as reference, not modified.
- Client-side impresión (`html2pdf` / `PremiumPrintReport.tsx`) — explicitly discarded.
- Reportes institucionales agregados (por nivel, anuales, comparativos).
- Cambios en la captura diaria de asistencia más allá de filtrar `behavior 3` del combo.
- Eliminación física de la columna `assignable` del schema (deferred; not guaranteed by this change — see proposal Risk A, resolved at design time).
- The specific backfill heuristic for pre-existing custom `AttendanceType` rows without an obvious `behavior` (a design-time decision; only the end-state invariant, REQ-P1-8, is specified here).
