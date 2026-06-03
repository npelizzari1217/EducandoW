# Design: Fix API Build

## Technical Approach

Fix 11 TypeScript errors by wrapping raw primitives with domain VOs at the infrastructure boundary (repositories) and application boundary (use cases). Follow existing patterns already used in the codebase (e.g., `CycleCode.reconstruct()` on line 63 of academic-cycle repo, `Id.reconstruct()` on line 77 of teacher repo).

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Id construction from tenant context | `Id.create(institutionId)` | `Id.reconstruct(institutionId)` | `create()` accepts optional string and auto-generates UUID if empty — safer than reconstruct which takes raw value without validation |
| Level/modality in toDomain | `EducationalLevel.fromCode(r.level)` | `EducationalLevel.create(r.level.toString())` | `fromCode()` is direct enum constructor, no `Result` wrapping needed for DB hydration (same pattern as `CycleCode.reconstruct`) |
| Status serialization in enrollment save | `enrollment.status.value` | `enrollment.status.toString()` | `.value` is the canonical getter; `toString()` delegates to it. `.value` is more explicit |
| Enrollment status in toDomain | `EnrollmentStatus.reconstruct(record.status as EnrollmentStatusValue)` | `record.status as EnrollmentStatus` | `reconstruct()` bypasses validation for DB hydration; raw cast to class is not type-safe |

## Data Flow

Repository reads (DB → Domain):
```
PrismaRow (number/string) ──→ toDomain ──→ construct VOs ──→ Domain Entity
    r.level: number           EducationalLevel.fromCode(r.level)     AcademicCycle
    record.status: string     EnrollmentStatus.reconstruct(s)       Enrollment
```

Repository writes (Domain → DB):
```
Domain Entity ──→ toPersistence ──→ extract primitives ──→ PrismaCreateInput
    cycle.level: VO          cycle.level.code (number)            { level: 1 }
    enrollment.status: VO    enrollment.status.value (string)     { status: "ACTIVE" }
```

Use cases (DTO → Domain):
```
CreateAcademicCycleDTO.input.level: number ──→ EducationalLevel.fromCode() ──→ AcademicCycle.create()
CreateStudentDTO.input.institutionId: string ──→ Id.create() ──→ Student.create()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/src/infrastructure/.../prisma-academic-cycle.repository.ts` | Modify | toDomain: wrap `r.level`/`r.modality` in VOs. toPersistence: extract `.code` |
| `api/src/infrastructure/.../prisma-enrollment.repository.ts` | Modify | save: use `.value` for status. toDomain: use `reconstruct()` |
| `api/src/infrastructure/.../prisma-student.repository.ts` | Modify | toDomain: `Id.create(institutionId)` instead of raw string |
| `api/src/infrastructure/.../prisma-teacher.repository.ts` | Modify | toDomain: `Id.create(institutionId)` instead of raw string |
| `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | Modify | Import VOs, wrap `input.level`/`input.modality` before `AcademicCycle.create()` |
| `api/src/application/student/use-cases/student.use-cases.ts` | Modify | Import `Id`, wrap `input.institutionId` before `Student.create()` |
| `api/src/application/teacher/use-cases/teacher.use-cases.ts` | Modify | Import `Id`, wrap `input.institutionId` before `Teacher.create()` |

## VO Mapping Reference

| Raw DB/Input Type | VO Constructor | Extraction for DB |
|-------------------|----------------|-------------------|
| `number` (level) | `EducationalLevel.fromCode(n)` | `.code` (number) |
| `number` (modality) | `EducationalModality.fromCode(n)` | `.code` (number) |
| `string` (id) | `Id.create(s)` or `Id.reconstruct(s)` | `.get()` (string) |
| `string` (status) | `EnrollmentStatus.reconstruct(s)` | `.value` (string) |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Build | All TypeScript errors resolved | `pnpm build` passes |
| Unit | Existing 284+ tests still pass | `pnpm test` |
| Lint | No new lint violations | `pnpm lint` |

No new tests needed — this is a pure type-fix, no behavioral changes.

## Open Questions

None.
