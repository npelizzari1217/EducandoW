# Tasks: vencimiento-regularidad-terciario

> Phase: sdd-tasks · Date: 2026-06-18 · Artifact store: hybrid
> Delivery: single-pr (size:exception approved — see Review Workload Forecast)

---

## Execution constraints

- **STRICT TDD**: every `[IMPL]` task must be preceded by its `[TEST]` pair.
  Run `pnpm test` after each pair; do not advance until tests are green.
- Policy signature change (T-10/T-11) is **BREAKING**: callers and tests must be
  updated atomically in the same batch.
- `pnpm build` must pass at the end of every phase.

---

## Phase 1 — Domain layer: error + entity fields

> These tasks are independent of each other and can be executed in parallel
> (A-group, B-group, C-group). Each is a TDD pair.

### A — RegularidadVencidaError (foundational; required by C-group)

**T-01 [TEST]** Write failing test for `RegularidadVencidaError`
- File (new): `packages/domain/src/terciario/__tests__/errors/regularidad-vencida.test.ts`
- Asserts: instance of `DomainError`; `.code === 'REGULARIDAD_VENCIDA'`; message non-empty
- Satisfies: FR-6.1, FR-6.2
- Done-criteria: test file exists; `pnpm test` reports 1 failing suite (RED)

**T-02 [IMPL]** Create `RegularidadVencidaError`
- File (new): `packages/domain/src/terciario/errors/regularidad-vencida.error.ts`
- Extends `DomainError`; code `REGULARIDAD_VENCIDA`
- Satisfies: FR-6.1, FR-6.2
- Done-criteria: T-01 is green

**T-03 [IMPL]** Export `RegularidadVencidaError` from both index files
- Files: `packages/domain/src/terciario/index.ts`, `packages/domain/src/index.ts`
- Add `export { RegularidadVencidaError } from './errors/regularidad-vencida.error'`
  (and mirror in the root domain index)
- Satisfies: FR-6.1 (availability at API layer)
- Done-criteria: `pnpm build` passes; `RegularidadVencidaError` importable via `@educandow/domain`

---

### B — InscripcionMateria.fechaRegularidad + setFechaRegularidad

**T-04 [TEST]** Extend `inscripcion-materia.test.ts` with fechaRegularidad cases
- File: `packages/domain/src/terciario/__tests__/entities/inscripcion-materia.test.ts`
- Add tests:
  - `reconstruct()` with `fechaRegularidad` set → getter returns the date (FR-1.1, FR-1.3)
  - `reconstruct()` without `fechaRegularidad` → getter returns `undefined`/`null` (FR-1.2)
  - `create()` does NOT accept `fechaRegularidad` (type-level — verify no field exists) (FR-1.4)
  - `setFechaRegularidad(date)` on null → sets value (FR-2.4, Scenario A)
  - `setFechaRegularidad(date2)` when already set → remains original value (no-op) (FR-2.4, Scenario B)
- Satisfies: FR-1.1–FR-1.4, FR-2.4
- Done-criteria: new tests RED

**T-05 [IMPL]** Update `InscripcionMateria` entity
- File: `packages/domain/src/terciario/entities/inscripcion-materia.ts`
- Changes:
  - Add `fechaRegularidad?: Date` to `InscripcionMateriaProps`
  - Add `get fechaRegularidad(): Date | undefined` getter
  - `create()` static factory: do NOT add `fechaRegularidad` to its accepted params
  - `reconstruct()`: accept `fechaRegularidad?: Date` in props (already via InscripcionMateriaProps)
  - Add method `setFechaRegularidad(date: Date): void` — sets `this.props.fechaRegularidad = date` only
    when `this.props.fechaRegularidad == null` (write-once no-op otherwise)
- Satisfies: FR-1.1–FR-1.4, FR-2.4
- Done-criteria: T-04 is green

---

### C — Carrera.llamadosVencimiento

**T-06 [TEST]** Extend `carrera.test.ts` with llamadosVencimiento cases
- File: `packages/domain/src/terciario/__tests__/entities/carrera.test.ts`
- Add tests:
  - `create()` without `llamadosVencimiento` → getter returns `5` (Scenario M)
  - `create({ llamadosVencimiento: 3 })` → getter returns `3` (FR-3.4)
  - `create({ llamadosVencimiento: 0 })` → throws `ValidationError` (Scenario N, FR-3.5)
  - `create({ llamadosVencimiento: -1 })` → throws `ValidationError` (FR-3.5)
  - `reconstruct({ llamadosVencimiento: 7 })` → getter returns `7` (FR-3.3)
  - `reconstruct({ llamadosVencimiento: 0 })` → throws `ValidationError` (FR-3.5)
- Satisfies: FR-3.1–FR-3.5
- Done-criteria: new tests RED

**T-07 [IMPL]** Update `Carrera` entity
- File: `packages/domain/src/terciario/entities/carrera.ts`
- Changes:
  - Add `llamadosVencimiento: number` to `CarreraProps`
  - Add `get llamadosVencimiento(): number` getter
  - `create()`: accept optional `llamadosVencimiento?: number`; default to `5`; throw
    `ValidationError` if provided and `<= 0`
  - `reconstruct()`: accept `llamadosVencimiento: number`; throw `ValidationError` if `<= 0`
  - Import `ValidationError` from `../../shared/errors/validation-error` if not already imported
- Satisfies: FR-3.1–FR-3.5
- Done-criteria: T-06 is green

---

## Phase 2 — Port contracts

> T-08 and T-09 are independent of each other (parallel).
> Both depend on Phase 1 entities being done (T-05, T-07).

**T-08 [IMPL]** Add `countAfter` to `LlamadoExamenRepository` port
- File: `packages/domain/src/terciario/repositories/llamado-examen-repository.ts`
- Add to interface: `countAfter(anioAcademico: string, afterDate: Date): Promise<number>`
- Satisfies: FR-4 (ADR-1 count strategy for guard path)
- Done-criteria: interface updated; `pnpm build` passes (infra impl is in Phase 4)

**T-09 [IMPL]** Add `findByMateriaCarreraId` to `CarreraRepository` port
- File: `packages/domain/src/terciario/repositories/carrera-repository.ts`
- Add to interface: `findByMateriaCarreraId(materiaCarreraId: string): Promise<Carrera | null>`
- Satisfies: FR-7.4 (ADR-3 carrera resolution from materiaCarreraId)
- Done-criteria: interface updated; `pnpm build` passes (infra impl is in Phase 4)

---

## Phase 3 — Policy change (BREAKING — update callers atomically)

> **CRITICAL**: T-10 and T-11 MUST be applied in the same batch.
> T-11 changes the `check()` signature — all TypeScript callers break immediately.
> The test file update (T-10 part b) and production caller update (T-11b) are
> gates before this batch can be merged.

**T-10 [TEST]** Update existing + add new FinalEligibilityPolicy tests
- File: `packages/domain/src/terciario/__tests__/policies/final-eligibility-policy.test.ts`
- Part (a) — NEW test cases (write BEFORE implementing):
  - `estado = REGULAR, llamadosTranscurridos = 0, llamadosVencimiento = 5`
    → Ok (NULL fechaRegularidad path — Scenario D)
  - `estado = REGULAR, llamadosTranscurridos = 5, llamadosVencimiento = 5`
    → Err code `REGULARIDAD_VENCIDA` (at-threshold — Scenario E)
  - `estado = REGULAR, llamadosTranscurridos = 4, llamadosVencimiento = 5`
    → guard does NOT fire; falls through to TP/intento guards (Scenario F)
  - `estado = REGULAR, llamadosTranscurridos = 0, llamadosVencimiento = 1`
    → Ok (boundary — Scenario G: count 0 < 1 → not expired)
  - `estado = LIBRE, llamadosTranscurridos = 99, llamadosVencimiento = 1`
    → Err code `ALUMNO_LIBRE_NO_PUEDE_RENDIR` (guard step 2 skipped for LIBRE — FR-5.3)
  - `estado = REGULAR, llamadosTranscurridos = 5, llamadosVencimiento = 5, tpSlot=null`
    → Err code `REGULARIDAD_VENCIDA` (expiry fires BEFORE TP check — FR-5.2 order)
- Part (b) — UPDATE ALL EXISTING `FinalEligibilityPolicy.check()` calls:
  - Every existing call in the file currently uses `{ estado, tpSlot, intentosPrevios }`.
  - Add `llamadosTranscurridos: 0, llamadosVencimiento: 5` to ALL of them so they remain
    valid (non-expired cases) after the signature change.
  - This covers all calls in 'Guard: estado no confirmada', 'Guard: estado LIBRE',
    'Guard: TP obligatorio', 'Guard: límite de intentos', 'Success paths' describe blocks.
- Satisfies: FR-5.1–FR-5.4 (Scenarios D/E/F/G)
- Done-criteria: new cases in part (a) are RED; existing cases in part (b) compile with
  the NEW fields present (they will stay green after T-11 because their values are non-expiring)

**T-11 [IMPL]** Extend `FinalEligibilityPolicy.check()` — signature + guard step 2
- File: `packages/domain/src/terciario/policies/final-eligibility-policy.ts`
- Changes:
  - Add `llamadosTranscurridos: number` and `llamadosVencimiento: number` to the `input` type
  - After guard step 1 (not confirmed) and before the current step 2 (LIBRE), insert:
    ```ts
    // NEW step 2 — regularidad vencida
    if (estado.esRegular() && llamadosTranscurridos >= llamadosVencimiento) {
      return err(new RegularidadVencidaError());
    }
    ```
  - Import `RegularidadVencidaError` from `../errors/regularidad-vencida.error`
  - Guard runs only when `estado.esRegular()` → LIBRE and other states are unaffected (FR-5.3)
  - Policy remains a pure function — no I/O added (FR-5.4, NFR-5)
- Satisfies: FR-5.1–FR-5.4
- Done-criteria: all tests in T-10 green; `pnpm build` passes

---

## Phase 4 — Infra: Prisma schema, migration, repository implementations

> D1 (schema) can run in parallel with Phase 3.
> D2 (migration) must follow D1.
> D3/D4/D5 (repos) can run in parallel after D2.

**T-12 [IMPL]** Update Prisma tenant schema
- File: `api/prisma_tenant/schema.prisma`
- Changes:
  - In `model InscripcionMateria`: add `fechaRegularidad  DateTime? @map("fecha_regularidad")`
    (after `notaFinal` line, before relations)
  - In `model Carrera`: add `llamadosVencimiento  Int  @default(5)  @map("llamados_vencimiento")`
    (after `resolucion` line)
- Satisfies: FR-1.2, FR-3.2, NFR-6 (backward-compatible: nullable / has default)
- Done-criteria: `npx prisma validate --schema api/prisma_tenant/schema.prisma` passes

**T-13 [RUN]** Run migration and regenerate Prisma client
- Commands (from repo root):
  ```
  pnpm --filter api prisma:migrate:tenant   # creates migration file in api/prisma_tenant/migrations/
  pnpm --filter api prisma:generate         # regenerates tenant client
  ```
- Satisfies: NFR-4 (tenant client updated), NFR-6 (non-breaking migration)
- Done-criteria: migration file created; `pnpm build` passes after regeneration

**T-14 [IMPL]** `PrismaInscripcionMateriaRepository` — map `fechaRegularidad`
- File: `api/src/infrastructure/persistence/prisma/repositories/prisma-inscripcion-materia.repository.ts`
- Changes:
  - Add `fechaRegularidad?: Date | null` to `InscripcionRow` interface
  - `toDomain()`: pass `fechaRegularidad: r.fechaRegularidad ?? undefined` to `InscripcionMateria.reconstruct()`
  - `save()` upsert `create` block: add `fechaRegularidad: inscripcion.fechaRegularidad ?? null`
  - `save()` upsert `update` block: add `fechaRegularidad: inscripcion.fechaRegularidad ?? null`
    (allow persisting the write-once value when it was just set by ConfirmarNotaCursadaUC)
- Satisfies: FR-1.2, FR-2.1 (persistence of fechaRegularidad)
- Done-criteria: `pnpm build` passes; fechaRegularidad round-trips through save→toDomain

**T-15 [IMPL]** `PrismaCarreraRepository` — map `llamadosVencimiento` + `findByMateriaCarreraId`
- File: `api/src/infrastructure/persistence/prisma/repositories/prisma-carrera.repository.ts`
- Changes:
  - Add `llamadosVencimiento: number` to `CarreraRow` interface
  - `toDomain()`: pass `llamadosVencimiento: r.llamadosVencimiento` to `Carrera.reconstruct()`
  - `save()` upsert `create` and `update` blocks: add `llamadosVencimiento: carrera.llamadosVencimiento`
  - Add method `findByMateriaCarreraId(materiaCarreraId: string): Promise<Carrera | null>`:
    ```ts
    const r = await this.client.materiaCarrera.findUnique({
      where: { id: materiaCarreraId },
      include: { carrera: true },
    });
    return r ? this.toDomain(r.carrera) : null;
    ```
  - Add `findByMateriaCarreraId` to the `implements CarreraRepository` type satisfaction
- Satisfies: FR-3.2 (persistence), FR-7.4 (ADR-3 single join)
- Done-criteria: `pnpm build` passes; `PrismaCarreraRepository` implements full `CarreraRepository` interface

**T-16 [IMPL]** `PrismaLlamadoExamenRepository` — implement `countAfter`
- File: `api/src/infrastructure/persistence/prisma/repositories/prisma-llamado-examen.repository.ts`
- Add method:
  ```ts
  async countAfter(anioAcademico: string, afterDate: Date): Promise<number> {
    return this.client.llamadoExamen.count({
      where: {
        anioAcademico,
        active: true,
        deletedAt: null,
        fechaInicio: { gt: afterDate },
      },
    });
  }
  ```
- Satisfies: FR-4.2 (strict `>` — not `>=`), FR-4.4 (institution-wide, no carrera filter), ADR-1
- Done-criteria: `pnpm build` passes; implements `LlamadoExamenRepository` interface

---

## Phase 5 — Application layer use cases

> E-group depends on Phase 3 (policy) + Phase 4 repos being done.
> E1/E2/E3 are independent of each other (parallel within their TEST→IMPL pairs).

### E1 — ConfirmarNotaCursadaUC writes fechaRegularidad

**T-17 [TEST]** Write tests for `ConfirmarNotaCursadaUC` fechaRegularidad behavior
- File (new or extended): e.g. `api/src/application/nivel-terciario/__tests__/confirmar-nota-cursada.uc.test.ts`
- Tests (mock `InscripcionRepository`):
  - condicion = REGULAR, `inscripcion.fechaRegularidad == null` →
    `inscripcion.setFechaRegularidad` was called with a Date; inscripcion saved (Scenario A)
  - condicion = REGULAR, `inscripcion.fechaRegularidad` already set →
    `setFechaRegularidad` called but entity no-op ensures value unchanged (Scenario B)
  - condicion = LIBRE → `fechaRegularidad` remains null; entity `setFechaRegularidad` not called
    (Scenario C, FR-2.3)
  - condicion = PROMOCIONAL → same as LIBRE (FR-2.3)
- Satisfies: FR-2.1–FR-2.4
- Done-criteria: new tests RED

**T-18 [IMPL]** `ConfirmarNotaCursadaUC` — call `setFechaRegularidad` when REGULAR
- File: `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts`
- Change: after `inscripcion.updateEstado(...)`, add:
  ```ts
  if (input.condicion === 'REGULAR') {
    inscripcion.setFechaRegularidad(new Date());
  }
  ```
  No else-branch needed — `setFechaRegularidad` no-op for non-REGULAR states is not called,
  which also satisfies FR-2.3 (neither set nor cleared for LIBRE/PROMOCIONAL).
- Satisfies: FR-2.1–FR-2.3
- Done-criteria: T-17 green

---

### E2 — RegistrarNotaFinalUC loads expiry data and passes to policy

**T-19 [TEST]** Write tests for `RegistrarNotaFinalUC` expiry path
- File (new): e.g. `api/src/application/nivel-terciario/__tests__/registrar-nota-final.uc.test.ts`
- Tests (mock all repos + policy via spies or manual stubs):
  - `inscripcion.fechaRegularidad = T0`, `llamadosTranscurridos = 3 >= llamadosVencimiento = 3`
    → policy returns `Err(RegularidadVencidaError)` → UC returns same error (Scenario H / FR-7.2)
  - `inscripcion.fechaRegularidad = T0`, `llamadosTranscurridos = 2 < llamadosVencimiento = 5`
    → policy allows → UC returns Ok (Scenario I)
  - `inscripcion.fechaRegularidad = null` → UC passes `llamadosTranscurridos = 0` to policy
    (FR-7.3 — null is never expired)
  - `carreraRepo.findByMateriaCarreraId` returns null → UC returns `NotFoundError`
- Satisfies: FR-7.1–FR-7.4, Scenarios H/I
- Done-criteria: new tests RED

**T-20 [IMPL]** `RegistrarNotaFinalUC` — inject repos + compute expiry inputs + pass to policy
- File: `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts`
- Constructor: add two new dependencies after `txRunner`:
  ```ts
  private readonly llamadoExamenRepo: LlamadoExamenRepository,
  private readonly carreraRepo: CarreraRepository,
  ```
- In `execute()`, between step 2 (load inscripcion) and step 6 (policy check):
  ```ts
  // Step 2b: load carrera via materiaCarreraId (ADR-3)
  const carrera = await this.carreraRepo.findByMateriaCarreraId(acta.materiaCarreraId);
  if (!carrera) return err(new NotFoundError('Carrera', acta.materiaCarreraId));

  // Step 2c: compute llamadosTranscurridos (FR-7.3: null → 0 = not expired)
  const llamadosTranscurridos = inscripcion.fechaRegularidad == null
    ? 0
    : await this.llamadoExamenRepo.countAfter(
        inscripcion.anioAcademico,
        inscripcion.fechaRegularidad,
      );
  ```
- Update policy call (step 6) to include the two new fields:
  ```ts
  FinalEligibilityPolicy.check({
    estado: inscripcion.estado,
    tpSlot,
    intentosPrevios,
    llamadosTranscurridos,
    llamadosVencimiento: carrera.llamadosVencimiento,
  })
  ```
- Add imports: `LlamadoExamenRepository`, `CarreraRepository` from `@educandow/domain`
- Satisfies: FR-7.1–FR-7.4, NFR-3
- Done-criteria: T-19 green; `pnpm build` passes

---

### E3 — buildMateriasTerciario expiry filter

**T-21 [TEST]** Write tests for `buildMateriasTerciario` expiry filter
- File (new or extended): test for `GenerateBoletinUseCase.buildMateriasTerciario` (unit with
  mocked `client` using in-memory data)
- Tests:
  - REGULAR materia with `fechaRegularidad = T0` and 5 llamados `fechaInicio > T0`,
    `llamadosVencimiento = 5` → materia EXCLUDED from output (Scenario J)
  - REGULAR materia with `fechaRegularidad = T0` and 3 llamados `fechaInicio > T0`,
    `llamadosVencimiento = 5` → materia INCLUDED (Scenario K)
  - REGULAR materia with `fechaRegularidad = null` and 10 llamados → materia INCLUDED
    (Scenario L — FR-4.3)
  - INSCRIPTO/APROBADO materias unaffected by filter (only REGULAR gated)
- Satisfies: FR-8.1–FR-8.5, Scenarios J/K/L
- Done-criteria: new tests RED

**T-22 [IMPL]** `buildMateriasTerciario` — Q3 bulk llamados + post-DB expiry filter
- File: `api/src/application/reportes/generate-boletin.use-case.ts`
- Changes inside `buildMateriasTerciario`:
  1. After Q1 (inscripciones query), add Q3 (bulk llamados — once for the year):
     ```ts
     // Q3: bulk llamados for expiry filter (ADR-2 — once, no N+1)
     const llamadosAno = await client.llamadoExamen.findMany({
       where: { anioAcademico: enrollment.academicYear, active: true, deletedAt: null },
     });
     ```
  2. After building `materiasFlat`, apply post-DB expiry filter BEFORE cuatrimestre grouping:
     ```ts
     const materiasVigentes = materiasFlat.filter((_, idx) => {
       const insc = (inscripciones as any[])[idx];
       if ((insc.estado as string) !== 'REGULAR') return true;
       const fechaReg: Date | null = insc.fechaRegularidad ?? null;
       if (!fechaReg) return true; // null → not expired (FR-4.3)
       const llamadosVencimiento: number =
         (insc.materiaCarrera?.carrera as any)?.llamadosVencimiento ?? 5;
       const count = (llamadosAno as any[]).filter(
         (l) => (l.fechaInicio as Date) > fechaReg,
       ).length;
       return count < llamadosVencimiento; // exclude when count >= threshold
     });
     ```
  3. Replace `materiasFlat` with `materiasVigentes` in the cuatrimestre grouping loop
     and in the return statement (`materias: materiasVigentes`)
  - Note: `insc.materiaCarrera.carrera` is already loaded by Q1's `include` chain;
    `llamadosVencimiento` becomes available after D1+D2 schema migration (FR-8.4, ADR-2)
  - DB `where.estado.in` clause continues to include `REGULAR` — no DB query change (FR-8.2, FR-8.3)
- Satisfies: FR-8.1–FR-8.5
- Done-criteria: T-21 green; `pnpm build` passes

---

## Phase 6 — Wiring

> F1 and F2 are independent of each other.
> F1 can run at any time after T-02/T-03 (error class exists).
> F2 must follow T-20 (RegistrarNotaFinalUC constructor change).

**T-23 [IMPL]** `AppExceptionFilter` — add `REGULARIDAD_VENCIDA: 422`
- File: `api/src/presentation/shared/filters/exception.filter.ts`
- Add to `DOMAIN_STATUS`:
  ```ts
  REGULARIDAD_VENCIDA: 422,
  ```
  (place in the Terciario block, after `CONDICION_INVALIDA`)
- Satisfies: FR-6.3
- Done-criteria: filter maps `REGULARIDAD_VENCIDA` → HTTP 422 (Scenario H)

**T-24 [IMPL]** `NivelTerciarioModule` — update `RegistrarNotaFinalUC` factory
- File: `api/src/presentation/nivel-terciario/nivel-terciario.module.ts`
- Update the `RegistrarNotaFinalUC` provider factory:
  ```ts
  {
    provide: RegistrarNotaFinalUC,
    useFactory: (
      r: PrismaActaExamenRepository,
      i: PrismaInscripcionMateriaRepository,
      nc: PrismaNotaCursadaTerciarioRepository,
      tx: PrismaTenantTransactionRunner,
      le: PrismaLlamadoExamenRepository,
      ca: PrismaCarreraRepository,
    ) => new RegistrarNotaFinalUC(r, i, nc, tx, le, ca),
    inject: [
      'ActaExamenRepository',
      'InscripcionRepository',
      'NotaCursadaTerciarioRepository',
      'TenantTransactionRunner',
      LLAMADO_EXAMEN_REPOSITORY,
      'CarreraRepository',
    ],
  }
  ```
- Satisfies: FR-7.4 (DI wiring for new repo dependencies)
- Done-criteria: NestJS DI resolves `RegistrarNotaFinalUC` at startup; `pnpm build` passes

---

## Dependency Graph

```
Phase 1 (T-01..T-07)  — parallel groups A/B/C
  ↓
Phase 2 (T-08, T-09)  — parallel; depend on Phase 1 types
  ↓ (T-08 → T-16, T-09 → T-15)
Phase 3 (T-10, T-11)  — sequential pair; T-10 depends on T-02 (error exists)
  ↓ (T-11 → E-group)
Phase 4 (T-12..T-16)  — T-12 can start with Phase 3; T-13 after T-12; T-14/T-15/T-16 parallel after T-13
  ↓
Phase 5 (T-17..T-22)  — E1/E2/E3 independent pairs after Phase 3+4
  ↓
Phase 6 (T-23, T-24)  — T-23 any time after T-02; T-24 after T-20
```

Parallel opportunities:
- All of Phase 1 groups A/B/C run in parallel
- T-08 and T-09 run in parallel
- T-12 can start alongside Phase 3 (schema is independent of policy)
- T-14, T-15, T-16 run in parallel after T-13
- T-17/T-18, T-19/T-20, T-21/T-22 run in parallel (E1/E2/E3 are independent)
- T-23 can run any time after T-02

Sequential bottlenecks:
- T-13 (migration + generate) blocks all repo impls (T-14/T-15/T-16)
- T-11 (policy signature) blocks all application UC impls (T-18/T-20/T-22)
- T-20 (RegistrarNotaFinalUC constructor) blocks T-24 (module wiring)

---

## Review Workload Forecast

| Metric | Estimate |
|--------|----------|
| Production lines changed/added | ~220 |
| Test lines added | ~375 |
| **Total lines** | **~595** |
| 400-line budget risk | **HIGH** |
| Chained PRs recommended | **No** — single PR is correct (all changes are load-bearing for each other; the policy signature change is an atomic refactor across domain + app + tests) |
| Delivery | **single-pr** with `size:exception` (previously approved in task prompt) |
| Decision needed before apply | No — `size:exception` authorized |

The 595-line estimate breaks down as:
- Domain layer (errors + entities + policy + ports): ~95 production + ~155 test = 250
- Infra (schema + repos): ~85 production lines
- App UCs (ConfirmarNota + RegistrarFinal + Boletín): ~65 production + ~175 test = 240
- Wiring (filter + module): ~12 production lines

All production changes are tightly coupled (policy signature change forces callers to update atomically). Splitting into multiple PRs would require feature-flag scaffolding that adds more complexity than it saves.

---

## Open items to resolve before apply

1. **Confirm `EstadoInscripcion.esRegular()` exists** — checked in codebase; it does (`estado-inscripcion.ts` line 36). No fallback to `.get() === 'REGULAR'` needed.
2. **`ConfirmarNotaCursadaUC` write-once** — entity `setFechaRegularidad` no-op is sufficient (ADR-5). No UC-level skip needed.
3. **Q1 `include` chain for `carrera.llamadosVencimiento`** in `buildMateriasTerciario` — already includes `materiaCarrera: { include: { subject: true, carrera: true } }`, so `llamadosVencimiento` will be present after T-12/T-13 schema migration. No extra query needed.
4. **`RegistrarNotaFinalUC` constructor param order** — appending `llamadoExamenRepo` + `carreraRepo` after `txRunner` (new 5th and 6th params). Module factory updated accordingly in T-24.
