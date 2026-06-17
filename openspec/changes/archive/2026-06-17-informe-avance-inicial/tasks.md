# Tasks: informe-avance-inicial

> Phase: sdd-tasks · Store: hybrid · 2026-06-17
> Delivery: auto-chain · Single PR (chaining NOT required — see Review Workload Forecast)
> TDD: Strict (test-first order enforced below)

---

## Design note: ADR-3 supersedes REQ-BOL-I-08

The spec (REQ-BOL-I-08) originally proposed extending `MateriaBoletin` with `observacion?` and `DatosBoletin`
with `observacionesGenerales?`. The design (AUTHORITATIVE, ADR-3) rejected this sketch: it only fits a single
informe, pollutes the shared type consumed by all levels, and conflicts with ADR-1 (annual multi-informe).
**The correct structure is a dedicated `informesInicial?: InformeInicialBoletin[]` on `DatosBoletin` only.**
Do NOT add `observacion?` to `MateriaBoletin`.

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated changed lines (production) | ~193 lines |
| Estimated changed lines (tests, new files) | ~260 lines |
| Estimated total | ~450 lines |
| 400-line budget risk | **Medium** (production-only: Low; total including tests: slightly above 400) |
| Chained PRs recommended | **No** — single cohesive concern, no parallel team blockers |
| Decision needed before apply | **No** |

---

## Dependency graph

```
T1 (types)
  ├─→ T2 (informe UC tests)    ─────────────────────────┐
  ├─→ T3 (boletin inicial tests, red)                   │
  │     └─→ T4 (buildMateriasInicial impl, green T3)    │
  │           └─→ T5 (wire-up module)                   │
  └─→ T6 (template rewrite, parallel with T3→T4)        │
                                                         ↓
                                                  T7 (verify all gates)
```

Parallel groups:
- **Group A** (parallel): T1 and T2 have no mutual dependency — T2 can start concurrently with T1.
- **Group B** (after T1): T3 and T6 can start in parallel — T3 for red tests, T6 for template.
- **Group C** (after T3): T4 (makes T3 green). T6 may still be in progress (different file, no conflict).
- **Group D** (after T4): T5 (wire-up).
- **T7** (after T2 + T4 + T5 + T6 all done).

---

## Tasks

### T1 — [x] [TYPES] Add `AreaInicialBoletin`, `InformeInicialBoletin`, `informesInicial?` to `DatosBoletin`

**Satisfies:** REQ-BOL-I-02, REQ-BOL-I-03, REQ-BOL-I-06 (via ADR-3)
**Sequential:** must complete before T3, T4, T6 can start.
**File:** `api/src/application/reportes/templates/boletin.template.ts`
**Estimated lines:** ~33 added

Add after the existing `PreviaBoletin` interface (before `DatosBoletin`):

```ts
// ── Inicial-specific sub-types ─────────────────────────────────────────────────

/** One área de desarrollo inside an InformeEvolutivo (Inicial only). */
export interface AreaInicialBoletin {
  /** Free string — enum deferred (P1). E.g. "SOCIO_AFECTIVA". */
  nombre: string;
  /** Qualitative narrative — the key Inicial field. */
  observacion: string;
  /** "DESTACADO" | "LOGRADO" | "EN_PROCESO" | "NO_LOGRADO" (free string — VO deferred P3). */
  valoracion: string;
}

/** One trimestre informe evolutivo for the Inicial boletín. */
export interface InformeInicialBoletin {
  periodo: string;                  // "1T" | "2T" | "3T"
  fecha: string;                    // dd/mm/aaaa
  observacionesGenerales?: string;  // optional
  areas: AreaInicialBoletin[];
}
```

Add to `DatosBoletin` (after `previas?`):

```ts
/**
 * Informes evolutivos del alumno (todos los trimestres disponibles), ordenados 1T→2T→3T.
 * Only populated by buildMateriasInicial (level decade 1).
 * Undefined for Primario/Secundario/Terciario — {{#if informesInicial}} no-ops cleanly.
 */
informesInicial?: InformeInicialBoletin[];
```

**Acceptance:** `pnpm --filter api typecheck` — 0 new errors after this change alone.

---

### T2 — [x] [TEST-RED/GREEN] Unit tests for 4 InformeEvolutivo use-cases

**Satisfies:** REQ-BOL-I-12
**Parallel with:** T1 (no dependency on boletin types)
**New file:** `api/src/application/nivel-inicial/use-cases/__tests__/informe-evolutivo.use-cases.test.ts`
**Estimated lines:** ~130

Mock `InformeRepository` with `vi.fn()` stubs for `save`, `findById`, `findAll`.

Test cases (TDD — write tests, then they are red until the use-cases are confirmed correct):

1. **CreateInformeUseCase** — `execute(validInput)` → calls `repo.save`, returns `Ok(InformeEvolutivo)` with correct fields.
2. **CreateInformeUseCase** — invalid `periodo` (e.g. `"4T"`) → returns `Err(ValidationError)` without calling `repo.save`.
3. **GetInformeUseCase** — `findById` returns entity → `Ok(informe)`.
4. **GetInformeUseCase** — `findById` returns null → `Err(NotFoundError)` with `id` in message.
5. **ListInformesUseCase** — `findAll(filters)` called with the passed filters → `Ok([...])`.
6. **UpdateInformeUseCase** — existing found, valid input → calls `repo.save(updated)`, returns `Ok(updated)` with merged fields.
7. **UpdateInformeUseCase** — not found → `Err(NotFoundError)`, `repo.save` NOT called.
8. **UpdateInformeUseCase** — partial update (only `observacionesGenerales`) → other fields preserved from existing.

**Acceptance:** All 8 tests green after writing. No crash on import.

---

### T3 — [x] [TEST-RED→GREEN] Boletin Inicial unit tests (red before T4, green after)

**Satisfies:** REQ-BOL-I-01, REQ-BOL-I-02, REQ-BOL-I-03, REQ-BOL-I-05, REQ-BOL-I-06, REQ-BOL-I-10, REQ-BOL-I-12 (ADR-1, ADR-2, ADR-3)
**Depends on:** T1 (types must exist for assertions to compile)
**Parallel with:** T2, T6 (after T1)
**New file:** `api/src/application/reportes/__tests__/generate-boletin.inicial.test.ts`
**Estimated lines:** ~120

Mock pattern: follow `generate-boletin.use-case.test.ts` — `makePdfGenerator`, `makePdfStorage`, `makePrisma`.
Additional mocks needed: `mockSalaEnrollmentClient` (stubs `client.salaEnrollment.findFirst`), `mockInformeRepo` (stubs `findAll`).

Test cases:

1. **Mapping — 2 informes, ordered 1T→2T** (ADR-1 + ADR-2 + ADR-3):
   - Given: SalaEnrollment found; `InformeRepository.findAll` returns 2 `InformeEvolutivo` (2T, 1T — deliberately unordered).
   - `buildMateriasInicial` (called via `execute()` with level 10 enrollment).
   - Then: `datos.informesInicial` has 2 items ordered [1T, 2T]; each has `periodo`, `fecha`, `observacionesGenerales`, `areas[].nombre/observacion/valoracion`.
   - And: `InformeRepository.findAll` WAS called with `{ studentId, salaId }`.
   - And: `client.notaTrimestral` (or any legacy query) was NOT called.

2. **Empty state — no SalaEnrollment**:
   - `client.salaEnrollment.findFirst` returns null.
   - Then: `datos.informesInicial` is `[]`; no exception; `InformeRepository.findAll` NOT called.

3. **Empty state — no informes**:
   - SalaEnrollment found; `InformeRepository.findAll` returns `[]`.
   - Then: `datos.informesInicial` is `[]`; no exception.

4. **Empty state — informeRepo not injected**:
   - Construct `GenerateBoletinUseCase` without 8th arg.
   - Then: `datos.informesInicial` is `[]`; no exception.

5. **Dispatch: level 15 routes to buildMateriasInicial, not legacy**:
   - `InformeRepository.findAll` IS called; `client.notaTrimestral.findMany` is NOT called.

6. **No-regression: level 20 (Primario)**:
   - `InformeRepository.findAll` NOT called; `datos.informesInicial` is `undefined`.
   - `datos.materias` contains the expected Primario structure (unchanged).

**All 6 tests must be RED before T4 is implemented.** Running `pnpm --filter api test` at this point should fail these tests (missing implementation).

---

### T4 — [x] [IMPL] `buildMateriasInicial` + 9th DI param + dispatch arm in `GenerateBoletinUseCase`

**Satisfies:** REQ-BOL-I-01, REQ-BOL-I-02, REQ-BOL-I-05, REQ-BOL-I-09, REQ-BOL-I-10, REQ-BOL-I-13 (ADR-1, ADR-2, ADR-3)
**Depends on:** T1 (types), T3 (tests must be red first — TDD rule)
**Sequential after:** T3
**Parallel with:** T6 (template touches a different file)
**File:** `api/src/application/reportes/generate-boletin.use-case.ts`
**Estimated lines:** ~70 added

Steps:

1. Add import: `import type { InformeRepository, InformeInicialBoletin } from '@educandow/domain'` (check actual export; may need `AreaInicialBoletin` from `boletin.template.ts`).
   - Actually `InformeInicialBoletin` / `AreaInicialBoletin` are output types defined in `boletin.template.ts`, not domain entities — import from there.
   - `InformeRepository` IS from `@educandow/domain`.

2. Add 8th optional constructor parameter:
   ```ts
   private readonly informeRepo?: InformeRepository,
   ```
   After existing `private readonly materiaPreviaRepo?: MateriaPreviaRepository`.

3. Add `formatFecha` local helper (if not already present):
   ```ts
   function formatFecha(date: Date): string {
     return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
   }
   ```

4. Add private method `buildMateriasInicial` (per design §4.2 — exact implementation):
   - `client.salaEnrollment.findFirst({ where: { studentId, academicYear, active: true } })` → null → `{ materias: [], informesInicial: [] }`
   - `this.informeRepo.findAll({ studentId, salaId })` → empty → `{ materias: [], informesInicial: [] }`
   - Sort by `periodo.get()` order `{ '1T': 1, '2T': 2, '3T': 3 }`.
   - Map each `InformeEvolutivo` to `InformeInicialBoletin` (periodo/fecha/observacionesGenerales/areas).
   - Return `{ materias: [], informesInicial }`.

5. Add dispatch arm in `buildMaterias` (before the legacy `NotaTrimestral` path):
   ```ts
   if (Math.floor(enrollment.level / 10) === 1) {
     return this.buildMateriasInicial(client, enrollment);
   }
   ```

6. Extend the return type of `buildMaterias` (if typed) to include `informesInicial?: InformeInicialBoletin[]`.

7. In `execute()`, destructure `informesInicial` from `buildMaterias` result and assign `datos.informesInicial = informesInicial`.

**Acceptance:** T3 tests become GREEN. `pnpm --filter api test` passes (minus pre-existing Pool-mock failures).

---

### T5 — [x] [WIRE] Inject `PrismaInformeRepository` into `ReportesModule`

**Satisfies:** REQ-BOL-I-09
**Depends on:** T4 (use-case must accept 8th param)
**Sequential after:** T4
**File:** `api/src/presentation/reportes/reportes.module.ts`
**Estimated lines:** ~10 changed

Steps:

1. Add import:
   ```ts
   import { PrismaInformeRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-informe.repository';
   ```

2. Add `PrismaInformeRepository` to `providers` array (after `PrismaCompetencyValuationRepo`).

3. Extend `useFactory` signature to accept `informeRepo: PrismaInformeRepository` as 8th arg.

4. Pass it as 8th arg in `new GenerateBoletinUseCase(pdfGen, pdfStorage, prisma, sgpRepo, pgRepo, fgRepo, cvRepo, informeRepo)`.

5. Add `PrismaInformeRepository` as 8th entry in `inject` array.

**Acceptance:** NestJS DI wires cleanly; `pnpm --filter api typecheck` 0 new errors.

---

### T6 — [x] [TEMPLATE] Rewrite `boletin-inicial.hbs`

**Satisfies:** REQ-BOL-I-04, REQ-BOL-I-10, REQ-BOL-I-11 (ADR-4)
**Depends on:** T1 (types define the data shape the template must consume)
**Parallel with:** T3 and T4 (different file, no code dependency)
**File:** `api/src/infrastructure/reporting/html-templates/boletin-inicial.hbs`
**Estimated lines:** ~80 (net rewrite)

Changes required (per design §6, ADR-4):

1. **Remove** `<th>Docente</th>` column header and all `{{docente}}` / "Firma del docente" occurrences.

2. **Relabel** the top-level `{{periodo}}` display to "Ciclo lectivo" (e.g. `<span>Ciclo lectivo: {{periodo}}</span>`). This field still carries `academicYear` — relabeling fixes the UX confusion.

3. **Replace** the grades table with an `{{#each informesInicial}}` block:
   ```hbs
   {{#each informesInicial}}
     <div class="section-title">Informe — {{this.periodo}} · {{this.fecha}}</div>
     {{#if this.observacionesGenerales}}
       <p class="obs-generales">{{this.observacionesGenerales}}</p>
     {{/if}}
     <table class="grades">
       <thead>
         <tr><th>Área</th><th>Observación</th><th>Valoración</th></tr>
       </thead>
       <tbody>
         {{#each this.areas}}
           <tr>
             <td>{{this.nombre}}</td>
             <td>{{this.observacion}}</td>
             <td>{{this.valoracion}}</td>
           </tr>
         {{/each}}
       </tbody>
     </table>
   {{else}}
     <p class="empty-state">Sin informes evolutivos cargados para este ciclo.</p>
   {{/each}}
   ```

4. **Preserve** the `{{#if asistencia}}` block unchanged.

5. **3 columns only** in the areas table: Área | Observación | Valoración — no numeric notes, no Docente.

**Acceptance:** Template compiles at server start (Handlebars pre-compilation in constructor). `pnpm build` passes. HTML output from Scenario 5 (spec) contains "Ciclo lectivo", the area nombre/observacion/valoracion, no "Docente" column.

---

### T7 — [x] [VERIFY] Run all verification gates

**Depends on:** T2, T3 (green via T4), T4, T5, T6
**Sequential final step**

Gates (in order):

| Gate | Command | Expected result |
|------|---------|----------------|
| Unit tests | `pnpm --filter api test` | All pass; ~6 pre-existing Pool-mock failures are known baseline — must not increase |
| TypeScript | `pnpm --filter api typecheck` | 0 new errors beyond 11 baseline |
| Full build | `pnpm build` | Exits 0; HBS templates compile via pre-compilation in GenerateBoletinUseCase constructor |

**Additional manual checks:**
- Confirm `informesInicial` is `undefined` (not `[]`) for a Primario enrollment in the test output — verifies no-regression (REQ-BOL-I-06, Scenario 4).
- Confirm `GenerateBoletinBatchUseCase` source has no new Inicial-specific arm (REQ-BOL-I-13, Scenario 7).

---

## File map

| File | Task | Change type | Est. lines |
|------|------|-------------|-----------|
| `api/src/application/reportes/templates/boletin.template.ts` | T1 | Additive: 2 interfaces + 1 field | +33 |
| `api/src/application/nivel-inicial/use-cases/__tests__/informe-evolutivo.use-cases.test.ts` | T2 | New file | +130 |
| `api/src/application/reportes/__tests__/generate-boletin.inicial.test.ts` | T3 | New file | +120 |
| `api/src/application/reportes/generate-boletin.use-case.ts` | T4 | Additive: 8th param + method + arm | +70 |
| `api/src/presentation/reportes/reportes.module.ts` | T5 | Small extension: import + provider + factory | +10 |
| `api/src/infrastructure/reporting/html-templates/boletin-inicial.hbs` | T6 | Rewrite | ~80 |
| `api/src/application/reportes/__tests__/generate-boletin.use-case.test.ts` | T3 | Optional extension for no-regression | +20 |

**Total: ~463 lines across 7 files (2 new, 5 modified)**

---

## Out-of-scope (deferred per spec §5)

- P1 — Área enum/VO
- P2 — Authz docente self-service
- P3 — Valoración VO
- P4 — GradingPeriodDate alineación / período selector en execute()
- P5 — "No evaluado" vs "sin informe"
- P6 — Borrador → publicado workflow
- Drop de NotaTrimestral (frozen legacy — solo se deja de leer en path Inicial)
- `MateriaPreviaRepository` wiring in reportes.module.ts (already imported in UC, pre-existing gap — out of scope)
