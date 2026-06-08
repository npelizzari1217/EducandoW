# Archive Report — competency-instantiation

**Date**: 2026-06-08
**Change**: competency-instantiation
**Epic**: competency-grading (Fase 3 of N)
**Scope**: BACKEND-ONLY (UI deferred to Fase 3b)
**Verdict**: PASS WITH WARNINGS — ARCHIVED AND CLOSED

---

## Summary

Fase 3 introduced a fully normalized competency valuation model replacing the
prior flat-column design. All 32 tasks were implemented and verified across 3 PRs.

---

## Artifact References (Engram observation IDs)

| Artifact | Engram ID |
|----------|-----------|
| proposal | (engram: sdd/competency-instantiation/proposal) |
| spec | (engram: sdd/competency-instantiation/spec) |
| design | (engram: sdd/competency-instantiation/design) |
| tasks | (engram: sdd/competency-instantiation/tasks) |
| apply-progress | #848 |
| verify-report-backend | #852 |
| archive-report | (this document) |

---

## What Was Delivered

### PR1 — Additive domain + infra (stays green)
- New `CompetencyPeriodValuation` domain entity and repository interface
- New `CompetencyPeriodValuationRepository` port
- New 5 domain errors (`competency-valuation.errors.ts`)
- Extended `GradeScaleRepository.findActiveByLevelModality` and
  `GradingPeriodRepository.findActiveTemplateByLevelModality`
- New `PrismaCompetencyPeriodValuationRepository` with full test coverage
- Extended Prisma grade-scale and grading-period repo tests

### PR2 — Breaking change: migration + slim parent + trigger move
- Prisma schema: slim `CompetencyValuation` (courseCycleId FK, no flat columns, unique triple);
  new `CompetencyPeriodValuation` model
- Migration `20260608210000_competency_instantiation_fase3`: drops 13 flat columns, adds
  `courseCycleId` FK, creates `competency_period_valuations` table
- Rewrote `AutoCreateCompetencyValuationsUC.execute({courseCycleId})`; removed
  `executeForSubjectAssignment`/`executeForEnrollment`/`executeForNewEnrollment`
- Wired fire-and-forget hook in `GenerateCourseCyclesUseCase`
- Removed auto-create hook from `CreateSubjectAssignmentUC` and `CreateEnrollmentUseCase`
- Removed `UpdateCompetencyValuationUC` and flat PATCH handler from controller
- Slim response shape in `toValuationResponse`

### PR3 — Grading endpoint
- New `GradePeriodValuationUC` implementing full 9-step processing contract
- 9 UC test scenarios (GPE-1..GPE-9)
- `PATCH /v1/competency-valuations/:uuid/periods/:periodItemId` controller handler
- Boletin cache invalidation wired
- 5 controller integration tests (200, 404×2, 400×2)
- DTO: `UpdatePeriodGradeSchema` + `UpdatePeriodGradeDto`
- `PedagogyModule`: wired GradePeriodValuationUC with 5 repo injections

### Cleanup Batch — W1 fix
- ACT-5 fire-and-forget isolation test added to `course-cycle.use-cases.test.ts`

---

## Test Gates (Final)

| Gate | Result |
|------|--------|
| `pnpm --filter domain build` | CLEAN |
| `pnpm --filter domain test` | 799 tests PASSED (71 files) |
| `pnpm --filter api build` | CLEAN (298 files) |
| `pnpm --filter api test` | 646 tests PASSED (70 files; 6 pre-existing failures ajenos: postgres-admin + ensure-institution-levels) |

---

## Open Items at Archive Time

### W2 — Duplicate repo registration in PedagogyModule (ACCEPTED)
`PrismaGradeScaleRepository`, `PrismaGradingPeriodRepository`, `PrismaCourseCycleRepository`
are registered directly in `PedagogyModule` rather than exported from their home modules.

**Why accepted**: `GradingModule` has zero exports. Importing `CourseCycleModule` would
create a circular dependency. All three repos are stateless (`TenantContext.getClient()` pattern)
so duplicate instances are harmless. Structural smell only — no functional or correctness impact.

**Deferred to**: whenever `GradingModule`/`CourseCycleModule` get formal export surfaces.

### S1 — findFirst vs findUnique in PrismaCompetencyPeriodValuationRepository
`findByValuationAndPeriod` uses `findFirst()` instead of `findUnique()` with compound
unique key. Functionally equivalent. Deferred.

### Uncommitted working tree
Commits are PENDING. The user commits separately after review.

---

## Main Spec Updated

`openspec/specs/competency-valuations/spec.md` was rewritten (judgment merge) to reflect:
- Slim `CompetencyValuation` parent (courseCycleId, UNIQUE triple, no flat columns)
- New `CompetencyPeriodValuation` child entity (lazy creation, grade snapshot, UNIQUE pair)
- Auto-creation trigger at CourseCycle instantiation (not SubjectAssignment/Enrollment)
- New `PATCH /v1/competency-valuations/:uuid/periods/:periodItemId` endpoint
- Removed: flat PATCH endpoint, batch-retrieval-by-subjectId endpoint
- Preserved: access control requirements, GET single endpoint

---

## Deferred to Future Phases

| Item | Phase |
|------|-------|
| Grading UI (teacher grade entry) | Fase 3b |
| GET endpoint read shape for new normalized model | Fase 4 |
| Enrollment → CourseCycle FK | Fase 4 |
| Libreta (report card) generation | Fase 4 |
| GradingModule / CourseCycleModule formal export surfaces (W2) | TBD |

---

## Next Recommended

- **Fase 3b**: grading UI (frontend); teacher-facing period grading flow
- **Fase 4**: Enrollment→CourseCycle FK + libreta generation
