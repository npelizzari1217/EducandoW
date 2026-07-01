# Tasks — asistencia-behavior-e-impresion

**Change:** asistencia-behavior-e-impresion
**Execution mode:** Strict TDD — test-first, coverage ≥ 80%
**Test runner:** `pnpm test` (root) / `pnpm --filter api test` (api) / `pnpm --filter @educandow/domain test` (domain)
**Build gate:** `pnpm build` green at every PR boundary
**Delivery strategy:** auto-chain (cached) — 4 stacked PRs, no per-PR pause; forecast below still recorded per policy

---

## Dependency graph (PRs)

```
PR1 (behavior base: schema+migration+domain VO+repo+seed)
  │
  ├──→ PR2 (CRUD DTO/use-cases/controller + UI selector + grid filter)
  │
  └──→ PR3 (domain totals + PDF use-case/endpoint/template, landscape)
              │
              └──→ PR4 (front botones Imprimir)
```

- **PR1** has no dependency. Everything else needs `behavior` to exist end-to-end.
- **PR2** depends on PR1 (needs the `AttendanceBehavior` VO + entity prop + migrated column).
- **PR3** depends on PR1 only (catalog needs `behavior`); independent of PR2 in code, stacked after it by delivery order.
- **PR4** depends on PR3 (consumes the print endpoints).
- Chain: **PR1 → PR2 → PR3 → PR4**.

---

## PR1 — Base behavior (schema + domain + migration + repo + seed)

**Satisfies:** REQ-P1-1, REQ-P1-2, REQ-P1-3, REQ-P1-8 / Scenarios P1-1, P1-3, P1-4, P1-11, P1-12 / AC-P1-1, AC-P1-2, AC-P1-3, AC-P1-4, AC-P1-10, AC-P1-11, AC-P1-12
**Depends on:** nothing
**Sensitive:** the migration (Riesgo A — backfill heurístico). Rollback = drop column + drop enum type, sin borrar filas.

### Domain — VO `AttendanceBehavior`

#### T1.1 [TEST] Unit tests for `AttendanceBehavior` VO

- [x] Create `packages/domain/src/attendance-type/__tests__/value-objects/attendance-behavior.test.ts`
- [x] `AttendanceBehavior.create('AUSENTE_INJUSTIFICADO')` → ok, `.get()` returns the value (P1-1 base)
- [x] `AttendanceBehavior.create('INVALID')` → `Result` failure / `ValidationError` (mirrors P1-2 rejection)
- [x] Predicates: `isEligible()` false only for `NO_ELEGIBLE`; true for the other 6
- [x] `isDiaHabil()` false for `NO_ELEGIBLE` and `DIA_NO_HABIL`; true for the other 5
- [x] `isTardeJustificada()` / `isTardeInjustificada()` / `isAusenteJustificado()` / `isAusenteInjustificado()` / `isNoComputa()` each true only for their own member, false for the other 6
- [x] All 7 members constructible without cross-validation/uniqueness error (mirrors P1-11 at VO level)

#### T1.2 [IMPL] Create `attendance-behavior.ts` — run until T1.1 green

- [x] Create `packages/domain/src/attendance-type/value-objects/attendance-behavior.ts`
- [x] Export `AttendanceBehaviorValue` enum: `AUSENTE_INJUSTIFICADO`, `AUSENTE_JUSTIFICADO`, `NO_ELEGIBLE`, `NO_COMPUTA`, `TARDE_INJUSTIFICADA`, `TARDE_JUSTIFICADA`, `DIA_NO_HABIL` (matches Prisma enum member names 1:1)
- [x] `AttendanceBehavior.create(value: string): Result<AttendanceBehavior, ValidationError>` validates membership
- [x] Predicates per T1.1 (`isEligible`, `isDiaHabil`, `isTardeJustificada`, `isTardeInjustificada`, `isAusenteJustificado`, `isAusenteInjustificado`, `isNoComputa`), `get(): AttendanceBehaviorValue`
- [x] Add export to `packages/domain/src/attendance-type/value-objects/index.ts` and `packages/domain/src/attendance-type/index.ts`
- [x] `pnpm --filter @educandow/domain test` green

### Domain — entity `AttendanceType`

#### T1.3 [TEST] Update entity tests for `behavior`

- [x] Edit `packages/domain/src/attendance-type/__tests__/entities/attendance-type.test.ts`
- [x] `AttendanceType.create({..., behavior: AttendanceBehaviorValue.AUSENTE_JUSTIFICADO})` succeeds, `.behavior` exposes the VO (P1-1)
- [x] `CreateAttendanceTypeInput` no longer accepts/requires `assignable`; entity derives it: `.assignable === entity.behavior.isEligible()` for every behavior value (ADR-03)
- [x] `Reconstruct` path accepts `behavior` from persistence and rebuilds the VO (repo round-trip contract)
- [x] `assertMutable()` on an `isSystem = true` entity still throws `SystemAttendanceTypeError` regardless of what `behavior` is passed on the attempted update (P1-5/P1-6 — existing lock, verify it still covers `behavior`)
- [x] Fractional `absenceValue` (0.25, 0.75) persists independent of chosen `behavior` (P1-12)

#### T1.4 [IMPL] Update `attendance-type.ts` entity — run until T1.3 green

- [x] Edit `packages/domain/src/attendance-type/entities/attendance-type.ts`
- [x] Add `behavior: AttendanceBehavior` to `AttendanceTypeProps`, `CreateAttendanceTypeInput`, `ReconstructAttendanceTypeProps`
- [x] Remove `assignable` from `CreateAttendanceTypeInput` (kept only as a derived getter: `get assignable() { return this.props.behavior.isEligible(); }`)
- [x] Add `get behavior(): AttendanceBehavior`
- [x] No change to `assertMutable()` logic (lock already exists — ADR-04)
- [x] `pnpm --filter @educandow/domain test` green; `pnpm build` green in `packages/domain`

### Prisma tenant — schema + migration

#### T1.5 [IMPL] Schema: add enum + column

- [x] Edit `api/prisma_tenant/schema.prisma`
- [x] Add `enum AttendanceBehavior { AUSENTE_INJUSTIFICADO AUSENTE_JUSTIFICADO NO_ELEGIBLE NO_COMPUTA TARDE_INJUSTIFICADA TARDE_JUSTIFICADA DIA_NO_HABIL }`
- [x] Add `behavior AttendanceBehavior` (non-null in the final schema state) to `AttendanceType` model
- [x] `pnpm --filter api prisma:generate` regenerates tenant client types

#### T1.6 [IMPL] Migration: create type → nullable column → backfill → NOT NULL

- [x] Create tenant migration (per ADR-02, single migration file with staged SQL):
  1. `CREATE TYPE "AttendanceBehavior" AS ENUM (...)`
  2. `ALTER TABLE attendance_types ADD COLUMN behavior "AttendanceBehavior" NULL;`
  3. Backfill system types: `P` → `NO_COMPUTA`; `SAB`,`DOM`,`X` → `NO_ELEGIBLE`
  4. Backfill custom types by `(assignable, absenceValue)` heuristic: `assignable=false`→`NO_ELEGIBLE`; `assignable=true AND absenceValue=0`→`NO_COMPUTA`; `assignable=true AND 0<absenceValue<1`→`AUSENTE_JUSTIFICADO`; `assignable=true AND absenceValue>=1`→`AUSENTE_INJUSTIFICADO`; fallback→`NO_COMPUTA`
  5. `ALTER TABLE attendance_types ALTER COLUMN behavior SET NOT NULL;`
- [x] Down migration: drop column + drop enum type; do NOT touch `assignable` or delete rows (rollback path) — documented as a comment header in migration.sql (Prisma migrate has no down.sql, forward-only convention already used by every other migration in this repo)
- [ ] `pnpm --filter api prisma:migrate:tenant` (dev) applies cleanly on a fresh tenant DB — **NOT RUN**: no DB available in this WSL sandbox; schema+client regenerated offline via `prisma generate` only. Must run `prisma migrate deploy` (or `migrate dev` locally) before/during actual deploy.
- [x] **Manual verification note for apply**: dry-run the backfill SQL against a tenant DB dump/snapshot before merging (Riesgo A — no automated test covers real prod data shape) — **documented as pending manual step, not executed by this agent** (no DB access)

### API infrastructure — repository

#### T1.7 [TEST] Repo tests for `behavior` persistence

- [x] Edit/extend `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-attendance-type.repository.test.ts` (locate existing file for this repo; create if absent alongside the repo file)
- [x] `save()` on create: persists `behavior` from the entity and computes `assignable = entity.behavior.isEligible()` (does NOT read an input `assignable`)
- [x] `save()` preserves existing `isPresent` derivation formula unchanged (`absenceValue===0 && assignable`) — regression guard for `buildAsistencia` (out of scope, must not break)
- [x] `toDomain()` reads `behavior` from the row and reconstructs the VO correctly for all 7 values

#### T1.8 [IMPL] Update `prisma-attendance-type.repository.ts` — run until T1.7 green

- [x] Edit `api/src/infrastructure/persistence/prisma/repositories/prisma-attendance-type.repository.ts`
- [x] `save()`: compute `assignable` from `entity.behavior.isEligible()`; persist `behavior` column; keep `isPresent` formula as-is
- [x] `toDomain()`: read `behavior` from row, pass into `AttendanceType.reconstruct(...)`
- [x] `pnpm --filter api test` green (this file's suite)

### API application — seed

#### T1.9 [TEST] Seed tests for system type `behavior`

- [x] Edit `api/src/application/attendance-type/__tests__/ensure-attendance-types.use-case.test.ts`
- [x] `P` seeded/ensured with `behavior = NO_COMPUTA` (P1-3)
- [x] `SAB`, `DOM`, `X` seeded/ensured with `behavior = NO_ELEGIBLE` (P1-4)
- [x] Idempotency: re-running `ensure` on already-seeded level does not change `behavior` of existing system rows (covered by pre-existing `update: {}` idempotency test, unchanged by this PR)

#### T1.10 [IMPL] Update `ensure-attendance-types-for-level.use-case.ts` — run until T1.9 green

- [x] Edit `api/src/application/attendance-type/use-cases/ensure-attendance-types-for-level.use-case.ts`
- [x] Set `behavior` per system code per the fixed map (ADR-02 step 3 / REQ-P1-3)
- [x] **REVISAR** `api/scripts/backfill-system-attendance-types.ts` — reuses `seedSystemAttendanceTypes()` from `api/prisma/seed.ts` (a second, independent `SYSTEM_ATTENDANCE_TYPES` array from the one in the use-case above) — updated that array + its `upsert.create` call with the same `behavior` map so the script stays consistent
- [x] `pnpm --filter api test` green; `pnpm build` green (root)

---

## PR2 — CRUD + UI tipos + filtrado de grilla

**Satisfies:** REQ-P1-4, REQ-P1-5, REQ-P1-6, REQ-P1-7 / Scenarios P1-2, P1-5, P1-6, P1-7, P1-8, P1-9, P1-10, P1-11 / AC-P1-4, AC-P1-5, AC-P1-6, AC-P1-7, AC-P1-8, AC-P1-9, AC-P1-11
**Depends on:** PR1 (needs `AttendanceBehavior` VO + entity prop + migrated column in place)

**PARTIAL PLUMBING PULLED FORWARD INTO PR1b (not full PR2 completion):** PR1a's domain change made `assignable` a non-input, derived-only prop, which broke `api` typecheck/tests (Create/UpdateAttendanceTypeUseCase, both DTOs, controller, and 3 test files were all still constructing/calling with `assignable` as input). To get `pnpm build`/`pnpm test` green at the PR1 boundary (required gate), the minimum was brought forward:
- `CreateAttendanceTypeInput`/`UpdateAttendanceTypeInput` (`attendance-type.use-cases.ts`): `assignable` replaced by `behavior: AttendanceBehaviorValue` (create, required) / `behavior?: AttendanceBehaviorValue` (update, optional, falls back to `entity.behavior`).
- `CreateAttendanceTypeSchema`/`UpdateAttendanceTypeSchema` (DTOs): `assignable` replaced by `behavior: z.nativeEnum(AttendanceBehaviorValue)` (create, required) / optional (update). This is T2.5's DTO half, done.
- `attendance-type.controller.ts`: `toResponse` now also returns `behavior: entity.behavior.get()` (keeps `assignable` derived, for compat) — this is T2.4/T2.5's controller half, done. `create()` forwards `body.behavior` instead of `body.assignable`.
- Existing tests (`attendance-type.use-cases.test.ts`, `dto-validation.test.ts`, `attendance-type.controller.test.ts`) updated to the new shape, plus a handful of behavior-validation assertions added (rejects invalid/missing behavior, accepts all 7 values) — a subset of T2.1/T2.3/T2.4, NOT the full scenario coverage below.
- **STILL PENDING for PR2** (not done by this agent): T2.1's full scenario list (system-type lock re-verified specifically against `behavior` input attempts, 7-distinct-custom-types-no-uniqueness-conflict test, "behavior optional on update keeps unchanged" explicit test), all of T2.6-T2.9 (web UI selector + grid filter/lock — `asistencia-mensual.tsx` and `attendance-types.tsx` untouched, still read/write nothing about `behavior`).

**PR2 COMPLETED (this session):** all items above marked STILL PENDING are now done — T2.1's full use-case scenario list (system lock re-verified against `behavior` input, 7-distinct-custom-types, update-omits-behavior), T2.6/T2.7 (`attendance-types.tsx` behavior selector + table column), T2.8/T2.9 (`asistencia-mensual.tsx` grid filter/lock migrated from `assignable` to `behavior`). See PR2 task checkboxes below for detail per task.

### API application — use-cases

#### T2.1 [TEST] Use-case tests: create/update accept `behavior`, reject out-of-range, keep system lock

- [x] Edit `api/src/application/attendance-type/__tests__/attendance-type.use-cases.test.ts`
- [x] Create: valid `behavior` (e.g. 6) → succeeds, `absenceValue` stored independent of `behavior` (P1-1/Scenario P1-1)
- [x] Create: `behavior` out of range (e.g. `'INVALID'` payload before DTO layer, or invalid enum member) → validation error, no row created (Scenario P1-2)
- [x] Update: system type (`isSystem=true`) attempted update to description/absenceValue/behavior → rejected via existing `assertMutable`, row unchanged (Scenario P1-5)
- [x] Delete: system type → rejected, row remains active (Scenario P1-6)
- [x] Update/Delete: custom type → succeeds (Scenario P1-7)
- [x] Update: `behavior` optional on input; omitted → keeps `entity.behavior` unchanged
- [x] Create 7 distinct custom types, one per behavior 1-7 → all succeed, no uniqueness conflict on `behavior` (Scenario P1-11)

#### T2.2 [IMPL] Update `attendance-type.use-cases.ts` — run until T2.1 green

- [x] Edit `api/src/application/attendance-type/use-cases/attendance-type.use-cases.ts` (brought forward in PR1b)
- [x] `CreateAttendanceTypeUseCase`: input takes `behavior` instead of `assignable`
- [x] `UpdateAttendanceTypeUseCase`: `behavior` optional in input; reconstruct with `input.behavior ?? entity.behavior`
- [x] No change to `assertMutable` call sites (lock already wired — ADR-04)

### API presentation — DTO + controller

#### T2.3 [TEST] DTO validation tests

- [x] Edit `api/src/presentation/attendance-type/__tests__/dto-validation.test.ts` (done in PR1b)
- [x] Create DTO: `behavior` required, must be one of the 7 enum members; rejects unknown values (Scenario P1-2)
- [x] Update DTO: `behavior` optional; when present, same enum validation
- [x] Both DTOs no longer accept/require `assignable` as input

#### T2.4 [TEST] Controller tests: `toResponse` exposes `behavior` + derived `assignable`

- [x] Edit `api/src/presentation/attendance-type/__tests__/attendance-type.controller.test.ts` (done in PR1b)
- [x] Response payload includes `behavior: <value>` for created/updated/listed types
- [x] Response payload still includes `assignable` (derived, for backward compat with current consumers)
- [x] `behavior=3` (`NO_ELEGIBLE`) type still returns `assignable: false` in the response (compat check)

#### T2.5 [IMPL] Update DTOs + controller — run until T2.3 + T2.4 green

- [x] Edit `api/src/presentation/attendance-type/dto/create-attendance-type.dto.ts`: replace `assignable: z.boolean()` with `behavior: z.nativeEnum(AttendanceBehaviorValue)` (done in PR1b)
- [x] Edit `api/src/presentation/attendance-type/dto/update-attendance-type.dto.ts`: replace `assignable` with optional `behavior` (done in PR1b)
- [x] Edit `api/src/presentation/attendance-type/attendance-type.controller.ts`: `toResponse` adds `behavior: entity.behavior.get()`, keeps `assignable` in output; wire DTO `behavior` into use-case inputs (done in PR1b)
- [x] `pnpm --filter api test` green; `pnpm --filter api typecheck` clean
- [x] HTTP error mapping verified: `ATTENDANCE_TYPE_SYSTEM_PROTECTED`→409, `ATTENDANCE_TYPE_NOT_FOUND`→404, `VALIDATION_ERROR` (invalid behavior)→400, already wired in `api/src/presentation/shared/filters/exception.filter.ts` (`DOMAIN_STATUS` map) — no change needed, confirmed by use-case test asserting the invalid-behavior create rejects.

### Web — attendance-types admin UI

#### T2.6 [TEST] Component test: `behavior` selector in create/edit form

- [x] Extended `web/src/pages/dashboard/__tests__/attendance-types.test.tsx` (new `describe('AttendanceTypesPage — behavior selector')` block)
- [x] Form renders a `behavior` dropdown with the 7 labeled options for custom-type create/edit
- [x] Selector effectively hidden when editing a system type — system rows never render an "Editar" button (pre-existing lock), so the form/selector never opens for `isSystem=true` rows; verified no regression
- [x] Submitting create sends `behavior` in the payload; no `assignable` toggle rendered as input anymore

#### T2.7 [IMPL] Update `attendance-types.tsx` — run until T2.6 green

- [x] Edit `web/src/pages/dashboard/attendance-types.tsx`
- [x] Add `behavior` select (7 labeled options, from new `web/src/constants/attendance-behavior.ts`) to create/edit form; removed `assignable` boolean checkbox input
- [x] Table column `Asignable` replaced by `Comportamiento` (readable label via `attendanceBehaviorLabel`)
- [x] Behavior field never shown for system-type rows (no edit action rendered for them — pre-existing lock)

### Web — grid filter/lock

#### T2.8 [TEST] Component tests: grid combo filters by `behavior`, lock by `behavior`

- [x] Extended `web/src/pages/dashboard/__tests__/asistencia-mensual.test.tsx` (actual filename; `.spec.tsx` referenced in this task did not exist)
- [x] `behavior = NO_ELEGIBLE` (3) type MUST NOT appear in the editable-cell combo (Scenario P1-8, AC-P1-7) — GRID-5/GRID-6 renamed+updated
- [x] Types with `behavior` in `{1,2,4,5,6,7}` MUST appear in the combo when `active` (Scenario P1-9, AC-P1-8)
- [x] Lock check (previously `at?.assignable === false`) now reads `at?.behavior === 'NO_ELEGIBLE'`
- [x] Custom `Feriado` (`behavior=DIA_NO_HABIL`, `active=true`) IS selectable (new GRID-8 test, Scenario P1-10, AC-P1-9)

#### T2.9 [IMPL] Update `asistencia-mensual.tsx` — run until T2.8 green

- [x] Edit `web/src/pages/dashboard/asistencia-mensual.tsx`
- [x] Add `behavior: string` to `AttendanceTypeItem` interface (replaced `assignable: boolean`)
- [x] Line ~439 combo filter: `attendanceTypes.filter(t => t.active && t.behavior !== NO_ELEGIBLE_BEHAVIOR)` (constant from `web/src/constants/attendance-behavior.ts`, was `t.assignable`)
- [x] Line ~677 lock check: `isLockedByCode = at?.behavior === NO_ELEGIBLE_BEHAVIOR` (was `at?.assignable === false`)
- [x] `pnpm --filter web test` green; `pnpm build` green

---

## PR3 — Backend agregación + endpoint + template impresión

**Satisfies:** REQ-P2-1 through REQ-P2-7 / Scenarios P2-1..P2-11 / AC-P2-1..AC-P2-17
**Depends on:** PR1 (catalog needs `behavior`). Independent of PR2 in code; stacked after it by delivery order.

**PR3a COMPLETED (this session):** T3.1-T3.3 done — pure domain aggregator (`computeStudentTotals`, `computeDiasHabiles`) in `packages/domain/src/asistencia/utils/asistencia-totals.ts`, TDD RED→GREEN, exported from `asistencia/index.ts` + `domain/src/index.ts`.

**PR3b COMPLETED (prior session):** T3.4-T3.6 done — `PdfGeneratorService.generatePdf` now accepts an optional `{ landscape?, margin? }` second argument (additive, portrait A4 defaults unchanged when omitted — regression-guarded by test); new landscape template `asistencia-mensual.hbs` (alumnos × días grid + 6 totals columns + días hábiles label), context shape documented as an `.hbs` comment block for PR3c.

**PR3c COMPLETED (this session):** T3.7-T3.11 done — `GenerateAsistenciaMensualPdfUseCase` (executeGeneral/executeMateria) + `AsistenciaReportingError` + `AsistenciaReportingController`/`AsistenciaReportingModule` + 2 GET print endpoints, wired into `app.module.ts`. **STILL PENDING:** PR4 (front print buttons, T4.1-T4.2) — the only remaining slice of this change.

### Domain — aggregator

#### T3.1 [TEST] Unit tests for `computeStudentTotals`

- [x] Create `packages/domain/src/asistencia/utils/__tests__/asistencia-totals.test.ts`
- [x] P2-3: days with behavior 6 (0.5+0.5) and behavior 5 (1) → `tardesJust=1.0`, `tardesInj=1.0`, `totalTardes=2.0`
- [x] P2-4: days with behavior 1 (1) and behavior 2 (1+0.5) → `ausJust=1.5`, `ausInj=1.0`, `ausTotal=2.5`
- [x] P2-8: fractional absenceValue 0.25 + 0.75 both behavior 6 → `tardesJust=1.00`
- [x] P2-9: student with no marks (empty/blank days) → all six totals = 0, no throw
- [x] Days with behavior 3, 4, 7 contribute to none of the six totals
- [x] Unknown/missing catalog entry for a day code → does not throw, contributes 0 (defensive, supports P2-9/edge)

#### T3.2 [TEST] Unit tests for días hábiles computation

- [x] Same or sibling test file as T3.1 (e.g. `computeDiasHabiles` suite)
- [x] P2-5: 30-day month, 4 Sundays (behavior 3) + 1 weekday Feriado (behavior 7) → `díasHábiles = 30 - 5 = 25`
- [x] P2-6: day is BOTH Sunday (behavior 3 source) AND marked Feriado (behavior 7 source) → subtracted exactly once, not twice
- [x] P2-7: 31-day month, 4 Sundays + 4 Saturdays + 2 weekday Feriados → `díasHábiles = 31 - 10 = 21`
- [x] P2-10: month with 28 days, evaluated over a 31-column grid → columns 29/30/31 excluded from both the totals and the días hábiles subtraction (they render "X" per web, but the pure function only sees valid day indices 1..daysInMonth)
- [x] AC-P2-12: days with behavior in `{1,2,4,5,6}` count as día hábil (not subtracted)

#### T3.3 [IMPL] Create `asistencia-totals.ts` — run until T3.1 + T3.2 green

- [x] Create `packages/domain/src/asistencia/utils/asistencia-totals.ts`
- [x] `computeStudentTotals(days: Record<string,string>, catalog: Map<string,{behavior: AttendanceBehaviorValue, absenceValue: number}>)`: returns `{ tardesJust, tardesInj, totalTardes, ausJust, ausInj, ausTotal }` as weighted sums per ADR-06 formula
- [x] `computeDiasHabiles(daysInMonth: number, dayCodes: Record<string,string>, catalog: Map<...>)`: builds a `Set` of day indices 1..daysInMonth classified as behavior 3 or 7 (ADR-07 anti-double-count), returns `daysInMonth - set.size`
- [x] Add exports to `packages/domain/src/asistencia/index.ts` and `packages/domain/src/index.ts`
- [x] `pnpm --filter @educandow/domain test` green; `pnpm build` green in `packages/domain`

### API infrastructure — PDF options + template

#### T3.4 [TEST] `PdfGeneratorService.generatePdf` accepts landscape option

- [x] Locate/create `api/src/infrastructure/reporting/__tests__/pdf-generator.service.test.ts`
- [x] `generatePdf(html)` (no options) still calls `page.pdf({ format:'A4', ...portrait defaults })` unchanged (regression guard for boletines/constancia — ADR-09)
- [x] `generatePdf(html, { landscape: true })` calls `page.pdf({ format:'A4', landscape: true, ... })`
- [x] `generatePdf(html, { margin: {...} })` overrides only the provided margin keys, others keep default

#### T3.5 [IMPL] Extend `pdf-generator.service.ts` — run until T3.4 green

- [x] Edit `api/src/infrastructure/reporting/pdf-generator.service.ts`
- [x] `generatePdf(html: string, options?: { landscape?: boolean; margin?: Partial<{top:string;bottom:string;left:string;right:string}> }): Promise<Buffer>`
- [x] Merge `options.margin` over the current default margin object; pass `landscape: options?.landscape ?? false` to `page.pdf(...)`
- [x] Confirm the 3 existing call sites (boletín single/batch, constancia) still compile with zero args (backward compatible)

#### T3.6 [IMPL] Create landscape template (no dedicated unit test — covered by T3.9 use-case test rendering real HTML)

- [x] Create `api/src/infrastructure/reporting/html-templates/asistencia-mensual.hbs`
- [x] `@page { size: A4 landscape }`, `table-layout: fixed`, small font for 31 day columns + 6 total columns
- [x] Header: institución, curso/materia, mes/año, "Días hábiles: {{diasHabiles}}"
- [x] Table: rows = alumnos (pre-sorted by repo), columns = day codes `1..daysInMonth` + 6 total columns (Tardes Just / Tardes Inj / Total Tardes / Aus Just / Aus Inj / Aus Total)
- [x] Register any helpers needed (e.g. `lookup` for per-day code) following `generate-boletin.use-case.ts` pattern

### API application — use-case + error

#### T3.7 [TEST] Unit tests for `GenerateAsistenciaMensualPdfUseCase` — General scope

- [x] Create `api/src/application/asistencia-reporting/__tests__/generate-asistencia-mensual-pdf.use-case.test.ts`
- [x] `executeGeneral`: mocks `attendanceTypeRepo.list`, `findByScopeAndMonthEnriched` (general repo), `pdfGenerator.generatePdf`; resolves `level` from `courseCycleId`
- [x] View-model passed to template includes per-student six totals computed via `computeStudentTotals` (P2-3/P2-4 wired through the use-case, not re-tested numerically here — trust T3.1)
- [x] `díasHábiles` computed once at course level via `computeDiasHabiles`, included in the view-model (P2-5/P2-7 wired through)
- [x] `generatePdf` called with `{ landscape: true }`
- [x] Student with no marks for the month → row present with all totals 0, no throw (Scenario P2-9)
- [x] Unknown/missing `courseCycleId` → domain error with correct HTTP status via `AsistenciaReportingError` (NotFound-style, 404)

#### T3.8 [TEST] Unit tests for `GenerateAsistenciaMensualPdfUseCase` — Por Materia scope

- [x] Same file or sibling `__tests__/generate-asistencia-mensual-pdf.use-case.materia.test.ts`
- [x] `executeMateria`: resolves `level` via `materiaXCursoXCicloId → courseCycle → level` (confirmed against tenant schema: `MateriaXCursoXCiclo.courseCycleId → CourseCycle.uuid`, `CourseCycle.level: Int` — Riesgo C resolved, no ambiguity)
- [x] Same totals/días-hábiles wiring as General (Scenario P2-11 — values MUST match General given equivalent input data)
- [x] Unknown `materiaXCursoXCicloId` → same error contract as General

#### T3.9 [IMPL] Create `generate-asistencia-mensual-pdf.use-case.ts` + `AsistenciaReportingError` — run until T3.7 + T3.8 green

- [x] Create `api/src/application/asistencia-reporting/generate-asistencia-mensual-pdf.use-case.ts`
- [x] Create `AsistenciaReportingError` class (pattern: `BoletinError`, carries `httpStatus`) — `api/src/application/asistencia-reporting/asistencia-reporting.errors.ts`
- [x] `executeGeneral(input): Promise<Buffer>` and `executeMateria(input): Promise<Buffer>` per ADR-08 data flow (resolve level → build catalog via `attendanceTypeRepo.list({level})` [domain port, not raw Prisma — Clean Arch] → fetch enriched rows via existing `findByScopeAndMonthEnriched` → per-student `computeStudentTotals` + course-level `computeDiasHabiles` (merged day-codes across all rows) → compile `asistencia-mensual.hbs` in the constructor (fs.readFileSync + Handlebars.compile, same probe pattern as `generate-boletin.use-case.ts`) → `pdfGenerator.generatePdf(html, {landscape:true})`). Door 2 (preceptor/teacher-group) reused inline, same logic as `ListGeneralAttendanceUseCase`/`ListSubjectAttendanceUseCase`. Optional `grupoId` filter on `executeMateria` for ADR-2 parity.
- [x] `pnpm --filter api test` green

### API presentation — controller + module

#### T3.10 [TEST] Controller tests for print endpoints

- [x] Create `api/src/presentation/asistencia-reporting/__tests__/asistencia-reporting.controller.test.ts`
- [x] `GET /course-cycles/:ccId/asistencia-mensual/print?year=&month=` → calls `executeGeneral`, sets `Content-Type: application/pdf` + `Content-Disposition: attachment`, returns buffer body
- [x] `GET /materias-curso-ciclo/:materiaId/asistencia-mensual/print?year=&month=&grupoId=` → calls `executeMateria`, same headers
- [x] Guards: `AuthGuard` + `RolesGuard` applied; `@Roles('ROOT', {module:'ATTENDANCE', action:'READ'})` on both — resolved Riesgo "Permisos": ATTENDANCE/READ (not REPORTS/READ) because this endpoint renders the SAME data as the existing `GET .../asistencia-mensual` list endpoints (same Door 2 checks, same audience); REPORTS/READ is reserved for the boletín/constancia family (D3-admin-only surface). Reasoning documented as a code comment in the controller.
- [x] Missing/invalid `year`/`month` query params → 400 before hitting the use-case (via `ZodValidationPipe` + `AsistenciaMensualPrint*QuerySchema`, same pattern as `GeneralAttendanceQuerySchema`/`SubjectAttendanceQuerySchema` — not re-tested at controller-unit level per existing codebase convention, DTO schemas validated by construction)

#### T3.11 [IMPL] Create controller + module — run until T3.10 green

- [x] Create `api/src/presentation/asistencia-reporting/asistencia-reporting.controller.ts` (two GET routes per ADR-08)
- [x] Create `api/src/presentation/asistencia-reporting/asistencia-reporting.module.ts` (imports `PdfGeneratorService`, `PrismaService`, existing asistencia/attendance-type/grupo/docente repos, registers the use-case via factory provider)
- [x] Edit `app.module.ts` to register `AsistenciaReportingModule`
- [x] `pnpm --filter api test` green (196 files / 1972 tests); `pnpm --filter api typecheck` clean; `pnpm build` green (root, 3/3 tasks)

---

## PR4 — Front botones impresión

**Satisfies:** REQ-P2-1 / Scenarios P2-1, P2-2 / AC-P2-1, AC-P2-2
**Depends on:** PR3 (consumes the print endpoints)

**PR4 COMPLETED (this session) — CHANGE COMPLETO (PR1→PR4 all done):** T4.1-T4.2 done. TDD RED→GREEN: 7 tests written first against the not-yet-existing buttons (confirmed RED — `btn-imprimir-general`/`btn-imprimir-materia` not found), then the buttons were implemented and all went GREEN on first pass after the implementation (plus one fixture-scoping fix for the `document.createElement` spy, see Learned below).

### Web — print buttons

#### T4.1 [TEST] Component tests: "Imprimir" buttons trigger blob download

- [x] Extended `web/src/pages/dashboard/__tests__/asistencia-mensual.test.tsx` (actual filename; `.spec.tsx` referenced in this task did not exist — same naming reality already noted for T2.8) — new `describe('Impresión — PR-4', ...)` block, 7 tests (PR4-1..PR4-7)
- [x] General module: "Imprimir" button renders (PR4-1); click calls `apiClient.get(generalPrintEndpoint, { responseType: 'blob' })` with current `courseCycleId`/`year`/`month` (PR4-2, Scenario P2-1) — asserted via regex on the URL (`\\d{4}`/`\\d{1,2}` for year/month) to avoid coupling the test to the system clock
- [x] Por Materia module: "Imprimir" button renders (PR4-3); click calls the materia print endpoint with `materiaXCursoXCicloId`/`year`/`month` (PR4-4, Scenario P2-2)
- [x] On success, a blob URL is created and a download is triggered (PR4-2/PR4-4 — mocked `URL.createObjectURL`/`revokeObjectURL` + a scoped `document.createElement` spy that only intercepts `'a'` tags, delegating everything else to the real implementation — see Learned)
- [x] Disabled-state tests added (not in the original checklist, added per apply-scope instruction): PR4-5 (General disabled when no course cycle selected), PR4-6 (Por Materia disabled when no materia selected)
- [x] No `html2pdf`/client-side generation path is invoked (PR4-7, regression guard — REQ-P2-2) — `html2pdf.js` module-mocked via `vi.hoisted` + `vi.mock`, asserted never called after a successful print click

#### T4.2 [IMPL] Add print buttons — run until T4.1 green

- [x] Edited `web/src/pages/dashboard/asistencia-mensual.tsx`
- [x] Added "Imprimir" button to the General module block (rendered only when `mode === 'general'`): `handlePrintGeneral` calls `apiClient.get(...)` with `responseType: 'blob'`, shared `triggerPdfDownload(blob, filename)` helper builds a `blob` URL + `<a download>` trigger (same pattern as `downloadBoletinBatch` in `hooks/useBoletin.ts`), no `html2pdf`
- [x] Added "Imprimir" button to the Por Materia module block (rendered only when `mode === 'materia'`): `handlePrintMateria`, same pattern against the materia endpoint, includes optional `&grupoId=` param for ADR-2 parity with `loadSubjectRows`
- [x] Filename convention mirrors the backend's `Content-Disposition`: `asistencia-mensual-{ccId|materiaId}-{year}-{month}.pdf`
- [x] Loading/disabled state: shared `printLoading` boolean (button disabled + label "Generando PDF…" while in flight); each button additionally disabled when its own scope id (`selectedCCId`/`selectedMateriaId`) is empty
- [x] `pnpm --filter web test` → 49 files / 595 tests green (was 48/588 before this session — +1 describe block / +7 tests); `pnpm test` (root, turbo) → 4/4 tasks green (domain 110 files, api 196 files/1972 tests, web 49 files/595 tests); `pnpm build` (root, turbo) → 3/3 tasks green (web build includes the pre-existing `html2pdf.js` chunk used by `PremiumPrintReport.tsx`, unrelated to this change — confirms no new client-side PDF path was added)

---

## Acceptance criteria cross-check

| AC | Covered by |
|----|-----------|
| AC-P1-1 behavior 1-7 range enforced | T1.1, T1.2, T2.1, T2.3 |
| AC-P1-2 absenceValue preserved independent of behavior | T1.3, T1.9, T3.1 |
| AC-P1-3 system P → behavior 4 | T1.9, T1.10 |
| AC-P1-4 system SAB/DOM/X → behavior 3 | T1.9, T1.10 |
| AC-P1-5 edit/delete system type rejected | T1.3, T2.1 |
| AC-P1-6 custom CRUD succeeds + accepts behavior | T2.1, T2.3, T2.5 |
| AC-P1-7 behavior 3 excluded from grid combo | T2.8, T2.9 |
| AC-P1-8 behaviors 1,2,4,5,6,7 in grid combo | T2.8, T2.9 |
| AC-P1-9 Feriado (behavior 7) selectable day-by-day | T2.8, T2.9 |
| AC-P1-10 every row has non-null behavior post-migration | T1.6 |
| AC-P1-11 custom type per behavior 1-7, no uniqueness conflict | T1.1, T2.1 |
| AC-P1-12 fractional absenceValue persisted exactly | T1.3, T3.1 |
| AC-P2-1 Imprimir button General → server-side PDF | T4.1, T4.2 |
| AC-P2-2 Imprimir button Por Materia → server-side PDF | T4.1, T4.2 |
| AC-P2-3 landscape A4, server-side, no client-side gen | T3.4, T3.5, T4.1 |
| AC-P2-4 grid students × days with on-screen codes | T3.6, T3.9 |
| AC-P2-5..10 six weighted totals | T3.1, T3.9 |
| AC-P2-11 días hábiles formula, no double count | T3.2, T3.3 |
| AC-P2-12 behaviors 1,2,4,5,6 count as hábil | T3.2, T3.3 |
| AC-P2-13 identical General/Por Materia | T3.7, T3.8 |
| AC-P2-14 multiple feriados, each subtracted once | T3.2, T3.3 |
| AC-P2-15 fractional absenceValue sums exactly | T3.1 |
| AC-P2-16 student zero marks → totals 0, no error | T3.1, T3.7 |
| AC-P2-17 day > díasDelMes → "X", excluded from totals/hábiles | T3.2, T3.3 |

---

## Review Workload Forecast

| PR | New/edited files | Estimated new lines (code + tests) | Over 400? |
|----|------------------|-------------------------------------|-----------|
| PR1 — Base behavior (schema+migration+domain+repo+seed) | 2 new domain (VO+test), 2 domain edits, 1 schema edit, 1 migration, 1 repo edit + test, 2 use-case/seed edits + test | ~430 | **Yes (marginal)** |
| PR2 — CRUD + UI + grid filter | 2 use-case edits + test, 2 DTO edits, 1 controller edit + test, 2 web component edits + tests | ~410 | **Yes (marginal)** |
| PR3 — Backend agregación + endpoint + template | 1 domain util + test (~180), 1 pdf-service edit + test (~60), 1 template (~90), 1 use-case + 2 test files (~260), 1 controller+module + test (~140) | ~730 | **Yes** |
| PR4 — Front botones impresión | 1 web edit + test | ~120 | No |
| **Total** | **~20 files** | **~1,690 lines** | **Yes** |

**400-line budget risk:** High (PR3 ~1.8× budget; PR1/PR2 marginally over).
**Chained PRs recommended:** Yes.
**Decision needed before apply:** No — `delivery_strategy: auto-chain` already resolved; apply proceeds PR-by-PR without pausing for approval, but PR1, PR2, and PR3 each individually exceed the 400-line budget and SHOULD be sub-partitioned into stacked internal commits/reviews within their own PR, per the pattern used in `asistencia-dias-bloqueados`.

### Suggested internal stacking (within auto-chain, to respect 400-line review budget)

| PR | Internal split | Est. lines | Rationale |
|----|----------------|-----------|-----------|
| PR1a | Domain VO + entity (T1.1-T1.4) | ~150 | Domain-only, zero runtime risk |
| PR1b | Schema + migration + repo + seed (T1.5-T1.10) | ~280 | Riesgo A concentrated here; review migration SQL in isolation |
| PR2a | App use-cases + DTO + controller (T2.1-T2.5) | ~230 | Backend CRUD surface |
| PR2b | Web UI + grid filter (T2.6-T2.9) | ~180 | Frontend-only, independent review lens |
| PR3a | Domain totals util (T3.1-T3.3) | ~180 | Pure functions, easiest to review/verify against scenarios |
| PR3b | PDF service option + template (T3.4-T3.6) | ~150 | Additive infra change, isolated regression risk (boletín/constancia) |
| PR3c | Use-case + controller + module (T3.7-T3.11) | ~400 | Orchestration layer, right at budget |
| PR4 | Front buttons (T4.1-T4.2) | ~120 | Standalone, no further split needed |

Each internal split remains within a single PR branch (not separate GitHub PRs) unless the implementer judges a physical PR split adds review value — `auto-chain` means the top-level PR1→PR2→PR3→PR4 sequence proceeds without pausing for a chained/stacked-PR decision; the internal split above is a code-organization recommendation for `sdd-apply`, not an additional approval gate.
