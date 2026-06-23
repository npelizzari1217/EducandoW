# Tasks: RolCurso — Roles Extendidos

**Change**: `rolcurso-roles-extendidos`
**Phase**: tasks
**Delivery strategy**: auto-chain (single PR — see Review Workload Forecast)
**TDD mode**: STRICT — test first for every work unit that touches logic

---

## Dependency Graph

```
T1 (domain enum)
├── T2 (use-case test)   ─┐
├── T3 (Prisma schema)    ├── T6 (verify: build + test)
│     └── T4 (migration)  │
└── T5 (frontend)        ─┘
```

T1 is the sole blocker. T2, T3, and T5 all depend on T1 and can be executed in parallel
after T1 completes. T4 depends on T3. T6 is the final gate.

---

## Tasks

### [x] T1 — [Domain] Extend RolCurso enum — test + impl

**Sequential — must complete before any other task.**

**Spec**: SPEC-1, SC-01
**Commit**: `feat(domain): extend RolCurso enum to 6 values`

#### TDD steps (red → green)

1. Open `packages/domain/src/asignacion-curso-ciclo/__tests__/entities/asignacion-curso-x-ciclo.test.ts`.
2. Add two failing tests **before** touching the enum:

   ```
   it('RolCurso contains exactly 6 values (SPEC-1/SC-01)', () => {
     expect(Object.values(RolCurso)).toHaveLength(6);
     expect(Object.values(RolCurso)).toEqual(
       expect.arrayContaining([
         'PRECEPTOR', 'TITULAR',
         'SECRETARIO', 'DIRECTOR', 'EOE', 'DOCENTE_AUXILIAR',
       ]),
     );
   });

   it('creates assignments with each new RolCurso value (SPEC-1)', () => {
     const newRoles = [RolCurso.SECRETARIO, RolCurso.DIRECTOR, RolCurso.EOE, RolCurso.DOCENTE_AUXILIAR];
     newRoles.forEach((rol) => {
       const a = AsignacionCursoXCiclo.create({
         courseCycleId: 'cc-1',
         docenteXCicloId: 'dxc-1',
         rol,
       });
       expect(a.rol).toBe(rol);
     });
   });
   ```

3. Run `pnpm test` — tests fail (TypeScript errors: enum values do not exist). Confirm red.
4. Edit `packages/domain/src/asignacion-curso-ciclo/entities/asignacion-curso-x-ciclo.ts`:
   - Add 4 new members to `enum RolCurso` with matching string values and JSDoc comments:
     ```
     SECRETARIO = 'SECRETARIO',
     DIRECTOR = 'DIRECTOR',
     EOE = 'EOE',
     DOCENTE_AUXILIAR = 'DOCENTE_AUXILIAR',
     ```
   - Update the existing JSDoc comment above the enum to document all 6 roles.
5. Run `pnpm test` — both new tests pass, all existing tests stay green. Confirm green.
6. Commit the test + impl together.

**Files touched**:
- `packages/domain/src/asignacion-curso-ciclo/entities/asignacion-curso-x-ciclo.ts`
- `packages/domain/src/asignacion-curso-ciclo/__tests__/entities/asignacion-curso-x-ciclo.test.ts`

---

### [x] T2 — [Application] Use-case coverage: new roles do NOT trigger singleton removal

**Depends on T1. Can run in parallel with T3 and T5.**

**Spec**: SPEC-4, SC-03, SC-04
**Commit**: `test(asignacion-curso): verify new roles bypass titular singleton (SPEC-4)`

#### TDD steps (red → green)

1. Open `api/src/application/asignacion-curso/__tests__/assign-docente-to-curso.use-case.test.ts`.
2. Add one test that uses `RolCurso.SECRETARIO` (now available after T1):

   ```
   it('assigning a new role (SECRETARIO) does NOT remove titulares (SPEC-4/SC-03)', async () => {
     const d1 = makeDocente('dxc-1', 'cycle-1');
     const asgRepo = makeAsignacionRepo();
     const docenteRepo = makeDocenteRepo(d1);
     const service = new DocenteXCicloService(docenteRepo);
     const uc = new AssignDocenteToCursoUseCase(asgRepo, service);

     const result = await uc.execute({
       courseCycleId: 'cc-1',
       courseCycleUuid: 'cc-1',
       cycleId: 'cycle-1',
       userId: 'user-dxc-1',
       rol: RolCurso.SECRETARIO,
     });

     expect(asgRepo.removeTitularesForCourse).not.toHaveBeenCalled();
     expect(asgRepo.assign).toHaveBeenCalledOnce();
     expect(result.rol).toBe(RolCurso.SECRETARIO);
   });
   ```

3. Run `pnpm --filter api test` — test should be green immediately (use-case has no branching
   on new roles; this is a regression-guard/coverage test, not a new behaviour test).
4. If green on first run, that is correct — the test documents an invariant. Commit it.

**Files touched**:
- `api/src/application/asignacion-curso/__tests__/assign-docente-to-curso.use-case.test.ts`

**No implementation change** — use-case already handles new roles correctly (only branches on
`rol === RolCurso.TITULAR` per ADR-3).

---

### [x] T3 — [Persistence] Mirror domain enum in Prisma schema

**Depends on T1. Can run in parallel with T2 and T5.**

**Spec**: SPEC-2
**Commit**: `chore(prisma): add 4 RolCurso values to tenant schema (SPEC-2)`

#### Steps

1. Open `api/prisma_tenant/schema.prisma`.
2. Update `enum RolCurso` to mirror the domain exactly:

   ```prisma
   enum RolCurso {
     PRECEPTOR
     TITULAR
     SECRETARIO
     DIRECTOR
     EOE
     DOCENTE_AUXILIAR
   }
   ```

3. Do NOT run `prisma migrate dev` locally (Docker/DB unavailable in WSL — see T4).
   Run only `pnpm --filter api prisma:generate` to regenerate the Prisma client from the
   updated schema so TypeScript types are correct.
4. Run `pnpm --filter api typecheck` to confirm no type errors.
5. This commit contains schema only — migration file is T4.

**Files touched**:
- `api/prisma_tenant/schema.prisma`

---

### [x] T4 — [Migration] Author additive migration SQL — CONSTRAINED TASK

**Depends on T3. Sequential.**

**Spec**: SPEC-6, SC-05, SC-09
**Commit**: `chore(migration): add RolCurso values SECRETARIO DIRECTOR EOE DOCENTE_AUXILIAR`

#### Constraint

Docker + PostgreSQL are not integrated in WSL for this project. `prisma migrate dev` cannot
run locally to auto-generate the migration file. The migration SQL must be **authored manually**.

#### Steps

1. Create directory `api/prisma_tenant/migrations/{YYYYMMDDHHMMSS}_rolcurso_roles_extendidos/`.
   Use timestamp format consistent with existing migrations (e.g. `20260624000000`).
2. Create `migration.sql` with the following content (adapt timestamp to actual date):

   ```sql
   -- AddValue migration: extend RolCurso enum in tenant DB
   -- SPEC-6: additive only — no DROP TYPE, no data changes
   -- Postgres gotcha: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
   -- These statements are intentionally bare (no BEGIN/COMMIT).

   ALTER TYPE "RolCurso" ADD VALUE 'SECRETARIO';
   ALTER TYPE "RolCurso" ADD VALUE 'DIRECTOR';
   ALTER TYPE "RolCurso" ADD VALUE 'EOE';
   ALTER TYPE "RolCurso" ADD VALUE 'DOCENTE_AUXILIAR';
   ```

3. Verify the generated SQL does NOT have `BEGIN` / `COMMIT` / `START TRANSACTION` wrapping
   the `ADD VALUE` statements (Postgres 12+ can ADD VALUE outside a transaction; if wrapped,
   the migration will fail with "ALTER TYPE ... ADD VALUE cannot run inside a transaction
   block").
4. The migration must be applied to EVERY tenant database using:
   `pnpm --filter api prisma:migrate:deploy:tenant`
   **This must happen on the server, not locally.**

#### Deploy order (CRITICAL — ADR-4)

> The migration MUST be applied to ALL tenants BEFORE the frontend with 6 options is deployed.
> If the frontend ships first and a user selects e.g. `SECRETARIO`, the API will attempt an
> INSERT with an enum value that Postgres does not yet know, resulting in a runtime error:
> "invalid input value for enum RolCurso: SECRETARIO".
>
> Mandatory deploy sequence:
> 1. Merge PR (domain + schema + migration + frontend all in one).
> 2. On server: run `prisma:migrate:deploy:tenant` for all tenants.
> 3. Verify each tenant: `SELECT enum_range(NULL::"RolCurso")` must return all 6 values.
> 4. Only then bring up / restart the frontend build.

**Files touched**:
- `api/prisma_tenant/migrations/{timestamp}_rolcurso_roles_extendidos/migration.sql` (new file)

---

### [x] T5 — [Frontend] Refactor RolCurso usage, add label map, derive 6-option select — test + impl

**Depends on T1. Can run in parallel with T3 and T4.**

**Spec**: SPEC-7, SC-07, ADR-2
**Commit**: `feat(web): derive RolCurso select from domain enum + Spanish labels (SPEC-7)`

#### TDD steps (red → green)

1. Open `web/src/pages/dashboard/__tests__/materia-grupos.test.tsx`.
2. Add one failing test that asserts the role `<select>` renders exactly 6 options:

   ```
   it('role select renders all 6 RolCurso options with Spanish labels (SC-07)', async () => {
     // ... set up mocks so the asignacion panel is visible (management user) ...
     // click "Gestionar Asignaciones" to show form, then "+ Asignar Docente"
     // assert the rol select has 6 options and all expected labels appear
   });
   ```

   Use the existing test helpers and mock patterns already in that file. The test should
   verify the presence of all 6 label texts: "Preceptor", "Titular", "Secretario",
   "Director", "EOE", "Docente Auxiliar".

3. Run `pnpm --filter web test` — test fails (only 2 options rendered). Confirm red.

4. Implement changes:

   **`web/src/types/materia-grupo.ts`**:
   - Add import: `import { RolCurso } from '@educandow/domain';`
   - Export it: `export { RolCurso };`
   - Update `AsignacionCursoXCiclo.rol` field type from `'PRECEPTOR' | 'TITULAR'` to `RolCurso`.
   - Add and export the label map (presentation concern — lives in types, not domain):
     ```ts
     export const ROL_CURSO_LABELS: Record<RolCurso, string> = {
       [RolCurso.PRECEPTOR]: 'Preceptor',
       [RolCurso.TITULAR]: 'Titular',
       [RolCurso.SECRETARIO]: 'Secretario',
       [RolCurso.DIRECTOR]: 'Director',
       [RolCurso.EOE]: 'EOE',
       [RolCurso.DOCENTE_AUXILIAR]: 'Docente Auxiliar',
     };
     ```

   **`web/src/pages/dashboard/materia-grupos.tsx`**:
   - Add import of `RolCurso` and `ROL_CURSO_LABELS` from `../../types/materia-grupo`.
   - Change `formRol` state declaration from:
     `const [formRol, setFormRol] = useState<'PRECEPTOR' | 'TITULAR'>('PRECEPTOR');`
     to:
     `const [formRol, setFormRol] = useState<RolCurso>(RolCurso.PRECEPTOR);`
   - Change the onChange handler cast from `as 'PRECEPTOR' | 'TITULAR'` to `as RolCurso`.
   - Replace the 2 hardcoded `<option>` elements in the rol `<select>` with derived options:
     ```tsx
     {(Object.entries(ROL_CURSO_LABELS) as [RolCurso, string][]).map(([value, label]) => (
       <option key={value} value={value}>{label}</option>
     ))}
     ```
   - Update the UI label "Asignaciones del Curso (Preceptor / Titular)" to something
     level-agnostic, e.g. "Asignaciones del Curso" (cosmetic but avoids hardcoding 2 roles
     in a heading that now covers 6).

5. Run `pnpm --filter web test` — new test passes, all existing tests stay green. Confirm green.
6. Run `pnpm --filter web typecheck` to confirm no type errors.
7. Commit test + impl together.

**Files touched**:
- `web/src/types/materia-grupo.ts`
- `web/src/pages/dashboard/materia-grupos.tsx`
- `web/src/pages/dashboard/__tests__/materia-grupos.test.tsx`

---

### [x] T6 — [Verify] Full build + test suite green

**Depends on T1 through T5 (T4 schema change must be reflected in generated client).**

**Spec**: SC-10
**Not a commit** — verification gate before PR is opened.

#### Steps

1. Run `pnpm --filter api prisma:generate` to ensure Prisma client reflects the updated schema.
2. Run `pnpm test` from monorepo root — all suites must pass, coverage ≥ 80%.
3. Run `pnpm build` from monorepo root — exits with code 0.
4. If either fails, diagnose and fix before opening the PR.

**Note**: the migration has not been applied to a real DB at this point (T4 constraint).
The `prisma generate` step is enough to get correct types for tests. Integration tests
against a real tenant DB are deferred to the deploy verification step described in T4.

---

## Execution Order Summary

| Task | Depends on | Can parallelize with | Type |
|------|-----------|----------------------|------|
| T1   | —         | nothing              | test + impl (sequential blocker) |
| T2   | T1        | T3, T5               | test only |
| T3   | T1        | T2, T5               | schema edit |
| T4   | T3        | T5 (partially)       | CONSTRAINED — manual SQL |
| T5   | T1        | T2, T3               | test + impl |
| T6   | T1–T5     | —                    | verify gate |

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated changed/added lines | ~127 lines |
| Domain enum + test | ~23 lines |
| Use-case test | ~25 lines |
| Prisma schema | ~4 lines |
| Migration SQL | ~15 lines |
| Frontend (types + component + test) | ~60 lines |
| **Total** | **~127 lines** |
| 400-line budget risk | **Low** |
| Chained PRs recommended | **No** — fits comfortably in a single PR |
| Decision needed before apply | **No** |
| Files touched | 7 files (6 edits + 1 new migration) |

**Delivery**: single PR with work-unit commits. Commit sequence mirrors T1 → T2 → T3+T4 → T5.
The deploy sequencing (migration before frontend) is an operational constraint, not a code split.
