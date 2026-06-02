# Design: Curso por Ciclo (CourseCycle)

## Technical Approach

New bounded context `course-cycle` linking `CourseSection` + `StudyPlan` + `AcademicCycle` (Enrollment pattern). Domain entity + VOs in `packages/domain/`, use cases in `api/`, Prisma repo, REST controller, and a single CRUD page in `web/`. ID autonumérico DB-side with UUID alias for the API. Level uses the existing composite `LevelType` enum.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Bounded context** | New `course-cycle/` (not `nivel-secundario/`) | Applies to ALL 4 levels; separate bounded context keeps pedagogy entities decoupled |
| **ID strategy** | DB: `Int @default(autoincrement())` PK | User requirement. API: separate `uuid: String @unique` field — controllers return `uuid`, never `id`. Matches rest of codebase where API uses string IDs |
| **FK to Course** | `courseId → CourseSection.id` | `StudyPlanCourse` already links to `CourseSection`. The `Curso` entity (secundario) wraps `CourseSection` for a specific year — CourseCycle spans levels, so `CourseSection` is the correct join point |
| **Level VO** | Reuse `Level` (LevelType composite: 10-40) | Existing pattern across all pedagogy entities (CourseSection, Grado, Sala). Stores as `Int` in DB, maps to Level VO in domain |
| **CourseName VO** | `CourseName` — normalizes to uppercase, non-empty | Immutable historical snapshot from CourseSection at creation time |
| **PassingGrade VO** | `PassingGrade` — Float, 1-10 inclusive | Domain validation before persistence |
| **BimonthPeriod VO** | `BimonthPeriod` — validates end > start | 4 bimonth pairs each validate independently |
| **Active guard** | `ensureActive()` on entity → throws `CourseCycleClosedError` | Use cases call this before any mutation (update, delete, deactivate). Exceptions: `activate()` and `read()` skip it |
| **Bulk generation** | `GenerateCourseCyclesUseCase` with `createMany({ skipDuplicates: true })` | Prisma handles idempotency via unique `(courseId, cycleId)`. Returns `{ created, skipped, total }` |

---

## Data Flow

### Create
```
Client → ZodPipe(CreateCourseCycleSchema) → Controller
  → CreateCourseCycleUseCase
    → CourseSectionRepo.findById(courseId)     // validates course exists
    → AcademicCycleRepo.findById(cycleId)      // validates cycle exists
    → StudyPlanRepo.findById(studyPlanId)      // validates plan exists
    → CourseCycleRepo.findByPair(courseId, cycleId) → CourseCycleAlreadyExistsError?
    → CourseCycle.create({...VOs...})          // domain validates grades, dates, name
    → CourseCycleRepo.save(cc)
  → { data: { uuid, courseName, level, ... } }
```

### Bulk Generate
```
Client → POST /v1/course-cycles/generate { studyPlanId, cycleId }
  → GenerateCourseCyclesUseCase
    → StudyPlanRepo.findPlanCoursesByPlan(planId)
    → AcademicCycleRepo.findById(cycleId)      // validates active
    → for each planCourse:
        CourseCycle.create({ courseId: planCourse.courseSectionId, ... })
    → CourseCycleRepo.createMany(ccList)        // skipDuplicates via unique constraint
  → { data: { created, skipped, total } }
```

### Active Guard (write protection)
```
UpdateUseCase → repo.findById(id) → cc.ensureActive() → CourseCycleClosedError?
  → cc.update({...}) → repo.save(cc)
```

---

## Error Handling Matrix

| Domain Error | Code | HTTP |
|-------------|------|------|
| `CourseCycleAlreadyExistsError` | `COURSE_CYCLE_ALREADY_EXISTS` | 409 |
| `CourseCycleNotFoundError` | `NOT_FOUND` | 404 |
| `CourseCycleClosedError` | `COURSE_CYCLE_CLOSED` | 409 |
| `CourseSectionNotFoundError` | `NOT_FOUND` | 404 |
| `AcademicCycleNotFoundError` | `NOT_FOUND` | 404 |
| `StudyPlanNotFoundError` | `NOT_FOUND` | 404 |
| `AcademicCycleClosedError` | `ACADEMIC_CYCLE_CLOSED` | 409 |
| `BimonthPeriodInvalidError` | `VALIDATION_ERROR` | 400 |
| `ValidationError` (grade, name) | `VALIDATION_ERROR` | 400 |

Add CODES to `DOMAIN_STATUS` in `exception.filter.ts`: `COURSE_CYCLE_ALREADY_EXISTS: 409`, `COURSE_CYCLE_CLOSED: 409`, `ACADEMIC_CYCLE_CLOSED: 409`.

---

## Prisma Schema

```prisma
model CourseCycle {
  id             Int       @id @default(autoincrement())
  uuid           String    @unique @default(uuid())
  courseId       String
  studyPlanId    String
  cycleId        String
  courseName     String
  level          Int
  active         Boolean   @default(true)
  passingGrade   Float
  promotionText  String?
  firstBimStart  DateTime  @map("first_bim_start")
  firstBimEnd    DateTime  @map("first_bim_end")
  secondBimStart DateTime  @map("second_bim_start")
  secondBimEnd   DateTime  @map("second_bim_end")
  thirdBimStart  DateTime  @map("third_bim_start")
  thirdBimEnd    DateTime  @map("third_bim_end")
  fourthBimStart DateTime  @map("fourth_bim_start")
  fourthBimEnd   DateTime  @map("fourth_bim_end")
  lastModifiedAt DateTime  @updatedAt @map("last_modified_at")
  deletedAt      DateTime?

  course    CourseSection  @relation(fields: [courseId], references: [id])
  studyPlan StudyPlan      @relation(fields: [studyPlanId], references: [id])
  cycle     AcademicCycle   @relation(fields: [cycleId], references: [id])

  @@unique([courseId, cycleId])
  @@index([cycleId])
  @@index([studyPlanId])
  @@index([level])
  @@map("course_cycles")
}
```

---

## File Manifest

### New files

| File | Layer | Purpose |
|------|-------|---------|
| `packages/domain/src/course-cycle/index.ts` | Domain | Barrel exports |
| `packages/domain/src/course-cycle/entities/course-cycle.ts` | Domain | Entity + props + `ensureActive()`, `softDelete()` |
| `packages/domain/src/course-cycle/value-objects/course-name.ts` | Domain | VO: uppercase, non-empty |
| `packages/domain/src/course-cycle/value-objects/passing-grade.ts` | Domain | VO: Float 1-10 |
| `packages/domain/src/course-cycle/value-objects/bimonth-period.ts` | Domain | VO: validates end > start |
| `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts` | Domain | Interface: `findById`, `findByPair`, `findAll`, `save`, `createMany`, `softDelete` |
| `packages/domain/src/course-cycle/__tests__/entities/course-cycle.test.ts` | Domain | Unit: factory, ensureActive, softDelete |
| `packages/domain/src/course-cycle/__tests__/value-objects/*.test.ts` | Domain | Unit: VO validation |
| `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` | App | 7 use cases (CRUD + generate + toggle) |
| `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts` | App | Unit: mocks repo |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts` | Infra | Prisma impl with TenantContext |
| `api/src/presentation/course-cycle/course-cycle.controller.ts` | Present. | 8 endpoints |
| `api/src/presentation/course-cycle/dto/course-cycle.dto.ts` | Present. | Zod schemas for create/update/generate |
| `api/src/presentation/course-cycle/course-cycle.module.ts` | Present. | NestJS module |
| `web/src/pages/dashboard/course-cycles.tsx` | Web | CRUD page with filters, generate modal |

### Modified files

| File | Change |
|------|--------|
| `packages/domain/src/index.ts` | Export `CourseCycle`, VOs, repository interface |
| `api/prisma/schema_tenant.prisma` | Add `CourseCycle` model |
| `api/src/app.module.ts` | Import `CourseCycleModule` |
| `api/src/presentation/shared/filters/exception.filter.ts` | Add new error codes to `DOMAIN_STATUS` |
| `web/src/App.tsx` | Add route `/course-cycles` |
| `web/src/components/layout/sidebar.tsx` | Add menu item "Cursos por Ciclo" in "Académico" group |

---

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| VO unit | `CourseName`, `PassingGrade`, `BimonthPeriod` | Test valid/invalid values, edge cases |
| Entity unit | `CourseCycle.create`, `ensureActive()`, `softDelete()` | Factory creates valid; guard throws on closed |
| Use case unit | Each use case with mocked repo | Verify repo calls and error paths |
| Repo integration | Unique constraint, `createMany` skipDuplicates | Real test DB; verify 409 on duplicate |
| Controller e2e | All 8 endpoints | Supertest; verify HTTP status codes |
| Frontend | Page renders, filters work, generate modal | Vitest + React Testing Library |

---

## Open Questions

- None — all decisions resolved in architecture decisions above.
