# Verify Report — competency-instantiation (Fase 3 BACKEND-ONLY)

> PR1 + PR2 + PR3, 32 tasks
> Date: 2026-06-08
> Engram observation ID: #852

---

## Verdict: PASS WITH WARNINGS

- CRITICAL: 0
- WARNING: 2
- SUGGESTION: 2

---

## Test Gates

| Command | Result |
|---------|--------|
| `pnpm --filter domain build` | CLEAN — tsc, 0 errors |
| `pnpm --filter domain test` | 71 files, **799 tests PASSED** |
| `pnpm --filter api build` | CLEAN — 0 issues, 298 files compiled |
| `pnpm --filter api test` | 70 files, **646 tests PASSED** (72 total files, 2 files failed — 6 pre-existing failures: postgres-admin.service + ensure-institution-levels; confirmed NOT regressions) |

---

## Tasks

All 32 tasks marked [x]; code state matches tasks.md.

---

## Spec Conformance

| Spec | Result |
|------|--------|
| normalized-valuation-model (MVM-1 to MVM-6) | PASS — slim parent (courseCycleId, no flat cols), lazy child (unique valuationId+periodItemId, grade snapshot) all implemented and tested |
| auto-creation-trigger (ACT-1 to ACT-7) | PASS — all scenarios except ACT-5 test gap (see W1, subsequently CLOSED) |
| grade-period-endpoint (GPE-1 to GPE-9) | PASS — all 9 scenarios tested; HTTP mapping 200/404/400 correct; boletin invalidation wired |
| migration-integrity (MI-1 to MI-10) | PASS — all FK behaviors (RESTRICT×2, CASCADE×2, SetNull×1) correct in migration.sql and schema |

---

## WARNING W1 — ACT-5 test missing (CLOSED via apply-progress)

Task T2.12 required: "Add: ACT-5 case — autoCreateUC rejects → GenerateCourseCycles still returns success."
The test was absent during initial verify. Subsequently CLOSED: test added to
`api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts`:
_"succeeds even when autoCreateUC.execute rejects (fire-and-forget isolation)"_ — asserts
result.created === 1 and result.total === 1 with a rejecting `execute` mock.

**Status: CLOSED.**

---

## WARNING W2 — Module wiring structural smell (ACCEPTED)

`PrismaGradeScaleRepository`, `PrismaGradingPeriodRepository`, `PrismaCourseCycleRepository`
are registered directly in `PedagogyModule` (not imported from `GradingModule`/`CourseCycleModule`).

**Root cause**: `GradingModule` has zero exports; importing `CourseCycleModule` would create
circular dependencies. All three repos are stateless (`TenantContext.getClient()` pattern).

**Assessment**: FUNCTIONALLY CORRECT — duplicate instances are harmless.
Structural smell: home modules should export repos for external consumption.
Severity: WARNING, not CRITICAL.

**Resolution**: Documented as ACCEPTABLE for Fase 3. Proper export extraction deferred.

---

## SUGGESTION S1

`PrismaCompetencyPeriodValuationRepository.findByValuationAndPeriod` uses `findFirst()` instead
of `findUnique()` with compound unique key. Functionally equivalent; `findUnique` is more semantic
and index-optimal. No action required.

## SUGGESTION S2

Spec field tables use `Int PK + uuid String` convention; actual schema uses project convention
`String @id @default(uuid())`. `tasks.md` encodes the override correctly. Spec tables are
misleading for future readers but no behavior impact. No action required.

---

## Deep-Dive Critical Logic (verified in code)

- **CompetencyValuation**: `id String PK`, `competencyId`, `studentId`, `courseCycleId`, `active`,
  `deletedAt`. No flat cols. `@@unique([studentId, competencyId, courseCycleId])`. ✓
- **CompetencyPeriodValuation**: `id String PK`, `valuationId→Valuation CASCADE`,
  `periodItemId→TemplateItem RESTRICT`, `gradeScaleValueId→ScaleValue SetNull`, `gradeCode`/`internalStatus`
  snapshots, `modificable`/`imprimible`. `@@unique([valuationId, periodItemId])`. ✓
- **Migration.sql**: all 13 flat cols dropped, `courseCycleId NOT NULL FK→course_cycles.uuid RESTRICT`,
  new unique triple, child table created with correct FK matrix. ✓
- **Old cycle-blind methods**: `executeForSubjectAssignment`/`executeForEnrollment`/`executeForNewEnrollment`
  absent except one comment line in `competency.use-cases.ts:188`. ZERO runtime refs. ✓
- **GradePeriodValuationUC**: 9-step pseudocode from design §7 correctly implemented.
  `findValueById` BEFORE `findActiveByLevelModality` (spec order preserved). Lock check inside
  entity (`assignGrade`/`clearGrade`) — functionally equivalent to spec ordering. ✓
- **Flat-field audit**: `rg` result → only 2 code-comment lines, ZERO runtime refs. ✓
- **Fase-4 boundary**: no `Enrollment→CourseCycle` FK in schema. ✓

---

## Recommendation

`sdd-archive` approved. W1 closed (test added). W2 accepted (documented). 0 CRITICAL.
