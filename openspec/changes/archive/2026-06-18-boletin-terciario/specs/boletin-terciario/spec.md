# Delta Spec: Boletín Terciario (Fase C)

**Nivel pedagógico:** TERCIARIO
**Change:** boletin-terciario
**Depends on:** evaluacion-terciario (feat/evaluacion-terciario, PR #23)

---

## Context

Today, `GenerateBoletinUseCase.buildMaterias()` dispatches by decade (`Math.floor(level / 10)`).
Level 40–49 (TERCIARIO) falls into the `else` legacy branch that reads `CourseCycles → NotaTrimestral`
— tables that do not exist for Terciario students. The result is always an empty boletín.

`evaluacion-terciario` (Fase A+B) created `NotaCursadaTerciario` and `ActaExamenNota.intento`.
This change wires the boletín to those models.

---

## Requirements

### REQ-1: Dispatch — Decade-4 Branch

`buildMaterias()` MUST dispatch to `buildMateriasTerciario()` when
`Math.floor(enrollment.level / 10) === 4`, BEFORE reaching the legacy `else` branch.
The legacy `else` branch MUST NOT be modified.

#### Scenario 1.1 — Dispatch activates for decade-4 enrollment

- GIVEN an enrollment with `level = 40`
- WHEN `buildMaterias()` is called
- THEN `buildMateriasTerciario()` MUST be invoked, producing a non-empty `MateriaBoletin[]`
  when the student has at least one eligible `InscripcionMateria`

#### Scenario 1.2 — Other decades are unaffected

- GIVEN an enrollment with `level = 10` (PRIMARIO)
- WHEN `buildMaterias()` is called
- THEN the decade-1 legacy path MUST handle it; `buildMateriasTerciario()` MUST NOT be called

---

### REQ-2: Inclusion Rules

`buildMateriasTerciario()` MUST query `InscripcionMateria` filtered by
`studentId = enrollment.studentId` AND `anioAcademico = enrollment.anioAcademico`.

From those `InscripcionMateria` records it MUST apply the following inclusion rules:

| `InscripcionMateria.estado` | Include? | Rationale |
|-----------------------------|----------|-----------|
| `INSCRIPTO`                 | YES      | In-progress: parciales ongoing |
| `CURSANDO`                  | YES      | In-progress: parciales ongoing |
| `REGULAR`                   | YES      | TP approved; awaiting final |
| `PROMOCIONAL`               | YES      | Approved without final |
| `APROBADO`                  | YES      | Approved with final |
| `LIBRE`                     | NO       | Did not pass cursada; must re-enroll |

The query MUST be performed via tenant Prisma client only (MUST NOT use master client).

#### Scenario 2.1 — INSCRIPTO/CURSANDO materias are included

- GIVEN a student has an `InscripcionMateria` with `estado = CURSANDO`
  for the current `anioAcademico`
- WHEN `buildMateriasTerciario()` is called
- THEN that materia MUST appear in the result list

#### Scenario 2.2 — REGULAR materia is included

- GIVEN a student has an `InscripcionMateria` with `estado = REGULAR`
- WHEN `buildMateriasTerciario()` is called
- THEN that materia MUST appear in the result list

#### Scenario 2.3 — LIBRE materia is excluded

- GIVEN a student has an `InscripcionMateria` with `estado = LIBRE`
- WHEN `buildMateriasTerciario()` is called
- THEN that materia MUST NOT appear in the result list

#### Scenario 2.4 — Materias from other academic years are excluded

- GIVEN a student has an `InscripcionMateria` with `anioAcademico = 2023`
  but the enrollment `anioAcademico = 2024`
- WHEN `buildMateriasTerciario()` is called
- THEN the 2023 materia MUST NOT appear in the result list

---

### REQ-3: Slot Mapping (`slotsCursada`)

`MateriaBoletin` MUST include an optional field `slotsCursada: SlotCursadaBoletin[]`
containing exactly up to 5 entries, one per `SlotCursadaTerciario` enum value in order:
`PARCIAL_1`, `PARCIAL_2`, `RECUPERATORIO_PARCIAL_1`, `RECUPERATORIO_PARCIAL_2`, `TP`.

Each `SlotCursadaBoletin` MUST contain:
- `slot` — the slot identifier
- `nota` — numeric grade or `null` if no record exists for that slot

When an `InscripcionMateria` has no `NotaCursadaTerciario` records for a given slot,
that slot MUST still appear in the array with `nota: null` (blank in the template).

#### Scenario 3.1 — Five slots always present

- GIVEN an `InscripcionMateria` with only PARCIAL_1 graded (nota 7) and no other records
- WHEN the slot array is built
- THEN `slotsCursada` MUST contain exactly 5 entries; PARCIAL_1 has `nota: 7`;
  all other four entries have `nota: null`

#### Scenario 3.2 — All slots populated

- GIVEN an `InscripcionMateria` with all 5 `NotaCursadaTerciario` records
- WHEN the slot array is built
- THEN `slotsCursada` MUST contain exactly 5 entries, each with its corresponding `nota`

#### Scenario 3.3 — Slots absent when inscripcion has no notas

- GIVEN an `InscripcionMateria` with zero `NotaCursadaTerciario` records
- WHEN the slot array is built
- THEN `slotsCursada` MUST contain exactly 5 entries, all with `nota: null`

---

### REQ-4: Nota de Cursada and Condición (`notaCursadaConfirmada`, `condicionCursada`)

`MateriaBoletin` MUST include:
- `notaCursadaConfirmada: number | null` — the confirmed (final) cursada grade,
  derived from the relevant `NotaCursadaTerciario` slot or a summary field if available.
  MUST be `null` when no confirmed grade exists.
- `condicionCursada: string | null` — maps to `InscripcionMateria.estado` rendered as
  a human-readable label (e.g. `"Regular"`, `"Aprobado"`, `"Cursando"`).
  MUST be `null` only when `estado` cannot be mapped.

#### Scenario 4.1 — condicionCursada maps estado REGULAR

- GIVEN an `InscripcionMateria` with `estado = REGULAR`
- WHEN the boletín is generated
- THEN `condicionCursada` MUST equal `"Regular"` (or the canonical Spanish label)

#### Scenario 4.2 — notaCursadaConfirmada is null for in-progress materia

- GIVEN an `InscripcionMateria` with `estado = CURSANDO` and no confirmed nota
- WHEN the boletín is generated
- THEN `notaCursadaConfirmada` MUST be `null`

---

### REQ-5: Final Exam Attempts (`intentosFinales`)

`MateriaBoletin` MUST include `intentosFinales: IntentoFinalBoletin[]`.

`IntentoFinalBoletin` MUST contain at minimum:
- `intento` — the attempt number from `ActaExamenNota.intento`
- `nota` — the grade recorded
- `condicion` — the outcome (e.g. `"Aprobado"`, `"Desaprobado"`, `"Ausente"`)

The system MUST include ALL `ActaExamenNota` records linked to the included `InscripcionMateria`
regardless of the `ActaExamen.fecha` year (all-time per inscripcion).
Vencimiento (expiry) filtering MUST NOT be applied in this change.

When no final attempts exist for an inscripcion, `intentosFinales` MUST be an empty array `[]`.

#### Scenario 5.1 — Multiple finales shown all-time

- GIVEN an `InscripcionMateria` linked to 3 `ActaExamenNota` records across different years
- WHEN the boletín is generated
- THEN `intentosFinales` MUST contain all 3 records in chronological order

#### Scenario 5.2 — No finales produces empty array

- GIVEN an `InscripcionMateria` with `estado = REGULAR` and zero `ActaExamenNota` records
- WHEN the boletín is generated
- THEN `intentosFinales` MUST be `[]`

#### Scenario 5.3 — LIBRE inscripcion has no intentosFinales in output

- GIVEN an `InscripcionMateria` with `estado = LIBRE`
- WHEN the boletín is generated
- THEN that inscripcion MUST NOT appear at all (REQ-2 already excludes it);
  its `ActaExamenNota` records MUST NOT be surfaced

---

### REQ-6: Carrera Header

`DatosBoletin` (or the equivalent top-level struct passed to the HBS template) MUST include
a `carreraName` field resolved as follows:

1. MUST attempt to resolve via `InscripcionMateria → MateriaCarrera → Carrera.name`.
2. If `Carrera.name` is present and non-empty, MUST use that value.
3. If `Carrera.name` is absent or empty, MUST fall back to `enrollment.grade`.
4. If both are absent/empty, the field MUST be `null` and the template MUST render
   an empty string (no crash, no placeholder text).

#### Scenario 6.1 — Carrera name resolved from Carrera model

- GIVEN the student's `InscripcionMateria` links to a `MateriaCarrera` with `Carrera.name = "Profesorado de Lengua"`
- WHEN the boletín is generated
- THEN the header MUST display `"Profesorado de Lengua"`

#### Scenario 6.2 — Fallback to enrollment.grade when Carrera.name is absent

- GIVEN `Carrera.name` is null or empty AND `enrollment.grade = "Tecnicatura en Informática"`
- WHEN the boletín is generated
- THEN the header MUST display `"Tecnicatura en Informática"`

#### Scenario 6.3 — Both absent renders empty string

- GIVEN `Carrera.name` is null AND `enrollment.grade` is null
- WHEN the boletín is generated
- THEN the header MUST render an empty string (no crash, no undefined or "null" text)

---

### REQ-7: Both Cuatrimestres Grouped (1C + 2C)

The boletín MUST display materias from both `1C` and `2C` of the `anioAcademico`.
Materias MUST be grouped by cuatrimestre when the data includes a cuatrimestre field.
If a materia has no cuatrimestre assignment, it MUST be included in an "other / annual" group.

#### Scenario 7.1 — 1C and 2C materias both appear

- GIVEN a student has one `InscripcionMateria` with `cuatrimestre = "1C"` and one with `cuatrimestre = "2C"`,
  both in the same `anioAcademico`, both with eligible `estado`
- WHEN the boletín is generated
- THEN both materias MUST appear, grouped by cuatrimestre

#### Scenario 7.2 — Materias without cuatrimestre are not lost

- GIVEN a student has an `InscripcionMateria` with no cuatrimestre field set
- WHEN the boletín is generated
- THEN that materia MUST still appear in the output

---

### REQ-8: Queries — No N+1

`buildMateriasTerciario()` MUST NOT issue per-materia database queries.
All related data (`NotaCursadaTerciario`, `ActaExamenNota` via `ActaExamen`, `MateriaCarrera`,
`Carrera`, `Subject`) MUST be fetched in a single Prisma query using `include` chains.
The total number of queries MUST be constant regardless of the number of materias.

#### Scenario 8.1 — Single query for all data

- GIVEN a student with 10 eligible `InscripcionMateria` records
- WHEN `buildMateriasTerciario()` is called
- THEN the underlying database query count MUST be 1 (or a small constant,
  ≤ 2 if a separate header query is needed for `Carrera` name resolution)

---

### REQ-9: Test Coverage

All new logic in `buildMateriasTerciario()` and the updated `MateriaBoletin` type transformations
MUST be covered by unit tests.
Coverage for the affected files MUST be ≥ 80%.

---

## Out of Scope (explicitly deferred)

- **Vencimiento de regularidad**: no expiry model exists in the current schema.
  This change MUST NOT add expiry filtering. Deferred to a future change.
- **Retiro del path legacy `NotaTrimestral`**: other levels depend on it; not touched.
- **Docente entry / grade input**: outside the reporting read-path.
- **`BoletínTemplate` class hierarchy**: dead code relative to the PDF path; not modified.

---

## Type Additions (non-normative summary for implementors)

The following optional fields MUST be added to `MateriaBoletin`
(exact types defined in `boletin.template.ts`):

```
slotsCursada?:         SlotCursadaBoletin[]     // 5-entry fixed-order array
notaCursadaConfirmada?: number | null
condicionCursada?:     string | null
intentosFinales?:      IntentoFinalBoletin[]
```

New supporting types:

```
SlotCursadaBoletin  { slot: SlotCursadaTerciario; nota: number | null }
IntentoFinalBoletin { intento: number; nota: number; condicion: string }
```

These additions MUST be backward-compatible (all optional) so existing levels
that build `MateriaBoletin` objects without these fields continue to compile and render correctly.
