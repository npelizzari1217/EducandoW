# Archive Report: boletin-terciario (Fase C)

> Phase: sdd-archive · Store: hybrid · 2026-06-18
> Branch: feat/boletin-terciario (stacked on feat/evaluacion-terciario)
> Verdict: PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 2 SUGGESTION)
> Warnings resolved: YES — both JSDoc/comment WARNINGs fixed in commit a5791a2
> Archived to: openspec/changes/archive/2026-06-18-boletin-terciario/

---

## What Shipped

**Fase C: Boletín Terciario — transcript model wired to NotaCursadaTerciario + ActaExamenNota.**

Before this change, a Terciario student's boletín was always empty: `buildMaterias()` fell
into the legacy `else` branch that reads `CourseCycles → NotaTrimestral` — tables that don't
exist for Terciario. Fase A+B (`evaluacion-terciario`) built `NotaCursadaTerciario` and
`ActaExamenNota.intento`; this change wires the boletín to those models.

The PDF now works as a **transcripción** of the student's materias vigentes:
- In-progress materias (INSCRIPTO/CURSANDO) with all 5 slot grades
- Regular materias awaiting final (with existing final attempts)
- Promoted (PROMOCIONAL) and approved (APROBADO) materias
- LIBRE materias excluded (did not pass cursada)
- Grouped by cuatrimestre (1C → 2C → ANUAL)
- Carrera header from `Carrera.name`, fallback to `enrollment.grade`

**Test result: 1283/1283 passing (132 test files). generate-boletin.use-case.ts 85.6% stmt /
87.64% lines (>80%). No new TS errors. All 6 tasks complete.**

---

## Key Architecture Decisions

| ADR | Decision |
|-----|----------|
| ADR-1 | Approach A: raw tenant Prisma in the use case, no new DI. Mirrors legacy/Inicial precedent; include chain does all joins in one query. |
| ADR-2 | Slot order driven by domain `SlotCursadaTerciario` VALID array — single source of truth. DB stores slot as free String so canonical order is imposed at assembly time. |
| ADR-3 | `notaCursadaConfirmada = InscripcionMateria.notaCursada` (not recomputed from slots). Fase A writes the confirmed grade to that float. |
| ADR-4 | Finales scoped all-time per inscripcion (no fecha/year filter). `ActaExamen` has no `anioAcademico`; vencimiento out of scope. |
| ADR-5 | Cuatrimestre grouping done in use case via `DatosBoletin.cuatrimestresTerciario`. `MateriaCarrera.cuatrimestre` is `@deprecated` — not read. |
| ADR-6 | Two queries (≤2 budget). Q2 short-circuited when zero inscripciones. In-memory sort fallback for `orderBy` on to-one relation (Prisma R1 risk). |

---

## Canonical Specs Synced

| File | Change |
|------|--------|
| `openspec/specs/boletin-terciario/spec.md` | NEW — full canonical spec (BT-R1 through BT-R9). Includes deferred items section, type additions summary, and ADRs. |
| `openspec/specs/report-cards/spec.md` | UPDATED — added "TERCIARIO Boletín Data Source (Transcript Model)" requirement section with cross-reference to `boletin-terciario/spec.md`. |

---

## Deferred Items (carry-forward)

### DEFERRED-1 — Vencimiento de regularidad

No expiry model exists in the schema. The transcript shows all finales all-time per inscripcion.
A future change must add an expiry field to `InscripcionMateria` and update `buildMateriasTerciario`
to filter by `fechaVencimiento`. The deferred requirement is marked in `boletin-terciario/spec.md`
under DEFERRED-1 and in BT-R5.

**Future change name (suggested):** `vencimiento-regularidad-terciario`

### DEFERRED-2 — NotaTrimestral legacy retirement for Terciario

The legacy `else` branch (reads `NotaTrimestral / CourseCycles`) is now unreachable for
decade-4 students but was NOT deleted. Full retirement requires confirming which levels (if any)
still reach it. Noted in `boletin-terciario/spec.md` under DEFERRED-2.

**Future change name (suggested):** `retiro-nota-trimestral-legacy`

### DEFERRED-3 — BoletínTemplate dead-code hierarchy

The class hierarchy `BoletínTemplate` / `BoletínTerciario` (etc.) in `boletin.template.ts` is
dead code relative to the PDF path. Deferred to a future cleanup to keep this change focused.

### DEFERRED-4 — Docente entry for Terciario (Fase D)

Authz of a Terciario docente to enter cursada grades — planned as Fase D.

---

## Dependency Note

This change is **stacked on `feat/evaluacion-terciario` (PR #23)**.
- PR #23 MUST be merged first before this branch (`feat/boletin-terciario`) can be merged.
- Do NOT merge `feat/boletin-terciario` directly to main/develop while PR #23 is pending.
- `NotaCursadaTerciario`, `ActaExamenNota.intento`, and the tenant schema migration from
  `evaluacion-terciario` are runtime prerequisites for the Terciario boletín to work.

---

## Verify Report Summary

**Verdict:** PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 2 SUGGESTION)

- WARNING-1: JSDoc on `buildMaterias()` said "Terciario → legacy NotaTrimestral path". Fixed in a5791a2.
- WARNING-2: Inline comment at the legacy `else` still said "(Terciario, Inicial)". Fixed in a5791a2.
- SUGGESTION-1: Handlebars `{{#if nota}}` treats 0 as falsy (grade of 0 renders blank). Not a real risk in Argentine terciario (scale 1–10).
- SUGGESTION-2: Scenario 7.2 test uses `cuatrimestre='ANUAL'` explicitly; the `?? 'ANUAL'` null-coalescing path is untested. Non-critical (the schema field is non-optional).

---

## Engram Artifact IDs

| Artifact | Topic Key |
|----------|-----------|
| Proposal | sdd/boletin-terciario/proposal |
| Delta spec | sdd/boletin-terciario/spec |
| Design | sdd/boletin-terciario/design |
| Tasks | sdd/boletin-terciario/tasks |
| Apply progress | sdd/boletin-terciario/apply-progress |
| Verify report | sdd/boletin-terciario/verify-report (Engram #1172) |
| Archive report | sdd/boletin-terciario/archive-report |

---

## Files Changed (implementation)

- `api/src/application/reportes/__tests__/generate-boletin.terciario.test.ts` (new — 24 tests)
- `api/src/application/reportes/templates/boletin.template.ts` (new Terciario types)
- `api/src/application/reportes/generate-boletin.use-case.ts` (decade-4 dispatch + buildMateriasTerciario + execute wire)
- `api/src/infrastructure/reporting/html-templates/boletin-terciario.hbs` (rebuilt — transcript layout)
- `api/src/application/reportes/__tests__/generate-boletin.use-case.test.ts` (updated Terciario regression)
- `api/src/application/reportes/__tests__/generate-boletin.docente-s2.test.ts` (updated Terciario tests)

---

## Next Steps

- **PR #23 merge**: merge `feat/evaluacion-terciario` first.
- **PR for this change**: merge `feat/boletin-terciario` after #23.
- **Fase D (`docente-grade-entry`)**: authz for Terciario docente to enter cursada grades.
- **Vencimiento de regularidad**: once an expiry model is defined, implement as a new change.
- **Legacy cleanup**: retire the `NotaTrimestral` legacy path once all levels have migrated off it.
