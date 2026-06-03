# Design: Course Cycle Generate Improvements

## Architecture Decisions

### AD-1: UPSERT via findByPair + conditional update/create
**Decision**: Per-course loop: `findByPair(courseId, cycleId)` → exists? update courseName : create.
**Rationale**: `CourseCycleRepository.findByPair` already exists and filters `deletedAt: null`. `CourseCycle.update()` already supports `courseName`. No new repository methods needed. `createMany` can't update — must iterate.
**Alternative considered**: Bulk upsert via raw SQL. Rejected — breaks Clean Architecture (repo is the port).

### AD-2: Multi-plan support via optional studyPlanId
**Decision**: When `studyPlanId` is absent, use `StudyPlanRepository.findAll()` filtered by `level` (base level, extracted via `Math.floor(level/10)`) to get all plans, then iterate each plan's courses.
**Rationale**: User wants "all plans for the selected level". `StudyPlanRepository` already supports `findAll` with filters. `findPlanCoursesByPlan(planId)` per plan.

### AD-3: Level derivation via Level.fromParts
**Decision**: `Level.fromParts(plan.level, plan.modality)` → composite code. Remove `buildLevel('PRIMARIO')` hardcode.
**Rationale**: `Level.fromParts` exists in domain. Each StudyPlan has `level` (EducationalLevelCode 1-4) and `modality` (EducationalModalityCode 0-2). CourseCycle.level is composite (10-40).

### AD-4: Result type extension
**Decision**: Add `updated: number` to `CreateManyResult`. Response becomes `{ created, updated, total }`.
**Rationale**: User needs visibility into updates vs creates. `skipped` was misleading (duplicates were just skipped, not updated).

## File Manifest

### Modified
| File | Change |
|------|--------|
| `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` | Rewrite `GenerateCourseCyclesUseCase.execute()` with UPSERT + multi-plan |
| `api/src/presentation/course-cycle/dto/course-cycle.dto.ts` | Add `level` to schema, make `studyPlanId` optional |
| `api/src/presentation/course-cycle/course-cycle.controller.ts` | Map new DTO fields to use case input |
| `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts` | Add `updated: number` to `CreateManyResult` |
| `web/src/pages/dashboard/course-cycles.tsx` | Remove modal + "Nuevo Curso" button; wire "Generar Cursos" to filters; add toast result |
| `web/src/types/course-cycle.ts` | Update `GenerateResult` type |

### Deleted
| File | Reason |
|------|--------|
| `web/src/components/course-cycle/GenerateCourseCyclesModal.tsx` | Modal replaced by page-level filters |

### Created
None.

## Use Case Pseudocode

```
GenerateCourseCyclesUseCase.execute(input: { level: number, cycleId: string, studyPlanId?: string })
  // 1. Validate cycle
  cycle = academicCycleRepo.findByUuid(input.cycleId)
  if !cycle → throw NotFoundError
  if !cycle.active → throw AcademicCycleClosedError

  // 2. Determine plans to process
  plans: StudyPlan[] = []
  if input.studyPlanId:
    plan = studyPlanRepo.findById(input.studyPlanId)
    if !plan → throw NotFoundError
    plans = [plan]
  else:
    baseLevel = Math.floor(input.level / 10)  // composite→base: 20→2
    plans = studyPlanRepo.findAll({ level: baseLevel })

  // 3. Process each plan
  created = 0, updated = 0, total = 0
  for each plan in plans:
    planCourses = studyPlanRepo.findPlanCoursesByPlan(plan.id)
    for each pc in planCourses:
      compositeLevel = Level.fromParts(plan.level, plan.modality)
      courseName = CourseName.create(pc.courseSectionName ?? 'Sin nombre').unwrap()
      passingGrade = PassingGrade.create(6).unwrap()

      existing = courseCycleRepo.findByPair(pc.courseSectionId, input.cycleId)
      if existing:
        existing.update({ courseName })
        courseCycleRepo.save(existing)
        updated++
      else:
        cc = CourseCycle.create({
          courseId: pc.courseSectionId,
          studyPlanId: plan.id,
          cycleId: input.cycleId,
          courseName,
          level: compositeLevel,
          passingGrade,
          promotionText: null,
          firstBimonth: null, secondBimonth: null,
          thirdBimonth: null, fourthBimonth: null,
        })
        courseCycleRepo.save(cc)
        created++
      total++

  return { created, updated, total }
```

## Frontend Component Changes

### Removed
- `GenerateCourseCyclesModal` component + import
- `showGenerateModal` state
- `handleGenerated` callback
- `showForm` / `editing` state and related JSX (CreateForm, EditForm blocks)
- "Nuevo Curso por Ciclo" button

### Modified
- `handleGenerate` function: validates `filters.level` and `filters.cycleId`, calls `POST /course-cycles/generate` with `{ level, cycleId, studyPlanId }`, reloads table
- "Generar Cursos" button: `disabled` when level or cycleId not selected; calls `handleGenerate`

### New
- Toast/snackbar showing `{ created, updated, total }` after generate

## Migration Impact
None — no DB schema changes. The unique constraint `(courseId, cycleId)` already exists at DB level via Prisma `@@unique`.
