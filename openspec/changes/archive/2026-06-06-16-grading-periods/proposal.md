# Proposal: Grading Periods

## Intent

The system has no mechanism to determine which grading period (bimester 1–4, trimester 1–3) is currently active for a course cycle. Teachers entering grades have no auto-selection — the UI defaults to nothing. The legacy WINDEV system tracked `PeriodoActivo` (1–4) on enrollment records. EducandoW needs equivalent capability: date-based calculation from bimester ranges with optional explicit override.

**Nivel pedagógico**: ALL (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO).

## Scope

### In Scope
- `GradingPeriod` Value Object (validated 1–4 for bimesters, 1–3 for trimesters)
- `activeGradingPeriod` field on `CourseCycle` (source of truth, nullable Int)
- Domain method: `getCurrentPeriod()` — calculates current period from effective bimester dates, returns null when outside all ranges
- API: `GET /v1/course-cycles/:id/grading-period` + `PATCH /v1/course-cycles/:id/grading-period`
- `activeGradingPeriod` on `Enrollment` model (denormalized mirror, student-level visibility)

### Out of Scope
- UI auto-selection integration (separate change)
- Auto-advancing periods across date boundaries
- Legacy WINDEV `PeriodoActivo` data migration

## Capabilities

### New Capabilities
- `grading-periods`: `GradingPeriod` VO, date-range calculation domain service, GET/PATCH API endpoints, and `Enrollment` denormalization for student-level period awareness.

### Modified Capabilities
- `course-cycle`: adds `activeGradingPeriod` field to entity/model, adds `getCurrentPeriod()` method, adds two new REST endpoints.

## Approach

Period resolution: explicit override > date-based calculation.

1. **VO**: `GradingPeriod` wraps an integer 1–4 with a `periodType` (BIMESTER | TRIMESTER). Validation rejects 0 and >4.
2. **Domain service**: `GradingPeriodCalculator.currentPeriod(dates: [DateRange, ...]): number | null` — iterates sorted date ranges, returns 1-indexed position of the range containing `new Date()`.
3. **Entity**: `CourseCycle.getCurrentPeriod()` delegates to the calculator using effective bimester dates. `activeGradingPeriod` getter returns the explicit value if set, otherwise the calculated value.
4. **API**: `GET .../grading-period` returns `{ activeGradingPeriod, source: "explicit" | "calculated" | "none" }`. `PATCH .../grading-period` accepts `{ activeGradingPeriod: number | null }`.
5. **Enrollment**: new nullable `activeGradingPeriod Int` column. Set when enrollment is created/updated from the parent CourseCycle's current period.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/domain/src/pedagogy/value-objects/` | New | `GradingPeriod` VO + `GradingPeriodCalculator` service |
| `packages/domain/src/pedagogy/entities/course-cycle.ts` | Modified | +`activeGradingPeriod`, +`getCurrentPeriod()` |
| `packages/domain/src/enrollment/entities/enrollment.ts` | Modified | +`activeGradingPeriod` field |
| `api/prisma_tenant/schema.prisma` | Modified | +`activeGradingPeriod` on `CourseCycle` + `Enrollment` |
| `api/src/course-cycles/` | Modified | +controller route + use case for grading-period |
| `api/src/enrollments/` | Modified | Include `activeGradingPeriod` in create/update |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Date ranges may overlap or have gaps | Low | Calculator sorts ranges, returns first match; gaps return null |
| Enrollment denormalization drifts from CourseCycle | Low | CourseCycle is single source of truth; enrollment value is advisory only |

## Rollback Plan

1. Remove `activeGradingPeriod` columns via migration rollback (Prisma migrate down).
2. Revert `course-cycle.ts` entity and controller changes.
3. Remove `GradingPeriod` VO and calculator files.
4. No data loss — `activeGradingPeriod` is nullable and no other models depend on it.

## Dependencies

- None (all bimester date fields already exist on `AcademicCycle` and `CourseCycle`).

## Success Criteria

- [ ] `GradingPeriod.create(2)` returns valid VO; `create(0)` and `create(5)` fail
- [ ] Calculator returns correct period index when `new Date()` falls within a bimester range
- [ ] Calculator returns `null` when today is outside all defined ranges
- [ ] `GET /v1/course-cycles/:id/grading-period` returns `{ activeGradingPeriod, source }` with HTTP 200
- [ ] `PATCH .../grading-period` with `{ activeGradingPeriod: 2 }` persists and overrides calculation
- [ ] Enrollment created for a CourseCycle inherits its `activeGradingPeriod`
