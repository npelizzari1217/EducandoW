# Verify Report — institucion-activa-global

**Date**: 2026-06-19
**Verdict**: PASS WITH WARNINGS
**Test run**: 409/409 passed (pnpm --filter web test)
**TypeScript**: 0 errors (tsc --noEmit)
**Mode**: Strict TDD

---

## Findings

### CRITICAL (0)

None.

### WARNING (2)

**W-01 — REQ-01 state shape deviation**
- Spec says: `{ id: string; name: string } | null`
- Implementation exposes: `activeId: string | null` (ID only; name not stored/exposed)
- Design document explicitly chose this narrower shape (mirrors token.ts, interceptor only needs ID). Current use cases don't require the name via context (selector re-fetches from `/institutions` on mount). Not a functional regression but deviates from the stated spec shape.
- Intentional per ADR-2. Does not block archive.

**W-02 — REQ-04 "MUST NOT auto-dispatch tenant requests" not enforced**
- Spec says: ROOT without selection MUST NOT auto-dispatch tenant requests.
- Implementation: when ROOT has no active institution, page content loads and API calls fire without `institutionId`. The interceptor is a no-op (store is null), so requests go out without the param. Backend may return 403 for tenant-scoped routes.
- The selector shows "Seleccionar institución" placeholder (the "actionable prompt"), but there is no route guard blocking requests.
- Intentional per ADR-3 ("zero per-page coordination for MVP"). Does not block archive.

### SUGGESTION (2)

**S-01 — App.tsx indentation inconsistency**
- `ActiveInstitutionProvider`'s children are not indented one extra level relative to the provider tag. Purely cosmetic.

**S-02 — No deselect path in selector**
- `onChange` guard `if (e.target.value)` prevents calling `setActive('')`, so a ROOT user who has already selected an institution cannot revert to "no selection" via the placeholder option. If deselect is ever needed, this needs to be revised.

---

## Requirement Check Matrix

| Req   | Status | Notes |
|-------|--------|-------|
| REQ-01 | WARNING | Storage + lazy init + logout clear: ✓. State shape narrowed to `string | null` (design decision). |
| REQ-02 | PASS | Selector ROOT-only, fetches /institutions, placeholder when null, reload on select. |
| REQ-03 | PASS | `applyActiveInstitution`: injects when `== null`, preserves explicit `''` and explicit values, no-op when store empty. Client.ts calls it after auth header. |
| REQ-04 | WARNING | Placeholder shown (actionable prompt ✓). Request guard NOT implemented (deferred, ADR-3). |
| REQ-05 | PASS | Non-ROOT never writes store → interceptor always no-op for them. |
| REQ-06 | PASS | `existing == null` check preserves call-site values (incl. explicit `''`). |

## Acceptance Scenarios

| SC | Status | Notes |
|----|--------|-------|
| SC-01 | PASS | localStorage persist + lazy init = survives reload. |
| SC-02 | PASS | Interceptor injects when no call-site institutionId. |
| SC-03 | PASS | Non-ROOT: store null → no inject. |
| SC-04 | PARTIAL | Prompt shown ✓. Request guard deferred (W-02). |
| SC-05 | PASS | Explicit call-site value preserved via `== null` check. |
| SC-06 | PASS | ROOT with selection + /institutions request: interceptor injects but backend ignores extra param. |

## Coverage (new files)

| File | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| active-institution.ts | 100% | 100% | 100% | 100% (inferred — not in truncated table) |
| active-institution-context.tsx | 94.73% | 50% | 100% | 100% |
| active-institution-selector.tsx | 100% | 75% | 83.33% | 100% |

All new files meet ≥80% threshold. Branch gaps: context line 58 (unreachable error throw) and selector lines 21/28/39 (error/empty branches).

## Tasks

All 13 tasks: [x] complete. Code state matches task list.

## Next

sdd-archive — no blocking issues.
