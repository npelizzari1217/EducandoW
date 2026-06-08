# Tasks — competency-instantiation (Fase 3, BACKEND-ONLY)

> Decomposed from spec (4 files) + design. Delivery: 3 chained PRs (stacked, PR1→PR2→PR3).
> Each PR compiles and passes tests independently. STRICT TDD ACTIVE: RED→GREEN on all
> tasks that involve new logic. Runners: `pnpm --filter domain test` / `pnpm --filter api test`.
> Build gate order whenever domain ports change: `pnpm --filter domain build` BEFORE `pnpm --filter api build`.

---

## Resolved conventions (encode everywhere)

- IDs: `String @id @default(uuid())` — no Int PK + separate uuid column.
- Exactly-one-active per `(level, modality)`: `findActiveByLevelModality` finders return latest-updated
  active; PATCH rejects with typed 400 if none active.
- `gradeScaleValueId → SetNull` on delete (preserves gradeCode/internalStatus snapshots).
- `GradeScaleNotConfiguredError` (code: `SCALE_NOT_CONFIGURED`) → HTTP 400 (not 404).
- Application-layer UCs carry `@Injectable()` (real convention in this project).

---

## PR1 — Child-side scaffolding (ADDITIVE, ~300 lines, stays green)

All tasks are sequential within this PR. No behavior change to existing flow.
No schema migration — tests use mocked PrismaClient where schema not yet present.

### T1.1 [x] — Failing tests for `CompetencyPeriodValuation` entity
- **Spec**: MVM-4 (lazy create defaults), MVM-6 (ungraded null fields), GPE-4 (lock guard)
- **File**: `packages/domain/src/pedagogy/__tests__/entities/competency-period-valuation.test.ts` (NEW)
- **Tests to write**:
  - `create({valuationId, periodItemId})` → `modificable=true`, `imprimible=false`, all grade fields `null`
  - `assignGrade({gradeScaleValueId, gradeCode, internalStatus})` → snapshots all three fields; `isOk()`
  - `clearGrade()` → nulls all three grade fields; `isOk()`
  - `assignGrade(...)` when `modificable=false` → `Result.err(PeriodLockedError)`
  - `clearGrade()` when `modificable=false` → `Result.err(PeriodLockedError)`
  - `setModificable(false)` changes the flag; `setImprimible(true)` changes flag
- **Depends on**: nothing (new file, new domain error in T1.3 will be stubbed/imported once created)

### T1.2 [x] — Implement `CompetencyPeriodValuation` entity
- **Spec**: design §4.2; normalized-valuation-model/spec.md ADDED section
- **File**: `packages/domain/src/pedagogy/entities/competency-period-valuation.ts` (NEW)
- **Props**: `id: Id`, `valuationId: string`, `periodItemId: string`, `gradeScaleValueId: string | null`,
  `gradeCode: string | null`, `internalStatus: GradeInternalStatus | null`,
  `modificable: boolean`, `imprimible: boolean`
- **Static factories**: `create({valuationId, periodItemId})`, `reconstruct(props)`
- **Behavior** (invariants live HERE, not in use case):
  - `assignGrade({gradeScaleValueId, gradeCode, internalStatus}): Result<void, PeriodLockedError>` — guards `modificable===false`
  - `clearGrade(): Result<void, PeriodLockedError>` — guards lock; nulls 3 fields
  - `setModificable(b: boolean)`, `setImprimible(b: boolean)`
- **Imports**: `GradeInternalStatus` from `packages/domain/src/grading/value-objects/grade-internal-status.ts`
- **Gate**: T1.1 tests must turn GREEN

### T1.3 [x] — New domain error file for competency-valuation errors
- **Spec**: design §1 error table; GPE-4/5/6/7/8/9
- **File**: `packages/domain/src/pedagogy/errors/competency-valuation.errors.ts` (NEW)
- **Errors to add**:
  - `CompetencyValuationNotFoundError(uuid: string)` — code `COMPETENCY_VALUATION_NOT_FOUND`
  - `GradeScaleNotConfiguredError(level: number, modality: number)` — code `SCALE_NOT_CONFIGURED`
  - `PeriodItemNotInTemplateError(periodItemId: string, templateId: string)` — code `PERIOD_ITEM_NOT_IN_TEMPLATE`
  - `GradeScaleValueMismatchError(valueId: string, scaleId: string)` — code `GRADE_SCALE_VALUE_MISMATCH`
  - `PeriodLockedError(periodItemId: string)` — code `PERIOD_LOCKED`
- **Reuse** (do NOT duplicate): `ValueNotFoundError` from `packages/domain/src/grading/errors/grade-scale.errors.ts`
  for GradeScaleValue not found; `PeriodTemplateNotFoundError` from `packages/domain/src/grading/errors/grading-period.errors.ts`
  for template not configured

### T1.4 [x] — `CompetencyPeriodValuationRepository` port
- **Spec**: design §4.4
- **File**: `packages/domain/src/pedagogy/repositories/competency-period-valuation-repository.ts` (NEW)
- **Methods**:
  ```ts
  findByValuationAndPeriod(valuationId: string, periodItemId: string): Promise<CompetencyPeriodValuation | null>
  save(child: CompetencyPeriodValuation): Promise<void>   // upsert on (valuationId, periodItemId)
  listByValuation(valuationId: string): Promise<CompetencyPeriodValuation[]>  // Fase-4 read — add now, no route yet
  ```

### T1.5 [x] — Add `findActiveByLevelModality` to `GradeScaleRepository` port
- **Spec**: design §1 (findActiveByLevelModality decision)
- **File**: `packages/domain/src/grading/repositories/grade-scale.repository.ts` (MODIFY)
- **Add**: `findActiveByLevelModality(level: number, modality: number): Promise<GradeScale | null>`
- Returns single `active=true, deletedAt=null` match; if multiple active, returns most recently updated

### T1.6 [x] — Add `findActiveTemplateByLevelModality` to `GradingPeriodRepository` port
- **Spec**: design §1
- **File**: `packages/domain/src/grading/repositories/grading-period.repository.ts` (MODIFY)
- **Add**: `findActiveTemplateByLevelModality(level: number, modality: number): Promise<GradingPeriodTemplate | null>`
- Same semantics: single active match, most recently updated wins if multiple

### T1.7 [x] — Update domain `index.ts` exports
- **Spec**: n/a (packaging)
- **File**: `packages/domain/src/pedagogy/index.ts` (MODIFY)
- Export: `CompetencyPeriodValuation`, `CompetencyPeriodValuationRepository`, all errors from
  `competency-valuation.errors.ts`

### T1.8 [x] — `PrismaCompetencyPeriodValuationRepository` infra impl
- **Spec**: design §4.4; MVM-4, MVM-5 (upsert behavior)
- **File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-competency-period-valuation.repository.ts` (NEW)
- **Test**: `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-competency-period-valuation.repository.test.ts` (NEW)
- **Tests**: mock PrismaClient; `findByValuationAndPeriod` returns null when missing; `save` calls upsert on unique pair; `listByValuation` returns array
- **Note**: schema has no `competency_period_valuations` table yet (added in PR2 — tests use mocked client, so this compiles and passes)

### T1.9 [x] — `findActiveByLevelModality` impl in `PrismaGradeScaleRepository`
- **Spec**: design §1
- **File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-grade-scale.repository.ts` (MODIFY)
- **Test**: `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-grade-scale.repository.test.ts` (MODIFY — add cases)
- **Impl**: `prisma.gradeScale.findFirst({ where: { level, modality, active: true, deletedAt: null }, orderBy: { updatedAt: 'desc' } })` → map to entity or null

### T1.10 [x] — `findActiveTemplateByLevelModality` impl in `PrismaGradingPeriodRepository`
- **Spec**: design §1
- **File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-grading-period.repository.ts` (MODIFY)
- **Test**: `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-grading-period.repository.test.ts` (MODIFY — add cases)
- **Impl**: `prisma.gradingPeriodTemplate.findFirst({ where: { level, modality, active: true, deletedAt: null }, orderBy: { updatedAt: 'desc' }, include: { items: true } })` → map or null

### T1.11 [x] — Build gate (PR1)
- **Command**: `pnpm --filter domain build` (no API build — schema unchanged in PR1)
- **Gate**: must pass green before PR1 is opened
- **Run tests**: `pnpm --filter domain test`

---

## PR2 — Migration + slim parent + trigger move (~350 lines, breaking change)

All tasks are sequential. Depends on PR1 merged (or stacked locally).
This PR changes behavior: old cycle-blind creation paths are permanently removed.

### T2.1 [x] — Update Prisma schema
- **Spec**: migration-integrity/spec.md MI-1..MI-10; design §5
- **File**: `api/prisma_tenant/schema.prisma` (MODIFY)
- **Changes to `CompetencyValuation` model**:
  - REMOVE fields: `valuation1..4`, `modificable1..4`, `imprimible1..4`, `periodActive`
  - ADD: `courseCycleId  String` with `@relation(fields:[courseCycleId], references:[id], onDelete: Restrict)`
  - Change `@@unique` from `[studentId, competencyId]` → `[studentId, competencyId, courseCycleId]`
  - ADD: `@@index([courseCycleId])`
  - ADD reverse relation field: `periodValuations CompetencyPeriodValuation[]`
- **Add `CompetencyPeriodValuation` model** (full from design §5):
  - `id String @id @default(uuid())`
  - `valuationId String` → CompetencyValuation, onDelete: Cascade
  - `periodItemId String` → GradingPeriodTemplateItem, onDelete: Restrict
  - `gradeScaleValueId String?` → GradeScaleValue, onDelete: SetNull
  - `gradeCode String?`, `internalStatus GradeInternalStatus?`
  - `modificable Boolean @default(true)`, `imprimible Boolean @default(false)`
  - `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
  - `@@unique([valuationId, periodItemId])`, `@@index([valuationId])`, `@@index([periodItemId])`
  - `@@map("competency_period_valuations")`
- **Add reverse relations** on: `CourseCycle` (add `competencyValuations CompetencyValuation[]`),
  `GradingPeriodTemplateItem` (add `competencyPeriodValuations CompetencyPeriodValuation[]`),
  `GradeScaleValue` (add `competencyPeriodValuations CompetencyPeriodValuation[]`)

### T2.2 [x] — Generate Prisma migration
- **Spec**: migration-integrity/spec.md MI-1 (safe on empty tables)
- **Command**: `pnpm --filter api prisma migrate dev --name competency-instantiation-fase3`
- **File**: `api/prisma_tenant/migrations/{timestamp}_competency-instantiation-fase3/migration.sql` (GENERATED)
- **Verify SQL contains**: DROP COLUMN for flat fields; ALTER to add `courseCycleId NOT NULL`;
  DROP old UNIQUE; CREATE new UNIQUE triple; CREATE TABLE `competency_period_valuations`; all FK constraints
- Prisma client is regenerated automatically — API code must compile against the new client

### T2.3 [x] — Failing tests for slim `CompetencyValuation` entity
- **Spec**: MVM-1 (parent with courseCycleId), MVM-3 (different cycles OK); design §4.1
- **File**: `packages/domain/src/pedagogy/__tests__/entities/competency.test.ts` (MODIFY — rewrite flat-column test sections)
- **Tests to write**:
  - `create({competencyId, studentId, courseCycleId})` persists all three; `active=true` by default
  - `softDelete()` sets `active=false` and `deletedAt` to a Date
  - Accessing any flat setter (`setValuation`, `setModificable`, etc.) does not exist on the type (compile-level — check by absence in the entity, not test)
- **Remove**: existing tests that reference `valuation1..4`, `modificable1..4`, `setPeriodActive`, etc.

### T2.4 [x] — Rewrite slim `CompetencyValuation` entity
- **Spec**: design §4.1; MVM-1
- **File**: `packages/domain/src/pedagogy/entities/competency-valuation.ts` (REWRITE)
- **Props retained**: `id: Id`, `competencyId: string`, `studentId: string`, `courseCycleId: string`,
  `active?: boolean`, `deletedAt?: Date`
- **Static factories**: `create({competencyId, studentId, courseCycleId})`, `reconstruct(props)`
- **Behavior kept**: `softDelete()`
- **REMOVE**: all `valuation1..4`, `modificable1..4`, `imprimible1..4`, `periodActive` props + getters + setters + `isModificable()` + `setPeriodActive()`
- **Gate**: T2.3 tests must turn GREEN; downstream compile errors in infra/app must be fixed in subsequent tasks

### T2.5 [x] — Update `CompetencyValuationRepository` port
- **Spec**: design §4.4 (triple key)
- **File**: `packages/domain/src/pedagogy/repositories/competency-valuation-repository.ts` (MODIFY)
- **Remove**: `findByStudentAndCompetency(studentId, competencyId)` (was used only by removed paths)
- **Remove**: `findByStudentAndStudyPlanSubject` if it only served removed paths (verify usages first)
- **Update** `bulkCreate` docstring: "skip on `(studentId, competencyId, courseCycleId)` triple"
- **Keep**: `findById`, `save`, `delete`, `bulkCreate`

### T2.6 [x] — Add `findGradingContextByUuid` to `CourseCycleRepository` port
- **Spec**: design §2 (modality resolution from StudyPlan)
- **File**: `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts` (MODIFY)
- **Add**:
  ```ts
  findGradingContextByUuid(courseCycleUuid: string): Promise<{ level: number; modality: number } | null>
  ```
- Returns `null` when cycle does not exist

### T2.7 [x] — Implement `findGradingContextByUuid` in `PrismaCourseCycleRepository` + `findStudyPlanSubjectIdsByPlan` in `PrismaStudyPlanRepository`
- **Spec**: design §2
- **File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts` (MODIFY)
- **Test**: `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-course-cycle.repository.test.ts` (MODIFY)
- **Impl**: `prisma.courseCycle.findUnique({ where: { id: uuid }, select: { studyPlan: { select: { level: true, modality: true } } } })` → return `{ level, modality }` or null
- **Tests**: returns `{level, modality}` for found cycle; returns null for unknown uuid

### T2.8 [x] — Rewrite `PrismaCompetencyValuationRepository` (slim, courseCycleId-aware)
- **Spec**: design §4.4
- **File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-competency-valuation.repository.ts` (REWRITE)
- **Remove**: all references to flat columns (`valuation1..4`, `modificable1..4`, etc.) from select/create/update
- **Update** `bulkCreate`: skipDuplicates key changes to `(studentId, competencyId, courseCycleId)` triple
- **Remove**: `findByStudentAndCompetency` impl (port method removed in T2.5)
- **Remove**: `findByStudentAndStudyPlanSubject` impl if removed from port
- **Keep**: `findById`, `save`, `delete`, `bulkCreate`

### T2.9 [x] — Failing tests for `AutoCreateCompetencyValuationsUC` new signature
- **Spec**: auto-creation-trigger/spec.md ACT-1..ACT-5
- **File**: `api/src/application/pedagogy/__tests__/competency.use-cases.test.ts` (MODIFY)
- **Tests to write** (mock all ports):
  - ACT-1: 3 enrolled students × 4 competencies = 12 parent records created
  - ACT-2: idempotency — when `bulkCreate` skips duplicates, no error, existing records untouched
  - ACT-3: 0 enrolled students → 0 parents, no error
  - ACT-4: subject with 0 active competencies contributes 0 records
  - ACT-5: `valuationRepo.bulkCreate` throws → `execute()` still resolves (logged, not propagated)
- **Remove**: existing tests for `executeForSubjectAssignment`, `executeForEnrollment`, `executeForNewEnrollment`

### T2.10 [x] — Rewrite `AutoCreateCompetencyValuationsUC`
- **Spec**: design §6.2; auto-creation-trigger/spec.md ACT-1..ACT-5
- **File**: `api/src/application/pedagogy/use-cases/competency.use-cases.ts` (MODIFY)
- **New signature**: `execute({ courseCycleId: string }): Promise<void>`
- **Steps**:
  1. `courseCycleRepo.findByUuid(courseCycleId)` → if null, log + return
  2. `studyPlanRepo.findStudyPlanSubjectIdsByPlan(cycle.studyPlanId)` → check if finder exists; add to `StudyPlanRepository` port if missing
  3. For each studyPlanSubjectId: `subjectCompetencyRepo.findActiveByStudyPlanSubject(id)` → flatten
  4. Enrolled students via `CourseSection` (reuse existing enrolled-student lookup by `cycle.courseId`)
  5. Cross-product: `CompetencyValuation.create({competencyId, studentId, courseCycleId})` for each pair
  6. `valuationRepo.bulkCreate(parents)` — skipDuplicates on triple
- **Remove**: `executeForSubjectAssignment`, `executeForEnrollment`, `executeForNewEnrollment`, all helpers that only served them
- **Gate**: T2.9 tests must turn GREEN

### T2.11 [x] — Neuter `CreateSubjectAssignmentUC` and `CreateEnrollmentUseCase`
- **Spec**: auto-creation-trigger/spec.md ACT-6, ACT-7; design §6.3
- **Files**:
  - `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` — remove `autoCreateUC?` ctor injection + fire-and-forget block (~lines 281–285 per design)
  - `api/src/application/enrollment/use-cases/enrollment.use-cases.ts` — remove `autoCreateValuationsUC?` ctor param + `executeForNewEnrollment` call
- **Note**: verify existing tests for these UCs still pass (no regression in ACT-6, ACT-7)

### T2.12 [x] — Wire `AutoCreateCompetencyValuationsUC` fire-and-forget into `GenerateCourseCyclesUseCase`
- **Spec**: auto-creation-trigger/spec.md ACT-1, ACT-5; design §6.1
- **File**: `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` (MODIFY)
- **Change**: inject optional `autoCreateUC?: AutoCreateCompetencyValuationsUC`; after each `cc` is saved/located:
  ```ts
  this.autoCreateUC?.execute({ courseCycleId: cc.uuid })
    .catch(e => logger.error('[GenerateCourseCycles] auto-create valuations failed', e));
  ```
- **Test**: `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts` (MODIFY)
  - Add: ACT-5 case — autoCreateUC rejects → GenerateCourseCycles still returns success

### T2.13 [x] — Remove `UpdateCompetencyValuationUC` and its PATCH route
- **Spec**: design §6.3 (old flat patcher superseded)
- **Files**:
  - `api/src/application/pedagogy/use-cases/competency.use-cases.ts` — delete `UpdateCompetencyValuationUC` class
  - `api/src/presentation/pedagogy/pedagogy.controller.ts` — delete old `PATCH /competency-valuations/:uuid` handler
  - `api/src/presentation/pedagogy/dto/pedagogy.dto.ts` — delete old flat update DTO/schema if present
- **Note**: check for BoletinInvalidationService hook in the old handler — note where to re-attach it in PR3 (T3.4)

### T2.14 [x] — Audit and fix DI tokens in `pedagogy.module.ts` and `enrollment.module.ts`
- **Spec**: design §10 Risk #4 (dangling DI tokens)
- **Files**:
  - `api/src/presentation/pedagogy/pedagogy.module.ts` — remove `AutoCreateCompetencyValuationsUC` from the SubjectAssignment provider chain; update provider list for the rewritten UC
  - `api/src/presentation/enrollment/enrollment.module.ts` — remove `autoCreateValuationsUC` Symbol token + provider entry
- **Verify**: no `NestJS: unknown dependency` errors at startup

### T2.15 [x] — Build gate (PR2)
- **Commands** (in order):
  1. `pnpm --filter domain build`
  2. `pnpm --filter api build` (Prisma client already regenerated by T2.2)
- **Tests**: `pnpm --filter domain test` + `pnpm --filter api test`
- **Gate**: both must pass green before PR2 is opened

---

## PR3 — Grading endpoint (~280 lines)

All tasks are sequential. Depends on PR1 + PR2 merged (or stacked locally).

### T3.1 [x] — Failing tests for `GradePeriodValuationUC`
- **Spec**: grade-period-endpoint/spec.md GPE-1..GPE-9
- **File**: `api/src/application/pedagogy/__tests__/competency.use-cases.test.ts` (MODIFY — add new describe block)
- **Tests** (all mock ports — no infra):
  - GPE-1: happy path lazy create — child row created, grade snapshotted, returns `ok(child)` 
  - GPE-2: update existing child row — re-snapshots grade
  - GPE-3: clear grade (null) — all 3 fields nulled, `ok(child)`
  - GPE-4: `modificable=false` existing child → `err(PeriodLockedError)`
  - GPE-5: valuation not found → `err(CompetencyValuationNotFoundError)`
  - GPE-6: `findActiveTemplateByLevelModality` returns null → `err(GradingPeriodTemplateNotFoundError...)`  
    (reuse `PeriodTemplateNotFoundError` from grading errors — check design §1 mapping note)
  - GPE-7: `periodItemId` not in template items → `err(PeriodItemNotInTemplateError)`
  - GPE-8: `scaleValue.scaleId !== scale.id` → `err(GradeScaleValueMismatchError)`
  - GPE-9: `findValueById` returns null → `err(ValueNotFoundError)` mapped to 404

### T3.2 [x] — Implement `GradePeriodValuationUC`
- **Spec**: grade-period-endpoint/spec.md; design §7
- **File**: `api/src/application/pedagogy/use-cases/competency.use-cases.ts` (MODIFY — add new class)
- **Signature**: `execute({ valuationUuid, periodItemId, gradeScaleValueId: string | null }): Promise<Result<CompetencyPeriodValuation, DomainError>>`
- **Steps** (follow design §7 pseudocode exactly):
  1. Resolve parent via `findById(valuationUuid)` → `CompetencyValuationNotFoundError` [404]
  2. `courseCycleRepo.findGradingContextByUuid(parent.courseCycleId)` → null → same 404 error
  3. `gradingPeriodRepo.findActiveTemplateByLevelModality(ctx.level, ctx.modality)` → null → `PeriodTemplateNotFoundError` (or typed 400 error)
  4. Check `template.items.some(i => i.id === periodItemId)` → false → `PeriodItemNotInTemplateError`
  5. `periodRepo.findByValuationAndPeriod(parent.id, periodItemId)` → lazy create if null
  6. If `gradeScaleValueId !== null`: resolve `scaleValue` (404 if null) + `scale` (400 if null) + mismatch check + `child.assignGrade(...)` → `PeriodLockedError` [400]
     Else: `child.clearGrade()` → `PeriodLockedError` [400]
  7. `periodRepo.save(child)`
  8. Return `ok(child)`
- **Decorator**: `@Injectable()`
- **Gate**: T3.1 tests must turn GREEN

### T3.3 [x] — Add `UpdatePeriodGradeDto` / Zod schema
- **Spec**: grade-period-endpoint/spec.md (request body contract)
- **File**: `api/src/presentation/pedagogy/dto/pedagogy.dto.ts` (MODIFY)
- **Add**:
  ```ts
  export const UpdatePeriodGradeSchema = z.object({
    gradeScaleValueId: z.string().uuid().nullable(),
  });
  export type UpdatePeriodGradeDto = z.infer<typeof UpdatePeriodGradeSchema>;
  ```

### T3.4 [x] — `PATCH /v1/competency-valuations/:uuid/periods/:periodItemId` controller endpoint
- **Spec**: grade-period-endpoint/spec.md HTTP mapping table; design §1 error table
- **File**: `api/src/presentation/pedagogy/pedagogy.controller.ts` (MODIFY)
- **Route**: `@Patch(':uuid/periods/:periodItemId')`
- **Error mapping** (per design §1 table):
  - `CompetencyValuationNotFoundError` / null cycle context → `404`
  - `ValueNotFoundError` (GradeScaleValue not found) → `404`
  - All other typed errors (`PeriodTemplateNotFoundError`, `GradeScaleNotConfiguredError`,
    `PeriodItemNotInTemplateError`, `GradeScaleValueMismatchError`, `PeriodLockedError`) → `400`
- **BoletinInvalidationService hook**: re-attach here if it was present in the removed old PATCH (see T2.13 note)
- **Response**: HTTP 200 with serialized `CompetencyPeriodValuation` data
- **Controller unit tests**: add to `api/src/presentation/pedagogy/__tests__/` (or inline with controller spec if project pattern):
  - 200 path (mock UC returns ok)
  - 404 path (CompetencyValuationNotFoundError)
  - 404 path (ValueNotFoundError)
  - 400 path (PeriodLockedError)
  - 400 path (GradeScaleNotConfiguredError)

### T3.5 [x] — Wire `GradePeriodValuationUC` and `CompetencyPeriodValuationRepository` in `pedagogy.module.ts`
- **Spec**: NestJS modules convention (project: use-cases carry `@Injectable()`, repos bound via Symbol tokens)
- **File**: `api/src/presentation/pedagogy/pedagogy.module.ts` (MODIFY)
- **Add**:
  - Symbol token for `CompetencyPeriodValuationRepository` (if not already defined — follow existing Symbol pattern in module)
  - Provider: `{ provide: COMPETENCY_PERIOD_VALUATION_REPO_TOKEN, useClass: PrismaCompetencyPeriodValuationRepository }`
  - Provider: `GradePeriodValuationUC` (inject courseCycleRepo, gradingPeriodRepo, gradeScaleRepo, periodRepo, valuationRepo)
  - Inject `GradePeriodValuationUC` into controller constructor

### T3.6 [x] — Full build + test gate (PR3)
- **Commands** (in order):
  1. `pnpm --filter domain build`
  2. `pnpm --filter api build`
  3. `pnpm --filter domain test`
  4. `pnpm --filter api test`
- **Gate**: all four must pass green before PR3 is opened

---

## Review Workload Forecast

| PR | Estimated lines | Chaining needed | Decision before apply |
|----|----------------|-----------------|----------------------|
| PR1 | ~300 (incl. tests) | Yes | Resolved: chain |
| PR2 | ~350 (incl. tests) | Yes | Resolved: chain |
| PR3 | ~280 (incl. tests) | Yes | Resolved: chain |
| **Total** | **~930** | **Yes** | **Resolved: chained PRs** |

- Budget risk: HIGH (total >400 lines, 3× single-PR budget)
- Chained PRs recommended: **Yes**
- Decision needed before apply: **No — already resolved to CHAINED PRs (3 slices)**
- Each PR is independently compilable and test-green before the next opens

---

## Task counts

| Phase | Tasks | Sequential | Parallel |
|-------|-------|------------|---------|
| PR1 | 11 tasks (T1.1–T1.11) | All sequential | None |
| PR2 | 15 tasks (T2.1–T2.15) | All sequential | None |
| PR3 | 6 tasks (T3.1–T3.6) | All sequential | None |
| **Total** | **32 tasks** | **32** | **0** |

Inter-PR: sequential (PR1 → PR2 → PR3).
