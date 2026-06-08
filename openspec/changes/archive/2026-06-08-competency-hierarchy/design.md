# Design — competency-hierarchy (Fase 2)

Architecture-level HOW for re-scoping `SubjectCompetency` from the global `Subject`
to the `StudyPlanSubject` (Plan × Curso × Materia) tuple, rewiring auto-creation,
adding a copy endpoint, and repairing the dead competencies UI.

Clean-arch boundaries preserved: `domain` imports nothing; `application` imports
`domain`; `infrastructure` imports both; `presentation` imports `application`.
Repository stays one-port-per-aggregate. Expected failures return `Result<T,E>`,
DTO validation maps to HTTP **400** (project override).

---

## 1. Resolved Decisions (ADR-style)

### ADR-1 — `StudyPlanSubject` stays a primitive FK, NOT a new domain entity

**Question:** Is `StudyPlanSubject` a domain entity or only a Prisma model/DTO?

**Findings (code-verified):**
- No `StudyPlanSubject` domain entity exists. It lives only as a Prisma model
  (`schema.prisma:583`) and as an inline DTO shape inside
  `StudyPlanCourseDto.subjects` (`study-plan-repository.ts:10`).
- `StudyPlan` is the aggregate root; `StudyPlanCourse`/`StudyPlanSubject` are
  managed exclusively through `StudyPlanRepository` (`addSubject`, `removeSubject`,
  `findPlanCourseById` → DTO). They are NOT independent aggregates.
- Critically: the existing `SubjectCompetency` entity already treats `subjectId`
  as a **plain `string` FK**, not a `Subject` reference (`subject-competency.ts:5`).

**Decision:** Do NOT introduce a `StudyPlanSubject` domain entity in Fase 2. Swap
the primitive: `SubjectCompetency.subjectId: string` → `studyPlanSubjectId: string`.
The `StudyPlanSubject` remains a child of the `StudyPlan` aggregate, reached for
navigation/validation via a focused read method on `StudyPlanRepository`.

**Rationale:** Matches the existing modeling convention (FK-as-primitive),
respects single-aggregate boundaries, and keeps the change minimal. Introducing a
new entity + repository would be over-engineering for a value that is only ever a
foreign key here.

**Rejected:** (a) New `StudyPlanSubject` aggregate + repository — unjustified
ceremony, no behavior to own. (b) Reference the full `Subject`/`StudyPlanSubject`
object graph in the entity — violates the current lean FK convention and bloats
reconstruction.

---

### ADR-2 — `POST /subject-competencies/copy` is a dedicated use case

**Question:** Dedicated use case vs controller loop?

**Decision:** `CopySubjectCompetenciesUC` (one class, single `execute()`), clean-arch
compliant. Controllers stay thin.

**Contract:**
```
execute(input: { sourceStudyPlanSubjectId: string; targetStudyPlanSubjectId: string })
  : Promise<Result<{ copied: number; skipped: number }, Error>>
```
- Validate both ids present and `source !== target` → else `ValidationError` (HTTP 400).
- Load `repo.findActiveByStudyPlanSubject(source)`.
- For each source competency: `repo.findByStudyPlanSubjectAndName(target, name)`.
  If a non-deleted match exists → **skip** (`skipped++`); else
  `SubjectCompetency.create({ studyPlanSubjectId: target, name })` + `repo.save` → `copied++`.
- Idempotent: re-running copies nothing new (all names already present → all skipped).
- Returns `{ copied, skipped }` for UI feedback (incl. zero-source → `{0,0}`).

**Rationale:** Conflict handling (duplicate-name skip) and idempotency are domain
logic that must not leak into the controller. Single port (`SubjectCompetencyRepository`)
is enough — no new repo.

**Rejected:** Controller loop (business logic in presentation, untestable without
HTTP) and a SQL-level bulk copy in the repo (hides skip semantics, bypasses the
entity invariant).

---

### ADR-3 — Listing valuations by `studyPlanSubjectId` joins through `SubjectCompetency`

**Question:** How to list `CompetencyValuation` by `studyPlanSubjectId` (needs a join)?

**Findings:** `CompetencyValuation` links to the hierarchy only via
`competencyId → SubjectCompetency`. The existing `findByStudentAndSubject`
(`prisma-competency-valuation.repository.ts:19`) already does the two-step pattern:
resolve competency ids by `subjectId`, then filter valuations by `competencyId in [...]`.

**Decision:** Rename `findByStudentAndSubject` → `findByStudentAndStudyPlanSubject`
and change only the first query's filter from `subjectId` to `studyPlanSubjectId`:
```ts
const ids = await client.subjectCompetency.findMany({
  where: { studyPlanSubjectId, deletedAt: null }, select: { id: true },
});
if (ids.length === 0) return [];
const rows = await client.competencyValuation.findMany({
  where: { studentId, competencyId: { in: ids.map(c => c.id) }, deletedAt: null },
});
```
No schema change to `CompetencyValuation` — it stays structurally untouched (Fase 3
boundary). The join is fully navigable.

**Rejected:** Adding `studyPlanSubjectId` directly on `CompetencyValuation` — that
is Fase 3 territory (alongside `courseCycleId`), explicitly out of scope.

---

### ADR-4 — `SubjectCompetency` re-scope + `periodActive` removal

`SubjectCompetency` drops `subjectId` and the deprecated `periodActive`; gains
`studyPlanSubjectId`. Entity loses `setPeriodActive`/`periodActive` getter. This
cascades to DTO, controller responses, UpdateUC, and the front-end period selector.
`CompetencyValuation.periodActive` is **untouched** (Fase 3).

---

## 2. Migration Model

Target `SubjectCompetency` (api/prisma_tenant/schema.prisma):
- DROP `subjectId`, its `Subject` relation, `@@unique([subjectId, name])`,
  `@@index([subjectId])`, and the `Subject.competencies` back-relation.
- DROP `periodActive`.
- ADD `studyPlanSubjectId String` + relation
  `StudyPlanSubject @relation(fields:[studyPlanSubjectId], references:[id], onDelete: Cascade)`.
- ADD `@@unique([studyPlanSubjectId, name])`, `@@index([studyPlanSubjectId])`.
- ADD back-relation `competencies SubjectCompetency[]` on `StudyPlanSubject`.
- ADD Fase-3 marker comment on `CompetencyValuation.@@unique([studentId, competencyId])`:
  `// @fase3: add courseCycleId → UNIQUE(studentId, competencyId, courseCycleId) before populating multi-cycle data`.

**Strategy — clean migration with data reset (confirmed safe).** `studyPlanSubjectId`
is NOT NULL with no backfill mapping (old rows only know a global `subjectId`, which
could map to many `StudyPlanSubject` rows — ambiguous). Tables are near-empty, so the
generated migration TRUNCATEs `competency_valuations` then `subject_competencies`
(FK/cascade order) before altering columns. This is a destructive, intentional reset
documented in the migration. No down-migration data preservation needed.

> Risk noted at proposal level: `CompetencyValuation.UNIQUE(studentId, competencyId)`
> blocks multi-cycle grading. The Fase-3 marker comment lands NOW so it is changed
> before any real data is loaded.

---

## 3. AutoCreate Rewire (pseudocode)

The trigger contract is preserved: `CreateSubjectAssignmentUC.execute(subjectId,
teacherId, courseSectionId)` still calls
`autoCreateUC.executeForSubjectAssignment(subjectId, courseSectionId)` and an
AutoCreate failure must NOT roll back the assignment (current fire-and-forget call
order unchanged).

New navigation resolves competencies through the hierarchy instead of a direct
`subjectId` lookup. A focused read method is added to `StudyPlanRepository`:

```
StudyPlanRepository.findStudyPlanSubjectIds(courseSectionId, subjectId): Promise<string[]>
  // SELECT sps.id FROM study_plan_subjects sps
  // JOIN study_plan_courses spc ON sps.studyPlanCourseId = spc.id
  // WHERE spc.courseSectionId = :courseSectionId AND sps.subjectId = :subjectId
  // (a courseSection may belong to several plans → several StudyPlanSubject rows)
```

```
executeForSubjectAssignment(subjectId, courseSectionId):
  spsIds = studyPlanRepo.findStudyPlanSubjectIds(courseSectionId, subjectId)
  if spsIds empty: return                       # no StudyPlanSubject found → no-op
  competencies = flatten(spsIds.map(id => competencyRepo.findActiveByStudyPlanSubject(id)))
  if competencies empty: return                 # zero competencies → no-op
  studentIds = findEnrolledStudentIds(courseSectionId)   # unchanged
  valuations = []
  for studentId in studentIds:
    for c in competencies:
      if not valuationRepo.findByStudentAndCompetency(studentId, c.id):   # idempotent
        valuations.push(CompetencyValuation.create({ competencyId: c.id, studentId, ...defaults }))
  if valuations: valuationRepo.bulkCreate(valuations)   # skipDuplicates → idempotent

executeForEnrollment(studentId, courseSectionId):
  assignments = findSubjectAssignments(courseSectionId)   # [{subjectId}]
  competencies = flatten(assignments.map(a =>
      studyPlanRepo.findStudyPlanSubjectIds(courseSectionId, a.subjectId)
        .flatMap(id => competencyRepo.findActiveByStudyPlanSubject(id))))
  ...same idempotent valuation build/bulkCreate...
```

`AutoCreateCompetencyValuationsUC` gains a `StudyPlanRepository` constructor dependency
(wired in `pedagogy.module.ts`). Student lookup (`findEnrolledStudentIds`,
`executeForNewEnrollment`) stays as-is — student matching is a separate concern and
out of Fase 2 scope (flagged as a risk).

> Pre-existing smell (NOT fixed here): `AutoCreateCompetencyValuationsUC` reaches
> `TenantContext.getClient()` directly — an infrastructure leak in the application
> layer. Left untouched to stay in budget; flagged for future cleanup.

---

## 4. File Manifest — grouped into chained PR slices

Total estimate ≈ **665 changed lines → exceeds the 400-line single-PR budget.
Chaining is REQUIRED.** Four dependency-ordered slices (PR2+PR3 may merge if a
reviewer accepts ~420 lines).

### PR1 — Domain + Schema + Migration (~170 lines) — foundation, compiles & unit-green
- `api/prisma_tenant/schema.prisma` — SubjectCompetency remodel, Subject/StudyPlanSubject relations, CV Fase-3 comment (~15)
- `api/prisma_tenant/migrations/<ts>_competency_scope_remodel/migration.sql` — truncate + alter (new, ~30)
- `packages/domain/src/pedagogy/entities/subject-competency.ts` — subjectId→studyPlanSubjectId, drop periodActive (~15)
- `packages/domain/src/pedagogy/repositories/subject-competency-repository.ts` — `findActiveByStudyPlanSubject`, `findByStudyPlanSubjectAndName`, `findByStudyPlanSubject` (~10)
- `packages/domain/src/pedagogy/repositories/competency-valuation-repository.ts` — rename `findByStudentAndStudyPlanSubject` (~2)
- `packages/domain/src/pedagogy/repositories/study-plan-repository.ts` — add `findStudyPlanSubjectIds(courseSectionId, subjectId)` (~3)
- `packages/domain/src/pedagogy/__tests__/entities/competency.test.ts` — construction updates (~25)

### PR2 — Infrastructure + Application + wiring + tests (~300 lines) — backend complete
- `infrastructure/.../prisma-subject-competency.repository.ts` — all queries subjectId→studyPlanSubjectId, drop periodActive in create/toDomain (~35)
- `infrastructure/.../prisma-competency-valuation.repository.ts` — `findByStudentAndStudyPlanSubject` join (~10)
- `infrastructure/.../prisma-study-plan.repository.ts` — implement `findStudyPlanSubjectIds` (~15)
- `application/pedagogy/use-cases/competency.use-cases.ts` — Create/List UC studyPlanSubjectId + drop periodActive; AutoCreate rewire (+StudyPlanRepository dep); new `CopySubjectCompetenciesUC`; `ListCompetencyValuationsUC` param rename (~90)
- `application/pedagogy/__tests__/competency.use-cases.test.ts` — mock reshape + Copy + AutoCreate nav tests (~130)
- `presentation/pedagogy/pedagogy.module.ts` — wire CopyUC; inject StudyPlanRepository into AutoCreate (~6)

### PR3 — Presentation API (~60 lines) — thin controllers
- `presentation/pedagogy/dto/competency.dto.ts` — Create schema studyPlanSubjectId + drop periodActive; new `CopySubjectCompetenciesSchema` (~15)
- `presentation/pedagogy/pedagogy.controller.ts` — create/list by `studyPlanSubjectId`; valuations by `studyPlanSubjectId`; new `POST /subject-competencies/copy`; drop periodActive from responses; validation → **400** (~45)

### PR4 — Web (~250 lines) — UI repair + drill-down
- `web/src/pages/dashboard/competencies.tsx` — both tabs to real routes, Plan→Course→Subject drill-down, copy dialog, drop period selector (~190 net)
- `web/src/pages/dashboard/components/PlanCourseSubjectSelector.tsx` — extracted reusable cascade selector (new, ~70)
- `web/src/pages/dashboard/components/CopyCompetenciesDialog.tsx` — source selector + POST /copy + feedback (new, ~60)

> If reviewers prefer fewer PRs, PR2+PR3 combine to ~360 (under budget); PR4 stays
> separate (different layer/risk profile, UI).

---

## 5. Front-End Approach

**Drill-down (replaces flat `/subjects` selector):**
1. On mount: `GET /study-plans` → plan dropdown.
2. On plan select: `GET /study-plans/:id/courses` → returns `StudyPlanCourseDto[]`
   where each course already carries `subjects: [{ id, subjectId, subjectName }]`
   (`id` IS the `studyPlanSubjectId`). Populate course dropdown.
3. On course select: subjects come from the chosen course's inline `subjects[]`.
4. On subject select: hold `studyPlanSubjectId`. Cascading resets clear downstream
   selections on any upstream change.

**Tab 1 (definitions):** `GET /subject-competencies?studyPlanSubjectId={id}`;
create `POST /subject-competencies { studyPlanSubjectId, name }`. "Copy from another
course" button → `CopyCompetenciesDialog` with its own drill-down to pick the SOURCE
`studyPlanSubjectId` → `POST /subject-competencies/copy { sourceStudyPlanSubjectId,
targetStudyPlanSubjectId }` → refresh list → toast `{copied, skipped}` (incl.
zero-results feedback).

**Tab 2 (valuations):** same drill-down to resolve `studyPlanSubjectId` + a
`studentId` field → `GET /competency-valuations?studentId={id}&studyPlanSubjectId={id}`.

**Reuse:** extract `PlanCourseSubjectSelector` so Tab 1, Tab 2, and the copy dialog
share one cascade component (avoids triplicated fetch/reset logic).

Both currently-dead routes (`GET /subjects/:id/competencies`,
`GET /students/:id/competency-valuations`) are removed.

---

## 6. Out of Scope (Fase 3 boundary)

`CompetencyValuation.courseCycleId`; `UNIQUE(studentId, competencyId)` →
`(studentId, competencyId, courseCycleId)`; `GradeScaleValue` integration into
valuations; `CompetencyValuation.periodActive` removal; per-period row normalization.
`CompetencyValuation` stays structurally untouched in Fase 2.

---

## 7. Architectural Risks

- **R1 (Medium):** Migration is a destructive data reset of `subject_competencies` +
  `competency_valuations`. Safe only because tables are near-empty — re-confirm both
  are empty (or acceptably disposable) in the target tenant DBs before applying.
- **R2 (Medium):** Student lookup (`findEnrolledStudentIds`) still matches
  `Enrollment.{level,grade,division,academicYear}` against `CourseSection` columns —
  fragile, intentionally left in Fase 2. AutoCreate behavior depends on it.
- **R3 (Low):** `AutoCreateCompetencyValuationsUC` keeps its direct
  `TenantContext.getClient()` infrastructure leak (pre-existing). Not fixed here.
- **R4 (Low):** A `courseSection` belonging to multiple plans yields multiple
  `StudyPlanSubject` rows → competencies from all matching plans are auto-created.
  Confirm this multi-plan fan-out is the intended semantic (assumed yes).
- **R5 (Low):** Front-end depends on `GET /study-plans/:id/courses` returning inline
  `subjects[]` with `id = studyPlanSubjectId` — verified in `StudyPlanCourseDto`, but
  the controller response shape must expose it; confirm during PR4.
