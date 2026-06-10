# Proposal: Secundario Grading (Fase 4 Etapa 2)

## Intent

Secundario grading runs on two legacy models (`CalificacionSecundario` on the legacy `Curso` FK, and the `NotaTrimestral` the boletín reads) that only surface a per-subject average with no per-trimester breakdown, no audit trail, and no way to model LIBRE. Move Secundario onto the level-agnostic foundation already built for Primario so it gets modern, audit-trailed, per-trimester grading + finals, competencies, an explicit `condición` (REGULAR/PREVIA/LIBRE), and carry-over previas — with the boletín rebuilt to match.

## Scope

### In Scope
- Secundario branch (`Math.floor(level/10) === 3`) in the boletín dispatch reading `SubjectPeriodGrade` + `SubjectFinalGrade` (zero new grade tables; scale level=3 and trimester template level=3 already seeded).
- Explicit `condicion` column (REGULAR | PREVIA | LIBRE) on `SubjectFinalGrade` — ONE Prisma migration on tenant DB. Models LIBRE, which `internalStatus` cannot.
- NEW entity: materias previas históricas (academic debt per student per year) + loading + boletín section.
- Competencies for Secundario: REUSE Primario `CompetencyValuation` + per-cell imprimible toggle + competency boletín section.
- Rebuild `boletin-secundario.hbs`: dynamic per-trimester columns + 4 final instances + `condicion` per subject + competency section + previas section.
- Entry screens for Secundario grade capture (UX approach deferred to design).

### Out of Scope
- Legacy data migration — start fresh; no live data in `calificaciones_secundario`/`notas_trimestrales`.
- Terciario (keeps the legacy `NotaTrimestral` `else` branch).
- Retiring `NotaTrimestral` / `CalificacionSecundario` (kept for Terciario / backward compat).

## Capabilities

### New Capabilities
- `secundario-grading`: per-trimester + final grade capture for Secundario on the level-agnostic foundation, with `condición` (REGULAR/PREVIA/LIBRE).
- `materias-previas`: track and report carry-over academic debt per student per year.

### Modified Capabilities
- `boletin-generation`: add Secundario branch with dynamic columns, finals, condición, competencies, previas.
- `subject-final-grades`: add explicit `condicion` to the final-grade model + upsert flow.

## Approach

Mirror Primario. Reuse `SubjectPeriodGrade`/`SubjectFinalGrade`/`SubjectGradingPeriod`, their repos, `UpsertSubjectPeriodGrades`/`UpsertSubjectFinalGrades`, read endpoints, `TeacherFilteredSelector`, `use-grading-grid`, competency model, and boletín level dispatch. Add: (1) `condicion` migration on `SubjectFinalGrade`; (2) the previas entity + use cases; (3) `buildMateriasSecundario()` branch; (4) rebuilt boletín template. Period structure (trimestral/cuatrimestral/bimestral) stays dynamic via the existing snapshot + dynamic columns — no hardcoding.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/domain` | Modified/New | `condicion` on `SubjectFinalGrade`; new materias-previas entity |
| `api` | Modified/New | Upsert condición; previas use cases; boletín Secundario branch |
| `apps/web` | New/Modified | Entry screens; rebuilt `boletin-secundario.hbs` |
| `api/prisma_tenant` | Modified | ONE migration: `condicion` column on `SubjectFinalGrade` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| LIBRE/condición entry flow on screens | Med | Design phase resolves the UX + write path |
| Previas entity shape (fields, keying) | Med | Design phase models it before tasks |
| Entry-screen UX (generalize vs new routes) | Med | Explicit open design decision |
| Dual legacy-model coexistence | Low | Fresh start; legacy `else` branch untouched |

## Rollback Plan

Revert the `condicion` migration (column drop, nullable so safe), remove the Secundario boletín branch (falls back to legacy `NotaTrimestral` path), drop the previas table. No legacy data touched, so rollback is non-destructive.

## Dependencies

- grading-primario (Fase 4 Etapa 1) — COMPLETE. Supplies ~40-60% of the work for free.
- Seeded `gs-secundaria` (level=3) and `gpt-secundaria-trimestral` — present.

## Success Criteria

- [ ] Secundario boletín renders per-trimester columns, 4 finals, condición, competencies, previas.
- [ ] Grades capturable via entry screens and persisted on `SubjectPeriodGrade`/`SubjectFinalGrade`.
- [ ] `condicion` (REGULAR/PREVIA/LIBRE) settable and shown.
- [ ] Terciario boletín (legacy path) unchanged.

> Strict TDD is active for this project — applies to the implementation phases (apply/verify), not this proposal.
