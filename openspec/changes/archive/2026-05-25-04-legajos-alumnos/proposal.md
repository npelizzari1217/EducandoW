# Proposal: Legajos de Alumnos

## Intent

Provide a comprehensive student file (legajo) view aggregating personal data, enrollment history, grades, and attendance in a single page. Currently scattered across separate screens — the legajo unifies it for ADMIN, MANAGER, and TEACHER roles. Applies to ALL pedagogical levels.

## Scope

### In Scope
- Frontend page `/legajos` with student search by name/DNI and 4-section display: Datos Personales, Matrículas, Calificaciones, Asistencia
- Print-friendly layout via `@media print` CSS
- Role-based access (ADMIN, MANAGER, TEACHER)
- Possibly: backend `GET /students/:id/legajo` aggregation endpoint (design-phase decision)

### Out of Scope
- Editing student data from the legajo view
- PDF generation beyond browser print
- Bulk export or legajo comparison
- Historical/comparative analytics

## Capabilities

### New Capabilities
- `legajo-view`: Aggregated student file view combining personal info, enrollment history, grades, and attendance from multiple backend sources
- `legajo-print`: Print-optimized CSS layout for physical legajo output
- `legajo-aggregation`: Backend endpoint returning full legajo in one API call (TBD in design — currently 4 parallel calls)

### Modified Capabilities
None — first formal spec for this feature.

## Approach

Frontend-first delivery. Page already implemented at `web/src/pages/dashboard/legajos.tsx`. Route `/legajos` registered in App.tsx, sidebar item added. Uses 4 parallel `Promise.all` calls to existing endpoints: `GET /students/:id`, `GET /enrollments?studentId=`, `GET /notas?studentId=`, `GET /attendance?studentId=`.

Design phase evaluates whether to consolidate into `GET /students/:id/legajo`. Tradeoff: 4 calls = simpler, no backend work. 1 call = better perf, atomic, pagination support, but requires new backend use case + controller.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web/src/pages/dashboard/legajos.tsx` | New | Legajo page (already built) |
| `web/src/App.tsx` | Modified | Route `/legajos` added |
| `web/src/components/layout/sidebar.tsx` | Modified | "Legajos" nav item added |
| `api/src/presentation/student/` | Possibly Modified | New `GET /students/:id/legajo` endpoint (TBD) |
| `packages/domain/src/student/` | Possibly Modified | New use case + repository method (TBD) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| One of 4 parallel calls fails, losing entire legajo | Low | Per-section error boundaries showing partial data with error indicators |
| Large datasets (many enrollments/grades) degrade perf | Med | Server-side pagination via aggregation endpoint; client-side limit to recent academic year |
| Print CSS breaks on some browsers | Low | Test Chrome/Firefox; use `@page` rules for margins |

## Rollback Plan

1. Remove `web/src/pages/dashboard/legajos.tsx`
2. Revert App.tsx route and sidebar item
3. No DB migrations, no backend schema changes — pure frontend rollback
4. If backend aggregation endpoint was added: remove controller + use case, revert student controller

## Dependencies

- Existing endpoints: `GET /students/search`, `GET /students/:id`, `GET /enrollments`, `GET /notas`, `GET /attendance`
- Auth: JWT with `institutionId` (already provided by auth-context)

## Success Criteria

- [ ] Search by name/DNI returns matching students within the institution
- [ ] Selecting a student loads all 4 sections (Datos Personales, Matrículas, Calificaciones, Asistencia)
- [ ] Each section shows data or appropriate empty state
- [ ] Print button produces legible physical output
- [ ] Sidebar item shows for institutions with configured levels
- [ ] Only ADMIN, MANAGER, TEACHER roles can access the page
