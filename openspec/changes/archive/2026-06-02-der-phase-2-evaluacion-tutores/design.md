# Design: DER Phase 2 — Evaluación Jerárquica + Tutores/Alumnos

## Technical Approach

Frontend-first on existing API (evaluation: zero backend changes). Minimal backend enrichment for StudentGuardian (2 fields + 1 GET endpoint). Integration tests for evaluation endpoints.

## Architecture Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Separate page files per domain | Follow existing pattern: `legajos.tsx`, `students.tsx`, `pedagogy-pages.tsx`. Create `evaluation-pages.tsx` for evaluaciones/notas/periodos. |
| 2 | Reuse existing API client (`web/src/services/api.ts`) | Already configured with `/v1` baseURL + JWT interceptor. |
| 3 | Reuse Card + Table + Form patterns from `web/src/components/` | Consistency with existing UI. Card for list items, Table for nota grid. |
| 4 | Evaluation routes under `/dashboard/evaluaciones/*` | Separate from pedagogy-pages to avoid monolithic file. Sidebar links updated. |
| 5 | StudentGuardian: add fields to domain first, then cascade | Domain entity → Prisma migration → repo → DTO → controller → frontend. Standard Clean Arch flow. |
| 6 | Integration tests use supertest + test DB | Follow `api/test/` patterns. Test DB already configured via `.env.test`. |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `web/src/pages/dashboard/evaluation-pages.tsx` | **Create** | EvaluacionesPage, NotasPage, PeriodosPage, NotasTrimestralesPage |
| `web/src/App.tsx` | Modify | Add /evaluaciones/* routes, remove /grades |
| `web/src/components/layout/sidebar.tsx` | Modify | Replace /grades with /evaluaciones |
| `web/src/pages/dashboard/pedagogy-pages.tsx` | Modify | Remove broken GradesPage |
| `packages/domain/src/personnel/entities/student-guardian.ts` | Modify | Add isFinancialResponsible, isAuthorizedToPickUp |
| `api/prisma/schema_tenant.prisma` | Modify | Add 2 boolean columns to StudentGuardian |
| `api/src/.../prisma-student-guardian.repository.ts` | Modify | Save new fields in upsert |
| `api/src/presentation/student/dto/assign-guardian.dto.ts` | Modify | Add optional boolean fields |
| `api/src/presentation/student/student.controller.ts` | Modify | Add GET /:id/guardians endpoint |
| `web/src/pages/dashboard/students.tsx` | Modify | Guardian list UI + assign/remove modal |
| `web/src/components/reports/StudentPrintView.tsx` | Modify | Use StudentGuardian data instead of flat fields |
| `api/test/` | Create | Integration tests for evaluation + guardian endpoints |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Integration | POST/GET /evaluaciones, /notas, /periodos, /notas-trimestrales | supertest + test DB |
| Integration | POST/GET/DELETE /students/:id/guardians | supertest + test DB |
| Unit | StudentGuardian entity with new fields | vitest domain tests |
| Frontend | Smoke test: pages render without crash | Existing web test suite |
