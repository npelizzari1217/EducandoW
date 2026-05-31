# Proposal: Institution Filter — Consistent Pattern Across All Modules

## Intent

The institution filter combobox behaves inconsistently across dashboard modules. `study-plans.tsx` skips fetching institutions for non-ROOT users and defaults ROOT to an empty selection. `teachers.tsx` uses a disabled `<select>` instead of a disabled `<input>`. Neither matches the canonical pattern established in `users.tsx` and `students.tsx`. Additionally, the current ROOT default shows "all institutions" (empty), but the desired behavior is to default to the **first institution** to avoid accidental cross-tenant data exposure.

Pedagogical level: ALL.

## Scope

### In Scope
- Align `study-plans.tsx` institution filter to the canonical pattern (ROOT=dropdown defaulting to first institution; non-ROOT=disabled input showing own institution name)
- Align `teachers.tsx` to replace disabled `<select>` with disabled `<input>` for non-ROOT
- Align `enrollments.tsx` institution filter to the canonical pattern
- Change ROOT default from `""` (all) to first institution in list — applies to all aligned modules
- Fetch institutions unconditionally (remove `if (isRoot)` guards) in all affected files
- Update `study-plans/spec.md` to reflect the new ROOT default behavior

### Out of Scope
- Backend changes (no API changes required)
- `users.tsx` and `students.tsx` — already have the canonical pattern
- `legajos.tsx`, `course-sections.tsx` — no institution filter combobox
- Changing the pattern for the institution filter inside **forms** (create/edit modals)

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `study-plans`: Requirement "List Study Plans" — ROOT MUST default to first institution instead of empty (show all); non-ROOT MUST show disabled text input with institution name

## Approach

1. Extract/reuse the institution filter block from `users.tsx` as the reference implementation.
2. For each affected file (`study-plans.tsx`, `teachers.tsx`, `enrollments.tsx`):
   - Remove `if (isRoot)` guard around institution fetch
   - Initialize `institutionId` state to `userInstitutionId` (non-ROOT) or `""` (ROOT — resolved to first institution after fetch)
   - In `useEffect` after institutions load: if ROOT and `institutionId` is `""`, set to `institutions[0]?.id ?? ""`
   - Replace non-ROOT disabled `<select>` with `<input type="text" disabled value={...institution name...} />`
3. Write delta spec under `specs/study-plans/` for the changed requirement.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web/src/pages/dashboard/study-plans.tsx` | Modified | Add unconditional institutions fetch, default ROOT to first inst, add non-ROOT disabled input |
| `web/src/pages/dashboard/teachers.tsx` | Modified | Replace non-ROOT disabled `<select>` with disabled `<input>`, default ROOT to first inst |
| `web/src/pages/dashboard/enrollments.tsx` | Modified | Align to canonical pattern; default ROOT to first inst |
| `openspec/changes/11-institution-filter-study-plans/specs/study-plans/spec.md` | New (delta) | Updated scenario for ROOT default in List Study Plans |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ROOT loses ability to see all institutions at once | Med | Accepted — product decision; can add "Todas" option back via separate change |
| `enrollments.tsx` filter uses nested `filters` state (not flat `institutionId`) | Low | Adapt pattern to update `filters.institutionId` instead of standalone state |
| Existing tests for `students.tsx` / `users.tsx` break if shared logic diverges | Low | No shared component extracted — each file updated in isolation |

## Rollback Plan

All changes are presentation-layer only. Revert the three `.tsx` files to their prior state via git. No DB migrations or API changes are involved.

## Dependencies

- None — institutions endpoint `GET /v1/institutions` already exists and is used by the canonical modules.

## Success Criteria

- [ ] ROOT opening `study-plans`, `teachers`, or `enrollments` sees first institution selected by default (not empty)
- [ ] Non-ROOT opening any of those pages sees a disabled text input with their institution name
- [ ] Institutions are fetched unconditionally in all three files (no `isRoot` guard)
- [ ] Delta spec for `study-plans` updated to reflect new ROOT default requirement
- [ ] No regression in existing `students.test.tsx` or `users.test.tsx`
