# Archive Report: curso-por-ciclo

**Archived**: 2026-06-02
**Status**: Complete — 17/17 tasks verified
**Mode**: Hybrid (openspec + Engram)

---

## Summary

Nuevo bounded context `CourseCycle` que vincula cursos (`CourseSection`) con ciclos lectivos (`AcademicCycle`) y planes de estudio (`StudyPlan`). Entidad intermedia con 18 campos, Value Objects inmutables, soft delete, y guardia `active=false` que bloquea modificaciones. Incluye generación masiva desde plan de estudio y frontend CRUD completo.

---

## What Was Implemented

| Capability | Description |
|------------|-------------|
| `course-cycle` | Entidad CourseCycle con CRUD completo, Value Objects (CourseName, PassingGrade, BimonthPeriod), repositorio Prisma con unique constraint `(courseId, cycleId)` |
| Bulk generation | `POST /v1/course-cycles/generate` — crea un CourseCycle por cada curso del plan para un ciclo dado, skip duplicados |
| Active guard | `active=false` bloquea PATCH/DELETE con HTTP 409 (CourseCycleClosedError) |
| Soft delete | `deletedAt` timestamp, oculto en queries normales |
| Frontend | Página `/course-cycles` con tabla filtrable, formulario CRUD, modal "Generar cursos" |

---

## Files Created (27) + Modified (5)

### Domain (packages/domain/src/course-cycle/)
| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports |
| `errors.ts` | Domain errors (CourseCycleClosedError, CourseCycleAlreadyExistsError, CourseCycleNotFoundError, BimonthPeriodInvalidError) |
| `entities/course-cycle.ts` | Entity + factory create, ensureActive(), softDelete(), activate(), deactivate() |
| `entities/index.ts` | Entity barrel |
| `value-objects/course-name.ts` | VO: uppercase, non-empty |
| `value-objects/passing-grade.ts` | VO: Float 1-10 inclusive |
| `value-objects/bimonth-period.ts` | VO: validates end > start |
| `value-objects/index.ts` | VOs barrel |
| `repositories/course-cycle-repository.ts` | Interface |
| `repositories/index.ts` | Repo barrel |
| `__tests__/entities/course-cycle.test.ts` | Entity unit tests |
| `__tests__/value-objects/course-name.test.ts` | CourseName VO tests |
| `__tests__/value-objects/passing-grade.test.ts` | PassingGrade VO tests |
| `__tests__/value-objects/bimonth-period.test.ts` | BimonthPeriod VO tests |

### API
| File | Purpose |
|------|---------|
| `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` | 7 use cases (CRUD + generate + toggle) |
| `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts` | Use case unit tests |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts` | Prisma repo impl |
| `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-course-cycle.repository.test.ts` | Repo integration tests |
| `api/src/presentation/course-cycle/course-cycle.controller.ts` | 8 endpoints |
| `api/src/presentation/course-cycle/dto/course-cycle.dto.ts` | Zod schemas |
| `api/src/presentation/course-cycle/course-cycle.module.ts` | NestJS module |
| `api/src/presentation/course-cycle/__tests__/course-cycle.controller.test.ts` | Controller E2E tests |

### Web
| File | Purpose |
|------|---------|
| `web/src/lib/types/course-cycle.ts` | TypeScript types |
| `web/src/hooks/useCourseCycles.ts` | React hooks (list, create, update, delete, toggle, generate) |
| `web/src/components/course-cycle/CourseCycleForm.tsx` | CRUD form |
| `web/src/components/course-cycle/GenerateCourseCyclesModal.tsx` | Bulk generate modal |
| `web/src/pages/dashboard/course-cycles.tsx` | CRUD page with filters + table |
| `web/src/pages/dashboard/__tests__/course-cycles.test.tsx` | Frontend tests |

### Modified Files
| File | Change |
|------|--------|
| `packages/domain/src/index.ts` | Export CourseCycle, VOs, repository interface |
| `api/prisma/schema_tenant.prisma` | Add CourseCycle model |
| `api/src/app.module.ts` | Import CourseCycleModule |
| `api/src/presentation/shared/filters/exception.filter.ts` | Add new error codes to DOMAIN_STATUS |
| `web/src/App.tsx` | Add route `/course-cycles` |
| `web/src/components/layout/sidebar.tsx` | Add menu item "Cursos por Ciclo" |

---

## Issues Found & Resolved

### Circular dependency in NestJS module registration
- **Issue**: `CourseCycleModule` imports `PrismaModule` and `SharedModule`; `AppModule` imports `CourseCycleModule`. During initial wiring, a circular dependency emerged between `CourseCycleModule` and other modules that also imported `PrismaModule` indirectly.
- **Resolution**: Used NestJS `forwardRef()` for the circular imports and ensured `PrismaModule` is a `Global` module so it doesn't need re-importing in every feature module.
- **Files affected**: `api/src/presentation/course-cycle/course-cycle.module.ts`, `api/src/app.module.ts`

### Prisma migrate pre-existing failure
- **Issue**: `prisma migrate dev` failed due to pre-existing migration state issues.
- **Resolution**: Used `prisma db push` instead for the new `course_cycles` table.
- **Status**: Schema deployed correctly; unique constraint `(courseId, cycleId)` functional.

### Vite test resolution
- **Issue**: Tests in `__tests__/` subdirectories needed specific depth configuration for Vite to resolve them correctly.
- **Resolution**: Adjusted Vitest config to scan the correct subdirectory depth.

---

## Test Coverage

| Layer | Tests | Status |
|-------|-------|--------|
| Domain | 551 | ✅ All passing |
| API | 217 | ✅ All passing |
| Web | 88 | ✅ All passing |
| **Total** | **856** | ✅ **100% passing** |

All unit, integration, and E2E tests pass. Coverage threshold ≥80% met.

---

## Verification Evidence

- **Build**: ✅ `pnpm build` — 0 TS issues, all packages compile cleanly
- **Tests**: ✅ `pnpm test` — 856 passing
- **Tasks**: ✅ 17/17 completed across 6 phases (F1-F6)
- **Archived spec**: `openspec/specs/course-cycle/spec.md` (new capability)

---

## Archive Contents

```
openspec/changes/archive/2026-06-02-curso-por-ciclo/
├── archive-report.md   (this file)
├── proposal.md         (proposal phase)
├── specs/
│   └── course-cycle/
│       └── spec.md     (delta spec — merged to canonical)
├── design.md           (technical design)
└── tasks.md            (17 tasks, all marked [x])
```

## Engram Artifacts

| Artifact | Observation ID |
|----------|---------------|
| `sdd/curso-por-ciclo/proposal` | Retrieved from memory |
| `sdd/curso-por-ciclo/apply-progress` | #515 |
| `sdd/curso-por-ciclo/archive-report` | This observation |

---

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
Ready for the next change.
