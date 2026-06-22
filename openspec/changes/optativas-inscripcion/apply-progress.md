# Apply Progress: optativas-inscripcion — PR1

> Batch: PR1 (10 tasks, T1.1–T1.10)
> Status: DONE
> Date: 2026-06-22
> Test runner: pnpm test (turbo)
> Build: pnpm build

## PR1 Tasks

- [x] T1.1 — Entity test (RED): added 4 failing tests for esOptativa to `packages/domain/src/materia-grupo-ciclo/__tests__/entities/materia-x-curso-x-ciclo.test.ts`
- [x] T1.2 — Entity implementation (GREEN): added `esOptativa: boolean` to `MateriaXCursoXCicloProps`, `esOptativa?: boolean` to `CreateMateriaXCursoXCicloInput`, `esOptativa: input.esOptativa ?? false` in `create()`, getter `get esOptativa()`. File: `packages/domain/src/materia-grupo-ciclo/entities/materia-x-curso-x-ciclo.ts`
- [x] T1.3 — Port `MateriaXCursoXCicloRepository`: extended `upsertMany` element with `esOptativa?: boolean`; added `setEsOptativa(id, esOptativa): Promise<MateriaXCursoXCiclo>`. File: `packages/domain/src/materia-grupo-ciclo/repositories/materia-x-curso-x-ciclo-repository.ts`
- [x] T1.4 — Port `AlumnosXMateriaRepository`: added `removeStudent(id): Promise<void>` method. File: `packages/domain/src/materia-grupo-ciclo/repositories/alumnos-x-materia-repository.ts`
- [x] T1.5 — Schema: added `esOptativa Boolean @default(false) @map("es_optativa")` to `MateriaXCursoXCiclo`. File: `api/prisma_tenant/schema.prisma`. Migration SQL authored manually (DB unreachable in CI env): `api/prisma_tenant/migrations/20260622000000_add_es_optativa_to_materia_x_curso_x_ciclo/migration.sql`. Prisma client regenerated: `esOptativa` is now typed in `@prisma/tenant-client`.
- [x] T1.6 — Cascade tests (RED): added MGC-S15 (optativa filter — alumnos + competencies), MGC-S16 (all-obligatoria regression guard), MGC-S17 (all-optativa returns zeros) tests to `api/src/application/course-cycle/__tests__/cascade-student-materias-competencias.use-case.test.ts`
- [x] T1.7 — Cascade filter (GREEN): added `.filter((m) => !m.esOptativa)` after `findByCourseCycleId` in `api/src/application/course-cycle/cascade-student-materias-competencias.use-case.ts`. Applies to BOTH alumno upsert and competency resolution (D2).
- [x] T1.8 — Prisma repo tests (RED): 5 tests in new file `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-materia-x-curso-x-ciclo.repository.test.ts` covering upsertMany with/without flag, setEsOptativa toggle, toDomain round-trip.
- [x] T1.9 — Prisma repo implementation (GREEN): updated `MateriaXCursoXCicloRow` type, `upsertMany` to include `esOptativa: d.esOptativa ?? false`, added `setEsOptativa` method, updated `toDomain` to pass `esOptativa: row.esOptativa`. File: `api/src/infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository.ts`. Also pre-implemented `removeStudent` in `api/src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-materia.repository.ts` to satisfy T1.4 interface contract and keep build clean (tests for it are in PR2 T2.1).
- [x] T1.10 — Build verification: all 294 test files pass (domain 99, api 153, web 42 = 3028 tests). TypeScript build clean (`pnpm build` → 3 tasks successful).

## Side effects / fixups

- Updated 6 existing test fixture files that call `MateriaXCursoXCiclo.reconstruct()` without `esOptativa` — each got `esOptativa: false` added to stay source-compatible with the now-required prop:
  - `api/src/application/grading/list-admin-subjects-in-course-cycle.use-case.spec.ts`
  - `api/src/application/materia-grupo-ciclo/__tests__/list-materias.use-case.test.ts`
  - `api/src/application/materia-grupo-ciclo/__tests__/update-grupo.use-case.test.ts`
  - `api/src/application/materia-grupo-ciclo/__tests__/create-grupo.use-case.test.ts`
  - `api/src/application/materia-grupo-ciclo/__tests__/materialize-materias.use-case.test.ts`
  - `api/src/application/materia-grupo-ciclo/__tests__/add-student-to-materia.use-case.test.ts`
- Updated existing cascade test fixtures (plain objects `materia1`, `materia2`) to include `esOptativa: false`.

## Migration status

Migration SQL file authored at `api/prisma_tenant/migrations/20260622000000_add_es_optativa_to_materia_x_curso_x_ciclo/migration.sql`.
`prisma migrate dev` could NOT run (non-interactive environment). The migration MUST be applied before deploying or running integration tests against a live DB:
```
pnpm --filter api prisma:migrate:tenant   # dev
# OR
pnpm --filter api prisma:deploy:tenant    # prod
```
The Prisma client was regenerated successfully via `pnpm --filter api prisma:generate` — the schema file drives code generation, not the DB.

## Test results

| Suite | Files | Tests |
|-------|-------|-------|
| @educandow/domain | 99 | 1112 |
| api | 153 | 1490 |
| web | 42 | 426 |
| **Total** | **294** | **3028** |

Cascade filter tests (MGC-S15, S16, S17): PASS.
Entity esOptativa tests (MGC-S14): PASS.
Prisma repo flag tests (upsertMany + setEsOptativa): PASS.

## Post-PR1 typecheck fix (C1)

- [x] C1 — Added `removeStudent: vi.fn()` / `setEsOptativa: vi.fn()` stubs to mock factories in 7 existing test files that were not updated when the port interfaces gained those methods. `pnpm --filter api typecheck` → exit 0, 0 errors. `pnpm --filter api test` → 153 files / 1490 tests, all green.
  - `api/src/application/materia-grupo-ciclo/__tests__/add-student-to-grupo.use-case.test.ts` (removeStudent)
  - `api/src/application/materia-grupo-ciclo/__tests__/add-student-to-materia.use-case.test.ts` (setEsOptativa + removeStudent)
  - `api/src/application/materia-grupo-ciclo/__tests__/create-grupo.use-case.test.ts` (setEsOptativa)
  - `api/src/application/materia-grupo-ciclo/__tests__/list-alumnos-materia.use-case.test.ts` (removeStudent)
  - `api/src/application/materia-grupo-ciclo/__tests__/list-materias.use-case.test.ts` (setEsOptativa + removeStudent on both inline factories)
  - `api/src/application/materia-grupo-ciclo/__tests__/materialize-materias.use-case.test.ts` (setEsOptativa)
  - `api/src/application/materia-grupo-ciclo/__tests__/update-grupo.use-case.test.ts` (setEsOptativa)

## Next

PR1 complete. Next batch: PR2 (T2.1–T2.16).
next_recommended: sdd-verify (run against PR1 tasks) OR sdd-apply for PR2 slice.
