# Tasks: Fix API Build

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~40 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Repositories (Infrastructure)

- [x] 1.1 Fix `prisma-academic-cycle.repository.ts`: wrap `r.level` with `EducationalLevel.fromCode()`, `r.modality` with `EducationalModality.fromCode()` in `toDomain`; extract `.code` in `toPersistence`
- [x] 1.2 Fix `prisma-enrollment.repository.ts`: use `enrollment.status.value` in `save` (create + update); use `EnrollmentStatus.reconstruct(record.status)` in `toDomain`
- [x] 1.3 Fix `prisma-student.repository.ts`: wrap institutionId with `Id.create(institutionId)` in `toDomain`
- [x] 1.4 Fix `prisma-teacher.repository.ts`: wrap institutionId with `Id.create(institutionId)` in `toDomain`

## Phase 2: Use Cases (Application)

- [x] 2.1 Fix `pedagogy.use-cases.ts`: import `EducationalLevel`, `EducationalModality`; wrap `input.level`/`input.modality` before `AcademicCycle.create()`
- [x] 2.2 Fix `student.use-cases.ts`: import `Id`; wrap `input.institutionId` with `Id.create()` before `Student.create()`
- [x] 2.3 Fix `teacher.use-cases.ts`: import `Id`; wrap `input.institutionId` with `Id.create()` before `Teacher.create()`

## Phase 3: Verification

- [x] 3.1 Run `pnpm build` — must pass with 0 errors
- [x] 3.2 Run `pnpm test` — all 284+ tests must pass
- [x] 3.3 Run `pnpm lint` — no new violations
