# Design: Boletín Terciario (Fase C)

**Nivel pedagógico:** TERCIARIO (decade 4, level 40–49)
**Change:** boletin-terciario · **Depends on:** evaluacion-terciario (`feat/evaluacion-terciario`, PR #23)
**Architecture:** Clean Architecture (use-case orchestration), tenant Prisma only, Result-by-return (no throw in domain), Vitest + strict TDD ≥80%.

---

## 0. Resolution of the three open spec risks (grounded in REAL schema)

Read from `api/prisma_tenant/schema.prisma` (lines 1084–1225) and `packages/domain/src/terciario/value-objects/slot-cursada-terciario.ts`.

| Risk | Spec assumption | REAL finding | Decision |
|------|-----------------|--------------|----------|
| (a) Cuatrimestre axis | "likely `MateriaCarrera.cuatrimestre`" (CLAUDE.md guess) | **`InscripcionMateria.cuatrimestre` (String, line 1149) is the authoritative per-student axis.** `MateriaCarrera.cuatrimestre` (line 1108) ALSO exists but is marked `@deprecated grading-foundations: reemplazado por GradingPeriodDate`. The `InscripcionMateria` `@@unique` is `[studentId, materiaCarreraId, cuatrimestre, anioAcademico]` — cuatrimestre is part of the inscription identity. | **Group by `InscripcionMateria.cuatrimestre`.** Values seen: `"1C"`, `"2C"`, `"ANUAL"`. Never read the deprecated `MateriaCarrera.cuatrimestre`. |
| (b) `SlotCursadaTerciario` order | enum order unknown | **Canonical `VALID` array** in `slot-cursada-terciario.ts`: `PARCIAL_1`, `PARCIAL_2`, `RECUPERATORIO_PARCIAL_1`, `RECUPERATORIO_PARCIAL_2`, `TP`. Stored in DB as a plain `String` column (`NotaCursadaTerciario.slot`), NOT a Prisma enum. | **Drive the 5-slot array from the domain `SlotCursadaTerciario` VALID order** (single source of truth). Matches spec REQ-3 exactly. |
| (c) `notaCursadaConfirmada` source | "NotaCursadaTerciario slot or summary field" | **`InscripcionMateria.notaCursada` (`Float?`, line 1152)** is the confirmed cursada grade written in Fase A. There is also `InscripcionMateria.notaFinal Float?` (the final-exam outcome, distinct). | **`notaCursadaConfirmada = inscripcion.notaCursada` (null when absent).** Do NOT recompute from slots; the float is the confirmed value. `notaFinal` is out of scope for this field (it surfaces via `intentosFinales`). |

Additional confirmed schema facts:
- `InscripcionMateria.estado` is a **`String`** (not a Prisma enum) — comment line 1151 lists `INSCRIPTO|CURSANDO|REGULAR|APROBADO|LIBRE` + `PROMOCIONAL` (ADR-1). A Prisma `where estado: { in: [...] }` filter is valid.
- `InscripcionMateria.notasCursada` is the relation to `NotaCursadaTerciario[]` (line 1157) — directly includable.
- `MateriaCarrera` relations: `subject Subject` and `carrera Carrera` (line 1112) — both includable in one chain. `Carrera.name` (line 1086, non-null in schema but treat defensively per REQ-6).
- `ActaExamen` has `materiaCarreraId` + `fecha` (DateTime) but **no `anioAcademico`** — confirmed. `ActaExamenNota` has `studentId`, `nota Float`, `condicion String` (`APROBADO|DESAPROBADO|AUSENTE`), `intento Int @default(1)`, and `@@unique([actaId, studentId])`.

---

## 1. Dispatch change (REQ-1)

Insert a decade-4 branch in `buildMaterias()` **before** the legacy `else` (the `if (!enrollment.cycleId)` block at line ~223). Mirror the Inicial branch shape (no repo gating — the Terciario path uses raw tenant Prisma, Approach A).

```ts
// ── Terciario path (decade 4) — inserted BEFORE legacy NotaTrimestral ──
if (Math.floor(enrollment.level / 10) === 4) {
  return this.buildMateriasTerciario(client, enrollment);
}
```

- The legacy `else` is left byte-for-byte unchanged (REQ-1, Out-of-Scope).
- No change to `reportes.module.ts` / DI — `buildMateriasTerciario` takes only `(client, enrollment)` (Approach A).
- The `buildMaterias` param type and its return type are widened (see §6) to carry `grade` (for the carrera fallback) and the new optional `carreraName` + grouped output.

`enrollment.level = 40` → Scenario 1.1 routes here; `level = 10/20/30` → existing branches (Scenario 1.2). `getBaseLevel(40) === 'TERCIARIO'` already selects `boletin-terciario.hbs` (line 77), so template wiring is unchanged.

---

## 2. `buildMateriasTerciario` — query plan (REQ-2, REQ-8: NO N+1)

Two bulk queries, constant regardless of materia count.

### Query 1 — inscripciones + full include chain (1 query)

```ts
const ESTADOS_INCLUIDOS = ['INSCRIPTO', 'CURSANDO', 'REGULAR', 'PROMOCIONAL', 'APROBADO'] as const;

const inscripciones = await client.inscripcionMateria.findMany({
  where: {
    studentId: enrollment.studentId,
    anioAcademico: enrollment.academicYear,
    estado: { in: [...ESTADOS_INCLUIDOS] },   // LIBRE excluded at the DB (REQ-2)
  },
  include: {
    notasCursada: true,                        // NotaCursadaTerciario[] (slots)
    materiaCarrera: { include: { subject: true, carrera: true } },
  },
  orderBy: [{ cuatrimestre: 'asc' }, { materiaCarreraId: 'asc' }],
});
```

- `estado: { in: ... }` filters LIBRE (and any unknown estado) out at the database (REQ-2, Scenario 2.3). `anioAcademico = enrollment.academicYear` enforces year scoping (Scenario 2.4).
- `notasCursada`, `materiaCarrera.subject`, `materiaCarrera.carrera` arrive in **one** query via the include chain (REQ-8, Scenario 8.1). No per-materia query.
- Empty result → return empty materias (no throw).

### Query 2 — finales (all-time per inscripcion) (1 query)

```ts
const materiaCarreraIds = [...new Set(inscripciones.map(i => i.materiaCarreraId))];

const notasFinales = materiaCarreraIds.length === 0 ? [] :
  await client.actaExamenNota.findMany({
    where: {
      studentId: enrollment.studentId,
      acta: { materiaCarreraId: { in: materiaCarreraIds }, active: true },
    },
    include: { acta: { select: { materiaCarreraId: true, fecha: true } } },
    orderBy: [{ acta: { fecha: 'asc' } }, { intento: 'asc' }],   // chronological (REQ-5 Sc 5.1)
  });
```

- **Total = 2 queries.** Within REQ-8's `≤2` budget. Carrera name is resolved inside Query 1 — no separate header query.
- All-time scoping (REQ-5): no `anioAcademico`/`fecha` filter on finales beyond the materiaCarrera linkage. Vencimiento is explicitly NOT applied (Out-of-Scope).
- `acta.active: true` excludes soft-deleted actas.
- LIBRE inscripciones never enter `materiaCarreraIds` (excluded in Query 1), so their finales are never surfaced (REQ-5, Scenario 5.3).

> **Edge note:** `MateriaCarrera` is unique on `[carreraId, subjectId, anio, cuatrimestre]`, so one `materiaCarreraId` maps to exactly one (subject, anio, cuatrimestre) cell. Finales are grouped back onto inscripciones by `materiaCarreraId` (see §3.3). A `materiaCarreraId` shared by two included inscripciones in the same year is not expected given the inscription `@@unique`, but the assembly tolerates it (finales attach to each matching inscripcion).

---

## 3. In-memory assembly (per included inscripcion)

### 3.1 Slot mapping → exactly 5 ordered entries (REQ-3)

```ts
import { SlotCursadaTerciario } from '@educandow/domain'; // or local SLOT_ORDER const

const SLOT_ORDER = ['PARCIAL_1','PARCIAL_2','RECUPERATORIO_PARCIAL_1','RECUPERATORIO_PARCIAL_2','TP'] as const;

const notaBySlot = new Map(insc.notasCursada.map(n => [n.slot, n.nota]));
const slotsCursada: SlotCursadaBoletin[] = SLOT_ORDER.map(slot => ({
  slot,
  nota: notaBySlot.get(slot) ?? null,   // absent slot → null (blank in template)
}));
```

- Always 5 entries in canonical order regardless of how many records exist (Scenarios 3.1, 3.2, 3.3).
- `SLOT_ORDER` should be sourced from / asserted against the domain `SlotCursadaTerciario` VALID array so the two never drift (ADR-2).

### 3.2 notaCursadaConfirmada + condicionCursada (REQ-4)

```ts
const notaCursadaConfirmada = insc.notaCursada ?? null;        // risk (c) resolution

const CONDICION_LABEL: Record<string,string> = {
  INSCRIPTO: 'Inscripto', CURSANDO: 'Cursando', REGULAR: 'Regular',
  PROMOCIONAL: 'Promocional', APROBADO: 'Aprobado',
};
const condicionCursada = CONDICION_LABEL[insc.estado] ?? null; // null only when unmappable
```

- CURSANDO with no confirmed nota → `notaCursadaConfirmada: null` (Scenario 4.2).
- REGULAR → `condicionCursada: "Regular"` (Scenario 4.1).

### 3.3 intentosFinales assembly (REQ-5)

```ts
// index finales by materiaCarreraId (from Query 2)
const finalesByMC = new Map<string, typeof notasFinales>();
for (const n of notasFinales) {
  const k = n.acta.materiaCarreraId;
  (finalesByMC.get(k) ?? finalesByMC.set(k, []).get(k)!).push(n);
}

const CONDICION_FINAL_LABEL: Record<string,string> = {
  APROBADO: 'Aprobado', DESAPROBADO: 'Desaprobado', AUSENTE: 'Ausente',
};
const intentosFinales: IntentoFinalBoletin[] =
  (finalesByMC.get(insc.materiaCarreraId) ?? []).map(n => ({
    intento: n.intento,
    nota: n.nota,
    condicion: CONDICION_FINAL_LABEL[n.condicion] ?? n.condicion,
  }));
```

- Already ordered chronologically by the Query 2 `orderBy` (Scenario 5.1).
- No finales → `[]` (Scenario 5.2).

### 3.4 Carrera header resolution (REQ-6)

Resolved once per enrollment from the first inscripcion's `materiaCarrera.carrera.name`:

```ts
const carreraNameRaw = inscripciones[0]?.materiaCarrera?.carrera?.name?.trim();
const carreraName: string | null =
  (carreraNameRaw && carreraNameRaw.length > 0) ? carreraNameRaw
  : (enrollment.grade?.trim() || null);   // fallback → enrollment.grade, else null
```

- Carrera.name present → use it (Scenario 6.1).
- Absent/empty → `enrollment.grade` (Scenario 6.2).
- Both absent → `null`; template renders empty string via `{{carreraName}}` (Handlebars renders `null`/`undefined` as empty) (Scenario 6.3). No placeholder text, no crash.

### 3.5 Cuatrimestre grouping (REQ-7)

```ts
const CUATRI_ORDER = (c: string) => ({ '1C': 0, '2C': 1 } as Record<string,number>)[c] ?? 2; // ANUAL/other last

// build flat materias[], each carrying its cuatrimestre, then group:
const grupos = new Map<string, MateriaBoletin[]>();
for (const m of materiasFlat) (grupos.get(m.cuatrimestre) ?? grupos.set(m.cuatrimestre, []).get(m.cuatrimestre)!).push(m);

const cuatrimestresTerciario = [...grupos.entries()]
  .sort(([a],[b]) => CUATRI_ORDER(a) - CUATRI_ORDER(b))
  .map(([cuatrimestre, materias]) => ({ cuatrimestre, materias }));
```

- Both 1C and 2C appear, grouped (Scenario 7.1).
- A materia with empty/missing cuatrimestre falls into the `ANUAL`/other group (sorted last) and is never lost (Scenario 7.2). Grouping is done in the **use case**, not the template (clean-arch rule, mirrors the Primario `imprimible` precedent).

---

## 4. Type additions — `boletin.template.ts` (REQ-3/4/5, backward-compatible)

All additive and optional, so existing levels keep compiling/rendering (spec "Type Additions").

```ts
import type { SlotCursadaTerciarioValue } from '@educandow/domain';

export interface SlotCursadaBoletin {
  slot: SlotCursadaTerciarioValue;   // canonical enum value
  nota: number | null;               // null → blank
}

export interface IntentoFinalBoletin {
  intento: number;
  nota: number;
  condicion: string;                 // "Aprobado" | "Desaprobado" | "Ausente"
}

export interface GrupoCuatrimestreBoletin {   // grouped view for the template (REQ-7)
  cuatrimestre: string;              // "1C" | "2C" | "ANUAL"
  materias: MateriaBoletin[];
}

// added to MateriaBoletin (all optional):
//   slotsCursada?: SlotCursadaBoletin[];
//   notaCursadaConfirmada?: number | null;
//   condicionCursada?: string | null;
//   intentosFinales?: IntentoFinalBoletin[];
//   cuatrimestre?: string;          // traceability + grouping key

// added to DatosBoletin (all optional):
//   carreraName?: string | null;            // REQ-6 header
//   cuatrimestresTerciario?: GrupoCuatrimestreBoletin[];  // REQ-7 grouped render
```

The 4 spec-named `MateriaBoletin` fields are added verbatim. `cuatrimestre` (on materia) and the two `DatosBoletin` fields are the implementation vehicles for REQ-6/REQ-7 — documented as ADR-3 and ADR-5 since they extend the non-normative type summary.

---

## 5. Template rebuild — `boletin-terciario.hbs`

Replace the current promedio/valoración table (which assumes legacy `MateriaBoletin.promedio/valoracion/aprobado` — always empty for Terciario) with a transcript layout:

- **Header:** `{{carreraName}}` for the "Carrera:" row (was `{{grado}}`). Empty-safe.
- **Per cuatrimestre group** (`{{#each cuatrimestresTerciario}}`): section title `Cuatrimestre {{cuatrimestre}}`, then a grades table per materia:
  - Materia name, `condicionCursada`, `notaCursadaConfirmada` (blank when null).
  - 5 fixed slot columns from `slotsCursada` (blank when `nota` is null) — render in array order (already canonical).
  - `intentosFinales` as a nested list/sub-rows (intento · nota · condicion); render nothing when `[]`.
- Keep the existing `{{#if asistencia}}` block and footer/signature.
- Guard everything with `{{#if cuatrimestresTerciario}}` so a Terciario student with zero eligible inscripciones renders an empty-but-valid PDF (no crash).
- `DatosBoletin.materias` stays populated (flat) for compatibility, but the Terciario template renders from `cuatrimestresTerciario`.

The `BoletínTemplate` / `BoletínTerciario` class hierarchy in `boletin.template.ts` is **dead code** relative to the PDF path (HBS + `DatosBoletin` are what render). Do NOT modify it as if it were the source of truth (Out-of-Scope, explore #1165).

---

## 6. Signature / contract changes

`buildMaterias` and `buildMateriasTerciario`:

```ts
private async buildMaterias(
  client: TenantPrismaClient,
  enrollment: { id: string; studentId: string; level: number; cycleId: string | null;
                academicYear: string; grade?: string | null },  // + grade (already on runtime obj)
): Promise<{ materias: MateriaBoletin[]; previas?: PreviaBoletin[];
             informesInicial?: InformeInicialBoletin[];
             carreraName?: string | null;                       // NEW
             cuatrimestresTerciario?: GrupoCuatrimestreBoletin[] }> // NEW

private async buildMateriasTerciario(
  client: TenantPrismaClient,
  enrollment: { studentId: string; academicYear: string; grade?: string | null },
): Promise<{ materias: MateriaBoletin[]; carreraName: string | null;
             cuatrimestresTerciario: GrupoCuatrimestreBoletin[] }>
```

In `execute()` (line ~129/141), destructure the new fields and set `datos.carreraName` + `datos.cuatrimestresTerciario`. `enrollment.grade` already exists on the runtime object (used at line 147) — only the TS param type is widened.

---

## 7. Test strategy (Vitest, strict TDD, ≥80% — REQ-9)

New file: `api/src/application/reportes/__tests__/generate-boletin.terciario.test.ts`, mirroring `generate-boletin.inicial.test.ts`.

**Mocking pattern** (proven in the Inicial test): construct `GenerateBoletinUseCase` with `makePdfGenerator()`, `makePdfStorage()`, `makePrisma()` doubles and `undefined` for the repo slots (Terciario uses none — Approach A). Drive `(uc as any).buildMaterias(mockClient, enrollment)` directly with `enrollment.level = 40`. The mock tenant client is a plain object exposing only the models the path touches:

```ts
function makeTerciarioClient(opts) {
  return {
    inscripcionMateria: { findMany: vi.fn().mockResolvedValue(opts.inscripciones ?? []) },
    actaExamenNota:     { findMany: vi.fn().mockResolvedValue(opts.finales ?? []) },
    // legacy models present so no-regression dispatch tests can assert they are NOT called:
    notaTrimestral:     { findMany: vi.fn().mockResolvedValue([]) },
    courseCycle:        { findMany: vi.fn().mockResolvedValue([]) },
    attendance:         { findMany: vi.fn().mockResolvedValue([]) },
  };
}
```

Inscripcion doubles are **plain shaped objects** matching the include result (no Prisma needed): `{ materiaCarreraId, cuatrimestre, estado, notaCursada, notasCursada: [{slot,nota}], materiaCarrera: { subject:{name}, carrera:{name} } }`. Finales doubles: `{ intento, nota, condicion, acta:{ materiaCarreraId, fecha } }`.

**Test cases (1:1 with spec scenarios):**
- 1.1 dispatch: level 40 calls `inscripcionMateria.findMany`, NOT `notaTrimestral.findMany`. 1.2: level 10/20 don't call `inscripcionMateria.findMany`.
- 2.1/2.2 included estados appear; 2.3 LIBRE excluded — assert the `where.estado.in` argument passed to `findMany` excludes `LIBRE`; 2.4 assert `where.anioAcademico === enrollment.academicYear`.
- 3.1/3.2/3.3 slot array always length 5, correct nota/null per slot, canonical order.
- 4.1 condicionCursada label; 4.2 notaCursadaConfirmada null for CURSANDO without nota.
- 5.1 three finales across years all present, chronological; 5.2 empty `[]`; 5.3 LIBRE finales never surfaced.
- 6.1/6.2/6.3 carreraName resolution + fallback + null.
- 7.1 1C+2C grouped; 7.2 missing-cuatrimestre materia lands in ANUAL/other group.
- 8.1 query count: assert `inscripcionMateria.findMany` and `actaExamenNota.findMany` each called once (constant) for a 10-materia fixture — proves no N+1.

Coverage target ≥80% on `generate-boletin.use-case.ts` (new method) and the type transforms — achievable since every branch maps to a scenario above.

---

## 8. ADRs

- **ADR-1 — Approach A (raw tenant Prisma in the use case), no new DI.** *Why:* mirrors the legacy/Inicial precedent; the include chain (`notasCursada` + `materiaCarrera.{subject,carrera}`) does all joins in one query, so a repository abstraction buys nothing here and would force extending the `InscripcionRepository` domain interface (which has no year-scoped junction method). *Rejected:* Approach B (inject `NotaCursadaTerciarioRepository` + raw Prisma hybrid) — neither clean nor practical, requires domain interface churn for a read-only report path.
- **ADR-2 — Slot order driven by the domain `SlotCursadaTerciario` VALID array.** *Why:* single source of truth; the DB stores `slot` as a free `String`, so the boletín must impose canonical order itself. *Rejected:* hardcoding order only in the use case (drift risk vs domain).
- **ADR-3 — `notaCursadaConfirmada = InscripcionMateria.notaCursada`, not recomputed from slots.** *Why:* Fase A writes the confirmed cursada grade to that float; recomputing from slots would duplicate domain logic and could diverge. `notaFinal` is intentionally NOT this field.
- **ADR-4 — Finales scoped by `materiaCarreraId` linkage, all-time (no fecha/year filter).** *Why:* `ActaExamen` has no `anioAcademico`; the transcript semantics (decision #1166) want every intento of an included inscripcion. Vencimiento has no data model yet (Out-of-Scope) so no expiry filter is applied.
- **ADR-5 — Cuatrimestre grouping done in the use case via `DatosBoletin.cuatrimestresTerciario`, keyed on `InscripcionMateria.cuatrimestre`.** *Why:* clean-arch keeps presentation logic out of Handlebars (mirrors the Primario `imprimible` precedent); `MateriaCarrera.cuatrimestre` is `@deprecated`, so the inscription's own cuatrimestre is authoritative. *Rejected:* grouping in the template (Handlebars can't group cleanly) and reading the deprecated MateriaCarrera column.
- **ADR-6 — Two queries (`≤2` budget), carrera resolved inside Query 1.** *Why:* satisfies REQ-8 without a third header query; relation filter on `actaExamenNota.where.acta.materiaCarreraId` keeps finales in one bulk call.

---

## 9. Risks / assumptions to validate in apply

- **R1 (assumption):** `client.actaExamenNota.findMany` supports the nested relation filter `where: { acta: { materiaCarreraId: { in } } }` and `orderBy: { acta: { fecha } }`. Standard Prisma 5 capability, but confirm the generated tenant client exposes the `acta` relation under that name (schema relation field is `acta`). If `orderBy` on a to-one relation is rejected, fall back to in-memory sort by `acta.fecha` then `intento`.
- **R2 (assumption):** `enrollment.grade` carries the carrera name for Terciario students in real data. If it does not, REQ-6 fallback still renders Carrera.name (primary path) — fallback is best-effort only.
- **R3:** Multiple inscripciones sharing one `materiaCarreraId` in the same year would duplicate finales onto each. Not expected per the inscription `@@unique`; assembly tolerates it but apply tests should not fixture that case as canonical.
- **R4:** Template rebuild changes the visible PDF layout for Terciario — no golden-file/PDF snapshot test exists; verification is structural (`DatosBoletin` shape) + manual PDF review. Acceptable for this change.
- **R5 (deferred, not a blocker):** Vencimiento de regularidad has no model (decision #1166); transcript shows all-time finales by design. A future change must add expiry.
</content>
</invoke>
