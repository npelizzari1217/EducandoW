# Apply Progress — docente-grade-entry (Fase D, Terciario)

**Branch**: `feat/docente-grade-entry`
**Commit**: 18a9253
**Date**: 2026-06-19
**Status**: ALL TASKS COMPLETE ✓

## Tasks Completed (19/19)

- [x] T-01 — Entity `DocenteXMateriaCarrera` (test-first) — domain pure entity, `create/reconstruct/unassign/reactivate`
- [x] T-02 — Repo port `DocenteXMateriaCarreraRepository` — 5 methods, token exported
- [x] T-03 — `TerciarioAuthorizerPort` — `canWriteGrades` + `getAllowedStudentIds`, reuses `StudentScope`
- [x] T-04 — `DocenteAlreadyAssignedError` + `AssignmentAlreadyInactiveError`
- [x] T-05 — Barrel exports — all new symbols exported from `@educandow/domain`
- [x] T-06 — Tenant Prisma schema — `DocenteXMateriaCarrera` model + `MateriaCarrera` back-relation; confirmed `@@map("materias_carrera")`
- [x] T-07 — Tenant migration SQL — `20260619100000_docentes_x_materia_carrera`
- [x] T-08 — `PrismaDocenteXMateriaCarreraRepository` (test-first) — all 5 methods, TenantContext
- [x] T-09 — `listByMateria(materiaCarreraId, anioAcademico)` on `InscripcionRepository` port + `PrismaInscripcionMateriaRepository` impl
- [x] T-10 — Master migration SQL — `20260619110000_teacher_grades_update` (idempotent UPDATE)
- [x] T-11 — `seed-rbac.sql` — TEACHER GRADES `['CREATE','READ','UPDATE']`
- [x] T-12 — Exception filter — `DOCENTE_ALREADY_ASSIGNED: 409`, `ASSIGNMENT_ALREADY_INACTIVE: 409`
- [x] T-13 — `TerciarioAuthorizerService` (test-first) — Door 2 bypass, Door 3 lookup, fail-closed
- [x] T-14 — Cursada write UCs + `ListInscripcionesDocenteUC` (test-first) — ownership injected via `TerciarioAuthorizerPort`
- [x] T-15 — Admin use-cases: `AssignDocenteMateriaUC` / `ListAssignmentsUC` / `UnassignDocenteMateriaUC` (test-first)
- [x] T-16 — `NotaCursadaTerciarioController` — `@CurrentUser` on write actions, new `GET /terciario/cursada/inscripciones`
- [x] T-17 — `DocenteMateriaAdminController` — 3 routes (POST/GET/PATCH)
- [x] T-18 — `NivelTerciarioModule` — all new providers + controller wired
- [x] T-19 — Regression pass — 101 domain tests + 1357 API tests green; `pnpm build` clean; 0 TS errors

## Test Counts

| Suite | Files | Tests |
|---|---|---|
| `@educandow/domain` | 101 | 1132 |
| `api` | 137 | 1357 |
| **Total** | **238** | **2489** |

## Files Created

- `packages/domain/src/nivel-terciario/docente-x-materia-carrera.entity.ts`
- `packages/domain/src/nivel-terciario/repositories/docente-x-materia-carrera-repository.ts`
- `packages/domain/src/nivel-terciario/index.ts`
- `packages/domain/src/nivel-terciario/__tests__/docente-x-materia-carrera.entity.test.ts`
- `packages/domain/src/grading/ports/terciario-authorizer.port.ts`
- `packages/domain/src/shared/errors/docente-already-assigned-error.ts`
- `packages/domain/src/shared/errors/assignment-already-inactive-error.ts`
- `api/prisma_tenant/migrations/20260619100000_docentes_x_materia_carrera/migration.sql`
- `api/prisma_master/migrations/20260619110000_teacher_grades_update/migration.sql`
- `api/src/infrastructure/persistence/prisma/repositories/prisma-docente-x-materia-carrera.repository.ts`
- `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-docente-x-materia-carrera.repository.test.ts`
- `api/src/application/grading/terciario-authorizer.service.ts`
- `api/src/application/grading/__tests__/terciario-authorizer.service.test.ts`
- `api/src/application/nivel-terciario/use-cases/docente-materia.use-cases.ts`
- `api/src/application/nivel-terciario/__tests__/docente-materia.use-cases.test.ts`
- `api/src/presentation/nivel-terciario/docente-materia-admin.controller.ts`

## Files Modified

- `packages/domain/src/grading/index.ts` — added `TerciarioAuthorizerPort` exports
- `packages/domain/src/index.ts` — added all new domain symbols
- `packages/domain/src/terciario/repositories/inscripcion-repository.ts` — added `listByMateria`
- `api/prisma_tenant/schema.prisma` — added `DocenteXMateriaCarrera` model + back-relation
- `api/prisma/seed-rbac.sql` — TEACHER GRADES `['CREATE','READ','UPDATE']`
- `api/src/presentation/shared/filters/exception.filter.ts` — 2 new codes
- `api/src/infrastructure/persistence/prisma/repositories/prisma-inscripcion-materia.repository.ts` — `listByMateria`
- `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts` — authz integration + `ListInscripcionesDocenteUC`
- `api/src/application/nivel-terciario/__tests__/nota-cursada-terciario.use-cases.test.ts` — new ownership tests, updated signatures
- `api/src/application/nivel-terciario/__tests__/confirmar-nota-cursada.uc.test.ts` — updated signatures
- Several test files — added `listByMateria` to InscripcionRepository mocks
- `api/src/presentation/nivel-terciario/nota-cursada-terciario.controller.ts` — `@CurrentUser`, new GET route
- `api/src/presentation/nivel-terciario/nivel-terciario.module.ts` — full DI wiring

## Deferred (DB unavailable — apply at deploy time)

- **Tenant migration**: `api/prisma_tenant/migrations/20260619100000_docentes_x_materia_carrera/migration.sql` — creates `docentes_x_materia_carrera` table
- **Master migration**: `api/prisma_master/migrations/20260619110000_teacher_grades_update/migration.sql` — grants GRADES:UPDATE to TEACHER role
- **Operational note**: docentes must re-login after master migration to get `GRADES:UPDATE` in their JWT

## Non-obvious Discoveries

1. `listByMateria` did NOT exist on `InscripcionRepository` port — had to add it and update all 5 existing test files that mock the interface.
2. `ConfirmarNotaCursadaUC` had its own separate test file (`confirmar-nota-cursada.uc.test.ts`) using the old signature — both files needed updating.
3. T-14..T-18 were atomic: changing 3 UC constructors broke their module wiring until T-18 was done. All implemented in one batch.
4. `nivel-terciario` directory did not exist in `packages/domain/src/` — created it fresh.
5. `pnpm --filter api typecheck` initially showed domain symbols missing because domain TypeScript wasn't built — ran `pnpm --filter @educandow/domain build` first.
6. The `InscripcionMateria.studentId` field is directly accessible (not via a VO), enabling direct filter in `ListInscripcionesDocenteUC`.
