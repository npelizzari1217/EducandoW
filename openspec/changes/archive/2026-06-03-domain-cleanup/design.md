# Design: Domain Cleanup — Value Object Consistency

## Technical Approach

The technical approach is a pure domain-layer refactoring to enforce strict Value Object (VO) typing and consistency. This involves creating a new `EnrollmentStatus` VO and updating existing entities (`Student`, `Teacher`, `AcademicCycle`, `Enrollment`) to replace primitive types (`string`, `number`) with their corresponding VOs (`Id`, `EducationalLevel`, `EducationalModality`, `EnrollmentStatus`). All changes will be confined to the `@educandow/domain` package, ensuring zero impact on infrastructure, API, or web layers in this phase. The focus is on type safety and domain integrity, with backward compatibility managed at the `create()` method level to prevent breaking changes for existing callers.

## Architecture Decisions

### Decision: New Value Object Pattern for `EnrollmentStatus`

- **Choice**: Implement `EnrollmentStatus` following the existing pattern used by `EducationalLevel` and `EducationalModality`. This includes a private constructor, a static `create()` method returning a `Result<T, ValidationError>`, a static `reconstruct()` for persistence hydration, and an `equals()` method for value comparison.
- **Alternatives considered**:
    1.  Using a simple string enum. Rejected because it doesn't provide runtime validation or the rich domain object semantics of a full VO.
    2.  Using a factory function without a class. Rejected as it breaks the established class-based VO pattern in the codebase, leading to inconsistency.
- **Rationale**: Adhering to the established pattern ensures consistency across the domain layer. The `Result` object provides robust error handling, and the private constructor guarantees that invalid states are unrepresentable, which is the core benefit of a Value Object.

### Decision: Backward Compatibility for `institutionId`

- **Choice**: The `create()` methods for `Student` and `Teacher` will be updated to make the `institutionId` parameter optional. The internal property will be typed as `Id | undefined`. The `reconstruct` method will continue to require it, as data from persistence is expected to be complete.
- **Alternatives considered**:
    1.  Forcing all callers to immediately provide an `Id` object. Rejected as it would create a breaking change for any part of the system currently creating students or teachers.
    2.  Creating overloaded `create()` methods. Rejected as it adds unnecessary complexity; an optional parameter handles the use case cleanly.
- **Rationale**: The goal is to improve domain purity without causing cascading failures in dependent packages. Since the `institutionId` is often injected by tenant-aware infrastructure, making it optional at the domain's entry point (`create()`) is a pragmatic step that reflects its usage context.

## Data Flow

This change does not introduce new data flows. It modifies the in-memory representation of data within the domain layer entities.

1.  **Application Service Layer** (Unaffected, but will be updated in a future change) calls entity `create()` methods.
2.  **`Entity.create()`** now internally calls `ValueObject.create()` for validation (e.g., `Enrollment` uses `EnrollmentStatus.create`).
3.  **Data Hydration** (e.g., from a repository) will use `ValueObject.reconstruct()` to bypass validation and build entities from trusted, persisted data.

The flow remains the same, but the internal data types are now richer, self-validating domain objects instead of primitives.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/domain/src/enrollment/value-objects/EnrollmentStatus.ts` | Create | Defines the new `EnrollmentStatus` Value Object with validation. |
| `packages/domain/src/enrollment/value-objects/index.ts` | Create | Barrel file to export the new `EnrollmentStatus` VO. |
| `packages/domain/src/enrollment/entities/enrollment.ts` | Modify | Replace `status: EnrollmentStatusType` with `status: EnrollmentStatus`. Update `create()` and `changeStatus()` to use the VO. |
| `packages/domain/src/enrollment/index.ts` | Modify | Re-export the new `EnrollmentStatus` VO for easy access. |
| `packages/domain/src/personnel/entities/student.ts` | Modify | Change `institutionId: string` to `institutionId?: Id`. Make parameter optional in `create()`. |
| `packages/domain/src/personnel/entities/teacher.ts` | Modify | Change `institutionId: string` to `institutionId?: Id`. Make parameter optional in `create()`. |
| `packages/domain/src/pedagogy/entities/academic-cycle.ts` | Modify | Change `level: number` to `level: EducationalLevel` and `modality: number` to `modality: EducationalModality`. Update `create()` and `reconstruct()`. |

## Interfaces / Contracts

### `EnrollmentStatus.ts`

```typescript
import { Result } from "@educandow/shared/utils/result";
import { ValidationError } from "@educandow/shared/errors/validation-error";

export type EnrollmentStatusValue = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED';
const VALID_STATUSES: EnrollmentStatusValue[] = ['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED'];

export class EnrollmentStatus {
  private constructor(public readonly value: EnrollmentStatusValue) {}

  public static create(value: string): Result<EnrollmentStatus, ValidationError> {
    const upperValue = value?.toUpperCase();
    if (!VALID_STATUSES.includes(upperValue as EnrollmentStatusValue)) {
      return Result.fail(new ValidationError(`Invalid enrollment status: ${value}`));
    }
    return Result.ok(new EnrollmentStatus(upperValue as EnrollmentStatusValue));
  }

  public static reconstruct(value: EnrollmentStatusValue): EnrollmentStatus {
    return new EnrollmentStatus(value);
  }

  public equals(other: EnrollmentStatus): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
```

### Entity Prop Changes

```typescript
// packages/domain/src/enrollment/entities/enrollment.ts
export interface EnrollmentProps {
  // ...
  status: EnrollmentStatus; // Was EnrollmentStatusType (string union)
}

// packages/domain/src/personnel/entities/student.ts
export interface StudentProps {
  // ...
  institutionId?: Id; // Was string
}

// packages/domain/src/personnel/entities/teacher.ts
export interface TeacherProps {
  // ...
  institutionId?: Id; // Was string
}

// packages/domain/src/pedagogy/entities/academic-cycle.ts
export interface AcademicCycleProps {
  // ...
  level: EducationalLevel; // Was number
  modality: EducationalModality; // was number
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | **`EnrollmentStatus` VO** | - Test valid status creation (`ACTIVE`, `INACTIVE`, etc.).<br>- Test invalid status rejection (e.g., "PENDING", `null`, `""`).<br>- Test equality method.<br>- Test `reconstruct` bypasses validation. |
| Unit | **Entity Modifications** | - Verify `Enrollment.create()` initializes status to `ACTIVE`.<br>- Verify `Student.create()` and `Teacher.create()` correctly handle both present and absent `institutionId`.<br>- Verify `AcademicCycle.create()` correctly accepts and stores `EducationalLevel` and `EducationalModality` VOs.<br>- Ensure all existing domain unit tests (587+) continue to pass after refactoring. |
| Integration | N/A | No infrastructure or cross-domain changes are part of this task. |
| E2E | N/A | No UI or API changes. |

## Migration / Rollout

No migration required. This is a pure code refactoring of the domain layer. Dependent packages (like `api`) will need to be updated in subsequent changes to align with the new, stricter types, but this change is self-contained and does not affect persisted data schemas.

## Open Questions

- None. The scope is clear and the patterns are well-established in the codebase.
