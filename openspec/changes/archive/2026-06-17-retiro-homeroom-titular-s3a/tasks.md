# Tasks: retiro-homeroom-titular-s3a

> Phase: sdd-tasks · Store: hybrid · 2026-06-17
> Delivery strategy: auto-chain (single PR, ~200 lines, no chaining needed)
> Test runner: `pnpm --filter api test` · TDD: STRICT (test first per unit)

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| Estimated changed lines | ~200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Decision needed before apply | No |

Breakdown: new repo spec (+55), port addition (+12), repo impl (+12), use-case spec rewrite (net −15 after removing Teacher block and writing new homeroom tests), use-case impl rewrite (net −10), CC repo spec removal (−60), CC port removal (−8), CC impl removal (−12), module DI update (net +15). Single cohesive PR.

---

## Task List

### T1 [x] — [RED] Create spec for `findTitularCourseIdsByUser` in PrismaAsignacionCursoXCicloRepository

**Refs:** REQ-08, D1, D6 (TDD)
**File:** `api/src/infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository.spec.ts` _(new file)_
**Depends on:** none
**Parallel with:** can be written before T2

Write a new spec file. The tests MUST fail at this step (method does not yet exist in port or impl).

Tests to include:
- `[RED]` TITULAR rows with `docenteXCiclo:{userId,active:true}` → returns array of `courseCycleId` strings
- `[RED]` dedup: two rows with the same `courseCycleId` (different turnos) → returned array has length 1
- `[RED]` no matching rows → returns `[]` (no throw)
- `[RED]` assert the `findMany` where clause: `rol: RolCurso.TITULAR`, `docenteXCiclo: { userId, active: true }`

Pattern: mock `TenantContext.getClient`, mock `client.asignacionCursoXCiclo.findMany`.

**Gate:** `pnpm --filter api test` → these 4 tests FAIL (method does not exist).

---

### T2 [x] — Add `findTitularCourseIdsByUser` to `AsignacionCursoXCicloRepository` port

**Refs:** REQ-08, D1
**File:** `packages/domain/src/asignacion-curso-ciclo/repositories/asignacion-curso-x-ciclo-repository.ts`
**Depends on:** T1 (conceptually; confirms the contract tests require)
**Sequential after:** T1

Add method signature to the interface with the JSDoc from D1:

```ts
/**
 * Returns deduplicated CourseCycle UUIDs where the given master User is the
 * homeroom titular (rol=TITULAR) via an active DocenteXCiclo. AD-6 "por curso"
 * path on the new model. Empty array when none. Tenant scoping via TenantContext.
 */
findTitularCourseIdsByUser(userId: string): Promise<string[]>;
```

**Gate:** `pnpm --filter api typecheck` → NEW error: `PrismaAsignacionCursoXCicloRepository` does not satisfy the interface (expected — impl is next). Baseline 11 typecheck errors should not change in count for unrelated files.

---

### T3 [x] — [GREEN] Implement `findTitularCourseIdsByUser` in `PrismaAsignacionCursoXCicloRepository`

**Refs:** REQ-01, REQ-03, REQ-08, D1
**File:** `api/src/infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository.ts`
**Depends on:** T2 (port must be updated first)
**Sequential after:** T2

Add method to the class (satisfying the port):

```ts
async findTitularCourseIdsByUser(userId: string): Promise<string[]> {
  const rows = await this.client.asignacionCursoXCiclo.findMany({
    where: {
      rol: RolCurso.TITULAR,
      docenteXCiclo: { userId, active: true },
    },
    select: { courseCycleId: true },
  });
  return [...new Set(rows.map((r) => r.courseCycleId))];
}
```

`RolCurso` is already imported; `this.client` uses the existing tenant getter.

**Gate:** `pnpm --filter api test` → T1 tests GREEN. `pnpm --filter api typecheck` → 0 new errors (impl now satisfies port). Baseline 11 errors unchanged.

---

### T4 [x] — [RED] Rewrite homeroom block in `list-teacher-course-cycles.use-case.spec.ts`

**Refs:** REQ-01, REQ-02, REQ-04, REQ-05, REQ-06, REQ-12, REQ-14, D6
**File:** `api/src/application/grading/list-teacher-course-cycles.use-case.spec.ts`
**Depends on:** T3 (confirmed new API exists)
**Sequential after:** T3

Changes (produce failing tests — impl still uses `teacherRepo`):

1. **`makeRepos` function**: remove `teacherRepo` key and `findByHomeroomTeacher` from `courseCycleRepo`. Add `asignacionRepo: { findTitularCourseIdsByUser: vi.fn().mockResolvedValue([]) }`.

2. **Both `beforeEach` blocks** (subject describe + homeroom describe): change constructor call from `repos.teacherRepo as any` → `repos.asignacionRepo as any` in first position.

3. **Imports**: remove `Teacher`, `Dni`, `Email` (only used by `makeTeacher`). Remove `makeTeacher` helper function. `Id` stays (still used by `makeCC`).

4. **Replace entire homeroom `describe` block** with new tests covering:
   - `(Scenario A / REQ-05)` TITULAR of 1+ CCs → `findTitularCourseIdsByUser(userId)` called with correct userId; `findByUuids` called; returns `[{cycle, modality}]`
   - `(Scenario B / REQ-06)` no TITULAR assignment → `findTitularCourseIdsByUser` returns `[]`; use-case returns `[]`; no throw
   - `(Scenario D / REQ-04 / TIA-R9)` TITULAR CC with non-Primario level → decade filter excludes it → `[]`
   - `(REQ-02)` assert Teacher NOT read: `asignacionRepo.findTitularCourseIdsByUser` IS called with userId; `docenteRepo.findByUserId` and `grupoRepo.findByDocente` are NOT called in homeroom mode
   - `(Scenario E)` inactive `docenteXCiclo` (handled by repo returning `[]`) → `[]`

5. **Subject describe block**: only constructor call changes (swap first arg); all subject test bodies remain IDENTICAL.

**Gate:** `pnpm --filter api test` → new homeroom tests FAIL (use-case still calls `teacherRepo.findByUserId`). Subject tests still pass.

---

### T5 [x] — [GREEN] Rewrite homeroom branch in use-case + swap constructor

**Refs:** REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-14, D2
**File:** `api/src/application/grading/list-teacher-course-cycles.use-case.ts`
**Depends on:** T4 (failing tests to make green), T2 (port type available)
**Sequential after:** T4

Changes:
1. Remove `TeacherRepository` from import in `@educandow/domain`. Add `AsignacionCursoXCicloRepository`.
2. Constructor: replace `private readonly teacherRepo: TeacherRepository` with `private readonly asignacionRepo: AsignacionCursoXCicloRepository`. Keep same first-parameter position. Remove `// homeroom only` comment; update doc comment at top of file to reflect new model.
3. Replace homeroom branch body (currently lines 45-48) with:
   ```ts
   if (input.mode === 'homeroom') {
     // AD-6 "por curso" path — modelo NUEVO: userId → AsignacionCursoXCiclo(TITULAR)
     const ccUuids = await this.asignacionRepo.findTitularCourseIdsByUser(input.userId);
     courseCycles = await this.courseCycleRepo.findByUuids(ccUuids);
   } else {
   ```
4. The TAIL (lines 84-104 in current file: `allowedDecades`, decade filter, `findGradingContextsByUuids`, map) is UNTOUCHED.

**Gate:** `pnpm --filter api test` → ALL tests green (T1 + T4 + existing subject tests). `pnpm --filter api typecheck` → 0 new errors.

---

### T6 [x] — Remove `findByHomeroomTeacher` test block from CC repo spec

**Refs:** REQ-09, D3
**File:** `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.spec.ts`
**Depends on:** T5 (all new tests passing — verify before removing old tests)
**Sequential after:** T5

Changes:
- Remove header comment reference to `findByHomeroomTeacher` (line 3: `findByHomeroomTeacher, findByCourseSectionIds` → `findByCourseSectionIds`).
- Remove the entire `describe('PrismaCourseCycleRepository — findByHomeroomTeacher', ...)` block (lines 68-126).

**Gate:** `pnpm --filter api test` → still all green (block removed, no regression).

---

### T7 [x] — Remove `findByHomeroomTeacher` from `CourseCycleRepository` port

**Refs:** REQ-09, D3
**File:** `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts`
**Depends on:** T6 (test block gone — no test references the method)
**Sequential after:** T6

Remove the JSDoc + method signature block (lines 67-72):
```ts
/**
 * Returns CourseCycles where homeroomTeacherId = teacherId …
 */
findByHomeroomTeacher(teacherId: string): Promise<CourseCycle[]>;
```

**Gate:** `pnpm --filter api typecheck` → `PrismaCourseCycleRepository` now has an extra method not in the interface (fine — TypeScript structural typing allows extra members in impl). 0 new errors.

---

### T8 [x] — Remove `findByHomeroomTeacher` from `PrismaCourseCycleRepository` implementation

**Refs:** REQ-09, D3
**File:** `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts`
**Depends on:** T7 (port no longer declares it — impl is free to drop it)
**Sequential after:** T7

Remove the JSDoc + method body (lines 146-156):
```ts
/**
 * Returns CourseCycles where homeroomTeacherId = teacherId …
 */
async findByHomeroomTeacher(teacherId: string): Promise<CourseCycle[]> { … }
```

**Gate:** `pnpm --filter api typecheck` → impl still satisfies port (method absent from both). 0 new errors. `pnpm --filter api test` → all green.

---

### T9 [x] — Update DI in `course-cycle.module.ts`

**Refs:** REQ-10, REQ-11, D4
**File:** `api/src/presentation/course-cycle/course-cycle.module.ts`
**Depends on:** T3 (impl available), T5 (use-case constructor changed)
**Can run after T8** (parallel with T6/T7/T8 is possible since it's a different file, but apply sequentially to avoid context confusion)

Changes:
1. Remove import of `PrismaTeacherRepository` (line 24).
2. Add import of `PrismaAsignacionCursoXCicloRepository` from the same `repositories` path.
3. In `providers`:
   - Remove `PrismaTeacherRepository` (line 111).
   - Remove `{ provide: 'TeacherRepository', useExisting: PrismaTeacherRepository }` (line 112).
   - Add `PrismaAsignacionCursoXCicloRepository` as a direct provider (same pattern as `PrismaDocenteXCicloRepository`).
4. Update the `ListTeacherCourseCyclesUseCase` factory:
   - `useFactory` first param: `asignacionRepo: PrismaAsignacionCursoXCicloRepository`
   - `inject` first element: `PrismaAsignacionCursoXCicloRepository`
   - Factory body: `new ListTeacherCourseCyclesUseCase(asignacionRepo, docenteRepo, grupoRepo, ccRepo)`

Do NOT add `AsignacionCursoModule` to `imports` (R5 — circular risk).

**Gate:** `pnpm --filter api typecheck` → 0 new errors. `pnpm build` → PASS.

---

### T10 [x] — Final verification gates

**Refs:** All REQs
**Depends on:** T9 (all changes complete)
**Sequential after:** T9

Run all gates in order:

```bash
pnpm --filter api test              # must be 0 failures
pnpm --filter api typecheck         # must be 11 errors (baseline), 0 new
pnpm build                          # must PASS
git diff --stat -- '*.prisma'       # must be empty (no schema change per REQ-15)
```

Document results inline; if any gate fails, block the commit and fix.

---

### T11 [x] — COMMIT DISCIPLINE REMINDER (non-code task)

**Refs:** ERD WIP constraint from project state
**Applies to:** every `git commit` during apply phase

**CRITICAL:** The working tree contains UNCOMMITTED ERD WIP files:
- `.gitignore`
- `package.json`
- both `schema.prisma` files (master + tenant)
- `pnpm-lock.yaml`
- `ERD.svg` (ignored)

**NEVER** use `git add -A` or `git add .`.

**ALWAYS** stage only the explicit S3a paths:
```
packages/domain/src/asignacion-curso-ciclo/repositories/asignacion-curso-x-ciclo-repository.ts
api/src/infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository.ts
api/src/infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository.spec.ts
api/src/application/grading/list-teacher-course-cycles.use-case.ts
api/src/application/grading/list-teacher-course-cycles.use-case.spec.ts
packages/domain/src/course-cycle/repositories/course-cycle-repository.ts
api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts
api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.spec.ts
api/src/presentation/course-cycle/course-cycle.module.ts
```

---

## Execution Order (sequential — no parallelism needed at this scale)

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10
                                               (T11 reminder active throughout apply)
```

Phase checkpoints:
- After T3: `pnpm --filter api test` green for new repo spec
- After T5: `pnpm --filter api test` all green (full suite)
- After T9: `pnpm build` PASS
- After T10: all gates documented and green before commit

---

## Files Touched Summary

| File | Change | Task(s) |
|---|---|---|
| `packages/domain/src/asignacion-curso-ciclo/repositories/asignacion-curso-x-ciclo-repository.ts` | +method to port | T2 |
| `api/src/.../prisma-asignacion-curso-x-ciclo.repository.ts` | +method impl | T3 |
| `api/src/.../prisma-asignacion-curso-x-ciclo.repository.spec.ts` | new file | T1 |
| `api/src/application/grading/list-teacher-course-cycles.use-case.ts` | rewrite homeroom branch + swap constructor | T5 |
| `api/src/application/grading/list-teacher-course-cycles.use-case.spec.ts` | rewrite homeroom tests + remove Teacher | T4 |
| `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts` | −`findByHomeroomTeacher` | T7 |
| `api/src/.../prisma-course-cycle.repository.ts` | −`findByHomeroomTeacher` | T8 |
| `api/src/.../prisma-course-cycle.repository.spec.ts` | −`findByHomeroomTeacher` block | T6 |
| `api/src/presentation/course-cycle/course-cycle.module.ts` | −Teacher DI, +Asignacion DI | T9 |
