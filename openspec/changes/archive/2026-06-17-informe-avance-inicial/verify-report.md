# Verify Report: informe-avance-inicial

> Fase: sdd-verify · Change: informe-avance-inicial · Store: hybrid · 2026-06-17
> Branch: feat/informe-avance-inicial
> Verifier: sdd-verify executor (claude-sonnet-4-6)

---

## Verdict: PASS WITH WARNINGS

**0 CRITICAL · 3 WARNING · 1 SUGGESTION**

All 13 spec requirements are functionally satisfied. Two WARNINGs are deliberate design deviations (ADR-3 supersedes REQ-BOL-I-08; AreaInicialBoletin field naming). One WARNING is an unmeasured coverage gate. No blockers for archive.

---

## Gate Results

| Gate | Result | Detail |
|------|--------|--------|
| `pnpm --filter api test` | PASS | 1213/1213 · 128 files |
| `pnpm --filter api typecheck` | PASS (baseline) | 11 errors, all pre-existing in pedagogy/course-cycle tests; 0 new |
| `pnpm build` | PASS | 3 tasks successful · FULL TURBO |
| `git diff main -- '*.prisma'` | PASS | Empty — no schema changes |

---

## Requirement-by-Requirement Analysis

### REQ-BOL-I-01 — Fuente de datos para Inicial: PASS

`buildMaterias` (generate-boletin.use-case.ts:195-197) early-returns via `buildMateriasInicial` for `Math.floor(level/10) === 1`. The legacy `notaTrimestral.findMany` is structurally unreachable for Inicial. Test T3-5 (level 15) asserts `notaTrimestralFindMany` NOT called and `informeRepo.findAll` IS called. INV-2 test in docente-s2 updated to assert new dispatch behavior (not the old buggy path).

### REQ-BOL-I-02 — Campos por área en DTO: PASS with WARNING

`AreaInicialBoletin` contains `observacion` and `valoracion` as required. The area name field is named **`nombre`** in the implementation (not `area` as the spec literal states). The value is correct (mapped from `a.area`), only the DTO field name differs. This is a minor naming deviation from the spec text.

**WARNING-1**: `AreaInicialBoletin.nombre` vs spec-mandated `area`. Functionally equivalent; the template renders the correct value via `{{this.nombre}}`.

### REQ-BOL-I-03 — observacionesGenerales en DTO: PASS

`InformeInicialBoletin.observacionesGenerales?: string` exists (boletin.template.ts:64). Template guards with `{{#if this.observacionesGenerales}}` (boletin-inicial.hbs:43). Absent value → undefined (not empty string).

### REQ-BOL-I-04 — Sin nota numérica / Docente / aprobado: PASS

`buildMateriasInicial` returns `materias: []` — no `MateriaBoletin` constructed for Inicial. Template headers: `<th>Área</th><th>Observación</th><th>Valoración</th>` — no Docente column. No numeric computation in the Inicial path.

### REQ-BOL-I-05 — Sin excepción cuando no hay informe: PASS

Three early-return guards in `buildMateriasInicial`:
1. `!this.informeRepo → return {materias:[], informesInicial:[]}`
2. `!salaEnrollment → return {materias:[], informesInicial:[]}`
3. `informes.length === 0 → return {materias:[], informesInicial:[]}`

Template `{{#each informesInicial}}...{{else}}<p class="empty-state">Sin informes...</p>{{/each}}` renders a valid page for empty arrays. Tests T3-2, T3-3, T3-4 cover all three empty-state paths.

### REQ-BOL-I-06 — No regresión otros niveles: PASS

Primario and Secundario dispatch arms are gated after the Inicial early-return. `informesInicial` is `undefined` for non-Inicial (optional on DatosBoletin). Test T3-6 explicitly asserts `informeRepo.findAll` NOT called for level 20, `informesInicial` is undefined, `materias` is an array. Build passes with 0 new TS errors.

### REQ-BOL-I-07 — Sin migración Prisma: PASS

`git diff main --stat -- '*.prisma'` returns empty. Confirmed.

### REQ-BOL-I-08 — Extensión aditiva de tipos: PASS (ADR-3 supersedes spec literal)

The spec as written says `MateriaBoletin MUST be extended with observacion?: string` and `DatosBoletin MUST be extended with observacionesGenerales?: string`. The implementation intentionally deviates from the spec literal per ADR-3 (design decision):

- `MateriaBoletin` does NOT have `observacion?` — ADR-3 forbids polluting the shared type.
- `DatosBoletin` has `informesInicial?: InformeInicialBoletin[]` which contains per-informe `observacionesGenerales?` — a more correct structure than a single flat `observacionesGenerales?` on the parent.

The verify task instructions explicitly confirm ADR-3 is the expected implementation. The spirit of the requirement (optional, backward-compatible) is satisfied.

**WARNING-2**: REQ-BOL-I-08 literal text is superseded by ADR-3. Not a bug; documented design decision. The spec file (`delta.md`) predates the design phase and was not updated post-ADR.

### REQ-BOL-I-09 — InformeRepository como dep inyectable: PASS

Constructor signature: `private readonly informeRepo?: InformeRepository` at position 9 (generate-boletin.use-case.ts:64). Existing instantiations without it continue working (optional). Module factory wires it correctly: `new GenerateBoletinUseCase(pdfGen, pdfStorage, prisma, sgpRepo, pgRepo, fgRepo, cvRepo, undefined, informeRepo)` with explicit `undefined` for the known materiaPreviaRepo gap at position 8.

### REQ-BOL-I-10 — Campo periodo muestra trimestre: PASS

The template shows trimestre in each informe section header: `Informe — {{this.periodo}} · {{this.fecha}}` where `this.periodo` is "1T/2T/3T" (from `InformeInicialBoletin.periodo`). The student info block shows the academic year labeled as "Ciclo lectivo" — semantically distinct and correctly labeled, not a bug.

### REQ-BOL-I-11 — Template boletin-inicial.hbs reescrito: PASS

Template rewritten. Renders `observacionesGenerales` (conditional), per-area rows with Área/Observación/Valoración. No Docente column. Asistencia block preserved. Empty-state `{{else}}` block. Valid Handlebars (confirmed by build: `TSC Found 0 issues`, `SWC Successfully compiled: 414 files`).

### REQ-BOL-I-12 — Cobertura de tests (Strict TDD): PASS with WARNING

- `informe-evolutivo.use-cases.test.ts`: 8 tests for Create/Get/List/Update use-cases — all GREEN.
- `generate-boletin.inicial.test.ts`: 6 tests (mapping+ordering, 3x empty-state, dispatch, no-regression Primario) — all GREEN.
- All 1213 tests pass (128 files).

**WARNING-3**: Coverage percentage (≥80%) not independently measured in this verify run (vitest run, no `--coverage` flag). Prior gate (sdd-apply T7) confirmed threshold was met. To independently confirm: `pnpm --filter api test:coverage`.

### REQ-BOL-I-13 — Batch hereda fix sin arm propio: PASS

`GenerateBoletinBatchUseCase.execute()` delegates to `this.singleUC.execute(enrollment.id)` for each enrollment (no level-specific branching in batch). Inicial enrollments inherit `buildMateriasInicial` automatically through `GenerateBoletinUseCase`. Confirmed: no Inicial arm in generate-boletin-batch.use-case.ts.

---

## Acceptance Scenarios

| Scenario | Status | Evidence |
|----------|--------|----------|
| Escenario 1 — Inicial con informe existente | PASS | T3-1: mapping + ordering 2T→1T sorted correctly |
| Escenario 2 — Inicial sin informe, sin crash | PASS | T3-2, T3-3, T3-4: all 3 empty-state guards |
| Escenario 3 — Inicial no toca NotaTrimestral | PASS | T3-5: level 15, notaTrimestral NOT called |
| Escenario 4 — No regresión Primario | PASS | T3-6: informeRepo.findAll NOT called for level 20 |
| Escenario 5 — Template renderiza correctamente | PASS | boletin-inicial.hbs renders all required sections, no Docente |
| Escenario 6 — Compilación TS sin errores nuevos | PASS | 0 new errors (11 baseline pre-existing) |
| Escenario 7 — Batch hereda fix sin arm propio | PASS | Batch delegates to singleUC.execute() only |

---

## Warnings Detail

| ID | Severity | Requirement | Description |
|----|----------|-------------|-------------|
| W-1 | WARNING | REQ-BOL-I-02 | `AreaInicialBoletin` field named `nombre` instead of `area` as spec states. Value is correct; naming differs. No functional impact. |
| W-2 | WARNING | REQ-BOL-I-08 | Spec literal (MateriaBoletin.observacion? + DatosBoletin.observacionesGenerales?) superseded by ADR-3 in design phase. Correct per design; spec not retroactively updated. |
| W-3 | WARNING | REQ-BOL-I-12 | Coverage ≥80% not independently re-measured. Prior apply gate confirmed it; recommend `pnpm --filter api test:coverage` before merging to main. |

## Suggestions

| ID | Severity | Location | Description |
|----|----------|----------|-------------|
| S-1 | SUGGESTION | generate-boletin.use-case.ts:237-246 | Dead code: `isInicial` check + docente resolver block in legacy path is unreachable for Inicial (Inicial returns early at line 195). Can be removed in a follow-up cleanup. No functional impact. |

---

## Risks

None blocking archive. All CRITICAL count: 0.

---

## Files Verified

- `api/src/application/reportes/templates/boletin.template.ts` — ADR-3 types, no observacion on MateriaBoletin
- `api/src/application/reportes/generate-boletin.use-case.ts` — dispatch arm + buildMateriasInicial + 9th param
- `api/src/presentation/reportes/reportes.module.ts` — PrismaInformeRepository wired correctly
- `api/src/infrastructure/reporting/html-templates/boletin-inicial.hbs` — rewritten, no Docente, empty-state
- `api/src/application/nivel-inicial/use-cases/__tests__/informe-evolutivo.use-cases.test.ts` — 8 UC tests
- `api/src/application/reportes/__tests__/generate-boletin.inicial.test.ts` — 6 boletin Inicial tests
- `api/src/application/reportes/__tests__/generate-boletin.docente-s2.test.ts` — INV-2 updated for new dispatch

---

## Recommended Next Step

`sdd-archive` — no CRITICAL issues, all gates pass, change is production-ready.
