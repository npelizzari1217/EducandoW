# Proposal: Fix Course Cycle Tests

## Intent

5 tests in `GenerateCourseCyclesUseCase` fail because the mock `makeMockAcademicCycleRepo()` is missing `findByUuid`, which the use case calls at line 287. The `AcademicCycleRepository` interface defines 7 methods — the mock only wires 3 (`findById`, `findAll`, `save`), leaving 4 unimplemented. No production code is broken; this is a pure test infrastructure gap.

## Scope

### In Scope
- Add `findByUuid` to `makeMockAcademicCycleRepo()` returning a valid mock AcademicCycle with `active: true`
- Add remaining missing interface methods (`findByCode`, `findActive`, `softDelete`) as minimal stubs
- Verify all 5 failing GenerateCourseCyclesUseCase tests pass

### Out of Scope
- Production code changes
- New tests or test structure refactors beyond the mock fix
- Other test files

## Capabilities

### New Capabilities
None

### Modified Capabilities
None

## Approach

Fix the test mock at lines 83–94 of `course-cycle.use-cases.test.ts`. Add 4 methods to match the `AcademicCycleRepository` contract defined in `packages/domain/src/pedagogy/repositories/academic-cycle-repository.ts`:

- **`findByUuid`**: returns mock AcademicCycle with `id`, `name`, `active: true`, `isCurrent: () => true` — same shape as existing `findById` mock
- **`findByCode`**: resolved to `null` (minimal stub)
- **`findActive`**: resolved to `[]` (minimal stub)
- **`softDelete`**: no-op resolved stub

**Level**: ALL — the mock serves tests across all pedagogical levels (INICIAL | PRIMARIO | SECUNDARIO | TERCIARIO).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts` | Modified | Extend `makeMockAcademicCycleRepo()` with 4 missing interface methods |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mock diverges from real implementation behavior | Low | Match existing mock patterns; return shapes identical to `findById` mock |
| Tests pass with mocks but fail with real DB | Low | Tests already validate use case logic, not persistence — mocks are appropriate for unit tests |

## Rollback Plan

```bash
git checkout api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts
```

No migrations, no DB changes, no config changes — plain file revert.

## Dependencies

None. Pure test file change with zero external prerequisites.

## Success Criteria

- [ ] All 5 GenerateCourseCyclesUseCase tests pass: "generates CourseCycles for all courses in plan", "skips existing pairs", "rejects when academic cycle is inactive", "rejects when study plan is not found", and the 5th test at line 143
- [ ] No regression in the other 226 API tests that currently pass
- [ ] All 586 domain tests continue passing
