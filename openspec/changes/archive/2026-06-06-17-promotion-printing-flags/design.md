# Technical Design: Promotion & Printing Flags

This document outlines the technical design for adding `printable` and `promoted` boolean flags to the Enrollment entity, enabling bulk and single-toggle operations via new API endpoints.

## 1. Database Schema Changes

The `Enrollment` model in `api/prisma_tenant/schema.prisma` will be updated to include two new boolean fields.

- `printable`: Controls whether a student's report card can be printed. Defaults to `true`.
- `promoted`: Controls whether a student is promoted to the next grade/level. Defaults to `false`.

```prisma
// file: api/prisma_tenant/schema.prisma

model Enrollment {
  id           String   @id @default(uuid())
  studentId    String
  cycleId      String?
  level        Int
  modality     Int      @default(0)
  academicYear String
  grade        String?
  division     String?
  status       String   @default("ACTIVE")
  enrolledAt   DateTime @default(now())

  // New fields
  printable    Boolean  @default(true)
  promoted     Boolean  @default(false)

  active       Boolean  @default(true)
  deletedAt    DateTime?

  student      Student        @relation(fields: [studentId], references: [id], onDelete: Cascade)
  cycle        AcademicCycle? @relation(fields: [cycleId], references: [uuid], onDelete: SetNull)

  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  @@index([studentId])
  @@index([cycleId])
  @@index([status])
  @@map("enrollments")
}
```

A new Prisma migration will be generated and applied to reflect these changes.

## 2. Domain Layer Changes

### 2.1. Enrollment Entity

The `EnrollmentProps` interface and `Enrollment` class in `packages/domain/src/enrollment/entities/enrollment.ts` will be extended.

- **Properties**: Add `printable` and `promoted` as optional booleans to `EnrollmentProps`.
- **Getters**: Add `isPrintable(): boolean` and `isPromoted(): boolean` getters.
- **Methods**: Add `togglePrintable()` and `togglePromoted()` methods to flip the boolean values.
- **Reconstruction**: The `reconstruct` static method will handle the new optional properties, setting defaults if they are not provided.

```typescript
// file: packages/domain/src/enrollment/entities/enrollment.ts

export interface EnrollmentProps {
  // ... existing properties
  printable?: boolean;
  promoted?: boolean;
  // ... existing properties
}

export class Enrollment {
  private constructor(private props: EnrollmentProps) {}

  // ... existing static methods

  static reconstruct(props: EnrollmentProps): Enrollment {
    return new Enrollment({
      ...props,
      printable: props.printable ?? true,
      promoted: props.promoted ?? false,
    });
  }

  // ... existing getters

  get isPrintable(): boolean {
    return this.props.printable ?? true;
  }

  get isPromoted(): boolean {
    return this.props.promoted ?? false;
  }

  togglePrintable(): void {
    this.props.printable = !this.isPrintable;
  }

  togglePromoted(): void {
    this.props.promoted = !this.isPromoted;
  }

  // ... existing methods
}
```

### 2.2. Enrollment Repository

The `EnrollmentRepository` interface in `packages/domain/src/enrollment/repositories/enrollment-repository.ts` will be updated to include a method for finding enrollments by course criteria, which is necessary for the bulk update operation.

```typescript
// file: packages/domain/src/enrollment/repositories/enrollment-repository.ts

import type { Enrollment } from '../entities';
import { Id } from '../../shared/value-objects/id';

export interface FindByCourseParams {
  cycleId: string;
  level: number;
  grade: string;
  division: string;
  academicYear: string;
}

export interface EnrollmentRepository {
  findById(id: string): Promise<Enrollment | null>;
  findByStudent(studentId: string): Promise<Enrollment[]>;
  findByInstitution(institutionId: string): Promise<Enrollment[]>;
  findActive(studentId: string): Promise<Enrollment | null>;
  findByCourse(params: FindByCourseParams): Promise<Enrollment[]>; // New method
  save(enrollment: Enrollment): Promise<void>;
  saveMany(enrollments: Enrollment[]): Promise<void>; // New method for bulk saves
  delete(id: string): Promise<void>;
}
```

## 3. Application Layer Changes

Two new use cases will be created in `api/src/application/enrollment/use-cases/`.

### 3.1. `ToggleEnrollmentFlagUseCase`

This use case will handle toggling a flag for a single enrollment.

- **Input**: `enrollmentId: string`, `flag: 'printable' | 'promoted'`.
- **Logic**:
  1. Fetch the enrollment by ID using `EnrollmentRepository`.
  2. If not found, return an error.
  3. Call the appropriate toggle method (`togglePrintable` or `togglePromoted`).
  4. Save the updated enrollment.
- **Output**: The updated `Enrollment` entity.

### 3.2. `BulkToggleEnrollmentFlagsUseCase`

This use case will handle toggling a flag for all enrollments in a specific course.

- **Input**: `courseParams: FindByCourseParams`, `flag: 'printable' | 'promoted'`, `value: boolean`.
- **Logic**:
  1. Fetch all enrollments matching the course criteria using `EnrollmentRepository.findByCourse`.
  2. Iterate through the enrollments. For each, set the specified flag to the new `value`.
  3. Use `EnrollmentRepository.saveMany` to persist the changes in a transaction.
- **Output**: A count of affected enrollments.

## 4. Presentation Layer Changes

The `EnrollmentController` in `api/src/presentation/enrollment/enrollment.controller.ts` will be updated with two new `PATCH` endpoints.

### 4.1. DTOs and Validation

New DTOs and Zod schemas will be created for the request bodies.

**Single Toggle DTO:**
```typescript
// file: api/src/presentation/enrollment/dto/toggle-flag.dto.ts
import { z } from 'zod';

export const ToggleFlagSchema = z.object({
  flag: z.enum(['printable', 'promoted']),
});

export type ToggleFlagDTO = z.infer<typeof ToggleFlagSchema>;
```

**Bulk Toggle DTO:**
```typescript
// file: api/src/presentation/enrollment/dto/bulk-toggle-flags.dto.ts
import { z } from 'zod';

export const BulkToggleFlagsSchema = z.object({
  flag: z.enum(['printable', 'promoted']),
  value: z.boolean(),
  enrollmentIds: z.array(z.string().uuid()),
});

export type BulkToggleFlagsDTO = z.infer<typeof BulkToggleFlagsSchema>;
```

### 4.2. Controller Endpoints

```typescript
// file: api/src/presentation/enrollment/enrollment.controller.ts
import { Controller, Patch, Param, Body, UseGuards } from '@nestjs/common';
// ... other imports

@Controller('enrollments')
@UseGuards(AuthGuard, RolesGuard)
export class EnrollmentController {
  constructor(
    // ... existing use cases
    private readonly toggleFlagUC: ToggleEnrollmentFlagUseCase,
    private readonly bulkToggleFlagsUC: BulkToggleEnrollmentFlagsUseCase,
  ) {}

  // ... existing endpoints

  @Patch(':id/flags')
  @Roles('ADMIN', 'SECRETARIO', 'DIRECTOR')
  async toggleFlag(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ToggleFlagSchema)) body: ToggleFlagDTO,
  ) {
    const result = await this.toggleFlagUC.execute({ enrollmentId: id, flag: body.flag });
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Patch('flags/bulk')
  @Roles('ADMIN', 'SECRETARIO', 'DIRECTOR')
  async bulkToggleFlags(
    @Body(new ZodValidationPipe(BulkToggleFlagsSchema)) body: BulkToggleFlagsDTO,
  ) {
    const count = await this.bulkToggleFlagsUC.execute(body);
    return { data: { affected: count } };
  }
}
```
*Self-correction: The proposal mentioned a path based on course criteria, but a more flexible approach is to pass an array of enrollment IDs. This is more atomic and allows the UI to control the exact set of students affected, for example, from a filtered list.*

## 5. Security and Authorization

The new endpoints will be protected by the existing `AuthGuard` and `RolesGuard`. Access will be restricted to users with the roles `ADMIN`, `SECRETARIO`, or `DIRECTOR`. The `@Roles` decorator will enforce this.

## 6. Implementation Plan

1.  **Database**: Add the `printable` and `promoted` fields to `schema.prisma` and run `prisma migrate dev`.
2.  **Domain**:
    - Update the `Enrollment` entity with the new properties, getters, and toggle methods.
    - Update the `EnrollmentRepository` interface.
3.  **Infrastructure**: Implement the new `findByCourse` and `saveMany` methods in the Prisma `EnrollmentRepository` implementation.
4.  **Application**:
    - Implement `ToggleEnrollmentFlagUseCase`.
    - Implement `BulkToggleEnrollmentFlagsUseCase`.
5.  **Presentation**:
    - Create the DTOs and Zod schemas.
    - Add the new `PATCH` endpoints to the `EnrollmentController`.
    - Wire up the new use cases in the `EnrollmentModule`.
6.  **Testing**:
    - Write unit tests for the new entity methods and use cases.
    - Write e2e tests for the new controller endpoints to verify functionality and security.
