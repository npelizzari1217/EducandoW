# Tasks — llamados-examen-terciario

> Phase: sdd-tasks · Date: 2026-06-18 · TDD: strict · Test runner: `pnpm test`
> Delivery: single-pr · Budget: ~820 lines estimated → **size:exception required before apply**
> Depends on spec (#1178) + design (#1179) + decisions (#1175)

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| New files | 12 (+ 1 migration) |
| New lines (domain + app + infra + presentation + tests) | ~820 |
| Modified files | 4 (`index.ts`, `schema.prisma`, `nivel-terciario.module.ts`, `exception.filter.ts`) |
| Modified lines | ~35 |
| **Total changed lines** | **~855** |
| 400-line budget risk | **HIGH** |
| Chained PRs recommended | No — single vertical slice, logically atomic |
| Decision needed before apply | **YES — record `size:exception` before launching sdd-apply** |

All new code is in one vertical slice (`LlamadoExamen`). Splitting would leave the feature half-wired.
The orchestrator MUST confirm `size:exception` before delegating `sdd-apply`.

---

## Dependency legend

- `→` sequential (depends on previous task)
- `‖` can start in parallel with other tasks at the same group boundary
- `[TEST]` produces a **failing** test file (red step in TDD)
- `[IMPL]` makes the preceding `[TEST]` green, or adds a file with no direct test
- `[VERIFY]` runs the suite / build; gates the next group

---

## Group A — Domain layer: errors, VO, entity, port, barrel

Sequential chain. Each `[IMPL]` unlocks the next `[TEST]`.

---

### T01 · [x] [TEST] RangoFechas VO — failing tests

**Satisfies**: R2 (INV-RANGE), Design §2.1

**Action**: Create test file with all `RangoFechas` cases. The VO does not yet exist; the file imports
it from its future path so the test run fails with a compile/import error (red).

**File**: `packages/domain/src/terciario/__tests__/value-objects/rango-fechas.test.ts`

**Test cases required**:
1. `inicio < fin` → `ok(RangoFechas)`, `inicio` and `fin` accessible
2. `inicio === fin` → `ok(RangoFechas)` (equal is VALID per R2 scenario)
3. `inicio > fin` → `err(InvalidLlamadoRangeError)` with code `INVALID_LLAMADO_RANGE`
4. `overlaps()` truth table:
   - `[07-01, 07-15]` vs `[07-10, 07-20]` → `true` (partial overlap)
   - `[07-01, 07-15]` vs `[07-16, 07-31]` → `false` (**boundary-adjacent: must NOT overlap**)
   - `[07-01, 07-15]` vs `[07-01, 07-15]` → `true` (same range)
   - `[07-01, 07-15]` vs `[07-15, 07-16]` → `true` (end-start touch = overlap)
   - `[07-01, 07-31]` vs `[06-01, 08-31]` → `true` (contained)

**Done criteria**: `pnpm test` runs and fails specifically on this file (import error or assertion error).

---

### T02 · [x] [IMPL] Domain errors: `InvalidLlamadoRangeError` + `LlamadoOverlapError`

**Satisfies**: R2, R3, Design §2.3 (ADR-3)

**Action**: Create both typed error classes extending `DomainError` with stable codes.

**Files**:
- `packages/domain/src/terciario/errors/invalid-llamado-range.error.ts`
  ```ts
  export class InvalidLlamadoRangeError extends DomainError {
    constructor(inicio: Date, fin: Date) {
      super(`fechaInicio (${inicio.toISOString()}) debe ser <= fechaFin (${fin.toISOString()})`,
            'INVALID_LLAMADO_RANGE');
    }
  }
  ```
- `packages/domain/src/terciario/errors/llamado-overlap.error.ts`
  ```ts
  export class LlamadoOverlapError extends DomainError {
    constructor(anioAcademico: string) {
      super(`Ya existe un llamado activo solapado en el año académico ${anioAcademico}`,
            'LLAMADO_OVERLAP');
    }
  }
  ```

**Done criteria**: `pnpm --filter api typecheck` (or domain tsc) exits 0 for these two files.

---

### T03 · [x] [IMPL] `RangoFechas` VO — makes T01 green → (T02 must be done first)

**Satisfies**: R2, Design §2.1

**Action**: Create the immutable, self-validating VO.

**File**: `packages/domain/src/terciario/value-objects/rango-fechas.ts`

**Contract**:
- Private constructor; public readonly `inicio: Date`, `fin: Date`
- `static create(inicio, fin): Result<RangoFechas, InvalidLlamadoRangeError>` — returns `err` when `inicio.getTime() > fin.getTime()`; equal is valid
- `overlaps(other: { inicio: Date; fin: Date }): boolean` — inclusive: `this.inicio <= other.fin && this.fin >= other.inicio`

**Done criteria**: `pnpm test` passes all T01 test cases.

---

### T04 · [x] [TEST] `LlamadoExamen` entity — failing tests → (T03 done)

**Satisfies**: R1, R2, R7 (softDelete), Design §2.2

**Action**: Create test file for the entity. Entity does not yet exist; tests fail at import.

**File**: `packages/domain/src/terciario/__tests__/entities/llamado-examen.test.ts`

**Test cases required**:
1. `LlamadoExamen.create(validInput)` → `ok` with all fields set; `active = true`, `deletedAt` undefined
2. `LlamadoExamen.create(invalidRange)` → `err(InvalidLlamadoRangeError)`
3. `entity.update({ nombre: 'Nuevo' })` → `ok(void)`, nombre updated, `updatedAt` refreshed
4. `entity.update({ fechaInicio, fechaFin })` where `inicio > fin` → `err(InvalidLlamadoRangeError)`
5. `entity.update({ fechaFin: extended })` with valid range → `ok(void)`, new fin stored
6. `entity.softDelete()` → `active === false`, `deletedAt` is a `Date`
7. `LlamadoExamen.reconstruct(props)` → entity with exact props (for repo toDomain)

**Done criteria**: `pnpm test` fails on this file.

---

### T05 · [x] [IMPL] `LlamadoExamen` entity — makes T04 green → (T03 done)

**Satisfies**: R1, R2, R5 (update), R7 (softDelete), Design §2.2

**Action**: Create the entity class.

**File**: `packages/domain/src/terciario/entities/llamado-examen.ts`

**Contract**:
- Private constructor, `LlamadoExamenProps` interface: `id: Id`, `nombre: string`, `anioAcademico: string` (ADR-1), `rango: RangoFechas`, `active: boolean`, `deletedAt?: Date`, `createdAt: Date`, `updatedAt: Date`
- `CreateLlamadoExamenInput` interface
- `static create(input)`: calls `RangoFechas.create`; returns `err` on invalid range; sets `id = Id.create()`, `active = true`, timestamps to `new Date()`
- `static reconstruct(props)`: no validation (DB rows are trusted)
- `update({ nombre?, fechaInicio?, fechaFin? })`: re-validates `RangoFechas` on the merged state; updates `updatedAt`
- `softDelete()`: `active = false`, `deletedAt = new Date()`
- Getters: `id`, `nombre`, `anioAcademico`, `fechaInicio` (= `rango.inicio`), `fechaFin` (= `rango.fin`), `rango`, `active`, `deletedAt`, `createdAt`, `updatedAt`

**Done criteria**: `pnpm test` passes all T04 test cases.

---

### T06 · [x] [IMPL] Repository port `LlamadoExamenRepository` → (T05 done)

**Satisfies**: R4–R7, Design §2.4

**Action**: Create the port interface and injection token.

**File**: `packages/domain/src/terciario/repositories/llamado-examen-repository.ts`

**Contract**:
```ts
export interface LlamadoExamenRepository {
  findById(id: string): Promise<LlamadoExamen | null>;
  findByAnioAcademico(anioAcademico: string): Promise<LlamadoExamen[]>; // active only, ASC fechaInicio
  findOverlapping(anioAcademico: string, inicio: Date, fin: Date, excludeId?: string): Promise<LlamadoExamen[]>;
  save(llamado: LlamadoExamen): Promise<void>;
}
export const LLAMADO_EXAMEN_REPOSITORY = 'LlamadoExamenRepository';
```

**Done criteria**: `pnpm --filter api typecheck` exits 0.

---

### T07 · [x] [IMPL] Update terciario domain barrel → (T02–T06 done)

**Satisfies**: Design §2.4 ("Exports added to index.ts")

**Action**: Add exports for all new symbols to the terciario barrel.

**File**: `packages/domain/src/terciario/index.ts`

**Add exports for**:
- `LlamadoExamen`, `LlamadoExamenProps`, `CreateLlamadoExamenInput`
- `RangoFechas`
- `InvalidLlamadoRangeError`, `LlamadoOverlapError`
- `LlamadoExamenRepository`, `LLAMADO_EXAMEN_REPOSITORY`

**Done criteria**: `pnpm build` in the domain package exits 0; all symbols importable from `@educandow/domain`.

---

### [VERIFY A] Domain green gate

**Command**: `pnpm test --filter domain` (or `pnpm test`)

**Done criteria**: T01 + T04 tests pass; no regressions in existing terciario tests.

---

## Group B — Persistence: Prisma schema + migration + repository

Can start in parallel with Group C (‖) once Group A is complete.

---

### T08 · [x] [IMPL] Add `LlamadoExamen` model to tenant Prisma schema ‖

**Satisfies**: R1, Design §6

**Action**: Insert the Prisma model block in the Terciario section (after `ActaExamen`).

**File**: `api/prisma_tenant/schema.prisma`

**Model to add**:
```prisma
model LlamadoExamen {
  id            String    @id @default(uuid())
  nombre        String
  anioAcademico String    @map("anio_academico")
  fechaInicio   DateTime  @map("fecha_inicio")
  fechaFin      DateTime  @map("fecha_fin")
  active        Boolean   @default(true)
  deletedAt     DateTime? @map("deleted_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt      @map("updated_at")

  @@index([anioAcademico])
  @@index([fechaInicio])
  @@map("llamados_examen")
}
```

**Constraints**: tenant schema only (`api/prisma_tenant`); master schema untouched. No FK to any other table (D1, D6).

**Done criteria**: `pnpm --filter api prisma:generate` exits 0; Prisma client exposes `client.llamadoExamen.*`.

---

### T09 · [x] [IMPL] Run Prisma tenant migration → (T08 done)

**Satisfies**: R1 (table must exist for the repo)

**Action**: Generate and apply the dev migration.

**Command**: `pnpm --filter api prisma:migrate:tenant`

**Done criteria**: New migration file created under `api/prisma_tenant/migrations/`; table `llamados_examen` exists in the local dev DB.

---

### T10 · [x] [IMPL] `PrismaLlamadoExamenRepository` → (T09 done, T07 done)

**Satisfies**: R4–R7, Design §5

**Action**: Create the Prisma implementation of the repository port, mirroring `PrismaMesaExamenRepository`.

**File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-llamado-examen.repository.ts`

**Key implementation details**:
- `get client()` → `TenantContext.getClient()` (tenant-only, never master)
- `toDomain(row)` → `RangoFechas.create(row.fechaInicio, row.fechaFin).unwrap()` (DB rows are trusted) + `LlamadoExamen.reconstruct(props)`
- `findById(id)` → returns `null` if not found (controller treats null and soft-deleted as 404; use case handles both)
- `findByAnioAcademico(anio)` → `where: { anioAcademico: anio, active: true, deletedAt: null }`, `orderBy: { fechaInicio: 'asc' }`
- `findOverlapping(anio, inicio, fin, excludeId?)` → inclusive interval: `fechaInicio: { lte: fin }`, `fechaFin: { gte: inicio }`, plus `active: true, deletedAt: null`, plus `id: { not: excludeId }` when `excludeId` is provided
- `save(llamado)` → Prisma `upsert` on `id`

**Done criteria**: `pnpm --filter api typecheck` exits 0; implements `LlamadoExamenRepository` interface fully.

---

## Group C — Application layer: use cases

Can start in parallel with Group B (‖) after Group A verify passes.

---

### T11 · [x] [TEST] All 4 use cases — failing tests ‖

**Satisfies**: R4, R5, R6, R7, R3 (overlap policy), Design §3 + §8

**Action**: Create the use case test file with a fake in-memory `LlamadoExamenRepository`. Use cases do not yet exist; tests fail at import.

**File**: `api/src/application/nivel-terciario/__tests__/llamado-examen.use-cases.test.ts`

**Test cases required** (mirrors `acta-examen.use-cases.test.ts` + carrera tests):

**CreateLlamadoExamenUC**:
1. Valid input → `ok(LlamadoExamen)`, entity persisted
2. `fechaInicio > fechaFin` → `err(InvalidLlamadoRangeError)` (no repo interaction)
3. Overlapping active record in same `anioAcademico` → `err(LlamadoOverlapError)`
4. Same dates as an active record in a **different** `anioAcademico` → `ok` (no overlap across years)
5. Same dates as a **soft-deleted** record in same `anioAcademico` → `ok` (deleted excluded from overlap)

**UpdateLlamadoExamenUC**:
6. Unknown `id` → `err(NotFoundError)`
7. `id` exists but `deletedAt != null` → `err(NotFoundError)` (soft-deleted treated as not found)
8. Valid `{ nombre }` update → `ok(LlamadoExamen)` with new nombre
9. `fechaInicio > fechaFin` on update → `err(InvalidLlamadoRangeError)`
10. Overlap with a different active record → `err(LlamadoOverlapError)`
11. Self-exclusion: extend own `fechaFin` when no other records in year → `ok` (no self-overlap)

**ListLlamadosExamenUC**:
12. Returns only active records for the given `anioAcademico`, sorted `fechaInicio ASC`
13. Empty year → `ok([])` with empty array
14. Soft-deleted records excluded from result

**DeleteLlamadoExamenUC**:
15. Active record → `ok(void)`, entity has `active=false` and `deletedAt` set
16. Unknown `id` → `err(NotFoundError)`
17. Already soft-deleted record → `err(NotFoundError)`

**Boundary test (explicit)**:
18. Existing `[2025-07-01, 2025-07-15]`; create `[2025-07-16, 2025-07-31]` → `ok` (adjacent dates, day after, must NOT overlap)

**Done criteria**: `pnpm test` fails on this file (import error or assertion errors).

---

### T12 · [x] [IMPL] 4 use cases — makes T11 green → (T11 done)

**Satisfies**: R4, R5, R6, R7, Design §3

**Action**: Create all four use cases in a single file with shared overlap helper.

**File**: `api/src/application/nivel-terciario/use-cases/llamado-examen.use-cases.ts`

**Implementation notes**:
- Each use case injects `LlamadoExamenRepository` via `LLAMADO_EXAMEN_REPOSITORY` token
- `private async assertNoOverlap(repo, anioAcademico, inicio, fin, excludeId?)` → calls `findOverlapping`; returns `err(LlamadoOverlapError)` if any clashes
- `CreateLlamadoExamenUC.execute`: `LlamadoExamen.create(input)` (range check) → `assertNoOverlap` → `repo.save` → `ok(entity)`
- `UpdateLlamadoExamenUC.execute`: `findById` (null → NotFoundError, deletedAt != null → NotFoundError) → `entity.update(input)` → `assertNoOverlap(excludeId=id)` → `repo.save` → `ok(entity)`
- `ListLlamadosExamenUC.execute`: `repo.findByAnioAcademico(anioAcademico)` → `ok(array)`
- `DeleteLlamadoExamenUC.execute`: `findById` (null/soft-deleted → NotFoundError) → `entity.softDelete()` → `repo.save` → `ok(undefined)` — **Result-returning, never throw** (ADR-2 in design §3 note)
- All methods return `Result<T, E>` — zero throws in the application layer (NFR)

**Done criteria**: `pnpm test` passes all T11 cases.

---

### [VERIFY B] Application green gate

**Command**: `pnpm test`

**Done criteria**: T11 tests pass; all prior tests still pass.

---

## Group D — Presentation layer: DTOs, filter, controller, DI

Sequential within the group. Starts after [VERIFY B] and after T10.

---

### T13 · [x] [IMPL] Zod DTO schemas ‖ (after [VERIFY B])

**Satisfies**: R4 (create input), R5 (update input), R6 (query param), ADR-4 (Zod → 400)

**Action**: Create Zod schemas for all 3 operations.

**File**: `api/src/presentation/nivel-terciario/dto/llamado-examen.dto.ts`

**Schemas**:
```ts
export const CreateLlamadoExamenSchema = z.object({
  nombre:        z.string().min(1),
  anioAcademico: z.string().min(1),          // String — ADR-1
  fechaInicio:   z.string().datetime(),      // ISO 8601; controller converts to Date
  fechaFin:      z.string().datetime(),
});

export const UpdateLlamadoExamenSchema = z.object({
  nombre:      z.string().min(1).optional(),
  fechaInicio: z.string().datetime().optional(),
  fechaFin:    z.string().datetime().optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'al menos un campo requerido' });

export const ListLlamadosExamenQuerySchema = z.object({
  anioAcademico: z.string().min(1),
});
```

**Note**: No cross-field range validation in Zod — INV-RANGE is the domain's responsibility (single source of truth). Missing required fields or invalid format → **400** (ADR-4, shared `ZodValidationPipe`).

**Done criteria**: `pnpm --filter api typecheck` exits 0.

---

### T14 · [x] [IMPL] Register error codes in exception filter ‖ (after [VERIFY B])

**Satisfies**: R2 (422 for range), R3 (409 for overlap), Design §4.3

**Action**: Add two entries to the `DOMAIN_STATUS` map (additive, non-breaking).

**File**: `api/src/presentation/shared/filters/exception.filter.ts`

**Add**:
```ts
INVALID_LLAMADO_RANGE: 422,
LLAMADO_OVERLAP:       409,
```

**Note**: `NOT_FOUND` → 404 is already registered. These are the only two new mappings. Locate the `DOMAIN_STATUS` or equivalent map in the filter and add the entries there.

**Done criteria**: Filter compiles; `pnpm --filter api typecheck` exits 0.

---

### T15 · [x] [IMPL] `LlamadoExamenController` → (T13 done, T14 done, T12 done)

**Satisfies**: R4–R8, Design §4.1

**Action**: Create the NestJS controller with 4 routes, Zod pipes, guards, and DTO mapping.

**File**: `api/src/presentation/nivel-terciario/llamado-examen.controller.ts`

**Route table**:

| Method | Path | Guard/Role | Status | Body/Query |
|---|---|---|---|---|
| POST | `terciario/llamados-examen` | GRADES/CREATE | 201 | `CreateLlamadoExamenSchema` |
| GET | `terciario/llamados-examen` | GRADES/READ | 200 | `ListLlamadosExamenQuerySchema` (query param) |
| PATCH | `terciario/llamados-examen/:id` | GRADES/UPDATE | 200 | `UpdateLlamadoExamenSchema` |
| DELETE | `terciario/llamados-examen/:id` | GRADES/DELETE | 204 | — |

**Implementation notes**:
- `@Controller('terciario/llamados-examen')` + `@UseGuards(AuthGuard, RolesGuard, LevelsGuard)` + `@Levels(EducationalLevelCode.TERCIARIO)` on class
- Each route: `@Roles('ROOT', { module: 'GRADES', action: '...' })`
- POST/PATCH: `@UsePipes(new ZodValidationPipe(schema))` → parse; controller converts ISO strings to `Date` before calling UC
- GET: parse query with `ListLlamadosExamenQuerySchema` (Zod parse failure → 400 via pipe)
- DELETE: `@HttpCode(HttpStatus.NO_CONTENT)` → 204 no response body
- `result.isErr()` → `throw result.unwrapErr()` (AppExceptionFilter maps the code → HTTP status)
- Success → `{ data: toDto(entity) }` for POST/GET/PATCH; no body for DELETE
- `toDto(l)` → `{ id: l.id.get(), nombre: l.nombre, anioAcademico: l.anioAcademico, fechaInicio: l.fechaInicio.toISOString(), fechaFin: l.fechaFin.toISOString(), active: l.active }`
- GET response → `{ data: entities.map(toDto) }`

**ADR-4 alignment**: Zod pipe throws `BadRequestException` → **400** (not 422). Domain INV-RANGE error code → **422** via filter. These are distinct code paths. Task verifier must expect 400 for malformed input, 422 for valid-but-violating-invariant input.

**Done criteria**: `pnpm --filter api typecheck` exits 0.

---

### T16 · [x] [IMPL] DI wiring in `nivel-terciario.module.ts` → (T10, T12, T15 done)

**Satisfies**: Design §7

**Action**: Register the repository, use cases, and controller in the module.

**File**: `api/src/presentation/nivel-terciario/nivel-terciario.module.ts`

**Add to `providers`**:
```ts
PrismaLlamadoExamenRepository,
{ provide: LLAMADO_EXAMEN_REPOSITORY, useExisting: PrismaLlamadoExamenRepository },
{ provide: CreateLlamadoExamenUC, useFactory: (r) => new CreateLlamadoExamenUC(r), inject: [LLAMADO_EXAMEN_REPOSITORY] },
{ provide: UpdateLlamadoExamenUC, useFactory: (r) => new UpdateLlamadoExamenUC(r), inject: [LLAMADO_EXAMEN_REPOSITORY] },
{ provide: ListLlamadosExamenUC,  useFactory: (r) => new ListLlamadosExamenUC(r),  inject: [LLAMADO_EXAMEN_REPOSITORY] },
{ provide: DeleteLlamadoExamenUC, useFactory: (r) => new DeleteLlamadoExamenUC(r), inject: [LLAMADO_EXAMEN_REPOSITORY] },
```

**Add to `controllers`**: `LlamadoExamenController`

**Pattern**: Mirrors the `Carrera` DI block in the same file (`useExisting` token + `useFactory` for each UC).

**Done criteria**: `pnpm --filter api build` exits 0; `pnpm --filter api dev` starts without DI resolution error.

---

## Group E — Final verification

---

### [VERIFY C] Full test suite + coverage

**Command**: `pnpm test`

**Done criteria**:
- All tests pass (T01, T04, T11 + all pre-existing tests)
- Coverage ≥ 80% on new code in `packages/domain/src/terciario/` and `api/src/` (domain entity, VO, errors, use cases)
- Zero regressions

---

### [VERIFY D] Typecheck + build

**Commands**:
```bash
pnpm --filter api typecheck
pnpm build
```

**Done criteria**: Both exit 0. No TypeScript errors across the monorepo.

---

## Execution order summary

```
T01 → T02 → T03 → T04 → T05 → T06 → T07 → [VERIFY A]
                                               ↓            ↓
                                          T08 → T09 → T10  T11 → T12 → [VERIFY B]
                                                              ↓
                                                    T13 ‖ T14 → T15 → T16
                                                                        ↓
                                                               [VERIFY C] → [VERIFY D]
```

Parallel opportunities:
- T08–T10 (infra/Prisma) runs in parallel with T11–T12 (use cases + tests) after [VERIFY A]
- T13 (DTOs) and T14 (filter) can run in parallel after [VERIFY B]

Total tasks: **18** (14 implementation/test tasks + 4 verify gates)
Sequential chain bottleneck: T01→T07 (domain layer, 7 tasks, cannot parallelize — each depends on prior)
Second bottleneck: T15→T16 (presentation wiring, needs T10 + T12 + T13 + T14 all done first)
