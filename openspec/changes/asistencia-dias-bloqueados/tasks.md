# Tasks — asistencia-dias-bloqueados

**Change:** asistencia-dias-bloqueados  
**Execution mode:** Strict TDD — test-first, coverage ≥ 80%  
**Test runner:** `pnpm test` (root) / `pnpm --filter api test` (api) / `pnpm --filter @educandow/domain test` (domain)  
**Build gate:** `pnpm build` green at every phase boundary  
**Delivery strategy:** ask-on-risk — see Review Workload Forecast before running `sdd-apply`

---

## Dependency graph

```
Ph1 (domain util) ──┬──→ Ph4 (infra repos) ─────→ Ph5 (app generate)
                    │                                     ↘
Ph2 (domain errors)─┴──→ Ph6 (app guards) ────────────→ Ph7 (presentation)
Ph3 (ports) ────────┘
Ph8 (frontend) ─── requires Ph1 only; independent of Ph4–Ph7
```

- **Ph1 ‖ Ph2** — no mutual dependency; both domain-only.
- **Ph3** unlocks immediately after Ph1 + Ph2 compile (type-only change).
- **Ph4** unlocks after Ph1 (buildLockedDayMap in domain) + Ph3 (days? on port interface).
- **Ph5** unlocks after Ph1 + Ph4.
- **Ph6** unlocks after Ph1 + Ph2 (calendar-utils + error classes).
- **Ph7** unlocks after Ph2 (error classes) + Ph6 (guard implemented, confirms error codes used correctly).
- **Ph8** unlocks after Ph1 (daysInMonth from domain); frontend is otherwise independent of backend phases.

---

## Phase 1 — Domain util `calendar-utils.ts`

**Satisfies:** REQ-UTIL-1, REQ-UTIL-2, REQ-UTIL-3, REQ-UTIL-4 / Scenarios UTIL-1..UTIL-12 / AC-01, AC-02

### T1.1 [TEST] Unit tests for `daysInMonth`, `dayOfWeek`, `buildLockedDayMap`

- [x] Create `packages/domain/src/asistencia/utils/__tests__/calendar-utils.spec.ts`
- [x] `daysInMonth` — UTIL-1: `(2025, 2)` → 28 (Feb non-leap)
- [x] `daysInMonth` — UTIL-2: `(2024, 2)` → 29 (Feb leap)
- [x] `daysInMonth` — UTIL-3: `(2025, 4)` → 30 (30-day month)
- [x] `daysInMonth` — UTIL-4: `(2025, 12)` → 31 (31-day month)
- [x] `dayOfWeek` — UTIL-5: `(2025, 1, 4)` → 6 (Saturday)
- [x] `dayOfWeek` — UTIL-6: `(2025, 1, 5)` → 0 (Sunday)
- [x] `dayOfWeek` — UTIL-7: `(2025, 1, 6)` → 1 (Monday)
- [x] `dayOfWeek` — timezone safety: use component constructor `new Date(year, month-1, day)`, NOT string parse — test in UTC (CI may run UTC; component ctor uses local, avoiding ISO-string UTC shift)
- [x] `buildLockedDayMap` — UTIL-8: Jan 2025 → keys `{4:"SAB",11:"SAB",18:"SAB",25:"SAB",5:"DOM",12:"DOM",19:"DOM",26:"DOM"}`; NO key `1`,`2`,`3`,`6`; NO `"X"` entries
- [x] `buildLockedDayMap` — UTIL-9: Feb 2025 → includes `{1:"SAB",8:"SAB",15:"SAB",22:"SAB",2:"DOM",9:"DOM",16:"DOM",23:"DOM",29:"X",30:"X",31:"X"}`; NO key `28`
- [x] `buildLockedDayMap` — UTIL-10: Feb 2024 → includes `{3:"SAB",10:"SAB",17:"SAB",24:"SAB",4:"DOM",11:"DOM",18:"DOM",25:"DOM",30:"X",31:"X"}`; key `29` ABSENT (day 29 exists in 2024)
- [x] `buildLockedDayMap` — UTIL-11: Apr 2025 → includes `{31:"X"}`; key `30` ABSENT
- [x] `buildLockedDayMap` — UTIL-12: Dec 2025 → includes SAB/DOM entries; NO `"X"` keys

### T1.2 [IMPL] Create `calendar-utils.ts` — run until T1.1 is fully green

- [x] Create `packages/domain/src/asistencia/utils/calendar-utils.ts`
- [x] `daysInMonth(year, month): number` → `new Date(year, month, 0).getDate()` (month is 1-based; `month, 0` rolls back to last day of prior month)
- [x] `dayOfWeek(year, month, day): number` → `new Date(year, month - 1, day).getDay()` (component ctor, never string parse)
- [x] `buildLockedDayMap(year, month): Record<string, string>` — iterate `d = 1..31`; `d > daysInMonth` → `"X"`; `dayOfWeek === 6` → `"SAB"`; `dayOfWeek === 0` → `"DOM"`; else skip
- [x] `pnpm --filter @educandow/domain test` green

### T1.3 [IMPL] Export from domain package

- [x] Add to `packages/domain/src/asistencia/index.ts`:  
  `export { daysInMonth, dayOfWeek, buildLockedDayMap } from './utils/calendar-utils';`
- [x] Add to `packages/domain/src/index.ts`:  
  `export { daysInMonth, dayOfWeek, buildLockedDayMap } from './asistencia';`
- [x] `pnpm build` green in `packages/domain`

---

## Phase 2 — Domain errors (parallel to Phase 1)

**Satisfies:** REQ-GUARD-1, REQ-GUARD-2, REQ-GUARD-3 / AC-07, AC-08, AC-09

### T2.1 [TEST] Unit tests for `DayNotAssignableError` and `StatusNotAssignableError`

- [x] Create `packages/domain/src/asistencia/errors/__tests__/domain-errors.spec.ts`
- [x] `DayNotAssignableError`: `instanceof DomainError`, `.code === 'DAY_NOT_ASSIGNABLE'`, `.message` contains the supplied string
- [x] `StatusNotAssignableError`: `instanceof DomainError`, `.code === 'STATUS_NOT_ASSIGNABLE'`, `.message` contains the supplied string
- [x] Type safety: `DayNotAssignableError` cannot be `instanceof StatusNotAssignableError` and vice versa
- [x] Both carry their `code` through the constructor without requiring a second argument

### T2.2 [IMPL] Create error files — run until T2.1 is green

- [x] Create `packages/domain/src/asistencia/errors/day-not-assignable-error.ts`:  
  `export class DayNotAssignableError extends DomainError { constructor(message: string) { super(message, 'DAY_NOT_ASSIGNABLE'); } }`
- [x] Create `packages/domain/src/asistencia/errors/status-not-assignable-error.ts`:  
  `export class StatusNotAssignableError extends DomainError { constructor(message: string) { super(message, 'STATUS_NOT_ASSIGNABLE'); } }`

### T2.3 [IMPL] Export errors from domain package

- [x] Add both classes to `packages/domain/src/asistencia/index.ts`
- [x] Add both classes to `packages/domain/src/index.ts`
- [x] `pnpm build` green in `packages/domain`

---

## Phase 3 — Domain ports `+days?` (after Ph1 + Ph2 compile)

**Satisfies:** REQ-GEN-3 (use case injects `days`; port interface must accept it)

### T3.1 [IMPL] Add `days?` to `GenerateGeneralInput`

- [x] Edit `packages/domain/src/asistencia/repositories/asistencia-general-repository.ts`
- [x] Add `days?: Record<string, string>;` to `GenerateGeneralInput` interface
- [x] Update JSDoc for `generateMany` method: note the new read-merge-write semantics; `days` contains the locked-day map built by the use case

### T3.2 [IMPL] Add `days?` to `GenerateMateriaInput`

- [x] Edit `packages/domain/src/asistencia/repositories/asistencia-materia-repository.ts`
- [x] Same addition and JSDoc update as T3.1

### T3.3 [VERIFY] Typecheck and existing tests still pass

- [x] `pnpm --filter api typecheck` → zero new errors (`days?` is optional; all existing callers remain valid)
- [x] `pnpm --filter api test` → existing tests still green (no behavioral change in this phase)

---

## Phase 4 — Infra `generateMany` read-merge-write (after Ph1 + Ph3)

**Satisfies:** REQ-GEN-1, REQ-GEN-2, REQ-GEN-3, REQ-REGEN-1, REQ-REGEN-2, REQ-REGEN-3 / Scenarios GEN-1..5, REGEN-1..4 / AC-03, AC-04, AC-05, AC-06

### T4.1 [TEST] Unit tests for `mergeLocked` pure helper

- [ ] Create `api/src/infrastructure/repositories/__tests__/merge-locked.spec.ts` (or include in T4.2 file)
- [ ] `mergeLocked({}, lockedMap)` → returns only locked entries (first-gen)
- [ ] `mergeLocked({"1":"P"}, {"4":"SAB","5":"DOM"})` → `{"1":"P","4":"SAB","5":"DOM"}` — hábil key `"1"` preserved (REGEN-1)
- [ ] `mergeLocked({"4":"SAB","1":"P"}, {"4":"SAB",...})` → `"4":"SAB"` unchanged, `"1":"P"` preserved (REGEN-2)
- [ ] `mergeLocked({"6":"P"}, {"6":"SAB",...})` NOTE: this case means the lockedMap has key `6` as `SAB` (if it's a Saturday); `"6":"P"` is overwritten by `"6":"SAB"` (REQ-REGEN-2 says hábil days must not be overwritten, but `lockedMap` never contains hábil keys — so this test verifies that a legacy incorrect hábil entry IS corrected when the calendar says it's blocked)
- [ ] `mergeLocked({"1":"P"}, undefined)` → `{"1":"P"}` — no lockedMap → no-op (REGEN-3 guard)

### T4.2 [TEST] Unit tests for `generateMany` — General repo (mock Prisma client)

- [ ] Create `api/src/infrastructure/repositories/__tests__/prisma-asistencia-general.repository.spec.ts`
- [ ] GEN-1 (Jan 2025, 2 students, no existing rows): `findMany` returns `[]`; `createMany` called with both rows having `days` including SAB/DOM keys for Jan 2025; no `"X"` keys
- [ ] GEN-2 (Feb 2025, 1 student, no existing rows): `createMany` called with `days` containing `"29":"X","30":"X","31":"X"`; key `"28"` absent
- [ ] GEN-3 (Feb 2024, 1 student): `days` has `"30":"X","31":"X"`; key `"29"` absent
- [ ] REGEN-1 (Jan 2025, existing row `{"1":"P"}`): `findMany` returns that row; `update` called with merged `days` = `{"1":"P","4":"SAB","5":"DOM",...}`; `"1":"P"` preserved
- [ ] REGEN-2 (already has `{"4":"SAB","1":"P"}`): `update` called; `"4":"SAB"` unchanged; `"1":"P"` unchanged; remaining SABs/DOMs added
- [ ] REGEN-3 (existing `{"6":"P"}` for Jan 2025, where day 6 is Monday — hábil): lockedMap has no key `"6"`; `update` called; `"6":"P"` preserved, not overwritten
- [ ] REGEN-4 (mixed: student-A has existing row, student-B does not): `createMany` for student-B with full lockedMap; `update` for student-A with merged days
- [ ] Idempotent: when merged result equals existing `days`, `update` is NOT called (change guard)
- [ ] Empty rows input: returns immediately without DB calls

### T4.3 [TEST] Unit tests for `generateMany` — Materia repo (mock Prisma client)

- [ ] Create `api/src/infrastructure/repositories/__tests__/prisma-asistencia-materia.repository.spec.ts`
- [ ] GEN-4 (Apr 2025, 1 student, subject S, no existing rows): `createMany` with `days` = `{"31":"X","5":"SAB","6":"DOM",...}`; key `"30"` absent
- [ ] REGEN-4 (materia variant): new student in materia scope gets full lockedMap on re-gen

### T4.4 [IMPL] Refactor `generateMany` in general repo — run until T4.1 + T4.2 pass

- [ ] Edit `api/src/infrastructure/repositories/prisma-asistencia-general.repository.ts`
- [ ] Extract `function mergeLocked(existing: Record<string,string>, locked?: Record<string,string>): Record<string,string>` as module-local pure function: `return { ...existing, ...(locked ?? {}) }`
- [ ] Extract `function daysChanged(a: Record<string,string>, b: Record<string,string>): boolean` — deep-equality check to skip no-op updates
- [ ] Replace current `createMany + skipDuplicates` with read-merge-write:
  1. `findMany` existing rows by `(courseCycleId, year, month, studentId IN [...])`
  2. Partition: `toCreate` (no existing row) / `toUpdate` (existing row)
  3. `$transaction`: `createMany(toCreate, skipDuplicates: true)` + for each `toUpdate`: merge + conditional `update`
- [ ] Return `{ created: toCreate.length, skipped: toUpdate.length }`

### T4.5 [IMPL] Refactor `generateMany` in materia repo — run until T4.3 passes

- [ ] Edit `api/src/infrastructure/repositories/prisma-asistencia-materia.repository.ts`
- [ ] Same `mergeLocked` and `daysChanged` helpers + same read-merge-write algorithm
- [ ] Natural key uses `materiaXCursoXCicloId` (not `courseCycleId`)

---

## Phase 5 — App use case `generate-monthly-attendance` (after Ph1 + Ph4)

**Satisfies:** REQ-GEN-1, REQ-GEN-2, REQ-GEN-3 / Scenarios GEN-1..5 / AC-03, AC-04

### T5.1 [TEST] Unit tests for `generate-monthly-attendance` — lockedMap injection

- [ ] Create or update `api/src/application/asistencia/__tests__/generate-monthly-attendance.use-case.spec.ts`
- [ ] Mock `IAsistenciaGeneralRepository` and `IAsistenciaMateriaRepository` ports
- [ ] GEN-1 (Jan 2025): verify `generateManymocked` receives rows with `days` = `buildLockedDayMap(2025, 1)` — assert keys `4:"SAB"`,`5:"DOM"` present; keys `1`,`2`,`3` absent; no `"X"` key
- [ ] GEN-2 (Feb 2025, non-leap): rows have `days["29"]:"X"`, `days["30"]:"X"`, `days["31"]:"X"`; key `"28"` absent
- [ ] GEN-3 (Feb 2024, leap): `days["30"]:"X"`, `days["31"]:"X"`; key `"29"` absent (`day 29 exists in 2024`)
- [ ] GEN-4 (Apr 2025, materia): materia repo receives `days` with `"31":"X"`; key `"30"` absent
- [ ] GEN-5 (Dec 2025): SAB/DOM entries present; no `"X"` key in `days`
- [ ] Same lockedMap reference is used for all rows in a single invocation (one `buildLockedDayMap` call per execution)

### T5.2 [IMPL] Inject lockedMap in `generate-monthly-attendance.use-case.ts` — until T5.1 green

- [ ] Add `import { buildLockedDayMap } from '@educandow/domain'`
- [ ] Compute `const lockedMap = buildLockedDayMap(year, month)` once before mapping rows
- [ ] Add `days: lockedMap` to each `GenerateGeneralInput` object in the `generalRows` array
- [ ] Add `days: lockedMap` to each `GenerateMateriaInput` object in the `subjectRows` array
- [ ] No change to use-case signature, authorization, or count/toast logic

---

## Phase 6 — App guards in `record-*-attendance-day` use cases (after Ph1 + Ph2)

**Satisfies:** REQ-GUARD-1..6, REQ-UTIL-4 (dedup local daysInMonth) / Scenarios GUARD-1..10 / AC-07..AC-12

### T6.1 [TEST] Unit tests for `record-general-attendance-day` guards

- [ ] Create or update `api/src/application/asistencia/__tests__/record-general-attendance-day.use-case.spec.ts`
- [ ] GUARD-1: `day=4, year=2025, month=1` (Saturday) → throws `DayNotAssignableError`, `.code === 'DAY_NOT_ASSIGNABLE'`
- [ ] GUARD-2: `day=5, 2025, 1` (Sunday) → throws `DayNotAssignableError`
- [ ] GUARD-3: `day=29, 2025, 2` (Feb 2025 has 28 days) → throws `DayNotAssignableError`
- [ ] GUARD-4: `day=31, 2025, 4` (April has 30 days) → throws `DayNotAssignableError`
- [ ] GUARD-5: `day=1, 2025, 1` (Monday hábil), `statusCode="SAB"` (assignable=false) → throws `StatusNotAssignableError`, `.code === 'STATUS_NOT_ASSIGNABLE'`
- [ ] GUARD-6: same day, `statusCode="DOM"` → throws `StatusNotAssignableError`
- [ ] GUARD-7: same day, `statusCode="X"` → throws `StatusNotAssignableError`
- [ ] GUARD-8: `day=1, 2025, 1`, `statusCode="P"` (assignable=true) → resolves successfully (happy path, HTTP 200 at controller)
- [ ] GUARD-9: student's `days` JSONB does NOT contain key `"4"` AND `day=4, 2025, 1` (Saturday) → still throws `DayNotAssignableError` (guard is calendar-derived, not JSONB-based)
- [ ] Error order: `day=0` or `day=99` → `ValidationError` (step 2 fires before step 3); `day=29, Feb2025` → `DayNotAssignableError` not `ValidationError`

### T6.2 [TEST] Unit tests for `record-subject-attendance-day` guards (symmetry)

- [ ] Create or update `api/src/application/asistencia/__tests__/record-subject-attendance-day.use-case.spec.ts`
- [ ] GUARD-10: `day=4, 2025, 1` (Saturday) via subject use case → throws `DayNotAssignableError` (identical to GUARD-1)
- [ ] `statusCode="SAB"` on hábil day via subject use case → throws `StatusNotAssignableError` (mirror GUARD-5)
- [ ] Happy path via subject use case → resolves successfully (mirror GUARD-8)

### T6.3 [IMPL] Implement guards in `record-general-attendance-day.use-case.ts` — until T6.1 green

- [ ] Add imports: `daysInMonth, dayOfWeek, DayNotAssignableError, StatusNotAssignableError` from `@educandow/domain`
- [ ] **Remove** any local `daysInMonth` inline computation in this file (REQ-UTIL-4)
- [ ] Step 2 (exists already or add): `if (!Number.isInteger(day) || day < 1 || day > 31)` → `throw new ValidationError('day must be an integer between 1 and 31')`
- [ ] Step 3 (NEW): `const maxDay = daysInMonth(year, month); if (day > maxDay)` → `throw new DayNotAssignableError(`day ${day} does not exist in ${month}/${year}`)`
- [ ] Step 4 (NEW): `const dow = dayOfWeek(year, month, day); if (dow === 0 || dow === 6)` → `throw new DayNotAssignableError(`day ${day} is a ${dow === 6 ? 'Saturday' : 'Sunday'}`)`
- [ ] Step 5 (exists): unknown statusCode → `ValidationError` (unchanged)
- [ ] Step 6 (NEW): `if (!type.assignable)` → `throw new StatusNotAssignableError(`statusCode "${statusCode}" is not assignable`)`
- [ ] Preserve existing step 1 (row not found → `NotFoundError`) unchanged

### T6.4 [IMPL] Implement guards in `record-subject-attendance-day.use-case.ts` — until T6.2 green

- [ ] Same 6-step guard sequence as T6.3
- [ ] Same imports from `@educandow/domain`
- [ ] **Remove** any local `daysInMonth` in this file (REQ-UTIL-4)

---

## Phase 7 — Presentation: exception filter + envelope (after Ph2; run alongside Ph6)

**Satisfies:** REQ-GUARD-7 / AC-07, AC-08, AC-09, AC-19

### T7.1 [TEST] Unit tests for `AppExceptionFilter`

- [ ] Create or update `api/src/presentation/shared/filters/__tests__/exception.filter.spec.ts`
- [ ] `DayNotAssignableError` → HTTP status 422, response body `{ error: { status: 422, code: "DAY_NOT_ASSIGNABLE", message: "..." } }`
- [ ] `StatusNotAssignableError` → HTTP status 400, response body `{ error: { status: 400, code: "STATUS_NOT_ASSIGNABLE", message: "..." } }`
- [ ] Existing domain error (e.g., one already in `DOMAIN_STATUS`) → its code appears in `error.code`
- [ ] Non-domain `HttpException` → `error.code` is absent or `undefined` (no regression)
- [ ] `error.status` field is still present for all domain errors (additive change, not rename)

### T7.2 [IMPL] Edit `exception.filter.ts` — until T7.1 green

- [ ] Add to `DOMAIN_STATUS` constant: `DAY_NOT_ASSIGNABLE: 422` and `STATUS_NOT_ASSIGNABLE: 400`
- [ ] In the `DomainError` catch branch: extract `exception.code` into a local `code` variable
- [ ] Change the `response.json(...)` call to emit `{ error: { status, code, message } }` (additive: `code` added, `status` kept)
- [ ] For non-domain paths, `code` remains `undefined` (not emitted or serialized as `null`)
- [ ] `pnpm --filter api test` green

---

## Phase 8 — Frontend `asistencia-mensual.tsx` (after Ph1; independent of Ph4–Ph7)

**Satisfies:** REQ-GRID-1..7, REQ-UTIL-4 (remove local daysInMonth from web) / Scenarios GRID-1..7 / AC-13..AC-17

### T8.1 [TEST] Component tests for `asistencia-mensual.tsx`

- [ ] Create `web/src/pages/dashboard/__tests__/asistencia-mensual.spec.tsx` (or locate existing test file)
- [ ] GRID-1: render with any month (including Feb, Apr) → count header day columns = exactly 31
- [ ] GRID-2 (Jan 2025, `days["4"]="SAB"`): column 4 renders read-only text "SAB"; no `<select>` in that cell; cell has `data-testid="cell-locked-{studentId}-4"`
- [ ] GRID-3 (`days["5"]="DOM"`): column 5 locked, no `<select>`
- [ ] GRID-4 (Feb 2025, `days["29"]="X"`, `days["30"]="X"`, `days["31"]="X"`): columns 29, 30, 31 each render as locked
- [ ] GRID-5 (Jan 2025, column 6 — Monday, no code in `days["6"]`): `<select>` present; options include only codes with `assignable: true` (e.g., "P", "A"); "SAB", "DOM", "X" absent from options
- [ ] GRID-6: combo populates from `attendanceTypes[].assignable` flag; test with custom types where a new code with `assignable: false` is also excluded automatically (no hardcoded list)
- [ ] GRID-7: simulate click on locked cell → mock API function is NOT called; cell remains read-only
- [ ] Locked cell style: assert visually distinct class or inline style attribute is applied (not the same as editable cell)

### T8.2 [IMPL] Edit `asistencia-mensual.tsx` — until T8.1 green

- [ ] Add `assignable: boolean` to `AttendanceTypeItem` interface (field already returned by backend `toResponse()`)
- [ ] Change day columns: `const dayColumns = Array.from({ length: 31 }, (_, i) => i + 1)` (was `length: numDays` or equivalent)
- [ ] Add `import { daysInMonth } from '@educandow/domain'`; remove any local `daysInMonth` implementation (REQ-UTIL-4)
- [ ] Compute `const numDays = daysInMonth(year, month)` for the legacy fallback only
- [ ] Per cell derivation:  
  ```ts
  const code = row.days[String(d)];
  const at = code ? attendanceTypes.find((a) => a.code === code) : undefined;
  const isLockedByCode = at?.assignable === false;
  const isNonExistent = d > numDays;
  const locked = isLockedByCode || isNonExistent;
  ```
- [ ] Locked render: `<span data-testid="cell-locked-{studentId}-{d}" style={cellLockedStyle}>{code ?? '—'}</span>` — no `<select>`, no `onChange`, no API trigger
- [ ] Define `cellLockedStyle` (same padding/border as editable cell; distinct background: muted/grey; `cursor: not-allowed`)
- [ ] Combo filter: `attendanceTypes.filter((t) => t.active && t.assignable).map((t) => t.code)`
- [ ] Do not touch `<table>` / `<thead>` structure

---

## Acceptance criteria cross-check

| AC | Covered by |
|----|-----------|
| AC-01 `buildLockedDayMap` in domain, single source, tested | T1.1, T1.2, T1.3 |
| AC-02 daysInMonth duplication eliminated (3 files) | T1.3 (export), T6.3 + T6.4 (api use cases), T8.2 (web) |
| AC-03 SAB/DOM/X in days JSONB at generation | T4.2, T4.3, T4.4, T4.5, T5.1, T5.2 |
| AC-04 Both General and Materia modes locked | T4.2, T4.3, T5.1 (GEN-4), T5.2 |
| AC-05 Re-gen merges without overwriting hábil | T4.1 (mergeLocked tests), T4.2 (REGEN-1..3) |
| AC-06 New students get full pre-load on re-gen | T4.2 (REGEN-4), T4.3 |
| AC-07 Weekend → HTTP 422 DAY_NOT_ASSIGNABLE | T6.1 (GUARD-1,2), T6.2 (GUARD-10), T7.1, T7.2 |
| AC-08 Non-existent day → HTTP 422 DAY_NOT_ASSIGNABLE | T6.1 (GUARD-3,4), T7.1, T7.2 |
| AC-09 Non-assignable code → HTTP 400 STATUS_NOT_ASSIGNABLE | T6.1 (GUARD-5,6,7), T6.2, T7.1, T7.2 |
| AC-10 Hábil + assignable → HTTP 200 | T6.1 (GUARD-8), T6.2 |
| AC-11 Guard uses calendar-utils, not JSONB | T6.1 (GUARD-9), T6.3, T6.4 |
| AC-12 Guard symmetry General + Materia | T6.2, T6.4 |
| AC-13 Grid 31 columns always | T8.1 (GRID-1), T8.2 |
| AC-14 Blocked cells read-only, no combo | T8.1 (GRID-2,3,4), T8.2 |
| AC-15 Locking by assignable flag, not hardcoded list | T8.1 (GRID-6), T8.2 |
| AC-16 Combo only assignable codes | T8.1 (GRID-5,6), T8.2 |
| AC-17 Feb 2025 29/30/31→X; Feb 2024 day 29 not locked | T1.1 (UTIL-9,10), T4.2 (GEN-2,3), T5.1 (GEN-2,3) |
| AC-18 No DB schema migration | — (JSONB days field already exists; no Prisma schema change) |
| AC-19 Envelope `{ error: { status, code, message } }` additive | T7.1, T7.2 |

---

## Review Workload Forecast

| Phase | New/edited files | Estimated new lines (code + tests) | Over 400? |
|-------|------------------|------------------------------------|-----------|
| Ph1 — Domain util | 3 new, 2 edits | ~240 | No |
| Ph2 — Domain errors | 2 new, 2 edits | ~60 | No |
| Ph3 — Ports | 2 edits | ~6 | No |
| Ph4 — Infra repos | 2 edits, 2–3 test files | ~440 | **Yes** |
| Ph5 — App generate | 1 edit, 1 test file | ~115 | No |
| Ph6 — App guards | 2 edits, 2 test files | ~340 | No |
| Ph7 — Presentation | 1 edit, 1 test file | ~90 | No |
| Ph8 — Frontend | 1 edit, 1 test file | ~235 | No |
| **Total** | **~16 files** | **~1,526 lines** | **Yes** |

**400-line budget risk:** High (~3.8× budget).  
**Chained PRs recommended:** Yes.  
**Decision needed before apply:** **Yes.**

### Proposed PR chain

| PR | Phases | Est. lines | Notes |
|----|--------|-----------|-------|
| PR 1 | Ph1 + Ph2 + Ph3 | ~306 | Domain-only: utils, errors, port interfaces. Zero runtime risk. Unblocks all other PRs. |
| PR 2 | Ph4 | ~440 | Infra repos (generateMany). Slightly over 400 (bulk is tests); consider `size:exception` or splitting: PR 2a (impl ~160) + PR 2b (tests ~280). |
| PR 3a | Ph5 + Ph7 | ~205 | App generate + filter. Small; merges cleanly after PR 1 + 2. |
| PR 3b | Ph6 | ~340 | App guards (two use cases + tests). Merges after PR 1. Independent of Ph4 at the application level. |
| PR 4 | Ph8 | ~235 | Frontend. Depends only on PR 1 (domain import). Can be developed in parallel with PR 2 + 3. |

**Action required before `sdd-apply`:** Choose delivery path:
- Option A — accept PR 2 with `size:exception` (bulk is tests; reviewer trusts the coverage).
- Option B — split PR 2 into impl + tests as separate commits in the same branch, reviewed together.
- Option C — merge Ph5 into PR 2 (all infra + generate in one shot, ~555 lines, `size:exception`).

The orchestrator will pause and ask before launching `sdd-apply`.
