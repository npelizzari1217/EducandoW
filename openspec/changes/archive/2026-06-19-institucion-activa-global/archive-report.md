# Archive Report: institucion-activa-global

> Phase: sdd-archive · Store: hybrid · 2026-06-19
> Branch: chore/archive-institucion-activa-global (merged to main via PR #41)
> Verdict: PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 2 SUGGESTION)
> Warnings resolved: W-02 resolved per ADR-3 (intentional MVP deferral); S-02 resolved per ADR-3. W-01 and S-01 are cosmetic/design-decision variants, not regressions. All confirmed non-blocking by orchestrator before archive.
> Archived to: openspec/changes/archive/2026-06-19-institucion-activa-global/

---

## What Shipped

**Institución Activa Global (ROOT) — centralized active-institution state + axios interceptor.**

Before this change, ROOT users had no tenant in their JWT (`dbName: null`, `institutionId: null`). The frontend solved this ad-hoc on ~11 pages, each with an inline `<select>` that manually threaded `institutionId` into API calls. This caused two production bugs: (1) Carreras de terciario lacked a selector → 403 (fixed inline, PR #31); (2) `CourseCycleForm.tsx` issued its own GETs without `institutionId` even when its parent page had a selector.

This change establishes a single, centralized mechanism:

- **`web/src/api/active-institution.ts`** — localStorage-backed store (lazy init, rehydrated before first API call). State shape: `string | null` (ID only, per ADR-2).
- **`web/src/api/active-institution-context.tsx`** — React context provider wrapping the app shell; exposes store to consumers without prop-drilling.
- **`web/src/components/ActiveInstitutionSelector.tsx`** — single global `<select>` in the top bar, visible only to ROOT. Fetches `/institutions` on mount, writes selection to store + localStorage.
- **`web/src/api/client.ts`** — axios request interceptor updated to call `applyActiveInstitution()`: injects `?institutionId=<activeId>` when ROOT and store is non-null; preserves explicit call-site values (no override); no-op for non-ROOT.

**Test result:** 409/409 passing (pnpm --filter web test). 0 TypeScript errors. All 13 tasks complete. Coverage on new files ≥ 80%.

---

## Key Architecture Decisions

| ADR | Decision |
|-----|----------|
| ADR-1 | Pattern mirrors existing `token.ts` + request interceptor in `client.ts`. New files stay under `web/src/api/` for consistency. |
| ADR-2 | State shape narrowed to `string \| null` (ID only). Selector re-fetches list from `/institutions` on mount; interceptor only needs the ID. Original spec said `{ id: string; name: string } \| null`. This is a deliberate narrowing — W-01 in verify-report. |
| ADR-3 | REQ-04 "MUST NOT auto-dispatch" request guard deferred for MVP. When ROOT has no selection, the interceptor is a no-op and requests fire; backend returns 403. The selector placeholder is the "actionable prompt". Guard is DEFERRED-1. W-02 + S-02 in verify-report. |

---

## Canonical Specs Synced

| File | Change |
|------|--------|
| `openspec/specs/active-institution/spec.md` | NEW — full canonical spec. No prior canonical spec existed for this capability; the delta spec IS the new canonical spec. Includes implementation ADRs and deferred items section. |

**Merge decision**: No existing canonical spec covered web-only ROOT tenant-selection or axios interceptor injection. The nearest candidates (`multi-tenant-routing/spec.md` — backend NestJS middleware, `token-storage/spec.md` — localStorage token key, `auth-access/spec.md` — backend RBAC) are orthogonal. A new capability spec `active-institution` was created.

---

## Deferred Items (carry-forward)

### DEFERRED-1 — Request guard for ROOT without selection (REQ-04 partial)

When ROOT has no active institution and navigates to a tenant-scoped page, requests fire without `institutionId` → backend 403. The selector placeholder (actionable prompt) is in place but no hard guard blocks the dispatch. A future change must add a guard (route guard or context-level gate) to prevent the requests from firing at all.

### DEFERRED-2 — Cleanup of ~11 inline institution selectors (REQ-06)

The existing inline selectors still work correctly thanks to the interceptor's call-site precedence rule. Progressive cleanup is a follow-up task; it is NOT a correctness requirement and does not block this change.

---

## Verify Report Summary

**Verdict:** PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 2 SUGGESTION)

- W-01: State shape `string | null` vs spec `{ id: string; name: string } | null` — intentional per ADR-2. Not a regression.
- W-02: REQ-04 request guard not implemented — intentional per ADR-3 (MVP deferral).
- S-01: App.tsx indentation inconsistency (cosmetic).
- S-02: No deselect path in selector — related to ADR-3 scope decisions.

---

## Engram Artifact IDs

| Artifact | Topic Key | Engram ID |
|----------|-----------|-----------|
| Proposal | sdd/institucion-activa-global/proposal | #1220 |
| Spec (delta) | sdd/institucion-activa-global/spec | #1221 |
| Design | sdd/institucion-activa-global/design | #1223 |
| Tasks | sdd/institucion-activa-global/tasks | #1226 |
| Apply progress | sdd/institucion-activa-global/apply-progress | #1227 |
| Verify report | sdd/institucion-activa-global/verify-report | #1229 |
| Archive report | sdd/institucion-activa-global/archive-report | (this file) |

---

## Files Changed (implementation — web only)

- `web/src/api/active-institution.ts` (new — localStorage store, lazy init)
- `web/src/api/__tests__/active-institution.test.ts` (new — 3 store tests)
- `web/src/api/active-institution-context.tsx` (new — React context provider)
- `web/src/api/__tests__/active-institution-context.test.tsx` (new — context tests)
- `web/src/components/ActiveInstitutionSelector.tsx` (new — global ROOT selector)
- `web/src/components/__tests__/ActiveInstitutionSelector.test.tsx` (new — selector tests)
- `web/src/api/client.ts` (updated — axios interceptor injects institutionId)
- `web/src/api/__tests__/client.test.ts` (updated — interceptor coverage)
- `web/src/App.tsx` (updated — ActiveInstitutionProvider + selector in shell)
- `web/src/App.test.tsx` (updated — provider in test tree)

---

## Next Steps

- **DEFERRED-1**: Add route guard for ROOT without active institution (REQ-04 full enforcement).
- **DEFERRED-2**: Progressive cleanup of ~11 inline institution selectors.
- No immediate follow-up blocking merges. PR #41 is merged to main.
