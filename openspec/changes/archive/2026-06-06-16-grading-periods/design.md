# Design: Grading Periods

## Technical Approach

The implementation will follow a clean architecture approach, introducing a new Value Object, a domain service, and new application use cases, while adhering to existing patterns in the codebase. The core logic will reside in the domain layer, with the application layer orchestrating the flow and the presentation layer handling API requests and responses. Persistence will be updated at the Prisma schema level.

The final period resolution will be: explicit override (`CourseCycle.activeGradingPeriod`) > date-based calculation (`GradingPeriodCalculator`) > `null`.

## Architecture Decisions

### Decision: Value Object for Grading Period

**Choice**: Create a `GradingPeriod` Value Object in `packages/domain/src/shared/value-objects/`.
**Alternatives considered**: Using a raw integer (`number`) in the domain entities.
**Rationale**: A VO enforces domain invariants (e.g., must be between 1 and 4 for bimesters). This prevents invalid states and makes the domain model more expressive and robust, following the existing pattern of using VOs for concepts like `Id` and `CourseName`.

### Decision: Domain Service for Calculation Logic

**Choice**: Create a `GradingPeriodCalculator` domain service in `packages/domain/src/shared/services/`.
**Alternatives considered**: Placing the calculation logic directly inside the `CourseCycle` entity.
**Rationale**: The calculation is based on a list of date ranges and the current system time. This is a stateless operation and a domain service is the perfect place for it. It decouples the `CourseCycle` entity from the details of the calculation and improves testability.

### Decision: Dedicated API Endpoints

**Choice**: Add `GET` and `PATCH` endpoints under `/v1/course-cycles/:uuid/grading-period`.
**Alternatives considered**: Adding `activeGradingPeriod` to the main `PATCH /v1/course-cycles/:uuid` endpoint.
**Rationale**: The spec explicitly forbids updating this field via the main `PATCH` endpoint. Dedicated endpoints create a clearer, more intentional API. This follows the Command Query Responsibility Segregation (CQRS) principle at a micro-level and mirrors the existing `.../:uuid/activate` pattern.

## Data Flow

The data flow for getting and setting the grading period will be as follows:

**GET /v1/course-cycles/:uuid/grading-period**
```
Client ──> CourseCycleController ──> GetGradingPeriodUseCase ──> CourseCycleRepository.findByUuid() ┐
                                                                                                    │
   ┌────────────────────────────────────────────────────────────────────────────────────────────────┘
   │
   └─> CourseCycle (Entity) ┐
                            │
                            ├─> (If explicit value exists) ─> Return value
                            │
                            └─> (If no explicit value) ─> GradingPeriodCalculator.currentPeriod() ┐
                                                                                                   │
                                     ┌─────────────────────────────────────────────────────────────┘
                                     │
Response <── Controller DTO Mapping <── Use Case (returns Result) <─────────────────────────────────┘
```

**PATCH /v1/course-cycles/:uuid/grading-period**
```
Client ──> CourseCycleController (DTO validation) ──> SetGradingPeriodUseCase ┐
                                                                               │
   ┌───────────────────────────────────────────────────────────────────────────┘
   │
   └─> CourseCycleRepository.findByUuid() ──> CourseCycle (Entity) ──> CourseCycleRepository.save() ┐
                                                                                                    │
                                                      ┌─────────────────────────────────────────────┘
                                                      │
Response <── Controller DTO Mapping <── Use Case (returns Result) <─────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/domain/src/shared/value-objects/grading-period.ts` | Create | New `GradingPeriod` Value Object. |
| `packages/domain/src/shared/services/grading-period-calculator.ts` | Create | New `GradingPeriodCalculator` domain service. |
| `packages/domain/src/course-cycle/entities/course-cycle.ts` | Modify | Add `activeGradingPeriod` property and `getCurrentPeriod()` method. |
| `packages/domain/src/enrollment/entities/enrollment.ts` | Modify | Add `activeGradingPeriod` property. |
| `api/prisma_tenant/schema.prisma` | Modify | Add `activeGradingPeriod` (nullable Int) to `CourseCycle` and `Enrollment` models. |
| `api/src/application/course-cycle/use-cases/grading-period.use-cases.ts` | Create | New use cases for getting and setting the grading period. |
| `api/src/presentation/course-cycle/course-cycle.controller.ts` | Modify | Add new methods for the `GET` and `PATCH` grading period endpoints. |
| `api/src/presentation/course-cycle/dto/grading-period.dto.ts` | Create | New DTOs and Zod schemas for the grading period endpoints. |

## Interfaces / Contracts

### GradingPeriod Value Object
```typescript
// packages/domain/src/shared/value-objects/grading-period.ts
export type PeriodType = 'BIMESTER' | 'TRIMESTER';

export class GradingPeriod extends ValueObject<{ value: number; periodType: PeriodType }> {
  public static create(value: number, periodType: PeriodType): Result<GradingPeriod, Error>;
  get value(): number;
  get periodType(): PeriodType;
}
```

### GradingPeriodCalculator Service
```typescript
// packages/domain/src/shared/services/grading-period-calculator.ts
export interface DateRange {
  start: Date;
  end: Date;
}
export class GradingPeriodCalculator {
  public static currentPeriod(ranges: DateRange[]): number | null;
}
```

### API Contracts
**`GET /v1/course-cycles/:uuid/grading-period`**
```json
// Response 200 OK
{
  "data": {
    "activeGradingPeriod": 2,
    "source": "calculated" // "explicit" | "calculated" | "none"
  }
}
```

**`PATCH /v1/course-cycles/:uuid/grading-period`**
```json
// Request Body
{
  "activeGradingPeriod": 3 // number | null
}

// Response 200 OK
{
  "data": {
    "activeGradingPeriod": 3,
    "source": "explicit"
  }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `GradingPeriod` VO | Test valid and invalid creation (e.g., 0, 5 for bimester). |
| Unit | `GradingPeriodCalculator` | Test with dates inside, outside, and on the edge of ranges. Test with overlapping and empty ranges. |
| Unit | `CourseCycle` entity | Test `getCurrentPeriod()` logic: returns override if present, otherwise delegates to calculator. |
| Integration | Use Cases | Test `GetGradingPeriodUseCase` and `SetGradingPeriodUseCase`. Mock repository dependencies. |
| E2E | Controller | Use Supertest to make HTTP requests to the new endpoints, validating responses and database state changes. |

## Migration / Rollout

A database migration will be required to add the `activeGradingPeriod` nullable integer column to the `CourseCycle` and `Enrollment` tables.

1.  Generate a new Prisma migration: `npx prisma migrate dev --name add_grading_period_fields`
2.  Review the generated SQL to ensure it is correct.
3.  Apply the migration.

No data backfill is required as the field is nullable and will default to `null`, correctly triggering the calculation logic.

## Open Questions

- [ ] Should `periodType` ('BIMESTER' | 'TRIMESTER') be sourced from a configuration or an entity property? For now, it will be hardcoded to 'BIMESTER' as per current system usage.
