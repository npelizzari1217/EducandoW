# Spec: Boletín Terciario

> Capability area: Terciario report card — transcript model
> Change: boletin-terciario (Fase C) · 2026-06-18
> Depends on: evaluacion-terciario (Fase A+B, PR #23)
> IDs: BT-R* / BT-S*

## Purpose

Define what MUST be true for the generation and rendering of the Terciario boletín after the
`boletin-terciario` change. `GenerateBoletinUseCase.buildMaterias()` gains a decade-4 branch
(`Math.floor(level / 10) === 4`) that reads from `NotaCursadaTerciario` and `ActaExamenNota`
(introduced by `evaluacion-terciario`). The output is a **transcripción** of the student's
materias vigentes at the time of request: in-progress, regular (awaiting final), and approved.

The legacy `NotaTrimestral` path for other levels is NOT modified.

---

## Data Model (introduced by evaluacion-terciario — pre-existing; updated by vencimiento-regularidad-terciario 2026-06-19)

```
InscripcionMateria
  studentId          String
  anioAcademico      String
  estado             String      // 'INSCRIPTO'|'CURSANDO'|'REGULAR'|'PROMOCIONAL'|'APROBADO'|'LIBRE'
  cuatrimestre       String      // '1C'|'2C'|'ANUAL' — authoritative per-student axis
  notaCursada        Float?      // confirmed cursada grade (Fase A write)
  fechaRegularidad   DateTime?   // UTC timestamp of first REGULAR confirmation (write-once; null = not expired)
  notasCursada       NotaCursadaTerciario[]
  materiaCarrera     MateriaCarrera (→ Subject, → Carrera)

NotaCursadaTerciario
  inscripcionMateriaId  String
  slot                  String   // 'PARCIAL_1'|'PARCIAL_2'|'RECUPERATORIO_PARCIAL_1'|'RECUPERATORIO_PARCIAL_2'|'TP'
  nota                  Float?

ActaExamenNota
  studentId    String
  nota         Float
  condicion    String   // 'APROBADO'|'DESAPROBADO'|'AUSENTE'
  intento      Int      // 1|2|3 (introduced by evaluacion-terciario)
  acta         ActaExamen (→ materiaCarreraId, fecha, active)

LlamadoExamen
  anioAcademico  String
  fechaInicio    DateTime
  active         Boolean
  deletedAt      DateTime?   // soft-delete

Carrera
  name                 String   // degree/career display name for transcript header
  llamadosVencimiento  Int      // max active llamados after fechaRegularidad before expiry (default 5)
```

Note: `MateriaCarrera.cuatrimestre` is `@deprecated` (grading-foundations); the inscription's
own `cuatrimestre` field is authoritative for grouping.

---

## Requirements

### BT-R1 — Dispatch: Decade-4 Branch Before Legacy Path

`buildMaterias()` MUST dispatch to `buildMateriasTerciario()` when
`Math.floor(enrollment.level / 10) === 4`, BEFORE reaching the legacy `else` branch that
reads `NotaTrimestral`. The legacy `else` branch MUST NOT be modified.

#### BT-S1.1 — Decade-4 dispatch activates for Terciario enrollment

- GIVEN an enrollment with `level = 40`
- WHEN `buildMaterias()` is called
- THEN `buildMateriasTerciario()` MUST be invoked and produce a non-empty `MateriaBoletin[]`
  when the student has at least one eligible `InscripcionMateria`

#### BT-S1.2 — Other decades are unaffected

- GIVEN an enrollment with `level = 10` (PRIMARIO)
- WHEN `buildMaterias()` is called
- THEN the decade-1 legacy path MUST handle it; `buildMateriasTerciario()` MUST NOT be called

---

### BT-R2 — Inclusion Rules

`buildMateriasTerciario()` MUST query `InscripcionMateria` filtered by
`studentId = enrollment.studentId` AND `anioAcademico = enrollment.anioAcademico`.

From those records it MUST apply the following inclusion rules:

| `InscripcionMateria.estado` | Include? | Rationale |
|-----------------------------|----------|-----------|
| `INSCRIPTO`                 | YES      | In-progress: parciales ongoing |
| `CURSANDO`                  | YES      | In-progress: parciales ongoing |
| `REGULAR`                   | YES*     | TP approved; awaiting final — unless regularidad is expired (see BT-R10) |
| `PROMOCIONAL`               | YES      | Approved without final |
| `APROBADO`                  | YES      | Approved with final |
| `LIBRE`                     | NO       | Did not pass cursada; must re-enroll |

*REGULAR with expired regularidad MUST be excluded by the post-DB expiry filter (BT-R10).
The DB query continues to include REGULAR in `where.estado.in`; expiry is applied in-memory.

The query MUST be performed via tenant Prisma client only (MUST NOT use master client).

#### BT-S2.1 — INSCRIPTO/CURSANDO materias are included

- GIVEN a student has an `InscripcionMateria` with `estado = CURSANDO` for the current `anioAcademico`
- WHEN `buildMateriasTerciario()` is called
- THEN that materia MUST appear in the result list

#### BT-S2.2 — REGULAR materia is included

- GIVEN a student has an `InscripcionMateria` with `estado = REGULAR`
- WHEN `buildMateriasTerciario()` is called
- THEN that materia MUST appear in the result list

#### BT-S2.3 — LIBRE materia is excluded

- GIVEN a student has an `InscripcionMateria` with `estado = LIBRE`
- WHEN `buildMateriasTerciario()` is called
- THEN that materia MUST NOT appear in the result list

#### BT-S2.4 — Materias from other academic years are excluded

- GIVEN a student has an `InscripcionMateria` with `anioAcademico = 2023`
  but the enrollment `anioAcademico = 2024`
- WHEN `buildMateriasTerciario()` is called
- THEN the 2023 materia MUST NOT appear in the result list

---

### BT-R3 — Slot Mapping (`slotsCursada`)

`MateriaBoletin` MUST include an optional field `slotsCursada: SlotCursadaBoletin[]`
containing exactly 5 entries, one per `SlotCursadaTerciario` enum value in canonical order:
`PARCIAL_1`, `PARCIAL_2`, `RECUPERATORIO_PARCIAL_1`, `RECUPERATORIO_PARCIAL_2`, `TP`.

Each `SlotCursadaBoletin` MUST contain:
- `slot` — the slot identifier
- `nota` — numeric grade or `null` if no record exists for that slot

When an `InscripcionMateria` has no `NotaCursadaTerciario` record for a given slot,
that slot MUST still appear in the array with `nota: null` (blank in the template).

The canonical slot order MUST be driven by the domain `SlotCursadaTerciario` VALID array
(single source of truth in `packages/domain`) — not hardcoded only in the use case.

#### BT-S3.1 — Five slots always present

- GIVEN an `InscripcionMateria` with only PARCIAL_1 graded (nota 7) and no other records
- WHEN the slot array is built
- THEN `slotsCursada` MUST contain exactly 5 entries; PARCIAL_1 has `nota: 7`;
  all other four entries have `nota: null`

#### BT-S3.2 — All slots populated

- GIVEN an `InscripcionMateria` with all 5 `NotaCursadaTerciario` records
- WHEN the slot array is built
- THEN `slotsCursada` MUST contain exactly 5 entries, each with its corresponding `nota`

#### BT-S3.3 — Slots absent when inscripcion has no notas

- GIVEN an `InscripcionMateria` with zero `NotaCursadaTerciario` records
- WHEN the slot array is built
- THEN `slotsCursada` MUST contain exactly 5 entries, all with `nota: null`

---

### BT-R4 — Nota de Cursada and Condición (`notaCursadaConfirmada`, `condicionCursada`)

`MateriaBoletin` MUST include:
- `notaCursadaConfirmada: number | null` — sourced from `InscripcionMateria.notaCursada`
  (the confirmed float written by secretaría in Fase A). MUST be `null` when absent.
  MUST NOT be recomputed from slots.
- `condicionCursada: string | null` — maps `InscripcionMateria.estado` to a human-readable
  Spanish label (`"Inscripto"`, `"Cursando"`, `"Regular"`, `"Promocional"`, `"Aprobado"`).
  MUST be `null` only when the estado value cannot be mapped.

#### BT-S4.1 — condicionCursada maps estado REGULAR

- GIVEN an `InscripcionMateria` with `estado = REGULAR`
- WHEN the boletín is generated
- THEN `condicionCursada` MUST equal `"Regular"`

#### BT-S4.2 — notaCursadaConfirmada is null for in-progress materia

- GIVEN an `InscripcionMateria` with `estado = CURSANDO` and no confirmed nota
  (`notaCursada` is null)
- WHEN the boletín is generated
- THEN `notaCursadaConfirmada` MUST be `null`

---

### BT-R5 — Final Exam Attempts (`intentosFinales`)

`MateriaBoletin` MUST include `intentosFinales: IntentoFinalBoletin[]`.

`IntentoFinalBoletin` MUST contain at minimum:
- `intento` — the attempt number from `ActaExamenNota.intento`
- `nota` — the grade recorded
- `condicion` — the outcome (`"Aprobado"`, `"Desaprobado"`, `"Ausente"`)

The system MUST include ALL `ActaExamenNota` records linked to the included `InscripcionMateria`
regardless of the `ActaExamen.fecha` year (all-time per inscripcion, transcript semantics).

**Vencimiento de regularidad:** expired REGULAR materias are excluded from the boletín entirely
by BT-R10 (resolved by change: vencimiento-regularidad-terciario 2026-06-19). If a materia
reaches this point it has passed the expiry filter and `intentosFinales` MUST be included normally.

When no final attempts exist, `intentosFinales` MUST be an empty array `[]`.

Results MUST be ordered chronologically (`ActaExamen.fecha asc`, then `intento asc`).

#### BT-S5.1 — Multiple finales shown all-time

- GIVEN an `InscripcionMateria` linked to 3 `ActaExamenNota` records across different years
- WHEN the boletín is generated
- THEN `intentosFinales` MUST contain all 3 records in chronological order

#### BT-S5.2 — No finales produces empty array

- GIVEN an `InscripcionMateria` with `estado = REGULAR` and zero `ActaExamenNota` records
- WHEN the boletín is generated
- THEN `intentosFinales` MUST be `[]`

#### BT-S5.3 — LIBRE inscripcion has no intentosFinales in output

- GIVEN an `InscripcionMateria` with `estado = LIBRE`
- WHEN the boletín is generated
- THEN that inscripcion MUST NOT appear at all (BT-R2 excludes it);
  its `ActaExamenNota` records MUST NOT be surfaced

---

### BT-R6 — Carrera Header

`DatosBoletin` MUST include a `carreraName` field resolved as follows:

1. MUST attempt to resolve via `InscripcionMateria → MateriaCarrera → Carrera.name`.
2. If `Carrera.name` is present and non-empty, MUST use that value.
3. If `Carrera.name` is absent or empty, MUST fall back to `enrollment.grade`.
4. If both are absent/empty, the field MUST be `null` and the template MUST render
   an empty string (no crash, no placeholder text).

#### BT-S6.1 — Carrera name resolved from Carrera model

- GIVEN the student's inscripciones link to a `MateriaCarrera` with `Carrera.name = "Profesorado de Lengua"`
- WHEN the boletín is generated
- THEN the header MUST display `"Profesorado de Lengua"`

#### BT-S6.2 — Fallback to enrollment.grade when Carrera.name is absent

- GIVEN `Carrera.name` is null or empty AND `enrollment.grade = "Tecnicatura en Informática"`
- WHEN the boletín is generated
- THEN the header MUST display `"Tecnicatura en Informática"`

#### BT-S6.3 — Both absent renders empty string

- GIVEN `Carrera.name` is null AND `enrollment.grade` is null
- WHEN the boletín is generated
- THEN the header MUST render an empty string (no crash, no "null" text)

---

### BT-R7 — Both Cuatrimestres Grouped (1C + 2C)

The boletín MUST display materias from both `1C` and `2C` of the `anioAcademico`, grouped
by cuatrimestre. Grouping MUST be performed in the use case (not in the Handlebars template),
delivered via `DatosBoletin.cuatrimestresTerciario: GrupoCuatrimestreBoletin[]`.

Materias with no cuatrimestre assignment MUST be included in an "ANUAL" or other group
(sorted after 1C and 2C).

`MateriaCarrera.cuatrimestre` MUST NOT be read (it is `@deprecated`).
The grouping axis MUST be `InscripcionMateria.cuatrimestre`.

#### BT-S7.1 — 1C and 2C materias both appear

- GIVEN a student has one `InscripcionMateria` with `cuatrimestre = "1C"` and one with `cuatrimestre = "2C"`,
  both in the same `anioAcademico`, both with eligible `estado`
- WHEN the boletín is generated
- THEN both materias MUST appear, grouped by cuatrimestre (1C first, then 2C)

#### BT-S7.2 — Materias without cuatrimestre are not lost

- GIVEN a student has an `InscripcionMateria` with no cuatrimestre field set
- WHEN the boletín is generated
- THEN that materia MUST still appear in the output (in ANUAL/other group)

---

### BT-R8 — Queries: No N+1

`buildMateriasTerciario()` MUST NOT issue per-materia database queries.
All related data (`NotaCursadaTerciario`, `ActaExamenNota` via `ActaExamen`, `MateriaCarrera`,
`Carrera`, `Subject`, `LlamadoExamen` for expiry) MUST be fetched in a constant number of
queries (≤ 3) regardless of the number of materias.

> Updated by change: vencimiento-regularidad-terciario (2026-06-19) — budget raised from ≤2 to ≤3
> to accommodate Q3 (bulk llamados load for expiry filter).

Implementation: 3 queries:
- Q1: `inscripcionMateria.findMany` with full include chain
  (`notasCursada`, `materiaCarrera.{subject, carrera}`) — also loads `llamadosVencimiento`
  via `carrera` after the schema migration
- Q2: `actaExamenNota.findMany` bulk by `materiaCarreraId IN [...]`,
  short-circuited to `[]` when there are zero included inscripciones
- Q3: `llamadoExamen.findMany` for the academic year (active, not soft-deleted) —
  loaded ONCE, used in-memory for all REGULAR expiry checks (ADR-2)

#### BT-S8.1 — Constant query set for all data

- GIVEN a student with 10 eligible `InscripcionMateria` records
- WHEN `buildMateriasTerciario()` is called
- THEN `inscripcionMateria.findMany` MUST be called exactly once
- AND `actaExamenNota.findMany` MUST be called exactly once
- AND `llamadoExamen.findMany` MUST be called exactly once (Q3, for expiry filter)

---

### BT-R10 — Expiry Filter: Exclude Expired REGULAR Materias

> Introduced by change: vencimiento-regularidad-terciario (2026-06-19).
> Resolves DEFERRED-1 from the original boletin-terciario spec.

`buildMateriasTerciario()` MUST exclude from its output any `InscripcionMateria` where ALL of
the following hold:
- `inscripcion.estado === REGULAR`
- `inscripcion.fechaRegularidad !== null`
- The count of active `LlamadoExamen` records with `fechaInicio > inscripcion.fechaRegularidad`
  is `>= carrera.llamadosVencimiento`

The exclusion MUST be applied as a **post-DB in-memory filter** AFTER the existing Prisma Q1
query and AFTER building `materiasFlat`, but BEFORE cuatrimestre grouping. The DB query
(`where.estado.in`) MUST continue to include `REGULAR` unchanged.

A single bulk load of the year's active `LlamadoExamen` records (Q3) MUST be used to compute
the count for all REGULAR inscripciones without N+1 queries.

Expired REGULAR materias MUST be **silently excluded** — no `"VENCIDA"` label or expiry
indicator MUST appear in the boletín response.

When `inscripcion.fechaRegularidad` is `null`, the materia MUST be included (treated as
non-expired — backfill safety).

#### BT-S10.1 — Expired REGULAR materia excluded

- GIVEN a student has an `InscripcionMateria` with `estado = REGULAR`, `fechaRegularidad = T0`
- AND `Carrera.llamadosVencimiento = 5`
- AND 5 active `LlamadoExamen` records with `fechaInicio > T0` exist
- WHEN `buildMateriasTerciario()` is called
- THEN that materia MUST NOT appear in the output
- AND no `"VENCIDA"` label MUST appear in the response

#### BT-S10.2 — Non-expired REGULAR materia included

- GIVEN a student has an `InscripcionMateria` with `estado = REGULAR`, `fechaRegularidad = T0`
- AND `Carrera.llamadosVencimiento = 5`
- AND 3 active `LlamadoExamen` records with `fechaInicio > T0` exist
- WHEN `buildMateriasTerciario()` is called
- THEN that materia MUST appear in the output with `condicionCursada = "Regular"`

#### BT-S10.3 — NULL fechaRegularidad included (backfill safety)

- GIVEN a student has an `InscripcionMateria` with `estado = REGULAR`, `fechaRegularidad = null`
- AND any number of `LlamadoExamen` records exist
- WHEN `buildMateriasTerciario()` is called
- THEN that materia MUST appear in the output (treated as non-expired)

#### BT-S10.4 — Q3 loaded exactly once regardless of REGULAR count

- GIVEN a student has 5 REGULAR `InscripcionMateria` records
- WHEN `buildMateriasTerciario()` is called
- THEN `llamadoExamen.findMany` MUST be called exactly once (no N+1)

---

### BT-R9 — Test Coverage

All new logic in `buildMateriasTerciario()` and the updated `MateriaBoletin` type transformations
MUST be covered by unit tests.
Coverage for `generate-boletin.use-case.ts` MUST be ≥ 80%.

**Implemented:** `api/src/application/reportes/__tests__/generate-boletin.terciario.test.ts`
(24 tests: 21 Terciario scenarios + 3 legacy regression tests). Coverage: 85.6% stmt / 87.64% lines.

---

## Type Additions (backward-compatible)

The following optional fields were added to `MateriaBoletin` in
`api/src/application/reportes/templates/boletin.template.ts`:

```ts
slotsCursada?:           SlotCursadaBoletin[];
notaCursadaConfirmada?:  number | null;
condicionCursada?:       string | null;
intentosFinales?:        IntentoFinalBoletin[];
cuatrimestre?:           string;
```

New supporting types:

```ts
SlotCursadaBoletin  { slot: SlotCursadaTerciarioValue; nota: number | null }
IntentoFinalBoletin { intento: number; nota: number; condicion: string }
GrupoCuatrimestreBoletin { cuatrimestre: string; materias: MateriaBoletin[] }
```

New fields added to `DatosBoletin`:

```ts
carreraName?:              string | null;
cuatrimestresTerciario?:   GrupoCuatrimestreBoletin[];
```

All additions are optional — existing levels that build `MateriaBoletin` without these fields
continue to compile and render correctly.

---

## Out of Scope (explicitly deferred)

### DEFERRED-1 — Vencimiento de regularidad ✓ RESOLVED

~~No expiry model exists in the current schema.~~

**Resolved by:** change `vencimiento-regularidad-terciario` (2026-06-19).
**Implementation:** BT-R10 (post-DB expiry filter) and BT-R8 (Q3 query budget update).
Expired REGULAR materias are silently excluded from the boletín (no VENCIDA label).
See `nivel-terciario` spec for the full expiry rule (on-the-fly computation, no background job).

### DEFERRED-2 — NotaTrimestral legacy retirement for Terciario

The legacy `else` branch that reads `NotaTrimestral` / `CourseCycles` is now unreachable for
Terciario students (decade-4 dispatches before it), but the code was NOT deleted here.
Full retirement of that path requires verifying that no other decade still relies on it.

**Deferred to:** a future cleanup change, after confirming which levels (if any) still reach
the legacy `else` branch.

### DEFERRED-3 — BoletínTemplate dead-code hierarchy

The class hierarchy `BoletínTemplate` / `BoletínTerciario` (etc.) in `boletin.template.ts` is
dead code relative to the PDF generation path (HBS + `DatosBoletin` is what actually renders).
It was NOT modified or removed here.

**Deferred to:** a future cleanup change to avoid risk in this focused change.

### DEFERRED-4 — Docente entry / grade input from teachers

Authz of a Terciario docente to enter cursada grades is out of scope (planned as Fase D).
Only secretaría-side reads are covered in this change.

---

## ADRs

| ADR | Decision |
|-----|----------|
| ADR-1 | Approach A: raw tenant Prisma in the use case, no new DI. Mirrors the legacy/Inicial precedent; the include chain does all joins in one query. Approach B (inject repositories) rejected — domain interface churn for a read-only report path. |
| ADR-2 | Slot order driven by domain `SlotCursadaTerciario` VALID array — single source of truth. DB stores `slot` as a free String, so canonical order must be imposed at assembly time. |
| ADR-3 | `notaCursadaConfirmada = InscripcionMateria.notaCursada` (not recomputed from slots). Fase A writes the confirmed grade to that float; recomputing would duplicate domain logic and could diverge. |
| ADR-4 | Finales scoped by `materiaCarreraId` linkage, all-time (no fecha/year filter). `ActaExamen` has no `anioAcademico`; transcript semantics include every intento of an included inscripcion. Vencimiento out of scope. |
| ADR-5 | Cuatrimestre grouping done in use case via `DatosBoletin.cuatrimestresTerciario`, keyed on `InscripcionMateria.cuatrimestre`. Clean-arch: presentation logic stays out of Handlebars. `MateriaCarrera.cuatrimestre` is `@deprecated` and MUST NOT be read. |
| ADR-6 | Three queries (≤3 budget). Carrera resolved inside Q1. Finales bulk via `actaExamenNota.where.acta.materiaCarreraId IN`. Q3 added for expiry (see ADR-7). Prisma `orderBy` on to-one relation (R1) uses in-memory sort fallback if rejected at runtime. |
| ADR-7 | Expiry filter (BT-R10): bulk-load all year llamados ONCE (Q3) → in-memory count per REGULAR inscripcion. Rejected: per-inscripcion `countAfter` DB call (N+1). Bulk is correct because LlamadoExamen are institution-wide and few per academic year. (Introduced by change: vencimiento-regularidad-terciario 2026-06-19) |
