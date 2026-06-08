# Design — competency-instantiation (Fase 3, BACKEND-ONLY)

> Architectural HOW for the normalized competency-grading instantiation layer.
> Reads: proposal (#843), spec (4 files), explore (#842). Clean/Hexagonal, NestJS, Result<T,E>.

---

## 0. Cross-cutting decision: ID convention overrides the spec tables

The spec field tables list `id Int PK autoincrement` + a separate `uuid String`. **This is WRONG
for this codebase.** Every tenant entity uses a single `id String @id @default(uuid())` as both
PK and public identifier (verified: `CompetencyValuation.id`, `GradeScaleValue.id`,
`GradingPeriodTemplateItem.id`, `SubjectCompetency.id`, `Student.id` are all String UUID). Repos
expose `findById(id: string)` and the controller returns `uuid: v.id.get()`.

**DECISION**: `CompetencyValuation` and the new `CompetencyPeriodValuation` use a single
`id String @id @default(uuid())`. No separate `uuid` column, no Int PK. All FKs are `String`.
The spec's Int/uuid split is a documentation placeholder; the migration and entities follow the
real String-UUID convention. (This affects every FK in the migration below.)

---

## 1. RESOLVED DECISION #1 — GradeScale lookup key + missing-scale error path

**Finding.** `GradeScale` (schema 355) and `GradingPeriodTemplate` (schema 1051) are structurally
identical for lookup: both carry `level Int` + `modality Int @default(0)`, both
`@@unique([level, modality, name])`. **There is NO `institutionId` column** on either — the tenant
DB *is* the institution (multi-tenant per-DB via `TenantContext`). So the spec's
"`(institutionId, level, modality)`" key is, in this codebase, simply `(level, modality)` scoped to
the active tenant connection.

**Confirmed**: GradeScale IS keyed the same way as GradingPeriodTemplate — by `(level, modality)`.

**Ambiguity discovered**: the unique key is `(level, modality, name)`, so MULTIPLE active scales /
templates can exist for one `(level, modality)`. Resolution must pick the single active one.

**DECISION**:
- Add `findActiveByLevelModality(level, modality): Promise<GradeScale | null>` to `GradeScaleRepository`
  and `findActiveTemplateByLevelModality(level, modality): Promise<GradingPeriodTemplate | null>` to
  `GradingPeriodRepository`. Each returns the single `active=true, deletedAt=null` match; if more
  than one exists it returns the most recently updated and we treat multi-active as a configuration
  smell (see Risks). Internally they reuse the existing `list({level, modality, active:true})` /
  `listTemplates({...})` finders.
- **Missing-scale error path** (the gap the spec flagged): when a cycle's `(level, modality)` has a
  template but **no matching active GradeScale**, do NOT return a bare 404. Introduce typed domain
  error **`GradeScaleNotConfiguredError(level, modality)`** (code `SCALE_NOT_CONFIGURED`) →
  HTTP **400**. Rationale: the scale is institution configuration, not the requested resource; a
  404 would wrongly imply the valuation/period URL is invalid. This mirrors the spec's treatment of
  `GradingPeriodTemplateNotFoundError` (also 400, step 3).
- Error-to-status table for the PATCH endpoint:
  | Error | Status |
  |---|---|
  | `CompetencyValuationNotFoundError` (uuid) | 404 |
  | `GradeScaleValueNotFoundError` (body uuid) | 404 |
  | `GradingPeriodTemplateNotFoundError` | 400 |
  | `GradeScaleNotConfiguredError` (NEW) | 400 |
  | `PeriodItemNotInTemplateError` (NEW) | 400 |
  | `GradeScaleValueMismatchError` (NEW) | 400 |
  | `PeriodLockedError` (NEW) | 400 |

---

## 2. RESOLVED DECISION #2 — modality resolution from CourseCycle (CRITICAL)

**Finding.** `CourseCycle` (schema 147) carries `level Int` but **NO `modality` column**. Its
relations are: `course → CourseSection` (has `modality`), `studyPlan → StudyPlan` (has `level` +
`modality`), `cycle → AcademicCycle` (no modality). So modality MUST be derived via a join.

Candidates carrying modality: `CourseSection.modality`, `StudyPlan.modality`, `Enrollment.modality`.

**DECISION — resolve the `(level, modality)` pair from `StudyPlan` via `CourseCycle.studyPlanId`:**

```
CompetencyValuation (by id/uuid)
  └─ .courseCycleId                 (String → CourseCycle.uuid)
      └─ CourseCycle.studyPlanId    (String → StudyPlan.id)   ← single FK hop
          └─ StudyPlan.level        ─┐  authoritative (level, modality) pair
          └─ StudyPlan.modality     ─┘
              ├─ GradingPeriodRepository.findActiveTemplateByLevelModality(level, modality)
              └─ GradeScaleRepository.findActiveByLevelModality(level, modality)
```

**Why StudyPlan and not CourseSection or CourseCycle.level:**
1. `StudyPlan` is a direct FK on `CourseCycle` (`studyPlanId`) — one hop, no fan-out.
2. `StudyPlan` is the pedagogical source of truth that *defines* which subjects/competencies exist
   for the cycle (the same plan drives `AutoCreate`'s competency traversal). Grading config
   (scales, period templates) is pedagogical config keyed to that plan's `(level, modality)`.
3. Taking BOTH `level` and `modality` from the **same row** guarantees an internally consistent
   pair. Mixing `CourseCycle.level` with `StudyPlan.modality` risks divergence; `GenerateCourseCycles`
   already builds `CourseCycle.level` from `Level.fromParts(plan.level, plan.modality)`, confirming
   StudyPlan is the origin of truth.

**Implementation.** Add a thin read method to the CourseCycle repo (infra), avoiding leaking Prisma
into the use case:
```ts
// CourseCycleRepository (domain port)
findGradingContextByUuid(courseCycleUuid: string):
  Promise<{ level: number; modality: number } | null>;
// infra impl: prisma.courseCycle.findUnique({ where:{uuid}, select:{ studyPlan:{ select:{ level, modality } } } })
```
Returns `null` when the cycle does not exist (→ caller maps to the valuation 404 path, since a
valuation always points at a real cycle via RESTRICT FK).

---

## 3. RESOLVED DECISION #3 — executeForEnrollment / executeForNewEnrollment disposition

**Finding.** Three cycle-blind creation paths exist on `AutoCreateCompetencyValuationsUC`:
- `executeForSubjectAssignment(subjectId, courseSectionId)` — called fire-and-forget by
  `CreateSubjectAssignmentUC` (pedagogy.use-cases.ts:282).
- `executeForEnrollment(studentId, courseSectionId)` — internal helper.
- `executeForNewEnrollment(studentId, {level,grade,division,academicYear})` — called fire-and-forget
  by `CreateEnrollmentUseCase` (enrollment.use-cases.ts:65).

All three build flat valuations with **no `courseCycleId`**. After Fase 3, `courseCycleId` is
NOT NULL, so all three would violate the invariant. An `Enrollment` references `AcademicCycle`
(`cycleId`), never `CourseCycle`; deriving `CourseCycle` would require matching
`(courseSection, academicCycle)` via `CourseCycle.@@unique([courseId, cycleId])` — but `Enrollment`
has no `courseSectionId`, only loose `level/grade/division/academicYear` matching. The reliable
`Enrollment → CourseCycle` link is **exactly the FK explicitly deferred to Fase 4**.

**DECISION — DEFER all enrollment/assignment-time creation to Fase 4; CourseCycle instantiation
becomes the SOLE creation path in Fase 3.**
- **Remove** `executeForSubjectAssignment`, `executeForEnrollment`, `executeForNewEnrollment`, and
  `findEnrolledStudentIds`/`findSubjectAssignments`/`findStudyPlanSubjectIds`-by-assignment helpers
  that only served them.
- **Remove the callers**: drop the `autoCreateUC?` injection + fire-and-forget block from
  `CreateSubjectAssignmentUC` and `CreateEnrollmentUseCase` (and their module providers).
- Replace with a single `execute({ courseCycleId })` (see §6).

**Justification.** (1) Deriving `courseCycleId` from an Enrollment needs the Fase-4 FK — keeping a
broken path would silently violate the NOT-NULL invariant. (2) The cycle-instantiation hook already
materializes `enrolled students × active competencies` for the cycle, so the only uncovered case is
a student who enrolls *after* the cycle is instantiated — covered today by re-running the idempotent
(`skipDuplicates`) generation, and properly by a Fase-4 enrollment→cycle hook. (3) Lazy child rows
mean a late student still gets graded correctly once their parent exists. The temporary gap
(late-enrollment auto-parent) is an explicit, documented Fase-4 boundary, not a regression of any
Fase-3 scenario.

---

## 4. Domain model

### 4.1 `CompetencyValuation` (slim parent) — REWRITE
`packages/domain/src/pedagogy/entities/competency-valuation.ts`
```
Props: id: Id, competencyId: string, studentId: string, courseCycleId: string,
       active?: boolean, deletedAt?: Date
create({ competencyId, studentId, courseCycleId }) → sets id, active=true
reconstruct(props)
Getters: id, competencyId, studentId, courseCycleId, active, deletedAt
Behavior: softDelete()
DROP: all valuation1..4 / modificable1..4 / imprimible1..4 / periodActive + their setters/getters.
```
Invariant: a parent is meaningless without `courseCycleId` (enforced by `create` signature + DB
NOT NULL). No grading state on the parent.

### 4.2 `CompetencyPeriodValuation` (child) — NEW
`packages/domain/src/pedagogy/entities/competency-period-valuation.ts`
```
Props: id: Id, valuationId: string, periodItemId: string,
       gradeScaleValueId: string | null, gradeCode: string | null,
       internalStatus: GradeInternalStatus | null,
       modificable: boolean, imprimible: boolean
create({ valuationId, periodItemId }) → ungraded row: grade fields null, modificable=true, imprimible=false
reconstruct(props)
Behavior (invariants live here, NOT in the use case):
  - assignGrade(value: { gradeScaleValueId, gradeCode, internalStatus }): Result<void, PeriodLockedError>
       → guards modificable===false → err(PeriodLockedError); else snapshots the 3 fields
  - clearGrade(): Result<void, PeriodLockedError>  → guards lock; nulls the 3 grade fields
  - setModificable(b), setImprimible(b)
Getters for all props.
```
`gradeCode` + `internalStatus` are **snapshots** (Nota pattern): copied from the referenced
`GradeScaleValue` at write time, never recomputed on read.

### 4.3 Value objects / enums
- Reuse existing `GradeInternalStatus` (enum already in domain, schema-level) for `internalStatus`.
- Reuse `GradeValueCode` VO only if the existing one fits a free-form snapshot; otherwise store
  `gradeCode` as a plain snapshot string (snapshots are historical copies, not re-validated).
- No new VO strictly required; the lock/snapshot logic is entity behavior.

### 4.4 Repository ports
- `CompetencyValuationRepository` (MODIFY): drop `findByStudentAndCompetency` (only used by removed
  paths) or repurpose to `findByStudentCompetencyCycle(studentId, competencyId, courseCycleId)`;
  change `bulkCreate` semantics to skip on the new `(studentId, competencyId, courseCycleId)` triple;
  keep `findById`, `save`, `delete`.
- `CompetencyPeriodValuationRepository` (NEW):
  ```
  findByValuationAndPeriod(valuationId, periodItemId): Promise<CompetencyPeriodValuation | null>
  save(child): Promise<void>          // upsert on (valuationId, periodItemId)
  listByValuation(valuationId): Promise<CompetencyPeriodValuation[]>  // for Fase-4 reads
  ```
- `CourseCycleRepository` (MODIFY): add `findGradingContextByUuid` (§2).
- `GradeScaleRepository` / `GradingPeriodRepository` (MODIFY): add the `findActive*ByLevelModality`
  finders (§1).

### 4.5 New domain errors
`packages/domain/src/pedagogy/errors/` (or grading/errors): `PeriodItemNotInTemplateError`,
`GradeScaleValueMismatchError`, `GradeScaleNotConfiguredError`, `PeriodLockedError`,
`CompetencyValuationNotFoundError`. Reuse `GradingPeriodTemplateNotFoundError` /
`GradeScaleValue`/`Scale` not-found errors if they already exist in grading errors; the grade-scale
errors file already has `ValueNotFoundError`/`ScaleNotFoundError` to reuse.

---

## 5. Migration model (destructive — tables empty, approved)

`api/prisma_tenant/schema.prisma` + generated migration SQL. Order:

1. **DROP** from `competency_valuations`: `valuation1..4`, `modificable1..4`, `imprimible1..4`,
   `periodActive`, and the deprecated `active` only if unused (keep `active`/`deletedAt` for soft
   delete — entity still soft-deletes).
2. **DROP** `@@unique([studentId, competencyId])`.
3. **ADD** `courseCycleId String` NOT NULL + FK → `CourseCycle.uuid`, `onDelete: Restrict`.
4. **ADD** `@@unique([studentId, competencyId, courseCycleId])` + `@@index([courseCycleId])`.
5. **CREATE** `competency_period_valuations`:
   ```
   id                String @id @default(uuid())
   valuationId       String  → CompetencyValuation.id   onDelete: Cascade
   periodItemId      String  → GradingPeriodTemplateItem.id  onDelete: Restrict
   gradeScaleValueId String? → GradeScaleValue.id       onDelete: SetNull (snapshot survives)
   gradeCode         String?
   internalStatus    GradeInternalStatus?
   modificable       Boolean @default(true)
   imprimible        Boolean @default(false)
   createdAt/updatedAt
   @@unique([valuationId, periodItemId])
   @@index([valuationId]) @@index([periodItemId])
   @@map("competency_period_valuations")
   ```
6. Add reverse relations: `CourseCycle.competencyValuations CompetencyValuation[]`,
   `CompetencyValuation.periodValuations CompetencyPeriodValuation[]`,
   `GradingPeriodTemplateItem.competencyPeriodValuations CompetencyPeriodValuation[]`,
   `GradeScaleValue.competencyPeriodValuations CompetencyPeriodValuation[]`.

**FK on-delete matrix** (matches migration-integrity spec):
| Parent | Child | onDelete |
|---|---|---|
| CourseCycle | CompetencyValuation | **Restrict** |
| CompetencyValuation | CompetencyPeriodValuation | **Cascade** |
| GradingPeriodTemplateItem | CompetencyPeriodValuation | **Restrict** |
| GradeScaleValue | CompetencyPeriodValuation | SetNull (snapshot preserves grade history) |
| SubjectCompetency | CompetencyValuation | Cascade (existing) |
| Student | CompetencyValuation | Cascade (existing) |

> Note `gradeScaleValueId` FK uses **SetNull** (not in spec's table but required): if a scale value
> is deleted, the snapshot `gradeCode`/`internalStatus` must survive on the period row — Restrict
> would block legitimate scale edits, Cascade would destroy grading history. SetNull on the FK only.

---

## 6. Trigger move

### 6.1 Host: extend `GenerateCourseCyclesUseCase` (NOT a sibling UC)
`api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts`. Rationale: that UC already
(a) iterates plans with `level`+`modality` in hand, (b) creates/locates each `CourseCycle`, (c) is
the canonical "instantiate cycles" entry point. A sibling UC would duplicate the plan/course
traversal. Inject `AutoCreateCompetencyValuationsUC` optionally (fire-and-forget contract).

Pseudocode (added after each `cc` is saved/located in the per-course loop):
```
const cc = existing ?? createdCourseCycle;
// fire-and-forget — failure logged, never blocks generation (ACT-5)
this.autoCreateUC?.execute({ courseCycleId: cc.uuid })
   .catch(e => logger.error('[GenerateCourseCycles] auto-create valuations failed (non-blocking)', e));
```

### 6.2 `AutoCreateCompetencyValuationsUC` — new signature
```
execute({ courseCycleId }): Promise<void>
  1. cycle = courseCycleRepo.findByUuid(courseCycleId)            → if null, return (logged)
  2. studyPlanSubjectIds = studyPlanRepo.findStudyPlanSubjectIdsByPlan(cycle.studyPlanId)
       (NEW finder: CourseCycle.studyPlanId → StudyPlanCourse → StudyPlanSubject[])
  3. competencies = flatten(findActiveByStudyPlanSubject(id) for each)
  4. studentIds = enrolled students for the cycle's course section
       (reuse level/grade/division/academicYear match via cycle.courseId → CourseSection)
  5. parents = for each (student × competency): CompetencyValuation.create({competencyId, studentId, courseCycleId})
  6. valuationRepo.bulkCreate(parents)   // skipDuplicates on (studentId, competencyId, courseCycleId)
  NO child rows created here (lazy).
```
Removed: `executeForSubjectAssignment`, `executeForEnrollment`, `executeForNewEnrollment`.

### 6.3 Neutering the old SubjectAssignment / Enrollment paths
- `CreateSubjectAssignmentUC` (pedagogy.use-cases.ts:269): remove `autoCreateUC?` ctor param + the
  fire-and-forget block (lines ~281-285). Update module provider list.
- `CreateEnrollmentUseCase` (enrollment.use-cases.ts:30): remove `autoCreateValuationsUC?` ctor param
  + the `executeForNewEnrollment` block. Update `enrollment.module.ts`.
- `UpdateCompetencyValuationUC` (the old flat patcher) and its `PATCH competency-valuations/:uuid`
  route: **remove** — superseded by the new period endpoint (§7). The slim entity has no flat setters.

---

## 7. Grade PATCH use case

New `GradePeriodValuationUC` (replaces `UpdateCompetencyValuationUC`), wired to
`PATCH /v1/competency-valuations/:uuid/periods/:periodItemId` in `pedagogy.controller.ts`.
Returns `Result<CompetencyPeriodValuation, DomainError>`; controller maps per §1 table.

```
execute({ valuationUuid, periodItemId, gradeScaleValueId | null }):
  1. parent = valuationRepo.findById(valuationUuid)
        → null ? err(CompetencyValuationNotFoundError) [404]
  2. ctx = courseCycleRepo.findGradingContextByUuid(parent.courseCycleId)   // {level, modality}  (§2)
        → null ? err(CompetencyValuationNotFoundError) [404]  (orphan cycle, shouldn't happen w/ Restrict)
  3. template = gradingPeriodRepo.findActiveTemplateByLevelModality(ctx.level, ctx.modality)
        → null ? err(GradingPeriodTemplateNotFoundError) [400]
  4. if !template.items.some(i => i.id === periodItemId)
        → err(PeriodItemNotInTemplateError) [400]
  5. child = periodRepo.findByValuationAndPeriod(parent.id, periodItemId)
            ?? CompetencyPeriodValuation.create({ valuationId: parent.id, periodItemId })   // LAZY
  6. if gradeScaleValueId === null:
        r = child.clearGrade()              → r.isErr ? err(PeriodLockedError) [400]
     else:
        scaleValue = gradeScaleRepo.findValueById(gradeScaleValueId)
            → null ? err(GradeScaleValueNotFoundError) [404]
        scale = gradeScaleRepo.findActiveByLevelModality(ctx.level, ctx.modality)
            → null ? err(GradeScaleNotConfiguredError) [400]              // (§1 missing-scale path)
        if scaleValue.scaleId !== scale.id
            → err(GradeScaleValueMismatchError) [400]
        r = child.assignGrade({ gradeScaleValueId,
                                gradeCode: scaleValue.code,               // SNAPSHOT
                                internalStatus: scaleValue.internalStatus // SNAPSHOT
                              })             → r.isErr ? err(PeriodLockedError) [400]
  7. periodRepo.save(child)    // upsert (valuationId, periodItemId)
  8. ok(child)  → controller 200
```
Lock check (`modificable=false`) lives inside `assignGrade`/`clearGrade` (entity behavior), evaluated
only when a child row already exists — a freshly lazy-created row defaults `modificable=true`.

DTO: `UpdatePeriodGradeSchema = z.object({ gradeScaleValueId: z.string().uuid().nullable() })`.
Boletín cache invalidation: keep the existing `BoletinInvalidationService` hook the old patcher used.

---

## 8. File manifest + PR slices (400-line budget → CHAINING REQUIRED)

Total estimate ~900-1000 lines incl. tests (Strict TDD active). Exceeds 400-line single-PR budget.
**Chaining: YES — 3 stacked PRs**, each compiles green and passes tests independently.

### PR1 — Child-side scaffolding (ADDITIVE, ~300 lines) — green, no behavior change
| File | Action | ~lines |
|---|---|---|
| `packages/domain/.../entities/competency-period-valuation.ts` | NEW entity + behavior | 90 |
| `packages/domain/.../repositories/competency-period-valuation-repository.ts` | NEW port | 20 |
| `packages/domain/.../errors/*` (Period/Scale errors) | NEW | 50 |
| `packages/domain/src/grading/repositories/*` | ADD `findActive*ByLevelModality` to ports | 10 |
| `.../infra/.../prisma-competency-period-valuation.repository.ts` | NEW impl | 90 |
| infra grade-scale / grading-period repos | ADD finder impls | 40 |
| domain `index.ts` exports | edit | 10 |
| tests (entity + new repos) | NEW | ~120 (separate budget) |

### PR2 — Migration + slim parent + trigger move (~350 lines) — breaking change, self-contained
| File | Action | ~lines |
|---|---|---|
| `api/prisma_tenant/schema.prisma` + migration SQL | drop flat, add courseCycleId, child table, FKs | 90 |
| `packages/domain/.../entities/competency-valuation.ts` | REWRITE slim | 40 |
| `packages/domain/.../repositories/competency-valuation-repository.ts` | MODIFY port (triple key) | 15 |
| `.../infra/.../prisma-competency-valuation.repository.ts` | REWRITE slim + courseCycleId | 70 |
| `.../course-cycle.repository` (port + infra) | ADD `findGradingContextByUuid` + reverse relation | 30 |
| `competency.use-cases.ts` AutoCreate | REWRITE `execute({courseCycleId})`, drop 3 old paths | 70 |
| `course-cycle.use-cases.ts` GenerateCourseCycles | inject + fire-and-forget hook | 15 |
| `CreateSubjectAssignmentUC` + `CreateEnrollmentUseCase` + 2 modules | remove old callers/providers | 20 |
| controller + `UpdateCompetencyValuationUC` | remove old flat PATCH route + UC | 15 |
| tests (rewrite AutoCreate, entity, repo) | NEW/REWRITE | ~150 (separate budget) |

### PR3 — Grading endpoint (~280 lines) — consumes PR1 + PR2
| File | Action | ~lines |
|---|---|---|
| `competency.use-cases.ts` `GradePeriodValuationUC` | NEW | 100 |
| `presentation/pedagogy/dto/competency.dto.ts` | ADD period-grade schema | 15 |
| `pedagogy.controller.ts` | NEW `PATCH .../periods/:periodItemId` + error mapping | 50 |
| `pedagogy.module.ts` | wire new UC + period repo | 20 |
| tests (UC + controller, 9 GPE scenarios) | NEW | ~140 (separate budget) |

Dependency order: **PR1 → PR2 → PR3** (stacked). PR1 is mergeable alone (additive). PR2 depends on
nothing in PR1 at compile time but is sequenced after to keep the stack linear; PR3 depends on both.

---

## 9. OUT OF SCOPE (explicit boundaries)
- **Front-end / grading UI** → Fase 3b.
- **`Enrollment → CourseCycle` FK / join** → Fase 4 (late-enrollment auto-parent creation depends on it).
- **Libreta / boletín / report-card rendering & read-model reshaping** → Fase 4.
- **GET endpoints for period children** → Fase 4 (`listByValuation` port added now, no route yet).
- **Bulk grading endpoints** → out.

## 10. Risks / assumptions
1. **Multi-active config**: more than one active GradeScale or GradingPeriodTemplate per
   `(level, modality)` is possible by schema. `findActive*ByLevelModality` returns the latest-updated;
   recommend an institution convention / future guard enforcing exactly one active. Medium.
2. **StudyPlan.modality authority**: assumes `StudyPlan.modality` is the correct grading key (vs
   `CourseSection.modality`). True when well-formed; mismatched plan/section data would mis-route the
   scale lookup. Low–medium; validate during PR2 with a real cycle.
3. **Late enrollment gap**: students enrolling after cycle instantiation have no auto-parent until
   re-generation; lazy children mean grading still works once a parent exists. Documented Fase-4 item.
4. **Removing `autoCreateUC` from enrollment/assignment** touches their modules + tests — audit all
   providers (`pedagogy.module.ts`, `enrollment.module.ts`) to avoid dangling DI tokens. Medium.
5. **`gradeScaleValueId` SetNull** intentionally diverges from the spec FK table to preserve grade
   snapshots; confirm with stakeholder that scale-value deletion should null the live FK but keep the
   historical `gradeCode`/`internalStatus`.
