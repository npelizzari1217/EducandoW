# Proposal: Domain Cleanup — Value Object Consistency

## Intent

Eliminate inconsistencies in the domain layer's Value Object usage across enrollment, personnel, pedagogy, and tenant-scoped entities. Four concrete issues from the exploration audit.

## Nivel pedagógico

**ALL** — afecta todos los niveles (shared VOs, enrollment, pedagogy, personnel).

## Scope

### In Scope

- **P1**: Create `EnrollmentStatus` VO in `enrollment/value-objects/` with self-validation. Replace string union type.
- **P2**: Change `institutionId` from raw `string` to `Id` VO in `Student` and `Teacher` entities (consistent with `Enrollment`).
- **P3**: Change `AcademicCycle.level` and `AcademicCycle.modality` from raw `number` to `EducationalLevel` / `EducationalModality` VOs (consistent with `CourseCycle` which uses `Level` VO).
- **P8 (partial)**: Make `institutionId` optional in `Student.create()` and `Teacher.create()` inputs — it is tenant-injected by infrastructure, not persisted to DB. Keep `reconstruct()` and getter for backward compat.

### Out of Scope

- Infrastructure repos (`api/src/`) — deferred to follow-up
- Web / frontend changes
- Full removal of `institutionId` from domain entities (requires infra coordination)
- `User.institutionId` typing change (User has different tenant semantics)
- `CourseSection` / `Subject` institutionId — same raw string, deferred to follow-up

## Capabilities

### New Capabilities

- `enrollment-status`: EnrollmentStatus Value Object with valid status validation

### Modified Capabilities

- `pedagogy`: AcademicCycle `level` and `modality` change from `number` to `EducationalLevel`/`EducationalModality` VOs
- `student-profile`: institutionId typing changes from `string` to `Id` VO

## Approach

1. **Create `EnrollmentStatus` VO**: Self-validating class with `ACTIVE | INACTIVE | GRADUATED | TRANSFERRED` enum. Factory `create(value)` returns `Result`. `reconstruct(value)` for infra. Replace type alias.
2. **Typing `institutionId` as `Id`**: Change `StudentProps.institutionId` and `TeacherProps.institutionId` from `string` to `Id`. Update getters. Make optional in `create()` params. Update domain tests.
3. **AcademicCycle VOs**: Replace `level: number` → `level: EducationalLevel`, `modality: number` → `modality: EducationalModality`. Adjust `create()`, `reconstruct()`, getters, `isCurrent()`, `update()`, input types, and tests.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `enrollment/value-objects/` | New | `enrollment-status.ts`, `index.ts` |
| `enrollment/entities/enrollment.ts` | Modified | Replace type alias with VO import |
| `enrollment/__tests__/entities/` | Modified | Update status assertions |
| `personnel/entities/student.ts` | Modified | `institutionId: string` → `Id`; optional in `create()` |
| `personnel/entities/teacher.ts` | Modified | `institutionId: string` → `Id`; optional in `create()` |
| `personnel/__tests__/entities/student.test.ts` | Modified | Use `Id.create()` for institutionId |
| `personnel/__tests__/entities/teacher.test.ts` | Modified | Use `Id.create()` for institutionId |
| `pedagogy/entities/academic-cycle.ts` | Modified | `level`/`modality` → `EducationalLevel`/`EducationalModality` |
| `pedagogy/__tests__/entities/academic-cycle.test.ts` | Modified | Use VO instances instead of raw numbers |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Infrastructure repos break on next build due to changed types | High | Follow-up PR syncs infra repos. Domain tests pass in isolation. |
| `AcademicCycle.isCurrent()` comparator uses `number` comparison — needs adjustment for VO | Low | `EducationalLevel`/`EducationalModality` expose numeric `.code`, same logic applies. |
| `EnrollmentRepository` re-exports `EnrollmentStatus` as type — consumers need import update | Med | Keep backward-compat re-export in `enrollment/entities/index.ts` — add VO class alongside type alias. |

## Rollback Plan

1. `git revert` the commit. Each change is self-contained per entity file.
2. Restore `enrollment/entities/enrollment.ts` type alias if VO causes regressions.
3. Revert `AcademicCycle` to raw numbers by restoring props and getters.

## Dependencies

- `Id` (shared), `Result` (shared), `ValidationError` (shared) — already available
- `EducationalLevel`, `EducationalModality` (shared) — already available for P3

## Success Criteria

- [ ] `enrollment/value-objects/` contains `EnrollmentStatus` VO with validation
- [ ] `Student.institutionId` and `Teacher.institutionId` typed as `Id` VO
- [ ] `AcademicCycle.level` typed as `EducationalLevel`, `AcademicCycle.modality` as `EducationalModality`
- [ ] `pnpm test` passes in `packages/domain` (587+ tests)
- [ ] `tsc --noEmit` passes in `packages/domain`
