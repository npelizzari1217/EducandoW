# Proposal: Supplementary Exams

## Intent

Students with `PREVIA` or `LIBRE` condition have no way to record supplementary exam results (Diciembre, Febrero) nor compute the definitive grade (`Definitiva`) for report cards. Secundario and Terciario need this recovery flow.

## Scope

### In Scope
- Domain entity `CalificacionSecundario` with definitiva logic
- API endpoints to record/retrieve Diciembre/Febrero grades on `CalificacionSecundario`
- Business rule: `Definitiva = max(nota, notaDiciembre, notaFebrero, lastNonnull)`
- Endpoint to list students flagged for supplementary exams
- Extend Terciario `ActaExamen` → `InscripcionMateria` grade flow

### Out of Scope
- UI/frontend, Primario/Inicial grading, MesaExamen flow refactor, WINDEV data migration

## Capabilities

### New Capabilities
- `supplementary-exams`: exam recovery rules, definitiva calculation, and student flagging for Secundario and Terciario

### Modified Capabilities
- `nivel-secundario`: endpoints for recording `notaDiciembre`/`notaFebrero` and retrieving definitiva
- `nivel-terciario`: extended `ActaExamenNota` → `InscripcionMateria.estado` update on approval

## Approach

Domain entity with `calcularDefinitiva()` method. Application use cases: `RegistrarNotaSuplementaria`, `ConsultarAlumnosExamen`, `CalcularDefinitiva`. Wire into existing `nivel-secundario` presentation module. For Terciario, extend existing actas flow. No DB migration needed — `notaDiciembre` and `notaFebrero` already exist.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/src/domain/calificacion-secundario/` | New | Entity + definitiva logic |
| `api/src/application/secundario/` | New | Supplementary exam use cases |
| `api/src/presentation/nivel-secundario/` | Modified | Controller + DTOs |
| `api/src/infrastructure/` | Modified | Prisma repository |
| `api/src/application/terciario/` | Modified | Extended acta-examen logic |
| `openspec/specs/nivel-secundario/` | Modified | Delta spec |
| `openspec/specs/nivel-terciario/` | Modified | Delta spec |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Febrero vs Marzo naming mismatch with WINDEV | Low | Use current schema names; document mapping |
| Duplicate grading (MesaExamen vs Calificacion) | Med | Separate concerns — boards vs per-student results |
| Client-side definitiva calculation | Low | Server-only; domain entity owns the rule |

## Rollback Plan

1. Remove controllers/DTOs from `nivel-secundario.module.ts`
2. Drop domain/application directories for calificacion-secundario
3. No data loss — existing columns remain

## Dependencies

- `enrollment-status` (student enrollment state)
- `academic-cycle-query` (current academic year)

## Success Criteria

- [ ] API endpoint to record `notaDiciembre`/`notaFebrero` on a `CalificacionSecundario` row
- [ ] Endpoint to list students needing supplementary exams (PREVIA/LIBRE without exam grade)
- [ ] `calcularDefinitiva()` returns correct value including null handling
- [ ] Terciario `ActaExamenNota` approval updates `InscripcionMateria.estado`
- [ ] Domain logic covered by unit tests
