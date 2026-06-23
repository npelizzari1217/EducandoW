# Verify Report — asistencia-desde-alumnos-curso

Date: 2026-06-23 (re-verify after CRIT-1 fix)
Verdict: PASS (0 CRITICAL, 0 WARNING, 0 SUGGESTION)

## Test Results

- api: 163 files, 1574 tests passed (0 failures) [cached — no backend changes]
- web: 43 files, 451 tests passed (0 failures)
- pnpm build: clean, 198 modules, 0 TypeScript errors
- tsc -b (web): exit 0, no errors

## CRIT-1 — RESOLVED

**REQ-A1/REQ-A2: "Ver asistencia" button now visible in production path**

Fix confirmed in AlumnosCursoCicloPanel.tsx:
- Header block (title + close button) remains guarded by `{!embedded && (` at line 217 — correct (Modal provides its own title).
- "Ver asistencia" button at lines 236–247 is NOW outside the `{!embedded && ...}` guard, gated only by `{can('ATTENDANCE','READ') && (` — renders in both embedded and non-embedded modes.
- course-cycles.tsx line 412 passes `embedded` (= true) — this panel now shows the button when the user holds ATTENDANCE READ.

Tests W-19/W-20/W-21 updated to pass `embedded={true}` (production path):
- W-19: `renderPanel('cc-1', vi.fn(), true)` — asserts btn-ver-asistencia visible when ATTENDANCE READ present.
- W-20: `renderPanel('cc-1', vi.fn(), true)` — asserts btn-ver-asistencia absent when no ATTENDANCE READ.
- W-21: `renderPanel('cc-abc', vi.fn(), true)` — asserts navigate called with `/asistencia-mensual?ccId=cc-abc`.

No longer false positives. Production path is covered.

## All REQs — PASS

- REQ-A1/REQ-A2: button rendered outside embedded guard, gated by ATTENDANCE READ — PASS
- REQ-A3: useSearchParams + useRef one-shot guard + async-safe pre-selection — PASS
- REQ-A4: no regression without ccId — PASS
- REQ-B1/B2: both DTOs include studentName: string — PASS
- REQ-B3: single Prisma include query, no N+1 — PASS
- REQ-B4: orderBy [lastName asc, firstName asc] in both repos — PASS
- REQ-B5: no new Prisma migration file — PASS
- REQ-B6: domain entity AsistenciaXAlumnoXCursoXCiclo unchanged — PASS
- REQ-B7/B8: grid renders row.studentName, UUID not displayed — PASS
- ADR-5: PATCH paths pass studentName: '' to mapper — PASS

## Files Verified

- web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx
- web/src/pages/dashboard/course-cycles.tsx
- web/src/pages/dashboard/__tests__/alumnos-curso-ciclo-panel.test.tsx

## Change is ready for archive
