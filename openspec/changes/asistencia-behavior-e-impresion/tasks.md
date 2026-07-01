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

- [ ] Edit `api/prisma_tenant/schema.prisma`
- [ ] Add `enum AttendanceBehavior { AUSENTE_INJUSTIFICADO AUSENTE_JUSTIFICADO NO_ELEGIBLE NO_COMPUTA TARDE_INJUSTIFICADA TARDE_JUSTIFICADA DIA_NO_HABIL }`
- [ ] Add `behavior AttendanceBehavior` (non-null in the final schema state) to `AttendanceType` model
- [ ] `pnpm --filter api prisma:generate` regenerates tenant client types

#### T1.6 [IMPL] Migration: create type → nullable column → backfill → NOT NULL

- [ ] Create tenant migration (per ADR-02, single migration file with staged SQL):
  1. `CREATE TYPE "AttendanceBehavior" AS ENUM (...)`
  2. `ALTER TABLE attendance_types ADD COLUMN behavior "AttendanceBehavior" NULL;`
  3. Backfill system types: `P` → `NO_COMPUTA`; `SAB`,`DOM`,`X` → `NO_ELEGIBLE`
  4. Backfill custom types by `(assignable, absenceValue)` heuristic: `assignable=false`→`NO_ELEGIBLE`; `assignable=true AND absenceValue=0`→`NO_COMPUTA`; `assignable=true AND 0<absenceValue<1`→`AUSENTE_JUSTIFICADO`; `assignable=true AND absenceValue>=1`→`AUSENTE_INJUSTIFICADO`; fallback→`NO_COMPUTA`
  5. `ALTER TABLE attendance_types ALTER COLUMN behavior SET NOT NULL;`
- [ ] Down migration: drop column + drop enum type; do NOT touch `assignable` or delete rows (rollback path)
- [ ] `pnpm --filter api prisma:migrate:tenant` (dev) applies cleanly on a fresh tenant DB
- [ ] **Manual verification note for apply**: dry-run the backfill SQL against a tenant DB dump/snapshot before merging (Riesgo A — no automated test covers real prod data shape)

### API infrastructure — repository

#### T1.7 [TEST] Repo tests for `behavior` persistence

- [ ] Edit/extend `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-attendance-type.repository.test.ts` (locate existing file for this repo; create if absent alongside the repo file)
- [ ] `save()` on create: persists `behavior` from the entity and computes `assignable = entity.behavior.isEligible()` (does NOT read an input `assignable`)
- [ ] `save()` preserves existing `isPresent` derivation formula unchanged (`absenceValue===0 && assignable`) — regression guard for `buildAsistencia` (out of scope, must not break)
- [ ] `toDomain()` reads `behavior` from the row and reconstructs the VO correctly for all 7 values

#### T1.8 [IMPL] Update `prisma-attendance-type.repository.ts` — run until T1.7 green

- [ ] Edit `api/src/infrastructure/persistence/prisma/repositories/prisma-attendance-type.repository.ts`
- [ ] `save()`: compute `assignable` from `entity.behavior.isEligible()`; persist `behavior` column; keep `isPresent` formula as-is
- [ ] `toDomain()`: read `behavior` from row, pass into `AttendanceType.reconstruct(...)`
- [ ] `pnpm --filter api test` green (this file's suite)

### API application — seed

#### T1.9 [TEST] Seed tests for system type `behavior`

- [ ] Edit `api/src/application/attendance-type/__tests__/ensure-attendance-types.use-case.test.ts`
- [ ] `P` seeded/ensured with `behavior = NO_COMPUTA` (P1-3)
- [ ] `SAB`, `DOM`, `X` seeded/ensured with `behavior = NO_ELEGIBLE` (P1-4)
- [ ] Idempotency: re-running `ensure` on already-seeded level does not change `behavior` of existing system rows

#### T1.10 [IMPL] Update `ensure-attendance-types-for-level.use-case.ts` — run until T1.9 green

- [ ] Edit `api/src/application/attendance-type/use-cases/ensure-attendance-types-for-level.use-case.ts`
- [ ] Set `behavior` per system code per the fixed map (ADR-02 step 3 / REQ-P1-3)
- [ ] **REVISAR** `api/scripts/backfill-system-attendance-types.ts` — if it sets `assignable` directly, add `behavior` to match (per design §5 "Scripts / seed")
- [ ] `pnpm --filter api test` green; `pnpm build` green (root)

---

## PR2 — CRUD + UI tipos + filtrado de grilla

**Satisfies:** REQ-P1-4, REQ-P1-5, REQ-P1-6, REQ-P1-7 / Scenarios P1-2, P1-5, P1-6, P1-7, P1-8, P1-9, P1-10, P1-11 / AC-P1-4, AC-P1-5, AC-P1-6, AC-P1-7, AC-P1-8, AC-P1-9, AC-P1-11
**Depends on:** PR1 (needs `AttendanceBehavior` VO + entity prop + migrated column in place)

### API application — use-cases

#### T2.1 [TEST] Use-case tests: create/update accept `behavior`, reject out-of-range, keep system lock

- [ ] Edit `api/src/application/attendance-type/__tests__/attendance-type.use-cases.test.ts`
- [ ] Create: valid `behavior` (e.g. 6) → succeeds, `absenceValue` stored independent of `behavior` (P1-1/Scenario P1-1)
- [ ] Create: `behavior` out of range (e.g. `'INVALID'` payload before DTO layer, or invalid enum member) → validation error, no row created (Scenario P1-2)
- [ ] Update: system type (`isSystem=true`) attempted update to description/absenceValue/behavior → rejected via existing `assertMutable`, row unchanged (Scenario P1-5)
- [ ] Delete: system type → rejected, row remains active (Scenario P1-6)
- [ ] Update/Delete: custom type → succeeds (Scenario P1-7)
- [ ] Update: `behavior` optional on input; omitted → keeps `entity.behavior` unchanged
- [ ] Create 7 distinct custom types, one per behavior 1-7 → all succeed, no uniqueness conflict on `behavior` (Scenario P1-11)

#### T2.2 [IMPL] Update `attendance-type.use-cases.ts` — run until T2.1 green

- [ ] Edit `api/src/application/attendance-type/use-cases/attendance-type.use-cases.ts`
- [ ] `CreateAttendanceTypeUseCase`: input takes `behavior` instead of `assignable`
- [ ] `UpdateAttendanceTypeUseCase`: `behavior` optional in input; reconstruct with `input.behavior ?? entity.behavior`
- [ ] No change to `assertMutable` call sites (lock already wired — ADR-04)

### API presentation — DTO + controller

#### T2.3 [TEST] DTO validation tests

- [ ] Edit `api/src/presentation/attendance-type/__tests__/dto-validation.test.ts`
- [ ] Create DTO: `behavior` required, must be one of the 7 enum members; rejects unknown values (Scenario P1-2)
- [ ] Update DTO: `behavior` optional; when present, same enum validation
- [ ] Both DTOs no longer accept/require `assignable` as input

#### T2.4 [TEST] Controller tests: `toResponse` exposes `behavior` + derived `assignable`

- [ ] Edit `api/src/presentation/attendance-type/__tests__/attendance-type.controller.test.ts`
- [ ] Response payload includes `behavior: <value>` for created/updated/listed types
- [ ] Response payload still includes `assignable` (derived, for backward compat with current consumers)
- [ ] `behavior=3` (`NO_ELEGIBLE`) type still returns `assignable: false` in the response (compat check)

#### T2.5 [IMPL] Update DTOs + controller — run until T2.3 + T2.4 green

- [ ] Edit `api/src/presentation/attendance-type/dto/create-attendance-type.dto.ts`: replace `assignable: z.boolean()` with `behavior: z.nativeEnum(AttendanceBehaviorValue)` (or `z.enum([...7 literals])`)
- [ ] Edit `api/src/presentation/attendance-type/dto/update-attendance-type.dto.ts`: replace `assignable` with optional `behavior`
- [ ] Edit `api/src/presentation/attendance-type/attendance-type.controller.ts`: `toResponse` adds `behavior: entity.behavior.get()`, keeps `assignable` in output; wire DTO `behavior` into use-case inputs
- [ ] `pnpm --filter api test` green; `pnpm --filter api typecheck` clean

### Web — attendance-types admin UI

#### T2.6 [TEST] Component test: `behavior` selector in create/edit form

- [ ] Locate or create test file alongside `web/src/pages/dashboard/attendance-types.tsx` (mirror existing test conventions in `web/src/pages/dashboard/__tests__/`)
- [ ] Form renders a `behavior` dropdown with the 7 labeled options for custom-type create/edit
- [ ] Selector disabled/hidden when editing a system type (`isSystem=true`)
- [ ] Submitting create sends `behavior` in the payload; no `assignable` toggle rendered as input anymore

#### T2.7 [IMPL] Update `attendance-types.tsx` — run until T2.6 green

- [ ] Edit `web/src/pages/dashboard/attendance-types.tsx`
- [ ] Add `behavior` select (7 labeled options) to create/edit form; remove `assignable` boolean input
- [ ] Disable/hide behavior field for system-type rows

### Web — grid filter/lock

#### T2.8 [TEST] Component tests: grid combo filters by `behavior`, lock by `behavior`

- [ ] Locate or extend `web/src/pages/dashboard/__tests__/asistencia-mensual.spec.tsx` (existing file from prior change `asistencia-dias-bloqueados`)
- [ ] `behavior = NO_ELEGIBLE` (3) type MUST NOT appear in the editable-cell combo (Scenario P1-8, AC-P1-7)
- [ ] Types with `behavior` in `{1,2,4,5,6,7}` MUST appear in the combo when `active` (Scenario P1-9, AC-P1-8)
- [ ] Lock check (previously `at?.assignable === false`) now reads `at?.behavior === 'NO_ELEGIBLE'`
- [ ] Custom `Feriado` (`behavior=7`, `active=true`) IS selectable and can be assigned day-by-day for one student without affecting others (Scenario P1-10, AC-P1-9)

#### T2.9 [IMPL] Update `asistencia-mensual.tsx` — run until T2.8 green

- [ ] Edit `web/src/pages/dashboard/asistencia-mensual.tsx`
- [ ] Add `behavior: string` to `AttendanceTypeItem` interface
- [ ] Line ~439 combo filter: `attendanceTypes.filter(t => t.active && t.behavior !== 'NO_ELEGIBLE')` (was `t.assignable`)
- [ ] Line ~677 lock check: `isLockedByCode = at?.behavior === 'NO_ELEGIBLE'` (was `at?.assignable === false`)
- [ ] `pnpm --filter web test` (or root `pnpm test`) green; `pnpm build` green

---

## PR3 — Backend agregación + endpoint + template impresión

**Satisfies:** REQ-P2-1 through REQ-P2-7 / Scenarios P2-1..P2-11 / AC-P2-1..AC-P2-17
**Depends on:** PR1 (catalog needs `behavior`). Independent of PR2 in code; stacked after it by delivery order.

### Domain — aggregator

#### T3.1 [TEST] Unit tests for `computeStudentTotals`

- [ ] Create `packages/domain/src/asistencia/utils/__tests__/asistencia-totals.test.ts`
- [ ] P2-3: days with behavior 6 (0.5+0.5) and behavior 5 (1) → `tardesJust=1.0`, `tardesInj=1.0`, `totalTardes=2.0`
- [ ] P2-4: days with behavior 1 (1) and behavior 2 (1+0.5) → `ausJust=1.5`, `ausInj=1.0`, `ausTotal=2.5`
- [ ] P2-8: fractional absenceValue 0.25 + 0.75 both behavior 6 → `tardesJust=1.00`
- [ ] P2-9: student with no marks (empty/blank days) → all six totals = 0, no throw
- [ ] Days with behavior 3, 4, 7 contribute to none of the six totals
- [ ] Unknown/missing catalog entry for a day code → does not throw, contributes 0 (defensive, supports P2-9/edge)

#### T3.2 [TEST] Unit tests for días hábiles computation

- [ ] Same or sibling test file as T3.1 (e.g. `computeDiasHabiles` suite)
- [ ] P2-5: 30-day month, 4 Sundays (behavior 3) + 1 weekday Feriado (behavior 7) → `díasHábiles = 30 - 5 = 25`
- [ ] P2-6: day is BOTH Sunday (behavior 3 source) AND marked Feriado (behavior 7 source) → subtracted exactly once, not twice
- [ ] P2-7: 31-day month, 4 Sundays + 4 Saturdays + 2 weekday Feriados → `díasHábiles = 31 - 10 = 21`
- [ ] P2-10: month with 28 days, evaluated over a 31-column grid → columns 29/30/31 excluded from both the totals and the días hábiles subtraction (they render "X" per web, but the pure function only sees valid day indices 1..daysInMonth)
- [ ] AC-P2-12: days with behavior in `{1,2,4,5,6}` count as día hábil (not subtracted)

#### T3.3 [IMPL] Create `asistencia-totals.ts` — run until T3.1 + T3.2 green

- [ ] Create `packages/domain/src/asistencia/utils/asistencia-totals.ts`
- [ ] `computeStudentTotals(days: Record<string,string>, catalog: Map<string,{behavior: AttendanceBehaviorValue, absenceValue: number}>)`: returns `{ tardesJust, tardesInj, totalTardes, ausJust, ausInj, ausTotal }` as weighted sums per ADR-06 formula
- [ ] `computeDiasHabiles(daysInMonth: number, dayCodes: Record<string,string>, catalog: Map<...>)`: builds a `Set` of day indices 1..daysInMonth classified as behavior 3 or 7 (ADR-07 anti-double-count), returns `daysInMonth - set.size`
- [ ] Add exports to `packages/domain/src/asistencia/index.ts` and `packages/domain/src/index.ts`
- [ ] `pnpm --filter @educandow/domain test` green; `pnpm build` green in `packages/domain`

### API infrastructure — PDF options + template

#### T3.4 [TEST] `PdfGeneratorService.generatePdf` accepts landscape option

- [ ] Locate/create `api/src/infrastructure/reporting/__tests__/pdf-generator.service.test.ts`
- [ ] `generatePdf(html)` (no options) still calls `page.pdf({ format:'A4', ...portrait defaults })` unchanged (regression guard for boletines/constancia — ADR-09)
- [ ] `generatePdf(html, { landscape: true })` calls `page.pdf({ format:'A4', landscape: true, ... })`
- [ ] `generatePdf(html, { margin: {...} })` overrides only the provided margin keys, others keep default

#### T3.5 [IMPL] Extend `pdf-generator.service.ts` — run until T3.4 green

- [ ] Edit `api/src/infrastructure/reporting/pdf-generator.service.ts`
- [ ] `generatePdf(html: string, options?: { landscape?: boolean; margin?: Partial<{top:string;bottom:string;left:string;right:string}> }): Promise<Buffer>`
- [ ] Merge `options.margin` over the current default margin object; pass `landscape: options?.landscape ?? false` to `page.pdf(...)`
- [ ] Confirm the 3 existing call sites (boletín single/batch, constancia) still compile with zero args (backward compatible)

#### T3.6 [IMPL] Create landscape template (no dedicated unit test — covered by T3.9 use-case test rendering real HTML)

- [ ] Create `api/src/infrastructure/reporting/html-templates/asistencia-mensual.hbs`
- [ ] `@page { size: A4 landscape }`, `table-layout: fixed`, small font for 31 day columns + 6 total columns
- [ ] Header: institución, curso/materia, mes/año, "Días hábiles: {{diasHabiles}}"
- [ ] Table: rows = alumnos (pre-sorted by repo), columns = day codes `1..daysInMonth` + 6 total columns (Tardes Just / Tardes Inj / Total Tardes / Aus Just / Aus Inj / Aus Total)
- [ ] Register any helpers needed (e.g. `lookup` for per-day code) following `generate-boletin.use-case.ts` pattern

### API application — use-case + error

#### T3.7 [TEST] Unit tests for `GenerateAsistenciaMensualPdfUseCase` — General scope

- [ ] Create `api/src/application/asistencia-reporting/__tests__/generate-asistencia-mensual-pdf.use-case.test.ts`
- [ ] `executeGeneral`: mocks `attendanceType.findMany`, `findByScopeAndMonthEnriched` (general repo), `pdfGenerator.generatePdf`; resolves `level` from `courseCycleId`
- [ ] View-model passed to template includes per-student six totals computed via `computeStudentTotals` (P2-3/P2-4 wired through the use-case, not re-tested numerically here — trust T3.1)
- [ ] `díasHábiles` computed once at course level via `computeDiasHabiles`, included in the view-model (P2-5/P2-7 wired through)
- [ ] `generatePdf` called with `{ landscape: true }`
- [ ] Student with no marks for the month → row present with all totals 0, no throw (Scenario P2-9)
- [ ] Unknown/missing `courseCycleId` → domain error with correct HTTP status via `AsistenciaReportingError` (NotFound-style)

#### T3.8 [TEST] Unit tests for `GenerateAsistenciaMensualPdfUseCase` — Por Materia scope

- [ ] Same file or sibling `__tests__/generate-asistencia-mensual-pdf.use-case.materia.test.ts`
- [ ] `executeMateria`: resolves `level` via `materiaXCursoXCicloId → courseCycle → level` (confirm exact relation path against tenant schema while implementing — Riesgo C)
- [ ] Same totals/días-hábiles wiring as General (Scenario P2-11 — values MUST match General given equivalent input data)
- [ ] Unknown `materiaXCursoXCicloId` → same error contract as General

#### T3.9 [IMPL] Create `generate-asistencia-mensual-pdf.use-case.ts` + `AsistenciaReportingError` — run until T3.7 + T3.8 green

- [ ] Create `api/src/application/asistencia-reporting/generate-asistencia-mensual-pdf.use-case.ts`
- [ ] Create `AsistenciaReportingError` class (pattern: `BoletinError`, carries `httpStatus`)
- [ ] `executeGeneral(courseCycleId, year, month): Promise<Buffer>` and `executeMateria(materiaXCursoXCicloId, year, month): Promise<Buffer>` per ADR-08 data flow (resolve level → build catalog via `attendanceType.findMany({level})` → fetch enriched rows via existing `findByScopeAndMonthEnriched` → per-student `computeStudentTotals` + course-level `computeDiasHabiles` → compile `asistencia-mensual.hbs` in the constructor (fs.readFileSync + Handlebars.compile, same probe pattern as `generate-boletin.use-case.ts`) → `pdfGenerator.generatePdf(html, {landscape:true})`)
- [ ] `pnpm --filter api test` green

### API presentation — controller + module

#### T3.10 [TEST] Controller tests for print endpoints

- [ ] Create `api/src/presentation/asistencia-reporting/__tests__/asistencia-reporting.controller.test.ts`
- [ ] `GET .../asistencia-mensual/general/:courseCycleId/print?year=&month=` → calls `executeGeneral`, sets `Content-Type: application/pdf` + `Content-Disposition: attachment`, returns buffer body
- [ ] `GET .../asistencia-mensual/materia/:materiaXCursoXCicloId/print?year=&month=` → calls `executeMateria`, same headers
- [ ] Guards: `AuthGuard` + `RolesGuard` applied; confirm `@Roles(...)` module/action matches the existing asistencia permissions catalog (resolve Riesgo "Permisos" during implementation — confirm REPORTS vs ATTENDANCE against the real permission list)
- [ ] Missing/invalid `year`/`month` query params → 400 before hitting the use-case

#### T3.11 [IMPL] Create controller + module — run until T3.10 green

- [ ] Create `api/src/presentation/asistencia-reporting/asistencia-reporting.controller.ts` (two GET routes per ADR-08)
- [ ] Create `api/src/presentation/asistencia-reporting/asistencia-reporting.module.ts` (imports `PdfGeneratorService`, `PrismaService`, existing asistencia repos, registers the use-case)
- [ ] Edit `app.module.ts` to register the new module
- [ ] `pnpm --filter api test` green; `pnpm --filter api typecheck` clean; `pnpm build` green (root)

---

## PR4 — Front botones impresión

**Satisfies:** REQ-P2-1 / Scenarios P2-1, P2-2 / AC-P2-1, AC-P2-2
**Depends on:** PR3 (consumes the print endpoints)

### Web — print buttons

#### T4.1 [TEST] Component tests: "Imprimir" buttons trigger blob download

- [ ] Extend `web/src/pages/dashboard/__tests__/asistencia-mensual.spec.tsx`
- [ ] General module: "Imprimir" button renders; click calls `apiClient.get(generalPrintEndpoint, { responseType: 'blob' })` with current `courseCycleId`/`year`/`month` (Scenario P2-1)
- [ ] Por Materia module: "Imprimir" button renders; click calls the materia print endpoint with `materiaXCursoXCicloId`/`year`/`month` (Scenario P2-2)
- [ ] On success, a blob URL is created and a download is triggered (mock URL.createObjectURL + anchor click)
- [ ] No `html2pdf`/client-side generation path is invoked (regression guard — REQ-P2-2)

#### T4.2 [IMPL] Add print buttons — run until T4.1 green

- [ ] Edit `web/src/pages/dashboard/asistencia-mensual.tsx`
- [ ] Add "Imprimir" button to the General module block: `apiClient.get(...)` with `responseType: 'blob'`, build `blob` URL + `<a download>` trigger, no `html2pdf`
- [ ] Add "Imprimir" button to the Por Materia module block: same pattern against the materia endpoint
- [ ] `pnpm --filter web test` (or root `pnpm test`) green; `pnpm build` green (root)

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
