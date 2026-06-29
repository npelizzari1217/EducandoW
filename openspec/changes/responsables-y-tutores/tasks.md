# Tasks — responsables-y-tutores

**Change**: `responsables-y-tutores`
**Artifact store**: hybrid
**Delivery strategy**: auto-chain (one autonomous slice at a time, ≤400 LOC each)
**TDD**: strict — RED task always precedes GREEN; `pnpm test`; coverage ≥80%
**Chain**: PR1 → PR2a → PR2b → PR3 (each slice depends on the previous)

---

## PR1 — Student emails + Mobile VO (foundation)

**Scope**: `Mobile` VO, `Student.fatherEmail`/`motherEmail`, tenant schema columns, repo mapping, use-case threading, DTOs, controller `mapStudent`, web email inputs.
**Self-contained** — no StudentGuardian changes. Unblocks PR2a.
**Estimated LOC**: ~280–340
**Work-unit commit**: `feat(student): add fatherEmail/motherEmail and Mobile VO`

### T1.1 [x] Unit tests — Mobile VO
- **File**: `packages/domain/src/shared/__tests__/value-objects/mobile.test.ts` (NEW)
- Valid `"+5492215551234"` → `Result.isOk()`, `mobile.get()` returns normalized value (REQ-RYT-11-A)
- Normalization: strips spaces, dashes, parens, dots; preserves leading `+` (REQ-RYT-11-A)
- 8-digit minimum after normalization → ok; 7-digit → `MOBILE_INVALID` (REQ-RYT-11-B)
- 15-digit maximum; 16-digit → `MOBILE_INVALID` (REQ-RYT-11-B)
- Non-numeric `"abc"` → `Result.isErr()` with `MOBILE_INVALID` (REQ-RYT-11-B)
- Empty string `""` → `Result.isErr()` (REQ-RYT-11-C)
- `equals()` returns `true` for same value; `false` otherwise
- **Satisfies**: REQ-RYT-11

### T1.2 [x] Unit tests — Student entity email getters
- **File**: `packages/domain/src/personnel/__tests__/student.test.ts` (NEW — no existing file)
- `Student.reconstruct({...})` with no fatherEmail → `student.fatherEmail` is `undefined` (REQ-RYT-01-E)
- `Student.reconstruct({..., fatherEmail: Email.reconstruct('padre@x.com')})` → `student.fatherEmail?.get()` equals `'padre@x.com'` (REQ-RYT-01-A)
- Symmetric tests for `motherEmail` (REQ-RYT-01-B)
- `fatherEmail` and `motherEmail` NOT present in the logical equivalent of `ALLOWED_TUTOR_FIELDS` (structural, verified at use-case level) (REQ-RYT-01-D)
- **Satisfies**: REQ-RYT-01

### T1.3 [x] Integration test — Student email persistence round-trip
- **File**: extend or create `api/test/integration/students.db.test.ts` (or nearest existing student integration test)
- ADMIN PATCH `/v1/students/:id` with `{ fatherEmail: "padre@example.com" }` → HTTP 200, GET returns `fatherEmail` (RYT-01-A)
- ADMIN PATCH with `{ motherEmail: "madre@example.com" }` → HTTP 200 (RYT-01-B)
- ADMIN PATCH with `{ fatherEmail: "not-an-email" }` → HTTP 400 (RYT-01-C)
- TUTOR PATCH with `{ fatherEmail: "padre@example.com" }` → HTTP 403 (RYT-01-D)
- **Satisfies**: REQ-RYT-01

### T1.4 [x] Create Mobile VO
- **File**: `packages/domain/src/shared/value-objects/mobile.ts` (NEW)
- `private readonly value: string`; no setters; immutable
- `static create(raw: string): Result<Mobile, ValidationError>`: normalize (strip spaces/dashes/parens/dots, preserve single leading `+`); after normalization digits-only 8–15 chars; empty/whitespace → `ValidationError('Mobile cannot be empty')`; else → `ValidationError('Invalid mobile format')`; store normalized value
- `static reconstruct(value: string): Mobile`
- `get(): string`, `equals(other: Mobile): boolean`
- Export from `packages/domain/src/shared/value-objects/index.ts` (add next to `Email`)
- Export from root `packages/domain/src/index.ts` (next to `Email`)
- **Satisfies**: REQ-RYT-11

### T1.5 [x] Update Student entity — fatherEmail/motherEmail
- **File**: `packages/domain/src/personnel/entities/student.ts`
- Add `fatherEmail?: Email`, `motherEmail?: Email` to `StudentProps` (after `motherDni`)
- Add getters `get fatherEmail(): Email | undefined` and `get motherEmail(): Email | undefined`
- `Student.create()` and `Student.reconstruct()` accept and pass through `fatherEmail`/`motherEmail`
- No validation beyond the pre-built `Email` VO (REQ-RYT-01-F — reuse existing VO; no new VO)
- Do NOT add to `ALLOWED_TUTOR_FIELDS` (enforced at use-case level, not entity)
- **Satisfies**: REQ-RYT-01

### T1.6 [x] Schema — Student email columns (tenant only)
- **File**: `api/prisma_tenant/schema.prisma`
- Add to `Student` model (after `motherDni`):
  ```
  fatherEmail   String?
  motherEmail   String?
  ```
- `api/prisma_master/schema.prisma` — NO CHANGES
- **Satisfies**: REQ-RYT-01

### T1.7 [x] prisma:generate (after schema edit)
- **Command**: `pnpm --filter api prisma:generate`
- Regenerates both master and tenant Prisma clients (master unaffected but must be regenerated together)
- **Satisfies**: schema → client sync

### T1.8 [x] Tenant migration — Student email columns
- **Command**: `pnpm --filter api prisma:migrate:tenant` (dev)
- Produces one migration adding two nullable `String?` columns; no data-migration script needed
- **Satisfies**: REQ-RYT-01

### T1.9 [x] Student repo — map fatherEmail/motherEmail
- **File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-student.repository.ts`
- `toDomain()`: if `record.fatherEmail` is truthy → `Email.reconstruct(record.fatherEmail as string)`, else `undefined`; same for `motherEmail`
- `save()`: `fatherEmail: student.fatherEmail?.get() ?? null`, `motherEmail: student.motherEmail?.get() ?? null`
- **Satisfies**: REQ-RYT-01

### T1.10 [x] PatchStudentUseCase — thread fatherEmail/motherEmail
- **File**: `api/src/application/student/use-cases/student.use-cases.ts`
- Add `fatherEmail?: string`, `motherEmail?: string` to `PatchStudentInput`
- In `applyChanges()` (or inline in `execute()`): if `fatherEmail` provided, build `Email.create()` → propagate error; apply to student; same for `motherEmail`
- Verify neither key is in `ALLOWED_TUTOR_FIELDS` constant — `FULL_ACCESS_ROLES` path only (admin/director/secretario)
- **Satisfies**: REQ-RYT-01-A, REQ-RYT-01-B, REQ-RYT-01-D

### T1.11 [x] Presentation DTOs — fatherEmail/motherEmail
- **File**: `api/src/presentation/student/dto/create-student.dto.ts`
  - Add `fatherEmail: z.string().email().optional().or(z.literal(''))`
  - Add `motherEmail: z.string().email().optional().or(z.literal(''))`
- **File**: `api/src/presentation/student/dto/update-student.dto.ts`
  - Add same two fields
- **Satisfies**: REQ-RYT-01-A, REQ-RYT-01-B, REQ-RYT-01-C

### T1.12 [x] Controller — mapStudent() includes fatherEmail/motherEmail
- **File**: `api/src/presentation/student/student.controller.ts`
- In `mapStudent()` (or equivalent response mapper): add `fatherEmail: student.fatherEmail?.get() ?? null`, `motherEmail: student.motherEmail?.get() ?? null`
- **Satisfies**: REQ-RYT-01-A, REQ-RYT-01-B

### T1.13 [x] Web — fatherEmail/motherEmail inputs in student form
- **File**: `web/src/pages/dashboard/students.tsx`
- Add `fatherEmail` and `motherEmail` inputs near father/mother DNI fields in the student create/edit form
- Thread through: form state initialization, `startEdit()` pre-fill from loaded student, `resetForm()`, create body, PATCH body
- Input type `email`; no client-side regex beyond browser default (server validates)
- **Satisfies**: REQ-RYT-01

---

## PR2a — StudentGuardian domain + schema

**Scope**: tenant schema (StudentGuardian extension + enum drop), entity migration to `Result`, new fields, repo port + implementation update.
**Depends on**: PR1 (Mobile VO must be available in `@educandow/domain`)
**Estimated LOC**: ~210–260
**Work-unit commit**: `feat(student-guardian): schema extension, entity to Result, repo port`

### T2a.1 [RED] Unit tests — StudentGuardian entity (UPDATE existing file)
- **File**: `packages/domain/src/personnel/__tests__/student-guardian.test.ts` (UPDATE)
- Remove all tests that import or reference `GuardianRelationship` enum
- Add: `StudentGuardian.create({...})` returns `Result<StudentGuardian, ValidationError>` — NOT throws (REQ-RYT-03, entity ADR)
- Add: `create()` with `relationship` of 1–15 chars → `Result.isOk()` (REQ-RYT-04-A)
- Add: `relationship` of 16 chars → `Result.isErr()` with validation message (REQ-RYT-04-B)
- Add: `relationship` empty string → `Result.isErr()` (REQ-RYT-04-C)
- Add: `userId` omitted/undefined → `create()` succeeds; `guardian.userId` is `undefined` (REQ-RYT-03-A)
- Add: `userId` present → `guardian.userId` is the provided value (REQ-RYT-03-B)
- Add: new props round-trip — `fullName`, `mobile` (Mobile VO), `email` (Email VO), `active`, `updatedAt` accessible via getters (REQ-RYT-02)
- Add: `fullName`/`mobile` optional at entity level — `create()` without them still succeeds (entity ADR)
- Add: `active` defaults to `true` when omitted (REQ-RYT-02)
- Add: `update({fullName: '...'})` mutation method updates the prop and bumps `updatedAt` (REQ-RYT-02, REQ-RYT-06)
- **Satisfies**: REQ-RYT-02, REQ-RYT-03, REQ-RYT-04, REQ-RYT-11 (indirectly)

### T2a.2 [GREEN] Schema — StudentGuardian extension + enum drop
- **File**: `api/prisma_tenant/schema.prisma`
- `userId String` → `userId String?` (nullable)
- `relationship GuardianRelationship` → `relationship String @db.VarChar(15)`
- Add after `isAuthorizedToPickUp`:
  ```
  fullName               String?
  mobile                 String?
  email                  String?
  active                 Boolean  @default(true)
  ```
- Change `createdAt` block: ensure `updatedAt DateTime @updatedAt` is present
- Remove `enum GuardianRelationship { mother father legal_guardian other }` from schema
- `@@unique([studentId, userId])` — KEEP as-is (Postgres NULLs are distinct)
- **Satisfies**: REQ-RYT-02, REQ-RYT-03, REQ-RYT-04, REQ-RYT-08

### T2a.3 [GREEN] prisma:generate (after StudentGuardian schema edit)
- **Command**: `pnpm --filter api prisma:generate`
- Regenerates both clients; master client unaffected
- **Satisfies**: schema → client sync

### T2a.4 [GREEN] Tenant migration — StudentGuardian changes
- **Command**: `pnpm --filter api prisma:migrate:tenant` (dev)
- CRITICAL — verify generated SQL ordering before committing:
  - `ALTER COLUMN "relationship" TYPE varchar(15)` MUST appear BEFORE `DROP TYPE "GuardianRelationship"`
  - Prisma generates this ordering automatically when enum is removed and column retyped in the same migration; inspect the generated `.sql` file to confirm
  - If Postgres rejects (DROP TYPE before ALTER), manually reorder in the generated migration file
- Tenant DBs are regenerated; no data-migration scripts for tenant
- **Satisfies**: REQ-RYT-04, schema integrity caution from design §2

### T2a.5 [GREEN] StudentGuardian entity — migrate to Result + new fields
- **File**: `packages/domain/src/personnel/entities/student-guardian.ts`
- `StudentGuardianProps`: `userId?: string`, `relationship: string`, add `fullName?: string`, `mobile?: Mobile`, `email?: Email`, `active: boolean`, `updatedAt: Date`
- `static create(...)` → `Result<StudentGuardian, ValidationError>` (no throw): validate `relationship.trim()` length 1..15; default `active ?? true`, `isFinancialResponsible ?? false`, `isAuthorizedToPickUp ?? false`, `id = Id.create()`, `createdAt = updatedAt = new Date()`
- `static reconstruct(props: StudentGuardianProps): StudentGuardian` — unchanged factory, add new props
- New getters: `userId(): string | undefined`, `fullName(): string | undefined`, `mobile(): Mobile | undefined`, `email(): Email | undefined`, `active(): boolean`, `updatedAt(): Date`
- New mutation method: `update(patch: { fullName?: string; mobile?: Mobile; email?: Email | null; relationship?: string; active?: boolean }): void` — applies provided fields, sets `this.props.updatedAt = new Date()`
- Remove `GuardianRelationship` type + `VALID_RELATIONSHIPS` array
- Remove `GuardianRelationship` export from `packages/domain/src/personnel/entities/index.ts`
- Remove `GuardianRelationship` export from `packages/domain/src/personnel/index.ts`
- Remove `GuardianRelationship` export from `packages/domain/src/index.ts`
- **Satisfies**: REQ-RYT-02, REQ-RYT-03, REQ-RYT-04

### T2a.6 [GREEN] Repo port — add findStudyTutor
- **File**: `packages/domain/src/personnel/repositories/student-guardian-repository.ts`
- Add method signature: `findStudyTutor(studentId: string, fullName: string): Promise<StudentGuardian | null>`
- Keep `findByComposite(studentId: string, userId: string)` unchanged (portal-only duplicate check; userId always non-null there)
- **Satisfies**: REQ-RYT-08

### T2a.7 [GREEN] Repo implementation — toDomain + save + findStudyTutor
- **File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-student-guardian.repository.ts`
- Remove `GuardianRelationship as PrismaGuardianRelationship` import (no longer exists in client)
- `toDomain()`: map `userId: record.userId as string | undefined`, `fullName`, `mobile: record.mobile ? Mobile.reconstruct(record.mobile as string) : undefined`, `email: record.email ? Email.reconstruct(record.email as string) : undefined`, `active: (record.active as boolean) ?? true`, `updatedAt: new Date(record.updatedAt as string)`
- `save()` `create` block: add `fullName`, `mobile: guardian.mobile?.get() ?? null`, `email: guardian.email?.get() ?? null`, `active: guardian.active`, `updatedAt: guardian.updatedAt`; `userId: guardian.userId ?? null`; drop `as PrismaGuardianRelationship` cast
- `save()` `update` block: add same new fields
- Implement `findStudyTutor(studentId, fullName)`: `this.client.studentGuardian.findFirst({ where: { studentId, fullName } })`
- **Satisfies**: REQ-RYT-02, REQ-RYT-03, REQ-RYT-08

---

## PR2b — StudentGuardian application + presentation

**Scope**: `AssignGuardianUseCase` Result migration (SAME slice as entity change — see note), `CreateStudyTutorUseCase` (new), `UpdateStudyTutorUseCase` (new), `GuardianOutput` extension, Zod DTOs, controller POST dispatch + PATCH endpoint, module wiring, all backend tests.
**Depends on**: PR2a (entity `create()` → `Result` must exist)
**Estimated LOC**: ~220–260
**Work-unit commit**: `feat(student-guardian): study-tutor use cases, controller dispatch, DTOs`

> **Note on AssignGuardianUseCase**: the entity `create()` → `Result` migration (PR2a T2a.5) breaks the existing `AssignGuardianUseCase` call site. T2b.5 MUST fix that call site. Because the entity change (PR2a) and the call-site fix (PR2b) land in consecutive commits of the same chain, the project stays green across the chain boundary. Never cherry-pick T2a.5 without T2b.5.

### T2b.1 [RED] Unit tests — AssignGuardianUseCase (UPDATE)
- **File**: `api/test/unit/assign-guardian.use-case.test.ts` (UPDATE)
- Replace any `expect(...).not.toThrow()` pattern with `result.isOk()` unwrap assertion (entity now returns Result)
- Remove `GuardianRelationship` enum cast references
- Add: `execute({ studentId, userId: undefined })` → `Result.err` with code `USER_ID_REQUIRED` (REQ-RYT-07-B)
- Add: `execute({ studentId, userId: 'u-tutor', relationship: 'father' })` → `Result.isOk()` (REQ-RYT-07-A)
- Mocked `guardianRepo.findByComposite` returns existing → `Result.err(GUARDIAN_ALREADY_ASSIGNED)` (REQ-RYT-08-A)
- **Satisfies**: REQ-RYT-07, REQ-RYT-08

### T2b.2 [RED] Unit tests — CreateStudyTutorUseCase (NEW)
- **File**: `api/test/unit/create-study-tutor.use-case.test.ts` (NEW)
- Mock `studentRepo.findById`, `guardianRepo.findStudyTutor`, `guardianRepo.save`
- Success: `{ studentId, fullName: 'Ana García', mobile: '+5492215551234' }` → `Result.isOk()`, `userId` is null/undefined, `active = true`, `isFinancialResponsible = false` (REQ-RYT-05-A)
- `fullName` missing/blank → `Result.err({ code: 'FULL_NAME_REQUIRED' })` (REQ-RYT-05-B)
- `mobile` missing/blank → `Result.err({ code: 'MOBILE_REQUIRED' })` (REQ-RYT-05-C)
- `mobile: '123'` (invalid format) → `Result.err` propagated from `Mobile.create()` (REQ-RYT-05-D)
- `email: 'lucia@example.com'` included → `Result.isOk()`, email persisted (REQ-RYT-05-E)
- `email: 'not-an-email'` → `Result.err` propagated from `Email.create()` (REQ-RYT-05-F)
- `findStudyTutor` returns existing record without `allowDuplicate` → `Result.err({ code: 'TUTOR_DUPLICATE_NAME' })` (REQ-RYT-08-B)
- Same scenario with `allowDuplicate: true` → `Result.isOk()` (REQ-RYT-08-C)
- Student not found → `Result.err(NotFoundError)` (REQ-RYT-05-A pre-condition)
- **Satisfies**: REQ-RYT-05, REQ-RYT-08

### T2b.3 [RED] Unit tests — UpdateStudyTutorUseCase (NEW)
- **File**: `api/test/unit/update-study-tutor.use-case.test.ts` (NEW)
- Mock `guardianRepo.findById`, `guardianRepo.findStudyTutor`, `guardianRepo.save`
- Success: update `fullName` and `mobile` → `Result.isOk()`, new values in returned guardian (REQ-RYT-06-A)
- Toggle `active: false` → `Result.isOk()`, `guardian.active === false` (REQ-RYT-06-B)
- Guardian not found → `Result.err({ code: 'GUARDIAN_NOT_FOUND' })` (REQ-RYT-06-C)
- `email: null` → sets email to null (REQ-RYT-06-D)
- `fullName` changes → triggers `findStudyTutor` uniqueness re-check; duplicate without override → `TUTOR_DUPLICATE_NAME`
- **Satisfies**: REQ-RYT-06

### T2b.4 [RED] Integration tests — guardians endpoint (UPDATE)
- **File**: `api/test/integration/guardians.test.ts` (UPDATE)
- POST `/students/:id/guardians` without `userId` → HTTP 201, study tutor created with `userId = null` (RYT-05-A, RYT-13-B)
- POST `/students/:id/guardians` with `userId` → HTTP 201, portal link still works (RYT-07-A)
- POST with `userId` present + `fullName` present → portal path wins; `userId` is used (dispatch ADR)
- PATCH `/students/:id/guardians/:guardianId` with `{ mobile: '...' }` → HTTP 200, updated value returned (RYT-06-A, RYT-13-C)
- PATCH with `{ active: false }` → guardian deactivated (RYT-06-B, RYT-13-D)
- GET `/students/:id/guardians` returns portal + study tutors (null userId included) with full shape (RYT-12-A)
- Uniqueness (studentId, fullName) → second create with same name → HTTP 409 (RYT-08-B)
- `allowDuplicate: true` → second create succeeds (RYT-08-C)
- Two null-userId rows for same studentId do NOT violate DB unique — both inserts succeed (RYT-08-D)
- GET `/students/my-children` as TUTOR with userId → sees linked student; null-userId study tutor on same student NOT returned (RYT-10-A, RYT-10-B)
- Three CreateStudyTutorUseCase calls → GET returns all three (RYT-09-A)
- `relationship: 'abuela'` stored and returned as-is; legacy `'father'` still works as free text (RYT-04-A)
- `relationship` of 16 chars → HTTP 400 (RYT-04-B)
- **Satisfies**: REQ-RYT-04 through REQ-RYT-10, REQ-RYT-12

### T2b.5 [GREEN] AssignGuardianUseCase — Result migration + userId guard
- **File**: `api/src/application/student/use-cases/student.use-cases.ts`
- Change return type to `Promise<Result<StudentGuardian, DomainError>>`
- Add guard: if `!input.userId` → `return err(new ValidationError('USER_ID_REQUIRED'))`
- Change duplicate-found path: `return err(new ValidationError('GUARDIAN_ALREADY_ASSIGNED'))` (was `throw`)
- Unwrap `StudentGuardian.create(...)` Result: `const createResult = StudentGuardian.create({...}); if (createResult.isErr()) return err(createResult.unwrapErr());`
- Drop `as GuardianRelationship` cast
- Remove `import type { GuardianRelationship }` from this file
- **Satisfies**: REQ-RYT-07, REQ-RYT-08

### T2b.6 [GREEN] CreateStudyTutorUseCase (NEW)
- **File**: `api/src/application/student/use-cases/student.use-cases.ts` (add new class)
- Input interface: `{ studentId: string; fullName: string; mobile: string; relationship?: string; email?: string; isFinancialResponsible?: boolean; isAuthorizedToPickUp?: boolean; allowDuplicate?: boolean }`
- Flow (all Result, no throws):
  1. `studentRepo.findById(studentId)` → if null → `return err(new NotFoundError(...))`
  2. `if (!input.fullName?.trim())` → `return err(new ValidationError('FULL_NAME_REQUIRED'))`
  3. `if (!input.mobile?.trim())` → `return err(new ValidationError('MOBILE_REQUIRED'))`
  4. `Mobile.create(input.mobile)` → propagate error
  5. If `input.email`: `Email.create(input.email)` → propagate error
  6. If `!input.allowDuplicate`: `guardianRepo.findStudyTutor(studentId, input.fullName)` → if found → `return err(new ValidationError('TUTOR_DUPLICATE_NAME'))`
  7. `StudentGuardian.create({ studentId, relationship: input.relationship ?? '', fullName: input.fullName, mobile: mobileVO, email: emailVO, isFinancialResponsible: false, isAuthorizedToPickUp: false })` → propagate error
  8. `await guardianRepo.save(guardian)` → `return ok(guardian)`
- **Satisfies**: REQ-RYT-05, REQ-RYT-08

### T2b.7 [GREEN] UpdateStudyTutorUseCase (NEW)
- **File**: `api/src/application/student/use-cases/student.use-cases.ts` (add new class)
- Input interface: `{ guardianId: string; fullName?: string; mobile?: string; email?: string | null; relationship?: string; active?: boolean }`
- Flow:
  1. `guardianRepo.findById(guardianId)` → if null → `return err(new NotFoundError('GUARDIAN_NOT_FOUND', ...))`
  2. If `input.mobile` provided: `Mobile.create(input.mobile)` → propagate error
  3. If `input.email` is a non-null string: `Email.create(input.email)` → propagate error
  4. If `input.fullName` provided and differs from current: `guardianRepo.findStudyTutor(guardian.studentId, input.fullName)` → if found → `return err(new ValidationError('TUTOR_DUPLICATE_NAME'))`
  5. Build patch object; call `guardian.update({...})`
  6. `await guardianRepo.save(guardian)` → `return ok(guardian)`
- Does NOT allow changing `userId` or `studentId`
- **Satisfies**: REQ-RYT-06

### T2b.8 [GREEN] GuardianOutput — extend + ListGuardiansUseCase mapping
- **File**: `api/src/application/student/use-cases/student.use-cases.ts`
- `GuardianOutput` interface: `userId?: string`; add `fullName?: string`, `mobile?: string`, `email?: string`, `active: boolean`, `updatedAt: Date`
- `ListGuardiansUseCase.execute()` mapper: `userId: g.userId ?? undefined`, `fullName: g.fullName`, `mobile: g.mobile?.get()`, `email: g.email?.get()`, `active: g.active`, `updatedAt: g.updatedAt`
- **Satisfies**: REQ-RYT-12

### T2b.9 [GREEN] Presentation DTOs — assign-guardian + new update-guardian
- **File**: `api/src/presentation/student/dto/assign-guardian.dto.ts`
  - `userId: z.string().uuid().optional()`
  - `relationship: z.string().min(1).max(15)` (drop `z.enum([...])`)
  - Add `fullName: z.string().min(1).optional()`, `mobile: z.string().min(1).optional()`, `email: z.string().email().optional()`
  - Keep `isFinancialResponsible`/`isAuthorizedToPickUp` with defaults
  - Comment: "If both userId and fullName present, userId takes precedence (portal path)"
- **File**: `api/src/presentation/student/dto/update-guardian.dto.ts` (NEW)
  - `UpdateGuardianSchema`: `fullName?: z.string().min(1).optional()`, `mobile?: z.string().min(1).optional()`, `email?: z.string().email().optional().nullable()`, `relationship?: z.string().min(1).max(15).optional()`, `active?: z.boolean().optional()`
- **Satisfies**: REQ-RYT-04, REQ-RYT-05, REQ-RYT-06

### T2b.10 [GREEN] Controller — POST dispatch + PATCH endpoint
- **File**: `api/src/presentation/student/student.controller.ts`
- POST `/students/:id/guardians` (existing handler): after DTO validation, dispatch:
  - `if (dto.userId)` → `assignGuardianUseCase.execute(...)` (portal path)
  - `else` → `createStudyTutorUseCase.execute(...)` (study-tutor path)
  - Map `Result.err` codes → HTTP 409 (`GUARDIAN_ALREADY_ASSIGNED`, `TUTOR_DUPLICATE_NAME`), HTTP 404 (not found), HTTP 400 (validation)
- Add `@Patch(':studentId/guardians/:guardianId')` handler:
  - Validate with `UpdateGuardianSchema`
  - Call `updateStudyTutorUseCase.execute({ guardianId, ...dto })`
  - Map `Result.err` codes → HTTP 404 (`GUARDIAN_NOT_FOUND`), HTTP 409 (`TUTOR_DUPLICATE_NAME`), HTTP 400
- `mapGuardian()` response shape includes: `id`, `userId`, `fullName`, `mobile`, `email`, `relationship`, `isFinancialResponsible`, `isAuthorizedToPickUp`, `active`, `updatedAt`
- **Satisfies**: REQ-RYT-05, REQ-RYT-06, REQ-RYT-07, REQ-RYT-12

### T2b.11 [GREEN] Module — register new use cases
- **File**: `api/src/presentation/student/student.module.ts`
- Add `CreateStudyTutorUseCase` and `UpdateStudyTutorUseCase` to `providers` array with Symbol token injection (matching existing pattern for `AssignGuardianUseCase`, `RemoveGuardianUseCase`)
- **Satisfies**: NestJS wiring / REQ-RYT-05, REQ-RYT-06

---

## PR3 — Web guardian panel

**Scope**: Guardian list/create/edit in `students.tsx` — null-userId badge display, free-text relationship, email pre-fill from student legajo.
**Depends on**: PR1 (fatherEmail/motherEmail on student response) + PR2b (new endpoints: PATCH guardian, POST without userId, full guardian shape)
**Estimated LOC**: ~220–290
**Work-unit commit**: `feat(web): study-tutor panel — list, create, edit, email pre-fill`

### T3.1 [GREEN] Web — guardian list section
- **File**: `web/src/pages/dashboard/students.tsx`
- Map guardian list API response; show ALL tutors (portal-linked + study tutors)
- Display columns: `fullName`, `mobile`, `email`, `relationship` (label map for legacy enum values `mother`→Madre, `father`→Padre, `legal_guardian`→Tutor legal, `other`→Otro; else render raw free-text string), `active`
- Badge/icon per row: `userId` present → "Con cuenta de portal"; `userId` absent → "Sin cuenta"
- **Satisfies**: REQ-RYT-12, REQ-RYT-13-A

### T3.2 [GREEN] Web — create/edit study tutor form
- **File**: `web/src/pages/dashboard/students.tsx`
- Guardian form changes:
  - `userId` field: now optional text input (leaving empty → study-tutor POST; filling → portal-link POST)
  - `relationship` → `<input type="text" maxLength={15}>` (was `<select>` with enum options)
  - Add `fullName`, `mobile`, `email`, `active` inputs
  - Two modes: create (no existing guardian → POST `/students/:id/guardians`) / edit (existing guardian → PATCH `/students/:id/guardians/:guardianId`)
  - Add async loading state for the PATCH call (matching existing pattern for other async buttons)
- **Satisfies**: REQ-RYT-13-B, REQ-RYT-13-C, REQ-RYT-13-D

### T3.3 [GREEN] Web — email pre-fill logic
- **File**: `web/src/pages/dashboard/students.tsx`
- On `relationship` field change in the guardian form:
  - If new value is `'father'` or `'padre'` (case-insensitive) → pre-fill `email` with `student.fatherEmail` (if present; else leave empty)
  - If new value is `'mother'` or `'madre'` (case-insensitive) → pre-fill `email` with `student.motherEmail` (if present; else leave empty)
  - Field remains editable; user may override before submit (REQ-RYT-14-C)
  - No pre-fill if the corresponding student email is absent (REQ-RYT-14-B)
- Pure client behavior; app layer receives whatever email value the form submits
- **Satisfies**: REQ-RYT-14

---

## Review Workload Forecast

| Slice | Estimated LOC | Tests included | Budget risk |
|-------|--------------|----------------|-------------|
| PR1 — Student emails + Mobile VO | ~280–340 | 3 test tasks (RED) | Low |
| PR2a — StudentGuardian domain + schema | ~210–260 | 1 test task (RED, updates existing) | Low |
| PR2b — StudentGuardian app + presentation | ~220–260 | 4 test tasks (RED, 2 new + 2 updates) | Low |
| PR3 — Web guardian panel | ~220–290 | 0 (web, no TDD harness) | Low |
| **Total** | **~930–1150** | **8 test tasks** | |

**Chained PRs recommended: Yes**
**400-line budget risk: Low** (each individual slice is within budget; PR2 was split as designed)
**Decision needed before apply: No** (auto-chain — deliver one slice at a time)

**First slice to implement**: PR1 (Student emails + Mobile VO). It is fully self-contained and unblocks the entire chain.

---

## Task count summary

| Slice | RED | GREEN | Total |
|-------|-----|-------|-------|
| PR1 | 3 | 10 | 13 |
| PR2a | 1 | 6 | 7 |
| PR2b | 4 | 7 | 11 |
| PR3 | 0 | 3 | 3 |
| **Total** | **8** | **26** | **34** |

---

## Dependencies and sequencing

```
PR1 (independent)
  → PR2a (needs Mobile VO from PR1)
    → PR2b (needs entity Result from PR2a; AssignGuardianUseCase call-site fix MUST land here)
      → PR3 (needs fatherEmail/motherEmail from PR1 on student response + new PATCH endpoint from PR2b)
```

**Critical coupling**: T2a.5 (entity `create()` → `Result`) breaks the `AssignGuardianUseCase` call site. T2b.5 MUST be implemented in the same apply session as or immediately after T2a.5. The chain must not pause between PR2a and PR2b with tests failing.

**Enum-drop ordering caution**: T2a.4 (migration) — always inspect the generated SQL file before `git add`. Postgres rejects `DROP TYPE GuardianRelationship` if the `relationship` column still references it. Prisma generates the correct order automatically, but verify.
