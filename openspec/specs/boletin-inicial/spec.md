# Spec: Boletín Inicial

> Capability area: Inicial report card wired to InformeEvolutivo
> Change: informe-avance-inicial · 2026-06-17
> IDs: BI-R* / BI-S*

## Purpose

Define what MUST be true for the generation and rendering of the Inicial boletín after the
`informe-avance-inicial` change. `GenerateBoletinUseCase.buildMaterias()` gains an Inicial
branch (`Math.floor(level / 10) === 1`) that reads from the existing `InformeEvolutivo`
model. The legacy `NotaTrimestral` path is no longer used for Inicial students.
All other levels are unaffected.

---

## Data Model (unchanged by this change — pre-existing)

```
InformeEvolutivo
  studentId               String
  salaId                  String
  periodo                 String    // "1T" | "2T" | "3T" (VO)
  fecha                   DateTime
  observacionesGenerales  String?
  areas                   AreaDesarrollo[]

AreaDesarrollo
  area        String   // free-string label, e.g. "SOCIO_AFECTIVA" (enum deferred — P1)
  observacion String   // qualitative narrative — the key Inicial field
  valoracion  String   // "DESTACADO" | "LOGRADO" | "EN_PROCESO" | "NO_LOGRADO" (VO deferred — P3)
```

Lookup path (ADR-2): `enrollment.studentId + enrollment.academicYear → SalaEnrollment.findFirst(active:true) → salaId → InformeRepository.findAll({ studentId, salaId })`.

---

## Requirements

### BI-R1 — Data source: InformeEvolutivo only

For any Inicial student (`Math.floor(enrollment.student.level / 10) === 1`),
`GenerateBoletinUseCase` MUST obtain boletín content exclusively from `InformeEvolutivo`
via `InformeRepository`. It MUST NOT read `NotaTrimestral` or `SubjectAssignment`
in the Inicial path.

#### BI-S1 — Inicial boletín reads InformeEvolutivo

- GIVEN a student enrolled in an Inicial CourseCycle (level = 10..19)
- WHEN `GenerateBoletinUseCase` is called for that student
- THEN `buildMaterias()` early-returns via `buildMateriasInicial`
- AND `InformeRepository.findAll({ studentId, salaId })` IS called
- AND `client.notaTrimestral` (or any SubjectAssignment query) is NOT called

---

### BI-R2 — Output structure: dedicated `informesInicial` collection (ADR-3)

`DatosBoletin` MUST contain `informesInicial?: InformeInicialBoletin[]` — a dedicated
optional array holding one element per available trimestre. `MateriaBoletin` MUST NOT
be extended with Inicial-specific fields (`observacion?` etc.).

> **ADR-3 rationale:** a shared-type extension only fits a single informe; ADR-1 mandates
> all three trimestres in one annual PDF; a dedicated structure avoids contaminating
> `MateriaBoletin` (consumed by Primario/Secundario/Terciario) and eliminates regression
> risk for those levels.

`InformeInicialBoletin` shape:

```ts
interface InformeInicialBoletin {
  periodo: string;                // "1T" | "2T" | "3T"
  fecha: string;                  // dd/mm/aaaa (formatted)
  observacionesGenerales?: string;
  areas: AreaInicialBoletin[];
}

interface AreaInicialBoletin {
  nombre: string;      // mapped from AreaDesarrollo.area; free-string (enum deferred P1)
  observacion: string; // qualitative narrative
  valoracion: string;  // e.g. "LOGRADO" (VO deferred P3)
}
```

> **Implementation note (W-1):** the DTO field for the area label is named `nombre`
> (not `area`). The value is correct (sourced from `AreaDesarrollo.area`); only the
> DTO property name differs from the raw model field.

#### BI-S2 — informesInicial is populated with correct structure

- GIVEN an Inicial student with two InformeEvolutivo records (periods 2T and 1T, deliberately unordered)
- WHEN the boletín is generated
- THEN `datos.informesInicial` has 2 items ordered [1T, 2T]
- AND each item contains `periodo`, `fecha`, `observacionesGenerales`, and `areas[].nombre`, `areas[].observacion`, `areas[].valoracion`

---

### BI-R3 — Annual render: all trimestres ordered 1T→2T→3T (ADR-1)

The invocation `GenerateBoletinUseCase.execute(enrollmentId)` is annual (no period
parameter). The Inicial branch MUST include ALL available `InformeEvolutivo` records
for the student's sala in that academic year, sorted `1T → 2T → 3T`. The top-level
`datos.periodo` field carries `academicYear` (labelled "Ciclo lectivo" in the template —
semantically correct for an annual document). Per-trimestre periods are rendered in
each informe section header, not in the top-level period field.

> **Product note (non-blocking):** in Argentina, Inicial informes are often delivered
> per-trimestre (one document per period). The current endpoint has no period selector,
> so the annual multi-informe render is the consistent and safe interpretation.
> Per-trimestre delivery requires a future change to add a period parameter to `execute()`
> (aligned with deferred item P4 — GradingPeriodDate alignment).

#### BI-S3 — Ordering is deterministic 1T→2T→3T

- GIVEN an Inicial student with InformeEvolutivo records for 3T and 1T (reverse order)
- WHEN the boletín is generated
- THEN `datos.informesInicial` is ordered [1T, 3T] (ascending by period)

---

### BI-R4 — Empty state: graceful, no exception

If no `SalaEnrollment` exists or `InformeRepository.findAll` returns an empty list,
`GenerateBoletinUseCase` MUST return a valid boletín with `informesInicial: []`.
It MUST NOT throw an exception. The HTTP endpoint MUST return 2xx.
The template renders a "Sin informes evolutivos cargados" placeholder for empty state.

#### BI-S4 — No SalaEnrollment → empty informesInicial

- GIVEN an Inicial student with no SalaEnrollment record
- WHEN the boletín is generated
- THEN `datos.informesInicial` is `[]`, no exception is thrown, HTTP 2xx

#### BI-S5 — No InformeEvolutivo records → empty informesInicial

- GIVEN an Inicial student with SalaEnrollment but no InformeEvolutivo
- WHEN the boletín is generated
- THEN `datos.informesInicial` is `[]`, no exception is thrown, HTTP 2xx

---

### BI-R5 — No numeric grades, no Docente column

The Inicial boletín MUST NOT include numeric grades, a Docente column, or
aprobado/reprobado logic in any layer (DTO, template, rendered HTML).
`buildMateriasInicial` returns `materias: []` — the shared numeric-grade path
is not used for Inicial.

#### BI-S6 — Template has no Docente column

- GIVEN any Inicial boletín
- WHEN the HTML is rendered
- THEN the output does NOT contain a "Docente" column header or any teacher field

---

### BI-R6 — No regression in other levels

The Inicial early-return MUST be the first arm in `buildMaterias()`, before the
Primario, Secundario, and Terciario paths. `informesInicial` is `undefined` for
non-Inicial enrollments (optional on `DatosBoletin`). Other level templates do not
reference `informesInicial` and MUST not be affected.

#### BI-S7 — Primario is unaffected

- GIVEN a Primario student (level = 20)
- WHEN the boletín is generated
- THEN `InformeRepository.findAll` is NOT called
- AND `dados.informesInicial` is `undefined`
- AND `dados.materias` contains the expected Primario structure unchanged

---

### BI-R7 — InformeRepository as optional injectable dependency

`GenerateBoletinUseCase` MUST accept `InformeRepository` as an optional constructor
parameter. Existing instantiations without it MUST continue working. If the repository
is not injected, `buildMateriasInicial` MUST return `informesInicial: []` (graceful).
`PrismaInformeRepository` MUST be wired in `ReportesModule`.

---

### BI-R8 — Batch inherits the fix without a separate arm

`GenerateBoletinBatchUseCase` delegates to `GenerateBoletinUseCase.execute(enrollmentId)`.
The batch MUST NOT contain any Inicial-specific dispatch. Inicial enrollments inherit
`buildMateriasInicial` automatically through delegation.

---

### BI-R9 — No Prisma schema change

This change MUST NOT include Prisma migrations. `InformeEvolutivo` and `AreaDesarrollo`
are consumed as-is from the existing tenant schema.

---

### BI-R10 — Template structure

`boletin-inicial.hbs` MUST render:
- A student-info block with "Ciclo lectivo: {{periodo}}" (year label, not trimestre label)
- `{{#each informesInicial}}` — one section per trimestre with header "Informe — {{this.periodo}} · {{this.fecha}}"
- Conditional `{{#if this.observacionesGenerales}}` block
- An areas table with 3 columns: Área | Observación | Valoración (no Docente, no numeric)
- `{{else}}` block: "Sin informes evolutivos cargados para este ciclo."
- `{{#if asistencia}}` attendance block (unchanged)

---

## Deferred (out of scope — tracked as product decisions P1–P6)

| ID | Item |
|----|------|
| P1 | Enum / VO de Área (area as free-string is acceptable for MVP) |
| P2 | Authz self-service for docentes (SalaXDocente — admin-only for now) |
| P3 | VO de Valoración (free-string with known values is acceptable for MVP) |
| P4 | GradingPeriodDate alignment / period selector in execute() (per-trimestre delivery) |
| P5 | "No evaluado" state distinct from "sin informe" |
| P6 | Borrador → publicado workflow |

Drop of `NotaTrimestral` and `SubjectAssignment` for Inicial is blocked on
`evaluacion-terciario` (the remaining gating feature — Terciario must move off the
legacy path before the shared `SubjectAssignment` join-key can be removed).
