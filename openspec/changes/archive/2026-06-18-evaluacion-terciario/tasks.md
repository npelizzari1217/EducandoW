# Tasks: evaluacion-terciario

> Generated: 2026-06-18 · Store: hybrid · sdd-tasks phase
> Specs: specs/nota-cursada-terciario/spec.md + specs/final-attempts/spec.md
> Design: design.md (ADR-1, ADR-2, ADR-3)
> STRICT TDD: every implementation task is preceded by its failing-test task.
> Test runner: `pnpm test` · Coverage target: ≥ 80% domain + api for new code.

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| Estimated changed lines | ~1 900 (implementation + tests combined) |
| 400-line budget risk | **High** — this change is ~4.7× the 400-line budget |
| Chained PRs recommended | **Yes** (by default policy) |
| Delivery strategy (this run) | **single-pr `size:exception`** — user explicitly requested one-pass |

**Decision recorded**: proceed as a single PR with `size:exception`. No slicing. Apply agent must implement all tasks in order within one branch.

---

## Dependency key

- `→` = must complete before
- `‖` = can run in parallel with siblings once shared prerequisite is done
- `[SUPUESTO]` = flagged assumption; implement with `// [SUPUESTO]` comment in code

---

## Group 0 · Domain Value Objects

_All four VO test/impl pairs are independent of each other and can run in parallel. Each pair is internally sequential (test → impl)._

### T01 [TEST] · VO SlotCursadaTerciario — failing tests

**Spec ref**: nota-cursada-terciario REQ Entidad NotaCursadaTerciario  
**File**: `packages/domain/src/terciario/__tests__/value-objects/slot-cursada-terciario.test.ts` *(create)*  
**Tests to write**:
- `create()` with each valid value (`PARCIAL_1`, `PARCIAL_2`, `RECUPERATORIO_PARCIAL_1`, `RECUPERATORIO_PARCIAL_2`, `TP`) → returns instance without throwing
- `create()` with invalid value → throws
- `esRecuperatorio()` → `true` only for `RECUPERATORIO_PARCIAL_1` and `RECUPERATORIO_PARCIAL_2`
- `parcialBase()` → maps `RECUPERATORIO_PARCIAL_1` → `PARCIAL_1`, `RECUPERATORIO_PARCIAL_2` → `PARCIAL_2`; throws for non-recuperatorio slots

**Done criteria**: all tests fail with "module not found" or equivalent (file does not exist yet).

---

### T02 [IMPL] · VO SlotCursadaTerciario

**Depends on**: T01  
**File**: `packages/domain/src/terciario/value-objects/slot-cursada-terciario.ts` *(create)*  
**Implementation**:
- `SlotCursadaTerciarioValue` type union
- `SlotCursadaTerciario` class: `static create(value: string)`, `get()`, `esRecuperatorio()`, `parcialBase()`
- Pattern: identical to `CondicionExamen` (throw in constructor only)

**Done criteria**: `pnpm test` passes all T01 tests.

---

### T03 [TEST] · VO CondicionCursada — failing tests

**Spec ref**: nota-cursada-terciario REQ Entidad (condicion column)  
**File**: `packages/domain/src/terciario/__tests__/value-objects/condicion-cursada.test.ts` *(create)*  
**Tests to write**:
- `create()` with `APROBADO`, `DESAPROBADO`, `AUSENTE` → valid
- `create()` with invalid value (e.g. `'REGULAR'`) → throws

**Done criteria**: tests fail (file not found).

---

### T04 [IMPL] · VO CondicionCursada

**Depends on**: T03  
**File**: `packages/domain/src/terciario/value-objects/condicion-cursada.ts` *(create)*  
**Implementation**: `CondicionCursadaValue = 'APROBADO' | 'DESAPROBADO' | 'AUSENTE'`; class with `create()`, `get()`, `equals()`.

**Done criteria**: T03 tests pass.

---

### T05 [TEST] · VO IntentoFinal — failing tests

**Spec ref**: final-attempts REQ Campo intento  
**File**: `packages/domain/src/terciario/__tests__/value-objects/intento-final.test.ts` *(create)*  
**Tests to write**:
- `create(1)`, `create(2)`, `create(3)` → valid, `get()` returns value
- `create(0)`, `create(4)`, `create(-1)` → throw
- `IntentoFinal` is the VO used in `ActaExamenNota`

**Done criteria**: tests fail (file not found).

---

### T06 [IMPL] · VO IntentoFinal

**Depends on**: T05  
**File**: `packages/domain/src/terciario/value-objects/intento-final.ts` *(create)*  
**Implementation**: `IntentoFinalValue = 1 | 2 | 3`; class with `create(n: number)` (throws for out of range), `get()`.

**Done criteria**: T05 tests pass.

---

### T07 [TEST] · VO EstadoInscripcion — extend tests for PROMOCIONAL + helpers

**Spec ref**: nota-cursada-terciario REQ Confirmación manual; final-attempts REQ Guard REGULAR; design ADR-1  
**File**: `packages/domain/src/terciario/__tests__/value-objects/estado-inscripcion.test.ts` *(modify — add cases)*  
**Tests to add**:
- `create('PROMOCIONAL')` → valid (currently throws — test MUST fail until T08 is done)
- `esRegular()` → `true` only for `REGULAR`
- `esLibre()` → `true` only for `LIBRE`
- `esPromocional()` → `true` only for `PROMOCIONAL`
- `esConfirmada()` → `true` for `REGULAR`, `PROMOCIONAL`, `LIBRE`, `APROBADO`; `false` for `INSCRIPTO`, `CURSANDO`

**Done criteria**: new tests fail (PROMOCIONAL not in VALID yet).

---

### T08 [IMPL] · VO EstadoInscripcion — add PROMOCIONAL + helpers

**Depends on**: T07  
**File**: `packages/domain/src/terciario/value-objects/estado-inscripcion.ts` *(modify)*  
**Changes**:
- Add `'PROMOCIONAL'` to `EstadoInscripcionValue` and `VALID`
- Add methods: `esRegular()`, `esLibre()`, `esPromocional()`, `esConfirmada()`

**Done criteria**: all T07 tests (old + new) pass.

---

## Group 1 · Domain Errors

_Can run in parallel with Group 0 pairs T03–T08. No separate test task — errors are trivial subclasses exercised by policy/UC tests._

### T09 [IMPL] · Domain Error subclasses (9 errors)

**Spec ref**: design §3.4  
**Files** (create all in `packages/domain/src/terciario/errors/`):

| File | Class | `code` |
|---|---|---|
| `slot-already-exists.error.ts` | `SlotAlreadyExistsError` | `SLOT_ALREADY_EXISTS` |
| `prerequisite-slot-missing.error.ts` | `PrerequisiteSlotMissingError` | `PREREQUISITE_SLOT_MISSING` |
| `parcial-ya-aprobado.error.ts` | `ParcialYaAprobadoError` | `PARCIAL_YA_APROBADO` |
| `invalid-intento.error.ts` | `InvalidIntentoError` | `INVALID_INTENTO` |
| `alumno-libre-no-puede-rendir.error.ts` | `AlumnoLibreNoPuedeRendirError` | `ALUMNO_LIBRE_NO_PUEDE_RENDIR` |
| `cursada-no-confirmada.error.ts` | `CursadaNoConfirmadaError` | `CURSADA_NO_CONFIRMADA` |
| `tp-obligatorio-faltante.error.ts` | `TpObligatorioFaltanteError` | `TP_OBLIGATORIO_FALTANTE` |
| `max-intentos-alcanzado.error.ts` | `MaxIntentosAlcanzadoError` | `MAX_INTENTOS_ALCANZADO` |
| `condicion-cursada-invalida.error.ts` | `CondicionCursadaInvalidaError` | `CONDICION_INVALIDA` |

Each class extends `DomainError` from `@educandow/domain` shared errors. Pattern identical to existing error subclasses.

**Done criteria**: all 9 files compile (`pnpm --filter api typecheck` and `pnpm --filter @educandow/domain typecheck` pass).

---

## Group 2 · Domain Entities

_T10–T11 and T12–T13 are independent pairs; both depend on Group 0 VOs (T02, T04, T06)._

### T10 [TEST] · Entity NotaCursadaTerciario — failing tests

**Spec ref**: nota-cursada-terciario REQ Entidad + scenario Duplicado slot  
**File**: `packages/domain/src/terciario/__tests__/entities/nota-cursada-terciario.test.ts` *(create)*  
**Tests to write**:
- `NotaCursadaTerciario.create(...)` → returns entity with correct props
- `getters`: `id`, `inscripcionMateriaId`, `slot`, `nota`, `condicion`, `fecha`, `creadoAt`, `actualizadoAt`
- `create()` with `nota: null` and `fecha: null` → valid (both optional)
- `NotaCursadaTerciario.reconstruct(...)` → restores entity without side effects

**Done criteria**: tests fail (entity file not found).

---

### T11 [IMPL] · Entity NotaCursadaTerciario

**Depends on**: T10, T02 (SlotCursadaTerciario), T04 (CondicionCursada)  
**File**: `packages/domain/src/terciario/entities/nota-cursada-terciario.ts` *(create)*  
**Implementation** (as per design §3.1):
```
NotaCursadaTerciarioProps {
  id: Id; inscripcionMateriaId: string; slot: SlotCursadaTerciario;
  nota?: number; condicion: CondicionCursada; fecha?: string;
  creadoAt: Date; actualizadoAt: Date;
}
static create(props: Omit<...,'id'|'creadoAt'|'actualizadoAt'>): NotaCursadaTerciario
static reconstruct(props: NotaCursadaTerciarioProps): NotaCursadaTerciario
```

**Done criteria**: T10 tests pass.

---

### T12 [TEST] · Entity ActaExamen — extend tests for intento

**Spec ref**: final-attempts REQ Campo intento + scenario backfill  
**File**: `packages/domain/src/terciario/__tests__/entities/acta-examen.test.ts` *(modify — add cases)*  
**Tests to add**:
- `registrarNota(studentId, nota, condicion, intento)` → `ActaExamenNota` includes `intento` field
- `reconstruct(props)` where `notas[].intento` is an `IntentoFinal` instance → reconstructs correctly
- Test MUST fail until T13 adds `intento` to the signature

**Done criteria**: new tests fail.

---

### T13 [IMPL] · Entity ActaExamen — add intento to ActaExamenNota + registrarNota

**Depends on**: T12, T06 (IntentoFinal)  
**File**: `packages/domain/src/terciario/entities/acta-examen.ts` *(modify)*  
**Changes**:
- Add `intento: IntentoFinal` to `ActaExamenNota` interface
- Update `registrarNota(studentId, nota, condicion, intento: IntentoFinal)` signature
- Pass `intento` into `newNota`
- Existing tests in the file must still pass (backwards compat: existing calls with only 3 args will need updating in test mocks)

**Done criteria**: T12 new tests pass; existing acta-examen entity tests pass.

---

## Group 3 · Domain Policies

_T14–T15 and T16–T17 can run in parallel. Both depend on T09 (errors), T11 (entity), T08 (EstadoInscripcion)._

### T14 [TEST] · Policy RecuperatorioPolicy — failing tests

**Spec ref**: nota-cursada-terciario REQ Elegibilidad de recuperatorio (all 4 scenarios)  
**File**: `packages/domain/src/terciario/__tests__/policies/recuperatorio-policy.test.ts` *(create)*  
**Tests to write** (all branches of `RecuperatorioPolicy.check`):
- Slot already exists → returns `Err(SlotAlreadyExistsError)` with code `SLOT_ALREADY_EXISTS`
- Recuperatorio slot, no parcial base present → `Err(PrerequisiteSlotMissingError)`
- Recuperatorio slot, parcial base exists with `APROBADO` → `Err(ParcialYaAprobadoError)`
- Recuperatorio slot, parcial base with `DESAPROBADO` → `Ok(undefined)`
- Recuperatorio slot, parcial base with `AUSENTE` → `Ok(undefined)`
- Non-recuperatorio slot, no prior duplicate → `Ok(undefined)`
- Non-recuperatorio slot `TP`, slot already exists → `Err(SlotAlreadyExistsError)`

**Done criteria**: tests fail (policy file not found).

---

### T15 [IMPL] · Policy RecuperatorioPolicy

**Depends on**: T14, T11, T04, T09  
**File**: `packages/domain/src/terciario/policies/recuperatorio-policy.ts` *(create)*  
**Implementation** (as per design §2, ADR-3):
```typescript
// pure function, no I/O
static check(
  slotNuevo: SlotCursadaTerciario,
  inscripcionMateriaId: string,
  existing: NotaCursadaTerciario[],
): Result<void, SlotAlreadyExistsError | PrerequisiteSlotMissingError | ParcialYaAprobadoError>
```
Guard evaluation order: duplicate check first, then prerequisite check.

**Done criteria**: T14 tests pass.

---

### T16 [TEST] · Policy FinalEligibilityPolicy — failing tests

**Spec ref**: final-attempts REQ Guard REGULAR, TP, límite 3 intentos, auto-LIBRE; design §5  
**File**: `packages/domain/src/terciario/__tests__/policies/final-eligibility-policy.test.ts` *(create)*  
**Tests to write** (deterministic order per design §5):
- `estado` null / INSCRIPTO / CURSANDO → `Err(CursadaNoConfirmadaError)`
- `estado = LIBRE` → `Err(AlumnoLibreNoPuedeRendirError)`
- `estado = REGULAR`, no TP slot → `Err(TpObligatorioFaltanteError)`
- `estado = REGULAR`, TP slot with `AUSENTE` → `Err(TpObligatorioFaltanteError)`
- `estado = REGULAR`, TP slot `APROBADO`, intentosPrevios = 3 → `Err(MaxIntentosAlcanzadoError)`
- `estado = REGULAR`, TP slot `APROBADO`, intentosPrevios = 0 → `Ok(IntentoFinal(1))`
- `estado = REGULAR`, TP slot `APROBADO`, intentosPrevios = 2 → `Ok(IntentoFinal(3))`
- `shouldTransitionToLibre(IntentoFinal(3), CondicionExamen('DESAPROBADO'))` → `true`
- `shouldTransitionToLibre(IntentoFinal(3), CondicionExamen('AUSENTE'))` → `true`
- `shouldTransitionToLibre(IntentoFinal(2), CondicionExamen('DESAPROBADO'))` → `false`
- `shouldTransitionToLibre(IntentoFinal(3), CondicionExamen('APROBADO'))` → `false`

**Done criteria**: tests fail (policy file not found).

---

### T17 [IMPL] · Policy FinalEligibilityPolicy

**Depends on**: T16, T08 (EstadoInscripcion), T06 (IntentoFinal), T09 (errors)  
**File**: `packages/domain/src/terciario/policies/final-eligibility-policy.ts` *(create)*  
**Implementation** (design §2 ADR-3, §5):
```typescript
static check(input: {
  estado: EstadoInscripcion;
  tpSlot: NotaCursadaTerciario | null;
  intentosPrevios: number;
}): Result<IntentoFinal, DomainError>

static shouldTransitionToLibre(
  intento: IntentoFinal,
  condicion: CondicionExamen,
): boolean
```
Guards evaluated in exact order of design §5.

**Done criteria**: T16 tests pass.

---

## Group 4 · Domain Repository Interfaces + index.ts

_T18 and T19 are independent; both depend on T11 and T13. T20 must be last in this group._

### T18 [IMPL] · Repository interface NotaCursadaTerciarioRepository

**Spec ref**: design §6.6  
**File**: `packages/domain/src/terciario/repositories/nota-cursada-terciario-repository.ts` *(create)*  
**Interface**:
```typescript
export interface NotaCursadaTerciarioRepository {
  findByInscripcion(inscripcionMateriaId: string): Promise<NotaCursadaTerciario[]>;
  findSlot(inscripcionMateriaId: string, slot: string): Promise<NotaCursadaTerciario | null>;
  save(entity: NotaCursadaTerciario): Promise<void>;
  update(entity: NotaCursadaTerciario): Promise<void>;
}
```

**Done criteria**: file compiles.

---

### T19 [IMPL] · Repository interface ActaExamenRepository — extend

**Spec ref**: design §6.6  
**File**: `packages/domain/src/terciario/repositories/acta-examen-repository.ts` *(modify)*  
**Changes**:
- Update `saveNota(actaId, studentId, nota, condicion, intento: number): Promise<void>` (add `intento` param)
- Add `countIntentosFinal(studentId: string, materiaCarreraId: string): Promise<number>`

**Done criteria**: file compiles. Note: callers of `saveNota` in existing use case and Prisma repo must also be updated (tracked in T24 and T28).

---

### T20 [IMPL] · Domain index.ts — export all new symbols

**Depends on**: T11, T13, T08, T15, T17, T18, T09  
**File**: `packages/domain/src/terciario/index.ts` *(modify)*  
**Add exports for**:
- `NotaCursadaTerciario`, `NotaCursadaTerciarioProps`
- `SlotCursadaTerciario`, `SlotCursadaTerciarioValue`
- `CondicionCursada`, `CondicionCursadaValue`
- `IntentoFinal`, `IntentoFinalValue`
- 9 error classes
- `RecuperatorioPolicy`, `FinalEligibilityPolicy`
- `NotaCursadaTerciarioRepository` (type)

**Done criteria**: `pnpm --filter @educandow/domain build` succeeds.

---

## Group 5 · Infrastructure — Prisma Schema + Migration

_Sequential: T21 → T22. T21 depends on T20 (domain types known)._

### T21 [IMPL] · Prisma tenant schema — new model + new column + inverse relation

**Spec ref**: design §6.1, §6.2, §6.3  
**File**: `api/prisma_tenant/schema.prisma` *(modify)*  
**Changes**:
1. Add `NotaCursadaTerciario` model (design §6.1 block verbatim — `@@unique([inscripcionMateriaId, slot])`, `@@index([inscripcionMateriaId])`).
2. Add inverse relation `notasCursada NotaCursadaTerciario[]` to `InscripcionMateria` model.
3. Add `intento Int @default(1)` to `ActaExamenNota` (or `acta_examen_notas` mapped table).
4. Add schema comment `// PROMOCIONAL valid value — see ADR-1` near `InscripcionMateria.estado`.

**Done criteria**: `pnpm --filter api prisma:generate` succeeds (types regenerated).

---

### T22 [IMPL] · Prisma migration — generate SQL + verify backfill

**Depends on**: T21  
**Command**: `pnpm --filter api prisma:migrate:tenant` (dev mode creates migration file)  
**File**: `api/prisma_tenant/migrations/<timestamp>_evaluacion_terciario/migration.sql` *(auto-generated, then verify)*  
**Verify migration contains** (design §6.4):
```sql
-- 1. CREATE TABLE nota_cursada_terciario (...)
-- 2. ALTER TABLE "acta_examen_notas" ADD COLUMN "intento" INTEGER NOT NULL DEFAULT 1;
-- 3. UPDATE "acta_examen_notas" SET "intento" = 1 WHERE "intento" IS NULL;
```
If step 3 is missing, add it manually to the migration SQL file before committing.

**Done criteria**: migration file exists and contains all three SQL operations. `pnpm --filter api prisma:generate` still passes.

---

## Group 6 · Infrastructure — Prisma Repo Implementations

_T23 and T24 are independent; both depend on T22 (migration applied)._

### T23 [IMPL] · PrismaNotaCursadaTerciarioRepository

**Spec ref**: design §6.6 (new repo)  
**File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-nota-cursada-terciario.repository.ts` *(create)*  
**Implement** `NotaCursadaTerciarioRepository` interface:
- `findByInscripcion`: `prisma.notaCursadaTerciario.findMany({ where: { inscripcionMateriaId } })`, map to domain entity via `NotaCursadaTerciario.reconstruct`
- `findSlot`: `findFirst({ where: { inscripcionMateriaId, slot } })`
- `save`: `prisma.notaCursadaTerciario.create(...)` with domain → Prisma mapping
- `update`: `prisma.notaCursadaTerciario.update(...)` using `id`
- Inject `TenantPrismaService` (or equivalent tenant Prisma client — follow existing pattern in `PrismaInscripcionMateriaRepository`)

**Done criteria**: file compiles, implements interface fully.

---

### T24 [IMPL] · PrismaActaExamenRepository — extend with countIntentosFinal + updated saveNota

**Depends on**: T22, T19  
**File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-acta-examen.repository.ts` *(modify)*  
**Changes**:
- Update `saveNota(actaId, studentId, nota, condicion, intento: number)` — add `intento` to the Prisma `create`/`update` call
- Add `countIntentosFinal(studentId, materiaCarreraId): Promise<number>` — count `ActaExamenNota` rows joined via `ActaExamen.materiaCarreraId` where `condicion IN ('DESAPROBADO','AUSENTE')` and `studentId` matches

**Done criteria**: file compiles, existing `acta-examen.use-cases.test.ts` tests still pass (mock interface updated).

---

## Group 7 · Application Use Cases — Fase A (Cursada)

_T25→T26 sequential. Depends on T20 (domain exports). Can start before T23 (tests mock the repo)._

### T25 [TEST] · Nota Cursada use cases — failing tests (4 UCs)

**Spec ref**: nota-cursada-terciario all scenarios  
**File**: `api/src/application/nivel-terciario/__tests__/nota-cursada-terciario.use-cases.test.ts` *(create)*  
**Tests to write** (mock `NotaCursadaTerciarioRepository` and `InscripcionRepository`):

**CreateNotaCursadaSlotUC**:
- Success: creates slot, returns `Ok(NotaCursadaTerciario)`
- Duplicate slot → `Err` with code `SLOT_ALREADY_EXISTS` (409)
- Recuperatorio, no parcial base → `Err(PREREQUISITE_SLOT_MISSING)` (422)
- Recuperatorio, parcial APROBADO → `Err(PARCIAL_YA_APROBADO)` (422)
- Recuperatorio, parcial DESAPROBADO → `Ok` (enabled)
- Recuperatorio, parcial AUSENTE → `Ok` (enabled)

**UpdateNotaCursadaSlotUC**:
- Slot exists → returns `Ok(updated entity)`
- Slot not found → `Err(NotFoundError)`

**ListNotaCursadaSlotsUC**:
- Returns array (may be empty)

**ConfirmarNotaCursadaUC**:
- `condicion='REGULAR'` → `Ok`, inscripcion `estado` updated to `REGULAR`
- `condicion='PROMOCIONAL'` → `Ok`, `estado` updated to `PROMOCIONAL` [SUPUESTO]
- `condicion='APROBADO'` (invalid for this endpoint) → `Err(CondicionCursadaInvalidaError)` (422)
- `condicion='LIBRE'` → `Ok` (allowed — secretaría can set LIBRE manually)

**Done criteria**: tests fail (UC file not found).

---

### T26 [IMPL] · Nota Cursada use cases — implement 4 UCs

**Depends on**: T25, T15 (RecuperatorioPolicy), T18 (repo interface), T20  
**File**: `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts` *(create)*  
**Implement** (as per design §4.1):

```typescript
@Injectable() CreateNotaCursadaSlotUC
@Injectable() UpdateNotaCursadaSlotUC
@Injectable() ListNotaCursadaSlotsUC
@Injectable() ConfirmarNotaCursadaUC
```

- Each use case returns `Result<T, DomainError>`; no throw in application layer.
- `ConfirmarNotaCursadaUC` accepts `condicion ∈ {REGULAR, PROMOCIONAL, LIBRE}` in payload (ADR-1), rejects others with `CondicionCursadaInvalidaError`, then writes `inscripcion.estado` via `InscripcionRepository.save`.

**Done criteria**: T25 tests pass; `pnpm --filter api typecheck` passes.

---

## Group 8 · Application Use Cases — Fase B (Finales)

_T27→T28→T29→T30 sequential. Depends on T20, T17 (FinalEligibilityPolicy). Can start before T24 (tests mock repos)._

### T27 [x] · RegistrarNotaFinalUC — failing tests (all guard scenarios)

**Spec ref**: final-attempts all scenarios  
**File**: `api/src/application/nivel-terciario/__tests__/registrar-nota-final.use-cases.test.ts` *(create)*  
**Tests to write** (mock `ActaExamenRepository`, `InscripcionRepository`, `NotaCursadaTerciarioRepository`, `TenantTransactionRunner`):

**Guard failures** (422):
- Acta not found → `Err(NotFoundError)`
- Inscripcion not found → `Err(NotFoundError)`
- `intento` = 0 or 4 → `Err(InvalidIntentoError)`
- `estado = null` / INSCRIPTO / CURSANDO → `Err(CursadaNoConfirmadaError)`
- `estado = LIBRE` → `Err(AlumnoLibreNoPuedeRendirError)`
- No TP slot → `Err(TpObligatorioFaltanteError)`
- TP slot with `AUSENTE` → `Err(TpObligatorioFaltanteError)`
- `intentosPrevios = 3` → `Err(MaxIntentosAlcanzadoError)`

**Success paths**:
- First attempt (`intentosPrevios=0`), DESAPROBADO → `Ok({ libreTransicion: false })`
- Second attempt (`intentosPrevios=1`), AUSENTE → `Ok({ libreTransicion: false })`
- Third attempt (`intentosPrevios=2`), DESAPROBADO → `Ok({ libreTransicion: true })`, `TenantTransactionRunner.run` called, `inscripcionRepo.save` called with `estado=LIBRE`
- Third attempt APROBADO → `Ok({ libreTransicion: false })` (APROBADO at 3rd does NOT trigger LIBRE)

**Done criteria**: tests fail (UC not yet modified).

---

### T28 [x] · RegistrarNotaFinalUC

**Depends on**: T27, T17 (FinalEligibilityPolicy), T19 (updated repo interface), T20  
**File**: `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts` *(modify — add new UC)*  
**Add** `RegistrarNotaFinalUC` class (new, separate from existing `RegistrarNotaUC`):

```typescript
@Injectable()
export class RegistrarNotaFinalUC {
  constructor(
    private readonly repo: ActaExamenRepository,
    private readonly inscripcionRepo: InscripcionRepository,
    private readonly notaCursadaRepo: NotaCursadaTerciarioRepository,
    private readonly txRunner: TenantTransactionRunner,
  ) {}

  async execute(actaId: string, input: RegistrarNotaFinalInput):
    Promise<Result<{ libreTransicion: boolean }, DomainError>>
```

Algorithm follows design §4.2 exactly (10 steps). Existing `RegistrarNotaUC` is NOT removed (backward compat).

**Done criteria**: T27 tests pass.

---

### T29 [TEST] · RegistrarPromocionalUC — failing tests [SUPUESTO]

**Spec ref**: final-attempts REQ PROMOCIONAL bypass [SUPUESTO]  
**File**: `api/src/application/nivel-terciario/__tests__/registrar-nota-final.use-cases.test.ts` *(modify — add section)*  
**Tests to add**:
- `estado = PROMOCIONAL` → `Ok`, `inscripcion.notaFinal` set, `inscripcion.estado` set to `APROBADO`, NO `ActaExamenNota` created, `countIntentosFinal` NOT incremented
- `estado != PROMOCIONAL` → `Err` (guard rejects non-PROMOCIONAL)

**Done criteria**: new tests fail.

---

### T30 [IMPL] · RegistrarPromocionalUC [SUPUESTO]

**Depends on**: T29  
**File**: `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts` *(modify — add)*  
**Add** `RegistrarPromocionalUC`: requires `estado=PROMOCIONAL`, sets `notaFinal + estado=APROBADO` on `InscripcionMateria` without creating `ActaExamenNota`. Mark with `// [SUPUESTO]` comment.

**Done criteria**: T29 tests pass.

---

## Group 9 · Presentation Layer

_T31 can run after T09. T32+T33 can run after T26. T34 can run after T28+T30. T35 must be last._

### T31 [IMPL] · AppExceptionFilter — register 9 new error codes

**Spec ref**: design §3.4; all spec scenarios that map to HTTP 409/422  
**File**: `api/src/presentation/shared/filters/exception.filter.ts` *(modify)*  
**Add to `DOMAIN_STATUS`**:
```typescript
SLOT_ALREADY_EXISTS: 409,
PREREQUISITE_SLOT_MISSING: 422,
PARCIAL_YA_APROBADO: 422,
INVALID_INTENTO: 422,
ALUMNO_LIBRE_NO_PUEDE_RENDIR: 422,
CURSADA_NO_CONFIRMADA: 422,
TP_OBLIGATORIO_FALTANTE: 422,
MAX_INTENTOS_ALCANZADO: 422,
CONDICION_INVALIDA: 422,
```

**Done criteria**: file compiles; existing filter tests pass unchanged.

---

### T32 [x] · Zod DTO schemas — failing tests

**Spec ref**: all HTTP scenarios in both specs; design §4.3  
**File**: `api/src/presentation/nivel-terciario/__tests__/nota-cursada-terciario.dto.test.ts` *(create)*  
**Tests to write** (pure Zod schema validation, no HTTP):

**CreateSlotSchema**:
- Valid: `{ slot: 'PARCIAL_1', nota: 7.5, condicion: 'APROBADO', fecha: '2026-06-10' }`
- Valid: `{ slot: 'TP', nota: null, condicion: 'APROBADO', fecha: null }` (optionals)
- Invalid: missing `slot` → parse fails
- Invalid: unknown slot value → parse fails

**UpdateSlotSchema**:
- Valid: `{ nota: 8.0, condicion: 'APROBADO' }` (all optional)
- Invalid: unknown `condicion` → parse fails

**ConfirmarNotaCursadaSchema**:
- Valid: `{ notaCursada: 7.0, condicion: 'REGULAR' }`
- Valid: `{ notaCursada: 9.0, condicion: 'PROMOCIONAL' }` [SUPUESTO]
- Invalid: `{ condicion: 'APROBADO' }` → parse fails (condicion must be REGULAR|PROMOCIONAL|LIBRE)

**RegistrarNotaFinalSchema**:
- Valid: `{ studentId: 'abc', nota: 5.0, condicion: 'DESAPROBADO', intento: 2 }`
- Invalid: `{ intento: 0 }` → parse fails
- Invalid: `{ intento: 4 }` → parse fails
- Invalid: missing `studentId` → parse fails

**Done criteria**: tests fail (schemas not defined yet).

---

### T33 [IMPL] · NotaCursadaTerciarioController + Zod schemas

**Depends on**: T32, T26  
**File**: `api/src/presentation/nivel-terciario/nota-cursada-terciario.controller.ts` *(create)*  
**Implement** (design §4.3):

```typescript
@Controller('terciario/cursada')
@UseGuards(AuthGuard, RolesGuard, LevelsGuard)
@Levels(EducationalLevelCode.TERCIARIO)
export class NotaCursadaTerciarioController
```

**Routes** (all with `@Roles('ROOT', { module: 'GRADES', action: ... })`):
- `POST /:inscripcionMateriaId/slots` → `CreateNotaCursadaSlotUC` → HTTP 201
- `PATCH /:inscripcionMateriaId/slots/:slot` → `UpdateNotaCursadaSlotUC` → HTTP 200
- `GET /:inscripcionMateriaId/slots` → `ListNotaCursadaSlotsUC` → HTTP 200
- `PATCH /:inscripcionMateriaId/confirmar` → `ConfirmarNotaCursadaUC` → HTTP 200
- `POST /:inscripcionMateriaId/promocionar` → `RegistrarPromocionalUC` → HTTP 200 [SUPUESTO]

Zod schemas defined in same file (or co-located DTO file): `CreateSlotSchema`, `UpdateSlotSchema`, `ConfirmarNotaCursadaSchema`, `RegistrarPromocionalSchema`.

Error handling: `if (result.isErr()) throw result.unwrapErr()` — `AppExceptionFilter` translates.

**Done criteria**: T32 Zod tests pass; controller compiles.

---

### T34 [x] · ActaExamenController — update POST notas to use RegistrarNotaFinalUC

**Depends on**: T28, T30  
**File**: `api/src/presentation/nivel-terciario/acta-examen.controller.ts` *(modify)*  
**Changes**:
- Inject `RegistrarNotaFinalUC` in addition to (or replacing) `RegistrarNotaUC` for the `POST :id/notas` route
- Update `RegistrarNotaFinalSchema` (or import from co-located DTO) to include `intento: z.number().int().min(1).max(3)`
- Update `POST :id/notas` handler: call `RegistrarNotaFinalUC.execute(id, body)`, return `{ data: { message: 'Nota registrada', libreTransicion: result.libreTransicion } }`
- `map()` helper: include `intento: n.intento.get()` in nota mapping

**Done criteria**: controller compiles; existing E2E/integration tests (if any) for this controller remain green.

---

### T35 [IMPL] · NivelTerciarioModule — register all new providers and controllers

**Depends on**: T33, T34, T23, T24  
**File**: `api/src/presentation/nivel-terciario/nivel-terciario.module.ts` *(modify)*  
**Add to `controllers`**: `NotaCursadaTerciarioController`  
**Add to `providers`**:
- `PrismaNotaCursadaTerciarioRepository`
- `{ provide: 'NotaCursadaTerciarioRepository', useExisting: PrismaNotaCursadaTerciarioRepository }`
- `{ provide: 'TenantTransactionRunner', useExisting: PrismaTenantTransactionRunner }` *(if not already provided globally — check first)*
- `CreateNotaCursadaSlotUC`, `UpdateNotaCursadaSlotUC`, `ListNotaCursadaSlotsUC`, `ConfirmarNotaCursadaUC` (with `useFactory` pattern matching existing UCs)
- `RegistrarNotaFinalUC` (inject: ActaExamenRepository, InscripcionRepository, NotaCursadaTerciarioRepository, TenantTransactionRunner)
- `RegistrarPromocionalUC` [SUPUESTO]
- Update existing `RegistrarNotaUC` factory if its `saveNota` mock needs `intento` param (backward compat check)

**Done criteria**: `pnpm --filter api build` succeeds; `pnpm test` passes at ≥ 80% coverage for new code.

---

## Summary

| # | ID | Type | Layer | Phase | Group | Sequential after |
|---|---|---|---|---|---|---|
| 1 | T01 | TEST | Domain VO | A+B | 0 | — |
| 2 | T02 | IMPL | Domain VO | A+B | 0 | T01 |
| 3 | T03 | TEST | Domain VO | A | 0 | — ‖ T01 |
| 4 | T04 | IMPL | Domain VO | A | 0 | T03 |
| 5 | T05 | TEST | Domain VO | B | 0 | — ‖ T01 |
| 6 | T06 | IMPL | Domain VO | B | 0 | T05 |
| 7 | T07 | TEST | Domain VO | A+B | 0 | — ‖ T01 |
| 8 | T08 | IMPL | Domain VO | A+B | 0 | T07 |
| 9 | T09 | IMPL | Domain Errors | A+B | 1 | — ‖ T01 |
| 10 | T10 | TEST | Domain Entity | A | 2 | T02, T04 |
| 11 | T11 | IMPL | Domain Entity | A | 2 | T10 |
| 12 | T12 | TEST | Domain Entity | B | 2 | T06 |
| 13 | T13 | IMPL | Domain Entity | B | 2 | T12 |
| 14 | T14 | TEST | Domain Policy | A | 3 | T09, T11 |
| 15 | T15 | IMPL | Domain Policy | A | 3 | T14 |
| 16 | T16 | TEST | Domain Policy | B | 3 | T09, T13, T08 |
| 17 | T17 | IMPL | Domain Policy | B | 3 | T16 |
| 18 | T18 | IMPL | Domain Repo | A | 4 | T11 |
| 19 | T19 | IMPL | Domain Repo | B | 4 | T13 |
| 20 | T20 | IMPL | Domain index | A+B | 4 | T15, T17, T18, T19 |
| 21 | T21 | IMPL | Infra Schema | A+B | 5 | T20 |
| 22 | T22 | IMPL | Infra Migration | A+B | 5 | T21 |
| 23 | T23 | IMPL | Infra Repo | A | 6 | T22 |
| 24 | T24 | IMPL | Infra Repo | B | 6 | T22 ‖ T23 |
| 25 | T25 | TEST | App UC | A | 7 | T20 |
| 26 | T26 | IMPL | App UC | A | 7 | T25, T15, T18 |
| 27 | T27 | TEST | App UC | B | 8 | T20 |
| 28 | T28 | IMPL | App UC | B | 8 | T27, T17, T19 |
| 29 | T29 | TEST | App UC | B | 8 | T28 |
| 30 | T30 | IMPL | App UC | B | 8 | T29 |
| 31 | T31 | IMPL | Presentation | A+B | 9 | T09 |
| 32 | T32 | TEST | Presentation | A+B | 9 | — ‖ T25 |
| 33 | T33 | IMPL | Presentation | A | 9 | T32, T26 |
| 34 | T34 | IMPL | Presentation | B | 9 | T28, T30 |
| 35 | T35 | IMPL | Presentation | A+B | 9 | T33, T34, T23, T24 |

**Total tasks: 35** (18 TEST + 17 IMPL, if counting T09/T31 as IMPL-only)  
**Critical path**: T01→T02→T10→T11→T14→T15→T18→T20→T21→T22→T23→T25→T26→T33→T35  
**Longest parallel opportunity**: domain VO pairs (T01–T08) + T09 can all start simultaneously.

---

## Risks

**R1** (blocking): T13 changes `ActaExamen.registrarNota` signature — existing `acta-examen.use-cases.test.ts` mocks `saveNota` without `intento`. Those mock definitions must be updated in T24/T28 or the test file will fail to compile. **Mitigation**: when doing T13, also update the mock in the existing test file.

**R2** (architectural): ADR-1 — `condicion` in payload maps to `InscripcionMateria.estado`. If any consumer reads `estado` and doesn't handle `PROMOCIONAL`, a runtime error may surface. **Mitigation**: check all reads of `estado` in existing code when doing T08.

**R3** (scope uncertainty): 3 `[SUPUESTO]` items (PROMOCIONAL bypass, TP bloquea, recuperatorio DESAPROBADO+AUSENTE). All are implemented as-designed but marked in code. Any reglamento change = only policy files change.

**R4** (infra): `countIntentosFinal` requires a JOIN across `ActaExamen` → `ActaExamenNota`. Verify the Prisma schema has the relation correctly set up in T21 before implementing the query in T24.

**R5** (TenantTransactionRunner): must confirm `PrismaTenantTransactionRunner` is already registered as a provider in the app (check `AppModule` or shared infra module). If not, T35 must also register it. Do not instantiate it directly — inject via DI token.
