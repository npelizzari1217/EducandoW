# Tasks: Domain Cleanup — Value Object Consistency

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250–310 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: EnrollmentStatus VO (Foundation)

- [x] 1.1 Create `packages/domain/src/enrollment/value-objects/enrollment-status.ts` — class with private constructor, static `create(value): Result<EnrollmentStatus, ValidationError>`, `reconstruct()`, `equals()`, `toString()`. Valid: ACTIVE, INACTIVE, GRADUATED, TRANSFERRED. Follow `EducationalLevel` pattern.
- [x] 1.2 Create `packages/domain/src/enrollment/value-objects/index.ts` — barrel re-exporting `EnrollmentStatus` and `EnrollmentStatusValue`.
- [x] 1.3 Update `packages/domain/src/enrollment/entities/enrollment.ts` — remove `type EnrollmentStatus` alias. Import VO from `../value-objects`. Change `EnrollmentProps.status` to `EnrollmentStatus`. `create()` uses `EnrollmentStatus.reconstruct('ACTIVE')`. `changeStatus()` accepts VO.
- [x] 1.4 Update `packages/domain/src/enrollment/entities/index.ts` — re-export VO class (was type alias). Update `packages/domain/src/enrollment/index.ts` — re-export VO.
- [x] 1.5 Create `packages/domain/src/enrollment/__tests__/value-objects/enrollment-status.test.ts` — test all 4 valid statuses, invalid rejection, empty string, `reconstruct` bypasses validation, equality.
- [x] 1.6 Update `packages/domain/src/enrollment/__tests__/entities/enrollment.test.ts` — assert `e.status.value` instead of string, `EnrollmentStatus.reconstruct('ACTIVE')` in reconstruct props, pass VO to `changeStatus()`.

## Phase 2: InstitutionId Typing (Student & Teacher)

- [x] 2.1 Update `packages/domain/src/personnel/entities/student.ts` — import `Id` from shared. Change `StudentProps.institutionId` to `Id | undefined`. `create()` accepts optional `institutionId?: Id`. Getter returns `Id | undefined`.
- [x] 2.2 Update `packages/domain/src/personnel/entities/teacher.ts` — same pattern: `institutionId: Id | undefined`, optional in `create()`, getter returns `Id | undefined`.
- [x] 2.3 Update `packages/domain/src/personnel/__tests__/entities/student.test.ts` — use `Id.create('inst-1')`/`Id.reconstruct('inst-1')` for institutionId. Assert `s.institutionId?.get()`. Add test for creation without institutionId.
- [x] 2.4 Update `packages/domain/src/personnel/__tests__/entities/teacher.test.ts` — use `Id.create('inst-1')`/`Id.reconstruct('inst-1')`. Assert `t.institutionId?.get()`.

## Phase 3: AcademicCycle VOs

- [x] 3.1 Update `packages/domain/src/pedagogy/entities/academic-cycle.ts` — import `EducationalLevel`, `EducationalModality` from shared. Change `AcademicCycleProps.level` to `EducationalLevel`, `.modality` to `EducationalModality`. Update `CreateAcademicCycleInput` accordingly (modality optional, defaults `COMUN`). Update `create()`, `reconstruct()`, getters, `update()`.
- [x] 3.2 Update `packages/domain/src/pedagogy/__tests__/entities/academic-cycle.test.ts` — replace `level: 2`/`level: 3` with `EducationalLevel.fromCode(2)`/`EducationalLevel.fromCode(3)`. Replace `modality: 0`/`modality: 1` with `EducationalModality.fromCode(0)`/`EducationalModality.fromCode(1)`. Assert `.code` instead of raw number.
- [x] 4.1 Run `pnpm test` in `packages/domain` — all 587+ tests pass.
- [x] 4.2 Run `tsc --noEmit` in `packages/domain` — zero type errors.
