# Verify Report: optativas-inscripcion — PR3 (web UI)

> Phase: sdd-verify
> Date: 2026-06-22
> Branch: feat/optativas-pr3-web
> Store: hybrid
> Scope: PR3 web UI slice + holistic sanity (PR1+PR2+PR3)

---

## Verdict

**PASS WITH WARNINGS**

- CRITICAL: 0
- WARNING: 1
- SUGGESTION: 1

PR3 is safe to commit and open a PR. The full change is ready for sdd-archive.

---

## Test Suite Results

| Suite | Files | Tests | Result |
|-------|-------|-------|--------|
| web (pnpm --filter web test) | 43 | 433 | ALL GREEN |
| web typecheck (tsc --noEmit) | — | — | exit 0, 0 errors |

The 7 new GGO tests (GGO-T1 through GGO-T7) all pass.

---

## Test Assertion Audit (GGO-T1 through GGO-T7)

Each test was read and traced against the implementation — not just counted.

| Test | What it asserts | Correct? |
|------|-----------------|----------|
| GGO-T1 | `data-testid="badge-optativa-m-2"` is in the document when `esOptativa=true` | YES |
| GGO-T2 | `data-testid="badge-optativa-m-1"` is NOT in the document when `esOptativa=false` | YES |
| GGO-T3 | PATCH `/course-cycles/cc-1/materias/m-2` called with `{esOptativa: false}` (inverse of current true) | YES |
| GGO-T4 | `materiasCallCount` increments after toggle — GET materias is refetched, not optimistically updated | YES |
| GGO-T5 | GET is called with `params.eligible === 'true'` when modal opens | YES |
| GGO-T6 | POST `/course-cycles/cc-1/materias/m-2/alumnos` with `{studentId: 'stu-2'}` (eligible item's `.studentId`, not `.id`) | YES |
| GGO-T7 | DELETE `/course-cycles/cc-1/materias/m-2/alumnos/enr-1` where `enr-1` is the enrollment record id, NOT the studentId `stu-1` | YES |

No false positives. All 7 assertions target the correct behavior.

---

## Endpoint Wiring Verification

### PATCH toggle
- URL: `/course-cycles/${ccId}/materias/${materia.id}` — CORRECT per design section 6.2
- Body: `{ esOptativa: !materia.esOptativa }` — CORRECT (inverse of current value)
- File: `gestion-grupos.tsx` line 532–536

### POST add to universe
- URL: `/course-cycles/${ccId}/materias/${materiaId}/alumnos` — CORRECT per MGC-S18
- Body: `{ studentId }` — CORRECT (sends studentId, not enrollment id)
- Called via `handleMateriaModalAdd(a.studentId)` using the eligible item's `.studentId` — CORRECT
- File: `gestion-grupos.tsx` line 498–501

### DELETE remove from universe
- URL: `/course-cycles/${ccId}/materias/${materiaId}/alumnos/${enrollmentId}` — CORRECT per MGC-S19
- `enrollmentId` = `a.id` from `materiaModalInscriptos` — this is the `AlumnosXMateriaXCursoXCiclo` record id, NOT the studentId
- Called via `handleMateriaModalRemove(a.id)` — CORRECT
- File: `gestion-grupos.tsx` line 516–518

### GET eligible
- URL: `/course-cycles/${ccId}/materias/${materiaId}/alumnos` with `params: { eligible: 'true' }` — CORRECT per design D5
- File: `gestion-grupos.tsx` line 468–471

---

## Refetch-After-Toggle (The Lesson)

**PASS.** The implementation explicitly does NOT read data from the PATCH response.

```ts
// CRITICAL: PATCH response does NOT carry enriched counts/subjectName.
// Always refetch GET materias to get the full updated list.
const r = await apiClient.get(`/course-cycles/${ccId}/materias`, { params: tenantParams });
setFilterMaterias(r.data?.data ?? r.data ?? []);
```

GGO-T4 verifies this by tracking `materiasCallCount` before and after the toggle click, confirming a new GET is fired.

---

## WARNING — Authz Gating on Toggle (UI Too Restrictive vs API/Design)

**Severity: WARNING**

The design (section 7, item 4) and tasks (T3.5) specify: "ROOT/admin only — guard by the authz context already available on the page."

The API PATCH endpoint guard is `COURSE_CYCLES × UPDATE` — which the 3-door model opens for both ROOT users AND module-permitted admins.

The implementation gates the toggle exclusively by `isRoot`:

```tsx
{isRoot && (
  <input type="checkbox" data-testid={`toggle-optativa-${materia.id}`} ... />
  Optativa
)}
```

**Impact:** Module admins who hold `COURSE_CYCLES UPDATE` permission can call the PATCH endpoint directly (API is open to them), but the toggle button is hidden from them in the UI.

**Is it safe?** Yes. The restriction is conservative (too restrictive, not too permissive). No security risk.

**Is it correct per design?** No. Design explicitly said "ROOT/admin" — admins are omitted from the UI gate.

**Recommendation:** Change the visibility guard to:

```tsx
const canToggleOptativa =
  isRoot ||
  (user?.modules ?? []).some(
    (m: { moduleCode: string; actions: string[] }) =>
      m.moduleCode === 'COURSE_CYCLES' && m.actions.includes('UPDATE'),
  );
```

Then use `{canToggleOptativa && (` for the toggle. This aligns the UI with the API's authz model. Can be done as a follow-up commit on the same PR or as a separate fix-up.

---

## SUGGESTION — Add/Remove Buttons Unguarded in Modal

**Severity: SUGGESTION**

The materia-universe modal "Inscriptos" button is visible to all users (no isRoot gate). Inside the modal, the "+" (add) and "−" (remove) buttons also have no authz gate. Users without COURSE_CYCLES UPDATE/DELETE permission will see these buttons; their API calls will be rejected with 403.

For defensive UX, the add/remove affordances in the modal could be gated to users with the appropriate module permission. The API is safe regardless (server enforces auth), but showing disabled or hidden buttons to read-only users avoids a confusing "action seemed to do nothing" experience.

This is a polish item, not a blocker for PR3 or archive.

---

## Holistic Sanity (PR1 + PR2 + PR3)

| Slice | Status | Notes |
|-------|--------|-------|
| PR1 (esOptativa + cascade filter) | DONE, tests green (api: 1490 tests) | Cascade correctly filters `!m.esOptativa` for both alumno upsert and competency resolution |
| PR2 (PATCH + DELETE + eligible endpoints, 3 UCs) | DONE, tests green (api: 1517 tests) | All endpoints wired, module registered, UC logic correct |
| PR3 (web UI: badge, toggle, modal) | DONE, tests green (web: 433 tests) | All surfaces implemented, correct API call patterns |

**End-to-end flow is coherent:**
1. Admin marks materia as optativa via toggle → PATCH updates the flag
2. New cascade calls for subsequent students skip the optativa → per MGC-R8
3. Admin manually enrolls specific students via the "Inscriptos" modal → POST adds, DELETE removes by enrollment record id
4. Existing enrolled students are preserved after retroactive toggle → per MGC-R11 (no auto-cleanup)

No gaps between the three PRs were found.

---

## Task Completion (PR3)

| Task | Status |
|------|--------|
| T3.1 [TEST] — GGO test file (7 tests, RED first) | [x] |
| T3.2 [IMPL] — `esOptativa?: boolean` on Materia interface | [x] |
| T3.3 [IMPL] — Optativa badge | [x] |
| T3.4 [IMPL] — Materia-universe modal (list + add + remove) | [x] |
| T3.5 [IMPL] — Optativa toggle (PATCH + refetch) | [x] |
| T3.6 [BUILD] — pnpm test + tsc --noEmit green | [x] |

All T3.x tasks are marked complete and verified against actual code.

---

## Spec Coverage (PR3 scope)

| Requirement | Covered by | Status |
|-------------|------------|--------|
| MGC-R7 (esOptativa on entity — UI side) | Badge + Materia interface | COVERED |
| MGC-R9 (manual add/remove) | Modal POST + modal DELETE | COVERED |
| MGC-R10 (toggle via PATCH) | Toggle → PATCH → refetch | COVERED |
| MGC-R11 (no retroactive cleanup — UX note) | D6 note in the UI | COVERED |
| MGC-R12 (GET materias includes esOptativa) | Materia interface + badge reads it | COVERED (API in PR2) |

---

## Decisions

| Item | Verdict |
|------|---------|
| DELETE uses enrollment record id, not studentId | CORRECT |
| POST uses studentId from eligible list (not eligible item's `.id`) | CORRECT |
| Toggle refetches GET materias after PATCH (no optimistic update) | CORRECT |
| Toggle gated by isRoot only (design said ROOT/admin) | WARNING — too restrictive vs API/design |
| Materia-universe modal visible to all users | ACCEPTABLE (API enforces auth); SUGGESTION to gate add/remove buttons |

---

## Archive Readiness

- All tasks T1.x, T2.x, T3.x marked [x] in tasks.md
- All tests pass across the full monorepo
- No CRITICAL issues
- 1 WARNING (toggle authz) — acceptable for archive, should be tracked as follow-up
- 1 SUGGESTION — optional polish

**next_recommended: sdd-archive**
