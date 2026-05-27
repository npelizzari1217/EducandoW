# Proposal: Study Plans Premium UI

## Intent

Replace the functional-but-plain Study Plans → Courses → Subjects interface with a premium visual hierarchy using collapsible accordions, color-coded level badges, nested indentation, and subtle contrast — improving readability and navigation without changing domain behavior.

## Scope

### In Scope
- Accordion UI: plans collapse/expand independently; courses collapse/expand their subjects within each plan
- Visual hierarchy via left-border colors, indentation levels, and font sizing per nesting depth
- Level-based color badges (Inicial=green, Primario=blue, Secundario=amber, Terciario=purple)
- Print CSS preserving expanded accordion structure, hiding interactive controls
- PATCH `/v1/subjects/:id` and PATCH `/v1/course-sections/:id` endpoints for inline editing
- Backend return of `courseGrade` and `courseDivision` on `GET /study-plans/:id/courses`

### Out of Scope
- Drag-and-drop reordering of courses or subjects
- Batch operations (multi-select, bulk edit)
- Real-time collaboration
- Export beyond browser print

## Capabilities

### Modified Capabilities
- `study-plans`: UI behavior changes — accordion collapse/expand state, visual hierarchy with color-coded badges, print CSS refinements. Backend adds PATCH endpoints for subjects and course-sections to enable inline editing from the plan view.

## Approach

React state-driven accordion toggles in the study-plans page. Backend additions follow existing NestJS Clean Architecture: new `UpdateSubjectUC` and `UpdateCourseSectionUC` in pedagogy module, Prisma repository queries updated, DTO field casing fixed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web/src/pages/dashboard/study-plans.tsx` | Rewritten | Accordions, badges, print CSS |
| `api/src/application/pedagogy/use-cases/` | Modified | UpdateSubjectUC, UpdateCourseSectionUC |
| `api/src/presentation/pedagogy/` | Modified | PATCH /subjects/:id, PATCH /course-sections/:id |
| `api/src/presentation/auth/dto/` | Modified | DTO casing fixes |
| `api/src/infrastructure/.../prisma-study-plan.repository.ts` | Modified | courseGrade, courseDivision in query |
| `packages/domain/src/pedagogy/` | Modified | Repository port + exports |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Accordion state lost on data refresh | Low | Preserve expanded IDs in React state, re-apply after refetch |
| Print layout overflows with many courses | Low | `page-break-inside: avoid` per course block |

## Rollback Plan

1. Revert `study-plans.tsx` to previous commit
2. Remove PATCH routes from controller and module registration
3. No database changes — rollback is code-only

## Dependencies

- Existing Study Plan CRUD (change `06-planes-de-estudio`)
- Tailwind CSS (already in project)

## Success Criteria

- [ ] Plans display with colored left-border and level/academic-year badges
- [ ] Clicking a plan expands it to show courses; clicking a course expands its subjects
- [ ] Multiple plans/courses can be expanded simultaneously
- [ ] PATCH endpoints accept partial updates and return HTTP 200
- [ ] Print output hides buttons and shows full expanded content
