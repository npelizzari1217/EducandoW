# Verify Report — asistencia-dias-bloqueados

**Date:** 2026-06-23
**Verdict:** PASS
**Findings:** 0 CRITICAL · 0 WARNING · 2 SUGGESTION

---

## Gate Results (real numbers)

| Gate | Result |
|------|--------|
| `pnpm --filter @educandow/domain test` | 101 files, 1140 tests — GREEN |
| `pnpm --filter api test` | 166 files, 1631 tests — GREEN |
| `pnpm --filter web test` | 43 files, 461 tests — GREEN |
| `pnpm exec turbo run build --force` | 3 workspaces GREEN (domain, api, web+rollup) |
| `pnpm --filter api typecheck` | 0 errors |

---

## AC Verification

### Domain (AC-01, AC-02, AC-17)

**AC-01** — `packages/domain/src/asistencia/utils/calendar-utils.ts` exists and exports `daysInMonth`, `dayOfWeek`, `buildLockedDayMap`. Pure TS, zero external deps. Exported via `asistencia/index.ts` and root `index.ts`. 12 unit tests cover UTIL-1..UTIL-12 including timezone safety test. PASS.

**AC-02** — No local `daysInMonth` definition found outside of `calendar-utils.ts` in any implementation file (confirmed with `rg "function daysInMonth|const daysInMonth"`). The three former copies have been replaced:
- `record-general-attendance-day.use-case.ts` → imports from `@educandow/domain`
- `record-subject-attendance-day.use-case.ts` → imports from `@educandow/domain`
- `asistencia-mensual.tsx` → imports from subpath `@educandow/domain/asistencia/utils/calendar-utils` (see SUGGESTION-1)
PASS.

**AC-17** — Verified by UTIL-9 (Feb 2025: 28 days, keys 29/30/31 → X), UTIL-10 (Feb 2024: 29 days, key 29 absent, 30/31 → X). Tests pass. Calendar logic in `buildLockedDayMap` correctly iterates 1..31 and checks `d > daysInMonth`. PASS.

---

### Generation (AC-03, AC-04, AC-05, AC-06)

**AC-03** — `generate-monthly-attendance.use-case.ts` calls `buildLockedDayMap(year, month)` once and passes `days: lockedMap` to all rows in both `generalRows` and `subjectRows` arrays (lines 99, 111, 133). PASS.

**AC-04** — `lockedMap` injected into both `generalRepo.generateMany(generalRows)` (general mode) and `materiaAsistRepo.generateMany(subjectRows)` (Por Materia mode). PASS.

**AC-05** — Both `prisma-asistencia-general.repository.ts` and `prisma-asistencia-materia.repository.ts` implement read-merge-write with `mergeLocked = { ...existing, ...(locked ?? {}) }`. Since `lockedMap` never contains hábil-day keys, existing hábil entries are preserved. PASS.

**AC-06** — Partition logic: `toCreate = rows.filter(r => !existingByStudent.has(r.studentId))`. New students get `days: r.days ?? {}` (full lockedMap) via `createMany`. Re-generated students get merge. PASS.

---

### Guards (AC-07..AC-12)

**AC-07** — `record-general-attendance-day.use-case.ts` step 4: `const dow = dayOfWeek(year, month, day); if (dow === 0 || dow === 6) throw new DayNotAssignableError(...)`. Code `DAY_NOT_ASSIGNABLE` → 422 via exception filter. Symmetric in `record-subject-attendance-day.use-case.ts`. PASS.

**AC-08** — Step 3: `const maxDay = daysInMonth(year, month); if (day > maxDay) throw new DayNotAssignableError(...)`. Code `DAY_NOT_ASSIGNABLE` → 422. PASS.

**AC-09** — Step 6: `if (!type.assignable) throw new StatusNotAssignableError(...)`. Code `STATUS_NOT_ASSIGNABLE` → 400 via exception filter. PASS.

**AC-10** — Happy path: `this.generalRepo.setDay(row.id.get(), day, statusCode)` executed when all guards pass (weekday, within month, assignable code). PASS.

**AC-11** — Guards call `daysInMonth(year, month)` and `dayOfWeek(year, month, day)` from domain. No `row.days` read for day-type determination. Guard test GUARD-9 confirms: even when `days` JSONB doesn't contain key "4", a Saturday is still rejected. PASS.

**AC-12** — Both use cases implement the identical 6-step guard sequence importing from `@educandow/domain`. Verified by reading both files; `record-subject-attendance-day` mirrors general. PASS.

---

### Filter/Envelope (AC-19)

**AC-19** — `exception.filter.ts`:
- `DOMAIN_STATUS` map includes `DAY_NOT_ASSIGNABLE: 422` and `STATUS_NOT_ASSIGNABLE: 400`
- `DomainError` catch branch: `code = exception.code`
- Response: `{ error: { status, code, message } }`
- `code` is `undefined` for `HttpException` paths (confirmed by FILTER-4 test)
- Existing `error.status` field preserved (backward-compatible — see SUGGESTION-2)
PASS.

---

### Frontend (AC-13..AC-16)

**AC-13** — `const dayColumns = Array.from({ length: 31 }, (_, i) => i + 1)` — fixed 31 columns. GRID-1 test asserts exactly 31 `columnheader` elements with numeric text. PASS.

**AC-14** — Per-cell logic:
```ts
const isLockedByCode = at?.assignable === false;
const isNonExistent = d > numDays;
const locked = isLockedByCode || isNonExistent;
```
Locked: renders `<span data-testid="cell-locked-{studentId}-{d}" style={cellLockedStyle}>{code ?? '—'}</span>`. No `<select>`. PASS.

**AC-15** — Lock decision uses `at?.assignable === false` (flag from API response), not a hardcoded list. GRID-6 test adds a custom `CUSTOM (assignable:false)` type and verifies it's excluded from combo without hardcoding the code name. PASS.

**AC-16** — Combo: `attendanceTypes.filter((t) => t.active && t.assignable).map((t) => t.code)`. Only active+assignable codes shown. GRID-5 confirms "SAB", "DOM", "X" absent from options. PASS.

---

### No migration (AC-18)

**AC-18** — Prisma migration directory checked. Latest migrations: `20260623110000_rolcurso_roles_extendidos` (unrelated). No new migration files for asistencia-dias-bloqueados. `days` JSONB column existed prior to this change. PASS.

---

## Task Completeness

All tasks T1.1 through T8.2 in `tasks.md` are marked `[x]`. No unchecked `[ ]` items remain.

---

## Findings

### SUGGESTION-1 — Frontend import uses subpath, not barrel
**File:** `web/src/pages/dashboard/asistencia-mensual.tsx:33`
**AC:** AC-02 (adjacent)
**Detail:** Component imports `from '@educandow/domain/asistencia/utils/calendar-utils'` (subpath) instead of `from '@educandow/domain'` (barrel). Tasks spec said `import { daysInMonth } from '@educandow/domain'`. This was a deliberate architectural decision (documented in apply-progress): the domain compiles to CJS and Rollup cannot detect named exports statically from the barrel due to re-export chains. The alias in `vite.config.ts` maps the subpath to the TS source, and the `package.json` exports map provides the compiled CJS for Vitest. Both paths are functionally identical; build and tests are green.
**Action:** No action required. Could be documented as a project convention (web imports domain calendar utils via subpath, not barrel).

### SUGGESTION-2 — Envelope includes `status` in addition to spec-required `code`
**File:** `api/src/presentation/shared/filters/exception.filter.ts:95-100`
**AC:** AC-19
**Detail:** The response envelope is `{ error: { status, code, message } }`. The spec only requires `{ error: { code, message } }`. The extra `status` field is a deliberate backward-compatible addition (ADR-D6) to avoid breaking existing consumers that read `error.status`. Tests assert both `error.status` and `error.code` are present. No regression risk; the spec requirement is fully met.
**Action:** No action required. If consumers ever need cleanup, `status` can be removed in a future breaking change.

---

## Summary

All 19 Acceptance Criteria (AC-01..AC-19) are satisfied by the implementation. The full test suite (1140 + 1631 + 461 = 3232 tests across domain, api, web) is GREEN. Build passes in all 3 workspaces including the production Rollup build that previously had CJS/ESM issues. Typecheck reports 0 errors. No Prisma schema migrations were introduced. All T1..T8 tasks are marked complete in tasks.md.
