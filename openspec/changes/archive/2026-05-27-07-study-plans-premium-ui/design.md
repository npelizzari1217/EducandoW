# Design: Study Plans Premium UI

## Technical Approach

Single-file React component (`study-plans.tsx`) replaces the plain CRUD table with a nested accordion UI — plans expand to show courses, courses expand to show subjects. Backend adds `PATCH /subjects/:id` and `PATCH /course-sections/:id` to enable inline field editing directly from the plan view, plus enriches plan-course responses with `courseGrade` and `courseDivision`.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Single-file component vs extracted sub-components | Sub-components would clean up the file but require prop-drilling across 3 nesting levels | **Single file**. No sub-components extracted — complexity of prop wiring outweighs readability gain at this scale. |
| CSS modules vs inline `<style>` tag | CSS modules give scoping guarantees and IDE autocompletion; inline styles keep everything in one file | **Inline `<style>` tag**. The CSS is premium-styling-only (not layout), colocated with the single consumer. |
| `Set<string>` for expanded state vs array/object boolean | Array requires O(n) lookup; boolean-per-ID object works but is more verbose to toggle | **`Set<string>`**. Native `.has()/.delete()/.add()` semantics match accordion toggle perfectly; immutability via `new Set(existing)`. |
| Full page reload after mutations vs selective refetch | Reload is simpler but loses expanded state and causes flicker | **Selective refetch** via `refreshPlanCourses()` and `refreshPlanCourseSubjects()` helpers. Preserves accordion state. |
| `Subject.reconstruct({...existing.props, ...})` vs `Subject.update()` method | Update method would be more explicit but requires adding to all domain entities | **`reconstruct` pattern**. Matches existing `UpdateStudyPlanUC` convention — consistency over abstraction. |

## Data Flow

```
study-plans.tsx
  ├─ useApiList<StudyPlan>('/study-plans')       ← initial plan list
  ├─ togglePlan(id) → GET /study-plans/:id/courses  ← fetches PlanCourse[]
  ├─ togglePlanCourseSubjects(id) → GET /study-plan-courses/:id/subjects  ← fetches subjects
  ├─ inline edit → PATCH /subjects/:id           ← domain: UpdateSubjectUC → Subject.reconstruct(…)
  ├─ inline edit → PATCH /course-sections/:id    ← domain: UpdateCourseSectionUC → CourseSection.reconstruct(…)
  └─ create+associate → POST /course-sections → POST /study-plans/:id/courses  (chained)
```

Mutations never trigger full-list reload. Each mutation calls its entity-specific `refresh` helper that targets only the affected slice of state.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `web/src/pages/dashboard/study-plans.tsx` | Modified | Complete rewrite: accordion UI with nested state, inline edit forms, `<style>` block with premium CSS, print media queries |
| `packages/domain/src/pedagogy/repositories/study-plan-repository.ts` | Modified | Adds `courseGrade?`, `courseDivision?` to `StudyPlanCourseDto` |
| `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | Modified | New `UpdateSubjectUC` and `UpdateCourseSectionUC` classes using entity `.reconstruct()` pattern |
| `api/src/presentation/pedagogy/pedagogy.controller.ts` | Modified | New `PATCH /subjects/:id` and `PATCH /course-sections/:id` endpoints; `listPlanCourses` response includes `courseGrade`, `courseDivision` |
| `api/src/presentation/auth/dto/register.request.ts` | Modified | New `UpdateSubjectSchema`, `UpdateCourseSectionSchema` Zod schemas with `.transform(s => s.trim())` |
| `api/src/infrastructure/.../prisma-study-plan.repository.ts` | Modified | `findPlanCoursesByPlan` and `findPlanCourseById` now include `courseSection.grade` and `courseSection.division` in DTO mapping |

## Interfaces / Contracts

```typescript
// DTO transformations (Zod)
UpdateSubjectSchema = z.object({
  name: z.string().min(1).max(200).transform(s => s.trim()).optional(),
});
UpdateCourseSectionSchema = z.object({
  name: z.string().min(1).max(100).transform(s => s.trim()).optional(),
  grade: z.string().min(1).max(50).transform(s => s.trim()).optional(),
  division: z.string().min(1).max(50).transform(s => s.toUpperCase().trim()).optional(),
});
```

```typescript
// Domain: StudyPlanCourseDto (enriched fields)
interface StudyPlanCourseDto {
  courseGrade?: string | null;     // NEW — prevents extra API call in UI
  courseDivision?: string | null;  // NEW — same
  // … existing fields unchanged
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Domain | `Subject.reconstruct()` with partial props, `CourseSection.reconstruct()` name auto-generation | Existing Vitest unit test pattern in `packages/domain` |
| Integration | `PATCH /subjects/:id` returns 200; `PATCH /course-sections/:id` updates name/grade/division | Controller-level NestJS test with mocked repository |
| E2E | Accordion expands/collapses; inline edit saves persist; print layout hides controls | Browser tests after deployment |

## Migration / Rollout

No migration required — no database schema changes. Rollback is code-only: revert the frontend file and remove the two `@Patch` routes from controller registration.

## Open Questions

None.
