# Technical Design: Student Observations

## 1. Overview

This design outlines the implementation of the student observation feature following a Clean Architecture approach. It introduces a new domain entity, `StudentObservation`, with a corresponding Prisma model and repository. A new rank-based authorization mechanism (`@Rank` decorator and `RankGuard`) will be created to protect the API endpoints, as the existing role-based guards are insufficient for the rank-based requirements.

## 2. Database Design

A new table, `student_observations`, will be added to the tenant database schema in `api/prisma_tenant/schema.prisma`.

### `StudentObservation` Prisma Model

The model will store the observation content, its type, the author, and a reference to the student.

```prisma
// In api/prisma_tenant/schema.prisma

model StudentObservation {
  id        String   @id @default(uuid())
  studentId String   @map("student_id")
  authorId  String   @map("author_id") // ID from the central User table
  type      String   // "PEDAGOGICAL" or "PSYCHOPEDAGOGICAL"
  content   String   @db.Text
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  // NOTE: authorId is a soft reference to the User model in the admin DB.
  // No hard foreign key constraint is possible across DBs.

  @@index([studentId])
  @@index([authorId])
  @@map("student_observations")
}
```

And add the relation to the `Student` model:
```prisma
// In model Student in api/prisma_tenant/schema.prisma
  observations            StudentObservation[]
```

## 3. Domain Layer Design

New entities and value objects will be created in `packages/domain/src/pedagogy/`.

### `ObservationType` Value Object

A simple value object to ensure type safety for the observation type.

- **File:** `packages/domain/src/pedagogy/value-objects/observation-type.ts`

```typescript
import { Result, ok, err } from '../../shared/result';

export enum ObservationTypeValue {
  PEDAGOGICAL = 'PEDAGOGICAL',
  PSYCHOPEDAGOGICAL = 'PSYCHOPEDAGOGICAL',
}

export class ObservationType {
  private constructor(public readonly value: ObservationTypeValue) {}

  public static create(value: string): Result<ObservationType, Error> {
    const upperValue = value.toUpperCase();
    if (!Object.values(ObservationTypeValue).includes(upperValue as ObservationTypeValue)) {
      return err(new Error(`Invalid observation type: ${value}`));
    }
    return ok(new ObservationType(upperValue as ObservationTypeValue));
  }

  public static reconstruct(value: ObservationTypeValue): ObservationType {
    return new ObservationType(value);
  }
}
```

### `StudentObservation` Entity

- **File:** `packages/domain/src/pedagogy/entities/student-observation.ts`

```typescript
import { Id } from '../../shared/value-objects/id';
import { ObservationType } from '../value-objects/observation-type';

export interface StudentObservationProps {
  id: Id;
  studentId: Id;
  authorId: Id;
  type: ObservationType;
  content: string;
  createdAt?: Date;
  deletedAt?: Date;
}

export class StudentObservation {
  private constructor(private props: StudentObservationProps) {}

  static create(props: Omit<StudentObservationProps, 'id'>): StudentObservation {
    return new StudentObservation({ ...props, id: Id.create() });
  }

  static reconstruct(props: StudentObservationProps): StudentObservation {
    return new StudentObservation(props);
  }

  get id(): Id { return this.props.id; }
  get studentId(): Id { return this.props.studentId; }
  get authorId(): Id { return this.props.authorId; }
  get type(): ObservationType { return this.props.type; }
  get content(): string { return this.props.content; }
  get createdAt(): Date | undefined { return this.props.createdAt; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  isAuthoredBy(userId: Id): boolean {
    return this.props.authorId.equals(userId);
  }

  softDelete(): void {
    this.props.deletedAt = new Date();
  }
}
```

### `StudentObservationRepository` Port

- **File:** `packages/domain/src/pedagogy/repositories/student-observation-repository.ts`

```typescript
import { StudentObservation } from '../entities/student-observation';
import { Id } from '../../shared/value-objects/id';

export interface StudentObservationRepository {
  save(observation: StudentObservation): Promise<void>;
  findById(id: Id): Promise<StudentObservation | null>;
  findByStudentId(studentId: Id): Promise<StudentObservation[]>;
  findByStudentIds(studentIds: Id[]): Promise<StudentObservation[]>;
  delete(id: Id): Promise<void>;
}
```

## 4. Application Layer Design

Use cases will be located in `api/src/application/student/use-cases/`.

### Use Cases

- **`create-student-observation.use-case.ts`**
  - **Input:** `{ studentId, authorId, type, content, authorRank }`
  - **Logic:**
    1.  Validate `ObservationType`.
    2.  If `type` is `PSYCHOPEDAGOGICAL`, check if `authorRank >= 50` (DIRECTOR). If not, return `ForbiddenError`.
    3.  Create `StudentObservation` entity.
    4.  Call `studentObservationRepository.save()`.
  - **Output:** `Result<void, Error>`

- **`list-observations-by-student.use-case.ts`**
  - **Input:** `{ studentId, callerRank }`
  - **Logic:**
    1.  Fetch observations via `studentObservationRepository.findByStudentId()`.
    2.  If `callerRank < 50`, filter out `PSYCHOPEDAGOGICAL` observations.
    3.  Return the filtered list.
  - **Output:** `Result<StudentObservation[], Error>`

- **`list-observations-by-course.use-case.ts`**
  - **Input:** `{ courseId, callerRank }`
  - **Logic:**
    1.  Fetch all students in the given course (`courseId`).
    2.  Get all `studentIds`.
    3.  Fetch observations via `studentObservationRepository.findByStudentIds(studentIds)`.
    4.  If `callerRank < 50`, filter out `PSYCHOPEDAGOGICAL` observations.
    5.  Return the filtered list, perhaps grouped by student.
  - **Output:** `Result<StudentObservation[], Error>`

- **`delete-student-observation.use-case.ts`**
  - **Input:** `{ observationId, callerId, callerRank }`
  - **Logic:**
    1.  Fetch observation by `observationId`.
    2.  If not found, return `NotFoundError`.
    3.  Check for permission: `observation.isAuthoredBy(callerId) || callerRank >= 60` (ADMIN).
    4.  If no permission, return `ForbiddenError`.
    5.  Call `studentObservationRepository.delete()`.
  - **Output:** `Result<void, Error>`

## 5. Infrastructure Layer Design

### Persistence

- **`prisma-student-observation.repository.ts`**
  - **Location:** `api/src/infrastructure/persistence/prisma/repositories/`
  - **Responsibility:** Implement the `StudentObservationRepository` interface using Prisma Tenant Client. Handle mapping between the Prisma model and the domain entity.

### Authorization (New)

A new rank-based guard is required.

- **`@Rank` Decorator:**
  - **File:** `api/src/infrastructure/auth/decorators/rank.decorator.ts`
  - **Implementation:**
    ```typescript
    import { SetMetadata } from '@nestjs/common';
    export const RANK_KEY = 'rank';
    export const Rank = (rank: number) => SetMetadata(RANK_KEY, rank);
    ```

- **`RankGuard`:**
  - **File:** `api/src/infrastructure/auth/guards/rank.guard.ts`
  - **Implementation:**
    ```typescript
    import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
    import { Reflector } from '@nestjs/core';
    import { RANK_KEY } from '../decorators/rank.decorator';
    import type { AuthenticatedRequest } from './auth.guard';

    @Injectable()
    export class RankGuard implements CanActivate {
      constructor(private readonly reflector: Reflector) {}

      canActivate(context: ExecutionContext): boolean {
        const requiredRank = this.reflector.get<number>(RANK_KEY, context.getHandler());
        if (!requiredRank) {
          return true; // No @Rank decorator, pass through
        }

        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const user = request.user;

        if (!user || !user.rank) {
          return false; // No user or rank attached to user
        }
        
        // ROOT bypasses rank checks
        if (user.roles?.includes('ROOT')) {
            return true;
        }

        return user.rank >= requiredRank;
      }
    }
    ```

## 6. Presentation Layer Design

A new controller will be added to handle observation-related HTTP requests.

- **File:** `api/src/presentation/student/student-observation.controller.ts`

### DTOs

- `CreateObservationDto` (`type`: string, `content`: string)
- `ObservationResponseDto` (maps entity to response)

### Controller

```typescript
import { Controller, Post, Get, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RankGuard } from '../../infrastructure/auth/guards/rank.guard';
import { Rank } from '../../infrastructure/auth/decorators/rank.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../application/auth/dtos/user-profile.dto';

// DTOs and UseCases would be imported here

@Controller('v1/students/:studentId/observations')
@UseGuards(AuthGuard, RankGuard)
export class StudentObservationController {
  // constructor with use case injection

  @Post()
  @Rank(20) // TEACHER+
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('studentId') studentId: string,
    @Body() createDto: CreateObservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // call CreateStudentObservationUseCase
  }

  @Get()
  @Rank(20) // TEACHER+
  async findByStudent(
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // call ListObservationsByStudentUseCase
  }
}

@Controller('v1/courses/:courseId/observations')
@UseGuards(AuthGuard, RankGuard)
export class CourseObservationController {
    // constructor
    @Get()
    @Rank(20)
    async findByCourse(
        @Param('courseId') courseId: string,
        @CurrentUser() user: AuthenticatedUser,
    ){
        // call ListObservationsByCourseUseCase
    }
}

@Controller('v1/observations')
@UseGuards(AuthGuard) // Guard applied at the method level
export class ObservationController {
    // constructor
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ){
        // The RankGuard is not used here because logic is more complex
        // (author OR admin). This is handled by the use case.
        // call DeleteStudentObservationUseCase
    }
}

```

## 7. File Structure

```
.
├── api
│   ├── prisma_tenant
│   │   └── schema.prisma (+1 model, +1 relation)
│   └── src
│       ├── application
│       │   └── student
│       │       └── use-cases
│       │           ├── create-student-observation.use-case.ts (new)
│       │           ├── list-observations-by-student.use-case.ts (new)
│       │           ├── list-observations-by-course.use-case.ts (new)
│       │           └── delete-student-observation.use-case.ts (new)
│       ├── infrastructure
│       │   ├── auth
│       │   │   ├── decorators
│       │   │   │   └── rank.decorator.ts (new)
│       │   │   └── guards
│       │   │       └── rank.guard.ts (new)
│       │   └── persistence
│       │       └── prisma
│       │           └── repositories
│       │               └── prisma-student-observation.repository.ts (new)
│       └── presentation
│           └── student
│               ├── dto
│               │   └── create-observation.dto.ts (new)
│               └── student-observation.controller.ts (new)
└── packages
    └── domain
        └── src
            └── pedagogy
                ├── entities
                │   └── student-observation.ts (new)
                ├── repositories
                │   └── student-observation-repository.ts (new)
                └── value-objects
                    └── observation-type.ts (new)
```
