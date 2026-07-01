# Spec: Asistencia Reporting (Impresión Mensual)

> Capability area: server-side landscape (apaisado) A4 PDF generation of the monthly attendance
> grid, for both General (per CourseCycle) and Por Materia (per subject) modes, with weighted
> absence/tardiness totals and a "Días hábiles" label.
> Changes:
>   asistencia-behavior-e-impresion (archived 2026-07-01) — ASR-R1, ASR-R2, ASR-R3, ASR-R4
> IDs: ASR-R* / ASR-S*
> Cross-references:
>   `attendance-types/spec.md` — REQ-15 (`behavior` classifier 1–7, source of the weights used here)
>   `attendance-recording/spec.md` — ATR-R1, ATR-R2 (General/Por Materia recording models
>   `asistenciaXAlumnoXCursoXCiclo` / `asistenciaXMateriaXAlumnoXCursoXCiclo`, reused read-only)
>   `report-cards/spec.md` (boletín) — shares the Puppeteer/Handlebars reporting stack
>   (`pdf-generator.service.ts`), extended additively (new `landscape` option, default `false`, no
>   regression on boletín/constancia)

## Purpose

Define what MUST be true for the "Imprimir" (print) capability of the monthly attendance grid: a
server-side-generated landscape A4 PDF, for the General and Por Materia modules, showing students ×
days-of-month with six weighted absence/tardiness totals per student and a "Días hábiles" label.
This spec does NOT cover `AttendanceType` CRUD (`attendance-types/spec.md`) nor the historical
boletín `buildAsistencia` aggregation (`report-cards/spec.md`), neither of which is modified by this
capability.

## Requirements

### ASR-R1 — Print button — server-side PDF, both modules

A "Imprimir" action MUST be available in the General module and in the Por Materia module of
`asistencia-mensual.tsx`, each triggering server-side PDF generation (existing Puppeteer + Handlebars
stack) for the CourseCycle/year/month (and subject, for Por Materia) currently viewed. The generated
document MUST be landscape (apaisado) A4. Client-side PDF generation (`html2pdf`) MUST NOT be used
for this feature.

#### ASR-S1 — Print button triggers PDF — General module

- GIVEN the General attendance module is displaying a CourseCycle/year/month
- WHEN the user clicks "Imprimir"
- THEN a landscape A4 PDF MUST be generated server-side and returned/downloaded

#### ASR-S2 — Print button triggers PDF — Por Materia module

- GIVEN the Por Materia attendance module is displaying a CourseCycle/year/month/subject
- WHEN the user clicks "Imprimir"
- THEN a landscape A4 PDF MUST be generated server-side for that subject

#### ASR-S3 — No client-side PDF regression

- GIVEN the web build after this change
- WHEN the bundle is inspected
- THEN no NEW client-side PDF chunk is introduced by this feature (the pre-existing `html2pdf-*`
  chunk, owned by `PremiumPrintReport.tsx`, is unrelated and untouched)

---

### ASR-R2 — Grid content: students × days, on-screen codes

The PDF MUST render a matrix of students (rows) × days of the month (columns), using the same
status codes shown on-screen in the grid for that CourseCycle/year/month (and subject, for Por
Materia). This requirement applies identically to General and Por Materia, using the aggregation
appropriate to each underlying model (`asistenciaXAlumnoXCursoXCiclo` /
`asistenciaXMateriaXAlumnoXCursoXCiclo`).

#### ASR-S4 — Grid renders on-screen codes

- GIVEN a CourseCycle/year/month with recorded attendance
- WHEN the PDF is generated
- THEN each student row MUST show the same per-day codes as the on-screen grid

---

### ASR-R3 — Six weighted total columns per student

For each student row, the PDF MUST include six total columns, each a weighted SUM of `absenceValue`
(NOT a count) over the days in that row matching the stated `behavior`(s) — see
`attendance-types/spec.md` REQ-15 for the behavior enum:

1. **Tardes Justificadas** = Σ `absenceValue` of days with `behavior = 6` (TARDE_JUSTIFICADA)
2. **Tardes Injustificadas** = Σ `absenceValue` of days with `behavior = 5` (TARDE_INJUSTIFICADA)
3. **Total Tardes** = totals 1 + 2 (equivalently, Σ `absenceValue` of `behavior ∈ {5,6}`)
4. **Ausentes Justificados** = Σ `absenceValue` of days with `behavior = 2` (AUSENTE_JUSTIFICADO)
5. **Ausentes Injustificados** = Σ `absenceValue` of days with `behavior = 1` (AUSENTE_INJUSTIFICADO)
6. **Ausentes Totales** = totals 4 + 5 (equivalently, Σ `absenceValue` of `behavior ∈ {1,2}`)

This requirement MUST apply identically to General and Por Materia.

#### ASR-S5 — Weighted totals — Tardes

- GIVEN a student's month has: day 3 = behavior 6 (absenceValue 0.5), day 10 = behavior 6
  (absenceValue 0.5), day 17 = behavior 5 (absenceValue 1)
- WHEN the PDF totals are computed for that student
- THEN Tardes Justificadas MUST equal 1.0, Tardes Injustificadas MUST equal 1.0, and Total Tardes
  MUST equal 2.0

#### ASR-S6 — Weighted totals — Ausentes

- GIVEN a student's month has: day 2 = behavior 1 (absenceValue 1), day 9 = behavior 2
  (absenceValue 1), day 16 = behavior 2 (absenceValue 0.5)
- WHEN the PDF totals are computed for that student
- THEN Ausentes Justificados MUST equal 1.5, Ausentes Injustificados MUST equal 1.0, and Ausentes
  Totales MUST equal 2.5

#### ASR-S7 — Fractional absenceValue sums exactly

- GIVEN day 4 = behavior 6, absenceValue 0.25; day 11 = behavior 6, absenceValue 0.75
- WHEN Tardes Justificadas is computed
- THEN it MUST equal 1.00 (0.25 + 0.75), independent of rounding/truncation

#### ASR-S8 — Student with no marks — all totals zero, no error

- GIVEN a student has no recorded days (empty or all-blank) for the given month
- WHEN the PDF totals are computed for that student
- THEN all six totals MUST equal 0 and the student's row MUST print normally without error

#### ASR-S9 — Applies identically to Por Materia

- GIVEN the same student/month data as ASR-S5, recorded via the Por Materia model for subject S
- WHEN the Por Materia PDF totals are computed
- THEN Tardes Justificadas, Tardes Injustificadas, and Total Tardes MUST match ASR-S5 exactly

---

### ASR-R4 — "Días hábiles" label — no double counting

The PDF MUST display a "Días hábiles" label computed as `díasDelMes − (días del mes clasificados
como behavior 3 [NO_ELEGIBLE] o behavior 7 [DIA_NO_HABIL])`, counted WITHOUT double-counting — a
calendar day MUST be subtracted at most once even if it qualifies as behavior 3 or 7 through more
than one source (e.g., a Sunday that is ALSO marked Feriado). Days with `behavior ∈ {1,2,4,5,6}`
MUST count as día hábil (MUST NOT be subtracted). A day index beyond `daysInMonth` for that
year/month MUST be excluded from all six totals (ASR-R3) and from días hábiles. This requirement
MUST apply identically to General and Por Materia.

#### ASR-S10 — Días hábiles, no double count

- GIVEN a 30-day month where days 6, 13, 20, 27 are Sundays (behavior 3) and day 25 is marked
  Feriado (behavior 7, a Thursday, not otherwise behavior 3)
- WHEN días hábiles is computed
- THEN días hábiles MUST equal 30 − 5 = 25 (4 Sundays + 1 Feriado weekday, none counted twice)

#### ASR-S11 — Feriado falling on an already non-hábil day

- GIVEN day 7 is a Sunday (behavior 3) AND is ALSO marked Feriado (behavior 7) for some reason
- WHEN días hábiles is computed
- THEN day 7 MUST be subtracted from díasDelMes exactly once, not twice

#### ASR-S12 (edge) — Month with multiple feriados marked

- GIVEN a 31-day month with 4 Sundays, 4 Saturdays, and 2 additional weekday Feriados (behavior 7)
- WHEN días hábiles is computed
- THEN días hábiles MUST equal 31 − (4 + 4 + 2) = 21

#### ASR-S13 (edge) — Day index beyond días del mes

- GIVEN a month with 28 days (e.g., February non-leap) rendered in a grid that shows day columns
  up to 31
- WHEN the PDF renders columns 29, 30, 31
- THEN none of columns 29, 30, 31 MUST be included in any of the six weighted totals (ASR-R3), and
  none MUST be counted as día hábil

**Implementation note (verify #1661, SUGGESTION, non-blocking):** the aggregation math correctly
excludes indices beyond `daysInMonth` (the loop bound is `1..daysInMonth`), so totals/días-hábiles
are never polluted. However, the PDF currently OMITS columns 29–31 from the rendered grid rather
than rendering an explicit "X" marker for them (unlike the on-screen web grid, which does render
"X" for those columns — see `attendance-recording/spec.md` ATR-S59). This is a deliberate,
documented design call (tasks.md T3.2: "X" is a web-grid-only concern; the pure aggregator only
needs valid day indices). Functionally safe — no data pollution — but a literal deviation from the
original scenario text ("PDF renders columns 29/30/31 ... displays marker 'X'"), pending
product-owner confirmation on whether column omission or an explicit "X" print column is the
desired final behavior. Does not block this archive; tracked as a fast-follow item if product
wants the literal behavior.

---

## ADR cross-reference (asistencia-behavior-e-impresion, Parte 2 — impresión)

| ADR    | Decision | Satisfies |
|--------|----------|-----------|
| ADR-06 | Pure domain aggregator `computeStudentTotals(days, catalog)` in `packages/domain/src/asistencia/utils/asistencia-totals.ts`, shared by General and Por Materia (no duplication) | ASR-R3 |
| ADR-07 | `computeDiasHabiles` = course-level scalar via a `Set<number>` of day indices 1..daysInMonth — double-counting structurally impossible | ASR-R4 |
| ADR-08 | Use-case `GenerateAsistenciaMensualPdfUseCase` (`executeGeneral`/`executeMateria`), reuses existing `findByScopeAndMonthEnriched` repos; Door 2 (preceptor/teacher-group) authorization reused inline, same logic as the existing list use-cases | ASR-R1, ASR-R2 |
| ADR-09 | `PdfGeneratorService.generatePdf(html, options?{landscape,margin})` made additive/opt-in, default `landscape:false` preserved — no regression on boletín/constancia (both call sites still pass zero args) | ASR-R1 |
| ADR-10 | New template `asistencia-mensual.hbs` (landscape), compiled via the same `fs.readFileSync` + `Handlebars.compile` probe pattern used by `generate-boletin.use-case.ts` | ASR-R1, ASR-R2 |

## Out of Scope (explicit non-requirements)

- Rediseño del cálculo histórico de asistencia del boletín (`buildAsistencia`) — used only as
  reference, not modified.
- Reportes institucionales agregados (por nivel, anuales, comparativos).
- Eliminación física de la columna `assignable` en `AttendanceType` — ver `attendance-types/spec.md`
  REQ-15: `assignable` queda derivada de `behavior`, no eliminada.
