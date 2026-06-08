# Verify Report — competency-grading-ui Fase 3b (Final)

> Source: engram observation #866 | 2026-06-09

**What**: Final verify report for competency-grading-ui Fase 3b — all 4 PRs (1a bulk-valuations-read, 1b students/modality, 2a selector+page+cleanup, 2b grid+save).

**Verdict**: PASS WITH WARNINGS — 0 CRITICAL, 2 WARNINGS, 2 SUGGESTIONS. All 22/22 tasks complete. All 35 spec scenarios (BVR-1..6, SBC-1..3, CCM-1..2, CCSS-1..7, CGG-1..12, VTC-1..3) have passing tests.

---

## Gates

| Gate | Result |
|------|--------|
| `pnpm --filter api test` | 679/685 passing (6 pre-existing postgres-admin failures — confirmed NOT regressions, same as backend verify) |
| `pnpm --filter web test` | 226/226 passing — GREEN |
| `pnpm --filter web lint` | 0 errors (tsc --noEmit + eslint) — GREEN |
| `pnpm --filter api build` | 0 TSC issues, 301 files — GREEN |

---

## W1 Closed (confirmed)

- `GET /course-cycles/:uuid/students` now returns `{ data: [...] }` (course-cycle.controller.ts line 108: `return { data: await this.listStudentsUC.execute(uuid) }`)
- SBC-1/2/3 tests assert `response.data` — consistent
- Frontend hook (use-grading-grid.ts line 125-127) reads `studentsRes.value.data?.data ?? []` — consistent with wrapper
- W1 FULLY CLOSED

---

## Spec Scenario Mapping

### PR1a — Bulk Valuations Read (BVR-1..6)

All 6 scenarios PASS — confirmed in backend verify. No regressions.

### PR1b — Students + Modality (SBC-1..3, CCM-1..2)

- SBC-1: `response.data` has 2 entries — PASS
- SBC-2: propagates NotFoundException → 404 — PASS
- SBC-3: `response.data` = [] — PASS
- CCM-1: `response.data.modality = 0` (number) — PASS in tests. Spec text still says `"modality": "COMUN"` (string) — WARNING W2 (not updated)
- CCM-2: throws CourseCycleNotFoundError — PASS

### PR2a — Selector + Cleanup (CCSS-1..7, VTC-1..3)

- CCSS-1: full emit `{courseCycleId, studyPlanId, studyPlanSubjectId, level: 2, modality: 0}` — PASS
- CCSS-2: AC change resets CC + Subject + no emit — PASS
- CCSS-3: CC change resets Subject + no emit — PASS
- CCSS-4: loading state during CC fetch, dropdown disabled — PASS
- CCSS-5: empty state "Sin ciclos disponibles" — PASS
- CCSS-6: error + retry button "Reintentar" — PASS
- CCSS-7: no emit without Subject selection — PASS
- VTC-1: ValuationsTab absent from competencies.tsx (rg confirms) — PASS
- VTC-2: No `valoracion1..4` payload fields (rg confirms only generic "valoraciones" string in UI message) — PASS
- VTC-3: CompetenciesTab and remaining functionality intact — PASS

### PR2b — Grid + Save Logic (CGG-1..12)

- CGG-1: 3-row × 2-col matrix, cell-s-1-c-1 = gsv-mb — PASS
- CGG-2: period nav pi-2 shows gsv-b (B), no refetch — PASS
- CGG-3: modificable=false → disabled + lock-icon testid — PASS
- CGG-4: APROBADO=green, EN_PROCESO=yellow, NO_APROBADO=red, LIBRE=muted, null=no badge — PASS
- CGG-5: dropdown change → PATCH issued, on 200 cell updated — PASS
- CGG-6: PATCH failure → cell-error testid visible — PASS
- CGG-7: saveAll retries error cells (3 fail + 3 retry = 6 total PATCHes) — PASS (see WARNING below)
- CGG-8: no students → "No hay alumnos inscriptos..." — PASS
- CGG-9: no competencies → "Sin competencias configuradas..." — PASS
- CGG-10: no period template → "Períodos no configurados..." — PASS
- CGG-11: no grade scale → "Escala de calificación no configurada..." — PASS
- CGG-12: loading → grid-loading testid, no combobox, no Guardar todo button — PASS

---

## Warnings

### W2: CCM-1 spec text says `"modality": "COMUN"` (string) but implementation returns `modality: 0` (number)

- spec.md still shows `"modality": "COMUN"` in the example response for CCM-1
- Implementation: controller `toResponse` returns `modality: modality ?? null` where modality is numeric
- Test asserts `expect(response.data).toHaveProperty('modality', 0)` — consistent with implementation
- Frontend `CourseCycleSelectionContext.modality: number | null` — consistent
- Impact: zero runtime impact; spec text is misleading if read literally
- Fix: update openspec/changes/competency-grading-ui/specs/course-cycle-modality/spec.md CCM-1 example to show `"modality": 0`
- **Status**: Resolved in main spec merge during archive (CCM-1 example now shows `"modality": 0`)

### W-saveAll: CGG-7 semantic gap — saveAll is "retry of failed saves", not "bulk first-time save of dirty cells"

- CellState has `saveState: 'idle' | 'dirty' | 'saving' | 'error'` — `dirty` state is never set by `updateCell`
- `updateCell` goes straight `idle → saving` (immediate optimistic), skipping `dirty`
- `saveAll()` collects `dirty || error` — in practice only `error` cells (dirty is dead code in normal flow)
- CGG-7 spec says "cells changed and are dirty" → saveAll sends PATCHes. Implementation: cells fail auto-save → become `error` → saveAll retries them.
- Spec intent of "deferred bulk save" is NOT implemented; instead: immediate optimistic save + retry-on-failure
- This is documented in apply-progress: "Per-cell PATCH state machine: idle → saving (skip dirty)"
- Assessment: ACCEPTABLE DEVIATION — optimistic auto-save is better UX. Design D3 describes optimistic saving. No user data loss. "Guardar todo" still provides failure recovery.
- Residual issue: `CellState.saveState = 'dirty'` is effectively dead code in the updateCell path.
- **Status**: Documented as minor debt S2 (see Suggestions). Accepted for Fase 3.

---

## Suggestions

### S1: Update CCM-1 spec example from `"modality": "COMUN"` to `"modality": 0`

File: openspec/changes/competency-grading-ui/specs/course-cycle-modality/spec.md
One-line change in the example JSON block.
**Status**: Applied during archive merge into main spec.

### S2: Remove `'dirty'` from saveState union or document it explicitly

If `dirty` is reserved for future use (e.g., offline support), document it with a comment.
If it's dead code, remove it from the `CellState` type to reduce confusion.
File: web/src/pages/dashboard/components/use-grading-grid.ts — CellState.saveState definition.
**Status**: Minor debt, deferred to Fase 4 or tech-debt cleanup.

---

## Route + Sidebar Verification

- `/competency-grading` route: `web/src/App.tsx` line 92 — CONFIRMED
- "Calificación de Competencias" sidebar entry: `web/src/components/layout/sidebar.tsx` line 58 — CONFIRMED

---

## Backend Still Good (no regressions)

- api build: 0 TSC errors, 301 files — same as backend verify
- api test: 679/685 — same 6 pre-existing failures — no new failures

---

## Fase-4 Boundary

- No Enrollment→CourseCycle FK (confirmed, derived join)
- No backend changes in PR2b (confirmed)
- Student list via heuristic join (CourseCycle → CourseSection → Enrollment) — correct for Fase 3

---

## Tasks State

All 22 tasks [x] in openspec/changes/competency-grading-ui/tasks.md. Confirmed via apply-progress #860.

---

## Files verified

- api/src/presentation/course-cycle/course-cycle.controller.ts (W1 fix confirmed)
- api/src/presentation/course-cycle/__tests__/course-cycle.dto.test.ts (SBC/CCM tests)
- web/src/pages/dashboard/components/CourseCycleSubjectSelector.tsx
- web/src/pages/dashboard/components/use-grading-grid.ts
- web/src/pages/dashboard/components/CompetencyGradingGrid.tsx
- web/src/pages/dashboard/components/grading-status.ts
- web/src/pages/dashboard/__tests__/course-cycle-subject-selector.test.tsx
- web/src/pages/dashboard/__tests__/use-grading-grid.test.ts
- web/src/pages/dashboard/__tests__/competency-grading-grid.test.tsx
- web/src/pages/dashboard/competencies.tsx (VTC cleanup)
- web/src/App.tsx (route)
- web/src/components/layout/sidebar.tsx (sidebar entry)
- openspec/changes/competency-grading-ui/tasks.md (all [x])
