# Archive Report: informe-avance-inicial

> Phase: sdd-archive · Store: hybrid · 2026-06-17
> Branch: feat/informe-avance-inicial
> Verdict: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 1 SUGGESTION)
> Archived to: openspec/changes/archive/2026-06-17-informe-avance-inicial/

---

## What Shipped

**Bug fix: Inicial boletín wired to InformeEvolutivo.**

The boletín de Nivel Inicial was broken in production: it fell through to the legacy
`NotaTrimestral` path (numeric grading — conceptually invalid for Inicial) and rendered
empty or incorrect. The `InformeEvolutivo` model (entity + repo + 4 use-cases + controller
+ Prisma model) already existed and was load-bearing for data entry, but the PDF generation
did not read it.

**What was implemented:**

- `GenerateBoletinUseCase.buildMateriasInicial` (new private method): resolves
  `SalaEnrollment` → `InformeRepository.findAll({ studentId, salaId })`, maps
  `InformeEvolutivo[]` → `InformeInicialBoletin[]` ordered 1T→2T→3T.
- Dispatch arm in `buildMaterias`: `Math.floor(level/10) === 1` early-returns to
  `buildMateriasInicial`, sidestepping the legacy `NotaTrimestral` path for Inicial.
- `InformeRepository` wired as 9th optional constructor parameter in
  `GenerateBoletinUseCase`; `PrismaInformeRepository` registered in `ReportesModule`.
- `DatosBoletin.informesInicial?: InformeInicialBoletin[]` (ADR-3 dedicated structure),
  `InformeInicialBoletin`, `AreaInicialBoletin` added to `boletin.template.ts`.
- `boletin-inicial.hbs` rewritten: renders one section per trimestre (Área /
  Observación / Valoración), no Docente column, no numeric grades, empty-state
  placeholder, "Ciclo lectivo" label for annual period.
- 8 new unit tests for the 4 `InformeEvolutivo` use-cases (Create/Get/List/Update).
- 6 new tests for the Inicial boletín (mapping+ordering, 3x empty-state guards,
  dispatch guard, Primario no-regression).

**Test result: 1213/1213 · 128 files · build PASS · 0 new TS errors · no schema change.**

---

## Key Architecture Decisions (ADRs)

| ADR | Decision |
|-----|----------|
| ADR-1 | Annual render: all available InformeEvolutivo records, ordered 1T→2T→3T (consistent with Primario/Secundario which also render all periods). |
| ADR-2 | Lookup: `SalaEnrollment(studentId, academicYear, active:true) → salaId → InformeRepository.findAll({ studentId, salaId })`. Reuses existing `findAll`; no new port method. |
| ADR-3 | Dedicated `informesInicial?: InformeInicialBoletin[]` on `DatosBoletin`. Rejected: extending `MateriaBoletin.observacion?` (single-informe only; contaminates type shared by all levels). |
| ADR-4 | Template: one section per trimestre, top-level period = "Ciclo lectivo" (academicYear), trimestre shown in section header. |

---

## Warnings from Verify Phase

| ID | Status | Description |
|----|--------|-------------|
| W-1 | Accepted | `AreaInicialBoletin` field named `nombre` (not `area` as spec literal). Value correct; naming is intentional (more descriptive). Reconciled in canonical spec. |
| W-2 | Resolved by ADR-3 | REQ-BOL-I-08 literal (MateriaBoletin.observacion?) superseded by ADR-3. Canonical spec carries ADR-3 wording; the old REQ-BOL-I-08 text is NOT carried forward. |
| W-3 | Non-issue | Coverage ≥80% not re-measured in verify run; prior apply gate confirmed threshold met. |

---

## Deferred Cleanup: S-1

`generate-boletin.use-case.ts` contains a dead `isInicial` block in the legacy
`NotaTrimestral` path (lines ~237-246 at verify time): Inicial now early-returns at
the dispatch arm so those lines are structurally unreachable. Additionally,
`resolveDocentesForStudentCC` now has only test callers (no production callers for
Inicial since that level no longer reaches it).

**Left intentionally:** the block is entangled with S2 (retiro-boletin-docente-s2) tests
that mock that path, and its removal would touch live code in the Terciario and any
future paths. Safe to remove in a follow-up cleanup once Terciario also moves off the
legacy path (evaluacion-terciario).

---

## Deferred Product Decisions (P1–P6)

These were explicitly out of scope for this MVP change and are tracked for future hardening:

| ID | Item | Notes |
|----|------|-------|
| P1 | Enum / VO de Área | `area` is a free-string today (e.g. "SOCIO_AFECTIVA"). Define as enum or VO when admin wants to constrain valid values. |
| P2 | Authz self-service para docente | Today admin-only. Add SalaXDocente authorization so assigned teachers can submit informes for their sala without admin. |
| P3 | VO de Valoración | Free-string with known values. Define a typed VO or enum for "DESTACADO"/"LOGRADO"/"EN_PROCESO"/"NO_LOGRADO". |
| P4 | GradingPeriodDate alignment / per-trimestre delivery | The endpoint has no period selector; renders all 3 trimesters in one PDF. If institutions want per-trimestre PDF delivery, add a period parameter to `execute()` and align with GradingPeriodDate. |
| P5 | "No evaluado" vs "sin informe" | Currently both states produce `informesInicial: []`. A future change may distinguish them for the template. |
| P6 | Borrador → publicado workflow | InformeEvolutivo is immediately visible; no draft state. |

---

## Annual-vs-Per-Term Product Note

The user confirmed: **annual render** (all trimestres in one PDF) is the correct
behaviour for the current product. Rationale: `execute(enrollmentId)` has no period
parameter; Primario and Secundario both render all periods in a single annual document;
the `academicYear` is the natural document scope. If per-trimestre delivery is ever
required, it maps to P4 above.

---

## Remaining Gating for Legacy Drop

The legacy `NotaTrimestral` / `SubjectAssignment` tables CANNOT be dropped yet:
- **Terciario** still reads `SubjectAssignment` (as join key) and `NotaTrimestral`
  (as grade source) in the boletín path. This is the sole remaining consumer.
- The gating change is **`evaluacion-terciario`**: build a fit-for-purpose grading
  model for Terciario (parciales / TP / recuperatorios / final-3-intentos) and
  wire the boletín to it, then drop `NotaTrimestral` → `SubjectAssignment` → `Teacher`
  (S3b-final of the retiro-teacher-legacy epic).

---

## Engram Observation IDs

| Artifact | Topic Key |
|----------|-----------|
| Proposal | sdd/informe-avance-inicial/proposal |
| Spec (delta) | sdd/informe-avance-inicial/spec |
| Design | sdd/informe-avance-inicial/design |
| Tasks | sdd/informe-avance-inicial/tasks |
| Apply progress | sdd/informe-avance-inicial/apply-progress |
| Verify report | sdd/informe-avance-inicial/verify-report |
| Archive report | sdd/informe-avance-inicial/archive-report |

---

## Canonical Spec Changes

| File | Change |
|------|--------|
| `openspec/specs/boletin-inicial/spec.md` | NEW — canonical requirements for Inicial boletín (BI-R1..BI-R10) |
| `openspec/specs/boletin-primario/spec.md` | Updated BP-R2 / BP-S3 — Inicial no longer uses legacy path |
| `openspec/specs/boletin-secundario/spec.md` | Updated BSS-R2 — Inicial removed from "legacy unchanged" list |
| `openspec/specs/nivel-inicial/spec.md` | Cross-reference: InformeEvolutivo is now the boletín data source |
| `openspec/specs/report-cards/spec.md` | New requirement: INICIAL Boletín Data Source |
| `openspec/changes/retiro-teacher-legacy/explore.md` | informe-avance-inicial marked DONE; evaluacion-terciario as remaining gate |

---

## Commits on feat/informe-avance-inicial

- `b2ea952` feat(boletin-inicial): add InformeInicialBoletin types + buildMateriasInicial dispatch + UC tests
- `7493327` feat(boletin-inicial): wire PrismaInformeRepository + rewrite boletin-inicial.hbs
- `f0a6d84` chore(sdd): mark all T1-T7 tasks complete in openspec tasks.md
