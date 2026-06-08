# Archive Report — competency-grading-ui (Fase 3b)

**Archived**: 2026-06-09  
**Verdict**: PASS WITH WARNINGS (0 CRITICAL)  
**Tasks**: 22/22 complete  
**Engram observation IDs**: proposal/spec/design/tasks (openspec files); apply-progress #860; verify-report-backend #863; verify-report-final #866

---

## Summary

Fase 3b delivers the competency grading UI end-to-end, making the grading epic usable for the first time. It adds three backend read capabilities (bulk valuations read, students-by-cycle, modality on single GET) and two frontend features (3-level cascade selector, competency grading grid with optimistic per-cell save).

This change makes Fase 3 usable end-to-end. Users can now navigate to `/competency-grading`, select an academic cycle → course cycle → subject, and grade competencies per student per period.

---

## Artifacts in this archive folder

| File | Source |
|------|--------|
| `proposal.md` | Active change — copied verbatim |
| `design.md` | Active change — copied verbatim |
| `tasks.md` | Active change — all 22 tasks [x] |
| `specs/bulk-valuations-read/spec.md` | Delta spec — merged into main |
| `specs/students-by-cycle/spec.md` | Delta spec — merged into main |
| `specs/course-cycle-modality/spec.md` | Delta spec — merged into main |
| `specs/course-cycle-subject-selector/spec.md` | UI delta spec — archived only (no backend main spec) |
| `specs/competency-grading-grid/spec.md` | UI delta spec — archived only (no backend main spec) |
| `specs/valuations-tab-cleanup/spec.md` | UI delta spec — archived only (no backend main spec) |
| `verify-report-final.md` | Written from engram #866 |
| `archive-report.md` | This file |

---

## Main Spec Merges

### openspec/specs/competency-valuations/spec.md

**Added**: Full `Requirement: Bulk Read — Parent Valuations + Period Children (Fase 3b)` section including:
- `GET /v1/competency-valuations?courseCycleId=&studyPlanSubjectId=` endpoint definition
- Both params required → 400
- Response shape: `{ data: [{ valuationId, studentId, competencyId, periodValuations: [...] }] }`
- Processing contract (4 steps)
- HTTP mapping table
- Scenarios BVR-1 through BVR-6
- Endpoint table row updated (replaced "Fase 4 read shape TBD" with concrete bulk-read + legacy-student-read rows)

### openspec/specs/course-cycle/spec.md

**Added**:
1. `Requirement: modality in CourseCycle Single Response (Fase 3b)` section:
   - `GET /v1/course-cycles/:uuid` now returns `modality: <number|null>` (numeric, NOT string)
   - Scenarios CCM-1 and CCM-2
2. `Requirement: Enrolled Students for a CourseCycle (Fase 3b)` section:
   - `GET /v1/course-cycles/:uuid/students` endpoint
   - Response: `{ data: [{ studentId, firstName, lastName }] }`
   - Derived (no explicit Enrollment→CourseCycle FK — Fase 4)
   - HTTP mapping table
   - Scenarios SBC-1, SBC-2, SBC-3
3. Endpoint table: added `GET /v1/course-cycles/:uuid/students` row
4. GET single description updated: notes `modality` inclusion

### Frontend delta specs (no main spec merge)

`course-cycle-subject-selector`, `competency-grading-grid`, and `valuations-tab-cleanup` are purely UI behavior specs. There is no `openspec/specs/` main spec for frontend components — they are captured verbatim in the archive folder. This is correct and intentional.

---

## Implementation Notes

### Grid save model (W-saveAll / S2)

The grid uses **optimistic per-cell PATCH + retry-on-failure** (not deferred bulk-dirty save).

- `updateCell()` fires an immediate PATCH on dropdown change: `idle → saving → idle|error`
- `saveAll()` ("Guardar todo" button) collects `error` cells and retries them in bounded-parallel chunks of 5
- `CellState.saveState = 'dirty'` is **dead code** in the normal update path (never set by `updateCell`)
- This is a better UX than deferred bulk save and is consistent with Design D3 (optimistic saving)
- Residual: `'dirty'` in the saveState union type is minor debt (S2) — deferred to Fase 4 or tech-debt cleanup

### Student list derivation

Students are derived via the existing `findEnrolledStudentIds` heuristic join (CourseCycle → CourseSection → Enrollment). There is **no explicit Enrollment→CourseCycle FK** until Fase 4. This is documented in both the spec and the verify report.

### modality is numeric

`modality` is a numeric code (e.g., `0` for COMUN) throughout — in the API response, in the frontend context type (`CourseCycleSelectionContext.modality: number | null`), and in tests. The earlier spec example showing `"modality": "COMUN"` (string) was corrected in the main spec merge.

---

## Test Gates

| Gate | Result |
|------|--------|
| `pnpm --filter web test` | 226/226 PASS |
| `pnpm --filter web lint` | 0 errors |
| `pnpm --filter api test` | 679/685 (6 pre-existing postgres-admin failures, confirmed not regressions) |
| `pnpm --filter api build` | 0 TSC errors, 301 files |

---

## Commit Status

Working tree was uncommitted at archive time. User commits separately (conventional commits, no AI attribution per project rules).

---

## What Fase 4 Must Address

1. **Enrollment→CourseCycle FK**: Replace derived student-list join with a proper FK. The `/v1/course-cycles/:uuid/students` endpoint stays but the implementation changes.
2. **`'dirty'` saveState debt**: Either document as "reserved for offline support" or remove from `CellState` type in `use-grading-grid.ts`.
3. **Libreta / boletín / report cards**: Next major epic. Depends on Fase 3 grading being usable (now done).

---

## Engram References

| Artifact | ID |
|----------|-----|
| apply-progress (22/22 tasks, 4 PRs) | #860 |
| verify-report-backend (PR1a + PR1b) | #863 |
| verify-report-final (all 4 PRs) | #866 |
| archive-report | saved at archive time (topic: sdd/competency-grading-ui/archive-report) |
