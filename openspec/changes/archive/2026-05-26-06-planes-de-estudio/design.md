# Design: Planes de Estudio

## Technical Approach

Follows the existing pedagogy module pattern: domain entities in `@educandow/domain`, Prisma repositories via `TenantContext`, thin use cases, Zod DTOs, and a React page with `useApiList`/`useApiCreate` hooks. Three tenant-schema models (no `institutionId` — tenant DB handles isolation). API uses separate nested endpoints matching the codebase's single-responsibility use cases. Frontend submits the 3-section form by orchestrating sequential API calls.

## Architecture Decisions

| # | Decision | Option A | Option B | Choice |
|---|----------|----------|----------|--------|
| 1 | API structure | Separate endpoints: CRUD + nested `/courses` and `/subjects` routes | Single `POST` with full nested payload | **A** — matches pedagogy pattern, simpler use cases |
| 2 | Entity layer | Domain entities (`StudyPlan.create()` / `reconstruct()`) | Plain Prisma models | **A** — consistency with every existing model |
| 3 | ROOT institution | Dropdown fetches `GET /institutions`, tenant switches on selection | Dedicated root endpoint | **A** — same pattern as course-sections page |
| 4 | Print | `@media print` CSS + `page-break-inside: avoid` per course | PDF server-side generation | **A** — out of scope per proposal, CSS is zero-cost |
| 5 | Migration | `prisma db push` for prototype | Formal migration file | **A** — prototype mode per proposal |

## Data Flow

```
Submit → POST /study-plans (plan metadata) → returns { id }
           ├→ POST /study-plans/:id/courses × N (courseSectionId)
           └→ POST /study-plan-courses/:id/subjects × N (subjectId, hoursPerWeek?)
```

## API Endpoints

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| `GET` | `/study-plans` | ADMIN, MANAGER, TEACHER | List (query: `level`) |
| `GET` | `/study-plans/:id` | ADMIN, MANAGER, TEACHER | Detail nested: `{ ..., courses: [{ ..., courseSection, subjects: [{ ..., subject }] }] }` |
| `POST` | `/study-plans` | ADMIN, MANAGER | Create `{ name, level, modality, academicYear }` |
| `PATCH` | `/study-plans/:id` | ADMIN, MANAGER | Update metadata |
| `DELETE` | `/study-plans/:id` | ADMIN | Soft-delete |
| `POST` | `/study-plans/:id/courses` | ADMIN, MANAGER | Add course `{ courseSectionId }` |
| `DELETE` | `/study-plans/:id/courses/:courseId` | ADMIN, MANAGER | Remove course |
| `POST` | `/study-plan-courses/:id/subjects` | ADMIN, MANAGER | Add subject `{ subjectId, hoursPerWeek? }` |
| `DELETE` | `/study-plan-courses/:id/subjects/:subjectId` | ADMIN, MANAGER | Remove subject |

## File Changes

### Domain (`packages/domain`)

| File | Action |
|------|--------|
| `src/pedagogy/entities/study-plan.ts` | Create — `StudyPlan` entity (id, name, level, modality, academicYear, active, deletedAt) |
| `src/pedagogy/entities/study-plan-course.ts` | Create — junction entity: StudyPlan ↔ CourseSection |
| `src/pedagogy/entities/study-plan-subject.ts` | Create — junction entity: StudyPlanCourse ↔ Subject, optional `hoursPerWeek` |
| `src/pedagogy/repositories/study-plan-repository.ts` | Create — `StudyPlanRepository` interface with CRUD + association methods |
| `src/pedagogy/index.ts` | Modify — export new entities and interface |
| `src/index.ts` | Modify — re-export new exports |

### API (`api`)

| File | Action |
|------|--------|
| `prisma/schema_tenant.prisma` | Modify — add `StudyPlan`, `StudyPlanCourse`, `StudyPlanSubject` models |
| `src/application/study-plans/use-cases/study-plans.use-cases.ts` | Create — 9 use cases (Create, List, GetDetail, Update, Delete, AddCourse, RemoveCourse, AddSubject, RemoveSubject) |
| `src/infrastructure/.../repositories/prisma-study-plan.repository.ts` | Create — Prisma impl using `TenantContext.getClient()` with `include` for nested queries |
| `src/presentation/study-plans/dto/study-plan.dto.ts` | Create — Zod schemas: Create, Update, AddCourse, AddSubject |
| `src/presentation/study-plans/study-plans.controller.ts` | Create — `@Controller('study-plans')`, AuthGuard + RolesGuard |
| `src/presentation/study-plans/study-plans.module.ts` | Create — NestJS module wiring (useFactory DI) |
| `src/app.module.ts` | Modify — import `StudyPlansModule` |

### Frontend (`web`)

| File | Action |
|------|--------|
| `src/pages/dashboard/study-plans.tsx` | Create — 3-section Card form, table list, print button, auto-fill institution/level |
| `src/components/layout/sidebar.tsx` | Modify — add `{ label: 'Planes de Estudio', path: '/study-plans', requiresLevel: true }` |
| `src/App.tsx` | Modify — add `<Route path="/study-plans" element={<StudyPlansPage />} />` |

## Key Contracts

```typescript
interface StudyPlanRepository {
  findById(id: string): Promise<StudyPlan | null>;
  findAll(level?: LevelType): Promise<StudyPlan[]>;
  findByIdWithCourses(id: string): Promise<StudyPlanWithCourses | null>;
  save(plan: StudyPlan): Promise<void>;
  delete(id: string): Promise<void>;
  addCourse(planId: string, courseSectionId: string): Promise<StudyPlanCourse>;
  removeCourse(courseId: string): Promise<void>;
  addSubject(courseId: string, subjectId: string, hoursPerWeek?: number): Promise<StudyPlanSubject>;
  removeSubject(subjectId: string): Promise<void>;
}
```

GET detail response nests `courses[]` each containing `courseSection` and `subjects[]` each containing `subject` — loaded via Prisma `include`.

## Testing Strategy

| Layer | Approach |
|-------|----------|
| Domain | Vitest unit tests: entity creation, `softDelete()` |
| Repository | Integration with test tenant DB: CRUD + nested include |
| Controller | Supertest: Zod validation (400), role guards (403) |
| Frontend | Form orchestration, institution/level auto-fill, ROOT dropdown |

## Rollout

`prisma db push`. Rollback: drop 3 tables, remove module + route + sidebar entry.
