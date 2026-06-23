# Apply Progress — asignacion-cascade-masiva

**Status:** done — all 3 tasks complete  
**Date:** 2026-06-23  
**TDD mode:** strict (RED → GREEN for every task)

## T-01 [x] — Bulk cascade use case

Files created:
- `api/src/application/course-cycle/__tests__/cascade-all-students-materias-competencias.use-case.test.ts`
  — 12 test cases (BULK-01 through BULK-08 with sub-cases)
- `api/src/application/course-cycle/cascade-all-students-materias-competencias.use-case.ts`
  — `BulkCascadeResult` interface + `CascadeAllStudentsMateriasCompetenciasUseCase` class

Key implementation notes:
- Same 5 constructor ports as per-student UC (same order)
- `findByCourseCycle` called once; `findByCourseCycleId` called once; `findActiveByStudyPlanSubject` called once per unique SPS — no N+1
- Per-student loop with best-effort try/catch; `studentsFailed` accumulates failures
- `this.logger?.warn(...)` — optional chaining needed because `Object.create(prototype)` test pattern skips field initializers
- No `NotFoundError` at batch level (ADR-B3)
- All-optativa CC returns `studentsProcessed=rows.length, rest=0` (no writes)

## T-02 [x] — Bulk endpoint + module wiring

Files modified:
- `api/src/presentation/course-cycle-alumnos/__tests__/alumnos-x-curso-x-ciclo.controller.spec.ts`
  — `makeController()` extended with all 8 UC deps; C-12 happy path; C-13 route-order assertion
- `api/src/presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.controller.ts`
  — New `bulkCascadeUC` ctor dep added; `cascadeAll` handler declared BEFORE `cascade` (ADR-B5)
  — `@Post('course-cycles/:ccId/alumnos/cascade')` with same Roles guard as per-student
- `api/src/presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.module.ts`
  — New `useFactory` provider for `CascadeAllStudentsMateriasCompetenciasUseCase` injecting same 5 Prisma repos

## T-03 [x] — Frontend bulk cascade button

Files modified:
- `web/src/pages/dashboard/__tests__/course-cycles.test.tsx`
  — Inner describe "Bulk cascade button" with W-19..W-24; inner `beforeEach` overrides `mockGet` to return 1 CC row; `as any` casts for type-compatible mock returns
- `web/src/pages/dashboard/course-cycles.tsx`
  — `BulkCascadeResult` interface; `confirmCascadeCcId` + `cascadingBulkCcId` state; `handleBulkCascade` handler; "Asignar materias y competencias" Button with `data-testid`; confirm Modal with `data-testid="btn-confirm-bulk-cascade"`

## Test results

```
pnpm test:
  domain:  99 files, 1114 tests — all pass
  api:    161 files, 1554 tests — all pass
  web:     44 files,  448 tests — all pass

pnpm build: clean (only pre-existing chunk-size warning)
```

## Gotchas

1. `private readonly logger = new Logger(...)` is a class field initializer. It does NOT run when using `Object.create(prototype)` in tests. Solution: use `this.logger?.warn(...)` (optional chaining).
2. Web tsconfig includes test files in its build (`include: ["src/**/*.ts", "src/**/*.tsx"]`). TypeScript infers `mockPost` return type from declaration; overriding with different shapes requires `as any` casts.
3. Inner `describe` `beforeEach` overrides outer `mockGet` implementation — safe because outer `it()` tests are declared BEFORE the inner describe, so they execute first.
