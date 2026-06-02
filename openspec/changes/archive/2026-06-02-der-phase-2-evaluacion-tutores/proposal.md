# Proposal: DER Phase 2 — Evaluación Jerárquica + Tutores/Alumnos

## Intent

Fix live broken GradesPage (calls non-existent `/grades` endpoint) by building evaluation UI on working Evaluacion→Nota API. Enrich StudentGuardian with DER-required boolean fields and build guardian management UI.

## Scope

### In Scope
- Replace GradesPage with EvaluacionesPage, NotasPage, PeriodosPage using existing `/evaluaciones`, `/notas`, `/periodos`, `/notas-trimestrales` endpoints
- Update App.tsx routes and sidebar (remove `/grades`, add `/evaluaciones`, `/periodos`)
- Add `isFinancialResponsible` + `isAuthorizedToPickUp` to StudentGuardian (domain, Prisma, DTO, repo)
- Add `GET /students/:id/guardians` endpoint
- Build guardian list/add/remove UI on student detail page
- Add API integration tests for evaluation endpoints (zero coverage today)
- Update StudentPrintView to read guardian data from StudentGuardian

### Out of Scope
- Batch note entry API
- Teacher-filtered evaluation views
- Removing guardianName/guardianPhone from Student model (separate migration)
- Level-specific evaluation integration (CalificacionPrimario stays separate)
- Standalone Tutor entity

## Capabilities

> Esta sección es el CONTRATO con la fase de specs.
> El agente sdd-spec la lee para saber exactamente qué archivos de spec crear o actualizar.

### New Capabilities
- `evaluation-frontend`: EvaluacionesPage, NotasPage, PeriodosPage web UI reemplazando GradesPage rota
- `guardian-management`: UI de gestión de tutores + GET /students/:id/guardians + enriquecimiento de campos DER

### Modified Capabilities
- `student-guardian`: agregar `isFinancialResponsible` + `isAuthorizedToPickUp` a entidad/Prisma/DTO/repo; agregar endpoint GET

## Approach

Frontend-first sobre API existente. Backend mínimo: 2 booleanos + 1 GET endpoint para StudentGuardian. Tests de integración para endpoints de evaluación.

**Nivel pedagógico afectado**: ALL (la UI de evaluación aplica a todos los niveles; StudentGuardian es transversal)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web/src/pages/dashboard/pedagogy-pages.tsx` | Modified | Replace GradesPage with evaluation pages |
| `web/src/App.tsx` | Modified | Update routes |
| `web/src/components/layout/sidebar.tsx` | Modified | Update nav items |
| `web/src/pages/dashboard/students.tsx` | Modified | Add guardian management UI |
| `web/src/components/reports/StudentPrintView.tsx` | Modified | Use StudentGuardian for guardian data |
| `packages/domain/src/personnel/entities/student-guardian.ts` | Modified | Add 2 boolean fields |
| `api/prisma/schema_tenant.prisma` | Modified | Add 2 boolean columns to StudentGuardian |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-student-guardian.repository.ts` | Modified | Persist new fields |
| `api/src/presentation/student/dto/assign-guardian.dto.ts` | Modified | Add optional booleans |
| `api/src/presentation/student/student.controller.ts` | Modified | Add GET /students/:id/guardians |
| `api/test/` | New | Integration tests for evaluation endpoints |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Broken GradesPage is live bug | High | Priority fix — deploy evaluation UI first |
| guardianName/guardianPhone double source of truth | Medium | StudentGuardian is canonical; flat fields read-only |
| No evaluation API tests | Medium | Add integration tests in this phase |
| Evaluation strategies not wired to general endpoints | Low | Document that level-specific models handle per-level rules |

## Rollback Plan

1. Revert frontend route changes, restore `/grades` path to old GradesPage stub
2. Revert StudentGuardian field additions (2 booleans + GET endpoint) — existing POST/DELETE unaffected
3. Remove new integration test files

## Dependencies

None. All backend evaluation endpoints already exist and are functional.

## Success Criteria

- [ ] `/grades` route replaced; evaluaciones/notas/periodos pages load and CRUD works
- [ ] StudentGuardian includes isFinancialResponsible + isAuthorizedToPickUp; GET endpoint returns them
- [ ] Guardian management UI allows add/remove per student
- [ ] API integration tests for evaluation endpoints pass (≥80% coverage)
- [ ] StudentPrintView shows guardian data from StudentGuardian
