# Apply Progress: optativas-inscripcion — PR1 + PR2

> Status: PR1 DONE · PR2 DONE
> Date PR1: 2026-06-22
> Date PR2: 2026-06-22
> Test runner: pnpm test (turbo)
> Build: pnpm build

---

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

## PR1 Side effects / fixups

- Updated 6 existing test fixture files that call `MateriaXCursoXCiclo.reconstruct()` without `esOptativa` — each got `esOptativa: false` added.
- Updated existing cascade test fixtures (plain objects `materia1`, `materia2`) to include `esOptativa: false`.

## PR1 Post-typecheck fix (C1)

- [x] C1 — Added `removeStudent: vi.fn()` / `setEsOptativa: vi.fn()` stubs to mock factories in 7 existing test files that were not updated when the port interfaces gained those methods. `pnpm --filter api typecheck` → exit 0, 0 errors. `pnpm --filter api test` → 153 files / 1490 tests, all green.

## Migration status

Migration SQL file authored at `api/prisma_tenant/migrations/20260622000000_add_es_optativa_to_materia_x_curso_x_ciclo/migration.sql`.
`prisma migrate dev` could NOT run (non-interactive environment). The migration MUST be applied before deploying or running integration tests against a live DB:
```
pnpm --filter api prisma:migrate:tenant   # dev
# OR
pnpm --filter api prisma:deploy:tenant    # prod
```
The Prisma client was regenerated successfully via `pnpm --filter api prisma:generate` — the schema file drives code generation, not the DB.

---

## PR2 Tasks

- [x] T2.1 [TEST] — Extended `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-alumnos-x-materia.repository.test.ts` with 2 new `removeStudent` tests (idempotent delete + non-existent id). Tests pass immediately (impl was pre-done in PR1 T1.9).
- [x] T2.2 [IMPL] — `removeStudent` already implemented in PR1 (T1.9 pre-impl). File: `api/src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-materia.repository.ts`.
- [x] T2.3 [TEST] — New file `api/src/application/materia-grupo-ciclo/__tests__/remove-student-from-materia.use-case.test.ts`. 3 tests: happy path + NotFound + not-called-on-missing-materia. RED confirmed before impl.
- [x] T2.4 [IMPL] — New file `api/src/application/materia-grupo-ciclo/remove-student-from-materia.use-case.ts`. Mirrors `RemoveStudentFromGrupoUseCase`: validates materia exists, delegates `alumnosRepo.removeStudent(alumnoXMateriaId)`. T2.3 tests GREEN.
- [x] T2.5 [TEST] — New file `api/src/application/materia-grupo-ciclo/__tests__/set-materia-es-optativa.use-case.test.ts`. 4 tests: toggle true/false + NotFound + no-alumno-repo-interaction (D6). RED confirmed.
- [x] T2.6 [IMPL] — New file `api/src/application/materia-grupo-ciclo/set-materia-es-optativa.use-case.ts`. Validates materia exists, calls `materiaRepo.setEsOptativa(id, esOptativa)`, returns entity. Single repo injection. T2.5 tests GREEN.
- [x] T2.7 [TEST] — New file `api/src/application/materia-grupo-ciclo/__tests__/list-enrollable-students-for-materia.use-case.test.ts`. 5 tests: NotFound + set-diff + all-enrolled empty + empty-optativa full list + courseCycleId routing. RED confirmed.
- [x] T2.8 [IMPL] — New file `api/src/application/materia-grupo-ciclo/list-enrollable-students-for-materia.use-case.ts`. Resolves materia → `findByCourseCycleEnriched(courseCycleId)` → `findByMateria(materiaId)` → set diff → projects to `AlumnoMateriaEnriched`. T2.7 tests GREEN.
- [x] T2.9 [TEST] — New file `api/src/presentation/materia-grupo-ciclo/__tests__/list-materias.controller.spec.ts`. 2 tests: MGC-S27 (esOptativa: false/true in response) + empty result. RED confirmed (DTO lacked esOptativa).
- [x] T2.10 [IMPL] — Added `esOptativa: boolean` to `MateriaResponse` interface in `api/src/presentation/materia-grupo-ciclo/dto/materia-grupo-ciclo.dto.ts`. Added `SetMateriaEsOptativaSchema` + `SetMateriaEsOptativaDto`. Updated `listMaterias` mapping to include `esOptativa: item.materia.esOptativa`. T2.9 tests GREEN.
- [x] T2.11 [TEST] — New file `api/src/presentation/materia-grupo-ciclo/__tests__/remove-student-from-materia.controller.spec.ts`. 3 tests: 204 delegation + NotFound propagation + idempotent double-call. RED confirmed.
- [x] T2.12 [TEST] — New file `api/src/presentation/materia-grupo-ciclo/__tests__/set-materia-es-optativa.controller.spec.ts`. 4 tests: toggle true + toggle false + NotFound + response shape (MateriaResponse). RED confirmed.
- [x] T2.13 [TEST] — New file `api/src/presentation/materia-grupo-ciclo/__tests__/list-enrollable-students.controller.spec.ts`. 4 tests: eligible=true delegates to ListEnrollableStudentsForMateriaUC + without-eligible uses existing UC + eligible wins over unassigned + empty candidates. RED confirmed (2 of 4 failed; T2/T4 passed because existing handler ignores extra params).
- [x] T2.14 [IMPL] — Updated `api/src/presentation/materia-grupo-ciclo/materia-grupo-ciclo.controller.ts`:
  - Added `?eligible` branch to `listAlumnosMateria` handler (eligible wins over unassigned if both set).
  - Added `DELETE course-cycles/:ccId/materias/:materiaId/alumnos/:id` → `removeStudentFromMateriaUC`. Authz: COURSE_CYCLES × DELETE.
  - Added `PATCH course-cycles/:ccId/materias/:materiaId` → `setMateriaEsOptativaUC`. Body: Zod `{ esOptativa: z.boolean() }`. Returns MateriaResponse. Authz: COURSE_CYCLES × UPDATE.
  - Added 3 new UC constructor params: `removeStudentFromMateriaUC`, `setMateriaEsOptativaUC`, `listEnrollableStudentsForMateriaUC`.
  - T2.11, T2.12, T2.13 tests GREEN.
- [x] T2.15 [IMPL] — Updated `api/src/presentation/materia-grupo-ciclo/materia-grupo-ciclo.module.ts`:
  - Added `PrismaAlumnosXCursoXCicloRepository` to providers.
  - Registered 3 new use cases: `RemoveStudentFromMateriaUseCase`, `SetMateriaEsOptativaUseCase`, `ListEnrollableStudentsForMateriaUseCase`.
- [x] T2.16 [BUILD] — `pnpm --filter api test` → 160 files / 1517 tests, all GREEN. `pnpm --filter api typecheck` → exit 0, 0 errors. `pnpm --filter api build` → success.

## PR2 Test results

| Suite | Files | Tests |
|-------|-------|-------|
| api (after PR2) | 160 (+7 files, +27 tests) | 1517 |

New test files added (7):
- `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-alumnos-x-materia.repository.test.ts` (extended with removeStudent tests)
- `api/src/application/materia-grupo-ciclo/__tests__/remove-student-from-materia.use-case.test.ts` (new)
- `api/src/application/materia-grupo-ciclo/__tests__/set-materia-es-optativa.use-case.test.ts` (new)
- `api/src/application/materia-grupo-ciclo/__tests__/list-enrollable-students-for-materia.use-case.test.ts` (new)
- `api/src/presentation/materia-grupo-ciclo/__tests__/list-materias.controller.spec.ts` (new)
- `api/src/presentation/materia-grupo-ciclo/__tests__/remove-student-from-materia.controller.spec.ts` (new)
- `api/src/presentation/materia-grupo-ciclo/__tests__/set-materia-es-optativa.controller.spec.ts` (new)
- `api/src/presentation/materia-grupo-ciclo/__tests__/list-enrollable-students.controller.spec.ts` (new)

Typecheck (tsc --noEmit): exit 0, 0 errors.
Build: success.

## Next

PR2 complete. All T2.1–T2.16 tasks done. Ready for sdd-verify (PR2) before PR3.
next_recommended: sdd-verify (PR2 slice) OR sdd-apply (PR3 — web layer).
