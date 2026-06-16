# Tasks: `notas-get-authz-grupo`

> Phase: sdd-tasks · Store: hybrid · 2026-06-16
> Reads: spec (`specs/notas/delta.md`), design (`design.md`)
> Delivery strategy: auto-chain · TDD: strict (pnpm test) · Coverage: ≥ 80%

---

## Dependency Graph

```
T2, T3 (domain ports, parallel)
   └─► T1 (authorizer tests)  ─────────► T5 (authorizer impl) ─────┐
   └─► T4 (repo tests)        ─────────► T6 (repo impl)       ─────┼─► T9 (DI wiring)
   └─► T7 (use-case spec)     ─────────► T8 (use-case impl)   ─────┘
                                                                     └─► T10 (suite run)
```

Sequential order for `sdd-apply`: T2 → T3 → T1 → T4 → T5 → T6 → T7 → T8 → T9 → T10

---

## Tasks

### T1 — [x] [TEST-FIRST] Authorizer: failing tests for `getAllowedStudentIds` + canWriteGrades regression

**File:** `api/src/application/grading/__tests__/assignment-authorizer.service.test.ts`
**Depends on:** T3 (port signature must exist)
**Parallel with:** T4

Write a new `describe('getAllowedStudentIds', ...)` block BEFORE any implementation. All tests in this block must fail (RED). Also verify the existing `canWriteGrades` describe block still passes after the refactor (regression suite, ADR-3).

Branch coverage required:

| Branch | Expected return |
|--------|----------------|
| SECRETARIO / DIRECTOR / ADMIN / ROOT (isAdministrative) | `'all'` (no repo calls) |
| no TenantContext client | `null` |
| client found but no CourseCycle for `courseCycleId` | `null` |
| CC found but no DocenteXCiclo for (userId, cycleId) | `null` |
| dxc found but no MateriaXCursoXCiclo for (courseCycleId, subjectId) | `null` |
| materia found, `findGroupsForDocente` returns `[]` | `null` |
| grupos > 0, `findStudentIdsByGrupoIds` returns `['s1','s2']` | `['s1','s2']` |
| grupos > 0, `findStudentIdsByGrupoIds` returns `[]` | `[]` (distinct from null) |
| co-docencia: same studentId from 2 grupos | deduped `['s1']` |

Canary mock: `alumnosXGrupoRepo.findStudentIdsByGrupoIds` must be mockable alongside `docenteRepo` and `grupoRepo` (update `MockRepos` interface and `makeRepos` helper).

**canWriteGrades regression** (7-case equivalence table from ADR-3): re-run existing assertions with zero changes; this validates the `resolveAssignedGrupos` refactor doesn't break the write path.

**Satisfies:** spec "Scope Resolution Returns an Access Scope Value", ADR-3 (regression table), ADR-6 (test strategy)

---

### T2 — [x] Domain port: add `findStudentIdsByGrupoIds` to `AlumnosXGrupoRepository`

**File:** `packages/domain/src/materia-grupo-ciclo/repositories/alumnos-x-grupo-repository.ts`
**Depends on:** nothing (domain-first)
**Parallel with:** T3

Add method signature:

```typescript
/**
 * Returns the deduplicated set of studentIds for a list of grupo IDs.
 * Two-hop resolution: AlumnosXGrupo → AlumnosXMateria.studentId.
 * Returns [] when grupoIds is empty or no memberships exist.
 * Satisfies: MGC-GET-AUTHZ / F5-T8 (multi-grupo dedup).
 */
findStudentIdsByGrupoIds(grupoIds: string[]): Promise<string[]>;
```

**Satisfies:** spec "Student ID Deduplication for Multi-Grupo Teachers", ADR-2

---

### T3 — [x] Domain port: add `getAllowedStudentIds` to `AssignmentAuthorizerPort`

**File:** `packages/domain/src/grading/ports/assignment-authorizer.port.ts`
**Depends on:** nothing (domain-first)
**Parallel with:** T2

Add tri-state return type alias and method:

```typescript
export type StudentScope = string[] | 'all' | null;

/**
 * Returns the read scope for a (user, courseCycle, subject) tuple:
 *   'all'     → administrative bypass (SECRETARIO / DIRECTOR / ADMIN / ROOT)
 *   string[]  → allowed studentIds (may be empty for an assigned-but-empty grupo)
 *   null      → forbidden (any broken link in the authz chain)
 *
 * Satisfies: spec "Scope Resolution Returns an Access Scope Value" (notas-get-authz-grupo)
 */
getAllowedStudentIds(
  userId: string,
  userRoles: string[],
  courseCycleId: string,
  subjectId: string,
): Promise<StudentScope>;
```

**Satisfies:** spec "Scope Resolution Returns an Access Scope Value", ADR-1

---

### T4 — [x] [TEST-FIRST] Repo: failing tests for `findStudentIdsByGrupoIds`

**File:** `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-alumnos-x-grupo.repository.test.ts`
  (create file if it does not exist)
**Depends on:** T2
**Parallel with:** T1

Write failing unit tests mocking the tenant Prisma client (same pattern as other repo tests). Cover:

- `grupoIds = []` → returns `[]` without calling Prisma
- hop-1 returns no rows → returns `[]` without hop-2
- hop-1 returns rows, hop-2 returns student IDs → correct `string[]`
- co-docencia: same `studentId` appears via 2 different `alumnosXMateriaXCursoXCicloId` → deduplicated

**Satisfies:** ADR-2, spec "Student ID Deduplication for Multi-Grupo Teachers"

---

### T5 — [x] Implementation: `resolveAssignedGrupos` + refactor `canWriteGrades` + `getAllowedStudentIds`

**File:** `api/src/application/grading/assignment-authorizer.service.ts`
**Depends on:** T1 (tests must be RED before this), T2, T3
**Sequential after T1**

Changes (all must make T1 tests GREEN):

1. Add `private readonly alumnosXGrupoRepo: AlumnosXGrupoRepository` as 3rd constructor param. Import type from `@educandow/domain`.

2. Extract private `resolveAssignedGrupos`:
   ```typescript
   private async resolveAssignedGrupos(
     userId: string, courseCycleId: string, subjectId: string,
   ): Promise<GrupoXCursoXMateriaXCiclo[] | null> {
     const client = TenantContext.getClient();
     if (!client) return null;
     const cc = await client.courseCycle.findUnique({ where: { uuid: courseCycleId }, select: { cycleId: true } });
     if (!cc) return null;
     const dxc = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId);
     if (!dxc) return null;
     const materia = await client.materiaXCursoXCiclo.findFirst({ where: { courseCycleId, subjectId }, select: { id: true } });
     if (!materia) return null;
     return this.grupoRepo.findGroupsForDocente(dxc.id, materia.id);
   }
   ```

3. Refactor `canWriteGrades` teacher path to delegate to `resolveAssignedGrupos`:
   ```typescript
   const grupos = await this.resolveAssignedGrupos(userId, courseCycleId, subjectId);
   return grupos !== null && grupos.length > 0;
   ```
   The `isAdministrative → return true` early exit is UNCHANGED.

4. Add `getAllowedStudentIds`:
   ```typescript
   async getAllowedStudentIds(userId, userRoles, courseCycleId, subjectId): Promise<StudentScope> {
     const scope = resolveAccessScope({ roles: userRoles });
     if (scope.isAdministrative) return 'all';
     const grupos = await this.resolveAssignedGrupos(userId, courseCycleId, subjectId);
     if (grupos === null || grupos.length === 0) return null;
     return this.alumnosXGrupoRepo.findStudentIdsByGrupoIds(grupos.map((g) => g.id));
   }
   ```

IMPORTANT: `canAccessCourseCycle` is NOT touched (uses a different resolution path).

**Satisfies:** ADR-1, ADR-3, spec "Scope Resolution Returns an Access Scope Value", regression table

---

### T6 — [x] Implementation: `findStudentIdsByGrupoIds` in Prisma repo

**File:** `api/src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-grupo.repository.ts`
**Depends on:** T4 (tests must be RED before this), T2

Implement the two-hop query (must make T4 tests GREEN):

```typescript
async findStudentIdsByGrupoIds(grupoIds: string[]): Promise<string[]> {
  if (grupoIds.length === 0) return [];

  const axg = await this.client.alumnosXGrupoXCursoXMateriaXCiclo.findMany({
    where: { grupoId: { in: grupoIds } },
    select: { alumnosXMateriaXCursoXCicloId: true },
  });
  if (axg.length === 0) return [];

  const axmIds = [...new Set(axg.map((r) => r.alumnosXMateriaXCursoXCicloId))];
  const axm = await this.client.alumnosXMateriaXCursoXCiclo.findMany({
    where: { id: { in: axmIds } },
    select: { studentId: true },
  });

  return [...new Set(axm.map((r) => r.studentId))];
}
```

Note: `this.client` is the existing private getter that throws if no tenant context; no change needed there.

**Satisfies:** ADR-2, spec "Student ID Deduplication for Multi-Grupo Teachers", "Co-Docencia Does Not Duplicate Grade Records"

---

### T7 — [x] [TEST-FIRST] Migrate use-case spec: update helper, AUTHZ-C1 tests, add F5-T8/F5-T9

**File:** `api/src/application/grading/get-subject-grades-by-subject.use-case.spec.ts`
**Depends on:** T3 (port must exist)
**Sequential after T3, before T8**

This task closes F5-T8 and F5-T9 at unit level. Integration against a real DB is DEFERRED.

Changes:

1. Update `makeAuthorizer` helper:
   - Remove `canWriteGrades` mock.
   - Add `getAllowedStudentIds` mock returning `'all'` by default (replaces the "authorized=true" boolean).
   - Add `getAllowedStudentIds` returning `null` for unauthorized case (replaces "authorized=false").

2. Migrate the 4 AUTHZ-C1 tests:
   - `canWriteGrades retorna false` → `getAllowedStudentIds returns null → { forbidden: true }`; assert `getAllowedStudentIds` called with correct args.
   - `canWriteGrades retorna true → NO forbidden` → `getAllowedStudentIds returns 'all' → success`.
   - `ROOT bypass` → `getAllowedStudentIds returns 'all'`; assert it is called with ROOT roles.
   - `parámetros correctos` → assert `getAllowedStudentIds` receives correct (userId, roles, ccId, subjectId).

3. Add F5-T8 (closes `docente-ciclo-grupos/specs/notas/delta.md` F5-T8):
   ```
   GIVEN getAllowedStudentIds returns ['s1','s2']
   WHEN execute({ courseCycleId, subjectId, userId, userRoles })
   THEN students[] contains only s1 and s2
   AND students with IDs outside the scope are not present
   ```

4. Add F5-T9 (closes `docente-ciclo-grupos` F5-T9 — cross-scope exclusion):
   ```
   GIVEN enrolled students = [s1, s2, s3]
   AND getAllowedStudentIds returns ['s1']
   THEN students[] = [s1] only; s2 and s3 are absent
   ```

5. Add scenario for empty scope (grupo-vacío):
   ```
   GIVEN getAllowedStudentIds returns []
   THEN result is NOT forbidden; students[] = []
   ```

6. Add scenario for 'all' scope:
   ```
   GIVEN getAllowedStudentIds returns 'all'
   AND enrolled students = [s1, s2, s3]
   THEN students[] contains all 3 (no filtering)
   ```

All existing non-AUTHZ tests pass unchanged once `makeAuthorizer` returns `'all'`.

**Satisfies:** spec "GET Use-Case Replaces Boolean Gate with Scope Filter", F5-T8, F5-T9, ADR-6

---

### T8 — [x] Implementation: replace `canWriteGrades` gate with scope filter in use-case

**File:** `api/src/application/grading/get-subject-grades-by-subject.use-case.ts`
**Depends on:** T7 (spec tests must be RED before this)

Changes:

1. Lines 93–94 — replace gate:
   ```typescript
   // BEFORE
   const canAccess = await this.authorizer.canWriteGrades(userId, userRoles, courseCycleId, subjectId);
   if (!canAccess) return { forbidden: true };

   // AFTER
   const scope = await this.authorizer.getAllowedStudentIds(userId, userRoles, courseCycleId, subjectId);
   if (scope === null) return { forbidden: true };
   ```

2. Line 104 — add scope filter after `findEnrolledStudents`:
   ```typescript
   const allStudents = await this.ccRepo.findEnrolledStudents(courseCycleId);
   const students = scope === 'all'
     ? allStudents
     : allStudents.filter((s) => (scope as string[]).includes(s.studentId));
   ```

3. Rename local variable from `students` to `allStudents` at the fetch, then use `students` as the filtered set. All subsequent code referencing `students` continues to work without further changes.

4. The `students.length === 0` branch at line 106 now operates on the scoped set — this correctly returns an empty grid for an assigned-but-empty grupo (200, not 403), satisfying the spec scenario.

**Satisfies:** ADR-4, spec "GET Use-Case Replaces Boolean Gate with Scope Filter", spec "Scope Narrowed to Group", F5-T8, F5-T9

---

### T9 — [x] DI wiring: update `grading.module.ts`

**File:** `api/src/presentation/grading/grading.module.ts`
**Depends on:** T5, T6
**Sequential after T5 and T6**

Changes:

1. Add import for `PrismaAlumnosXGrupoRepository`:
   ```typescript
   import { PrismaAlumnosXGrupoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-alumnos-x-grupo.repository';
   ```

2. In the `providers` array, AFTER the `PrismaGrupoRepository` block, add:
   ```typescript
   PrismaAlumnosXGrupoRepository,
   { provide: 'AlumnosXGrupoRepository', useExisting: PrismaAlumnosXGrupoRepository },
   ```
   Note: `PrismaAlumnosXGrupoRepository` is also provided in `materia-grupo-ciclo.module.ts` but that module is NOT imported by `GradingModule`, so no duplicate provider conflict exists.

3. Update the `AssignmentAuthorizer` factory (currently 2 deps → 3 deps):
   ```typescript
   {
     provide: AssignmentAuthorizer,
     useFactory: (
       docenteRepo: PrismaDocenteXCicloRepository,
       grupoRepo: PrismaGrupoRepository,
       alumnosXGrupoRepo: PrismaAlumnosXGrupoRepository,
     ) => new AssignmentAuthorizer(docenteRepo, grupoRepo, alumnosXGrupoRepo),
     inject: [PrismaDocenteXCicloRepository, PrismaGrupoRepository, PrismaAlumnosXGrupoRepository],
   },
   ```

RISK: If T5's constructor change lands without this update, NestJS injects `undefined` for the 3rd arg → runtime failure on `getAllowedStudentIds`. T9 MUST ship in the same batch as T5.

**Satisfies:** ADR-5, spec DI wiring requirement

---

### T10 — [x] Run full suite; verify GREEN and coverage ≥ 80%

**Command:** `pnpm test`
**Depends on:** T1 through T9
**Sequential — must be last**

Expected outcome:
- All new tests pass.
- All previously-passing tests still pass (no regression).
- `canWriteGrades` suite passes unchanged (proves ADR-3 regression table).
- F5-T8 and F5-T9 pass at unit level. Full DB integration deferred per spec invariant.
- Coverage for `assignment-authorizer.service.ts` and `get-subject-grades-by-subject.use-case.ts` ≥ 80%.

If coverage drops below 80% on modified files, add targeted test cases before marking this task done.

**Satisfies:** ADR-6, spec invariant "unit tests with mocks satisfy the spec gate"

---

## Summary Table

| ID | Type | File(s) | Depends on | Parallel with | Spec / ADR |
|----|------|---------|------------|---------------|------------|
| T2 | domain-port | `alumnos-x-grupo-repository.ts` | — | T3 | ADR-2 |
| T3 | domain-port | `assignment-authorizer.port.ts` | — | T2 | ADR-1 |
| T1 | test | `assignment-authorizer.service.test.ts` | T3 | T4, T7 | ADR-3, ADR-6 |
| T4 | test | `prisma-alumnos-x-grupo.repository.test.ts` | T2 | T1, T7 | ADR-2 |
| T5 | impl | `assignment-authorizer.service.ts` | T1, T2, T3 | T6 | ADR-1, ADR-3 |
| T6 | impl | `prisma-alumnos-x-grupo.repository.ts` | T4, T2 | T5 | ADR-2 |
| T7 | test | `get-subject-grades-by-subject.use-case.spec.ts` | T3 | T1, T4 | F5-T8, F5-T9, ADR-6 |
| T8 | impl | `get-subject-grades-by-subject.use-case.ts` | T7 | T5, T6 | ADR-4 |
| T9 | wiring | `grading.module.ts` | T5, T6 | T8 | ADR-5 |
| T10 | verify | — | T1–T9 | — | ADR-6 |

Mandatory same-batch pair: **T5 + T9** (constructor + factory must land together).

---

## Traceability: Blocked Tasks from `docente-ciclo-grupos`

- **F5-T8** ("TEACHER scoped to one grupo sees only that grupo's students"): CLOSED at unit level by T7 + T8. Full DB integration deferred.
- **F5-T9** ("students outside scope not present"): CLOSED at unit level by T7 + T8. Full DB integration deferred.

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Files changed | 8 |
| Estimated changed lines | ~250 (domain ports +17, authorizer tests +80, authorizer impl +35, repo test +40, repo impl +20, use-case spec +50, use-case impl +12, module wiring +8) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Decision needed before apply | No |

Single PR is safe. The 250-line estimate is comfortably within the 400-line budget.
Lines removed (old `canWriteGrades` gate in use-case, simplified `canWriteGrades` teacher body) partially offset additions, keeping net delta low.
