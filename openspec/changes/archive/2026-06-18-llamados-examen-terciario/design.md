# Design — llamados-examen-terciario

> Phase: sdd-design · Date: 2026-06-18 · Nivel: TERCIARIO · Artifact store: hybrid
> Architecture: Clean Architecture (domain → application → infrastructure → presentation)
> Reads: proposal (#1177), spec (#1178), decisions (#1175)

## 1. Architecture approach

Replicate the proven **MesaExamen** vertical slice, but institution-scoped (no subject/carrera FK,
no sub-entity). The slice is a textbook CRUD over a single aggregate with two domain invariants.

Dependency rule (enforced):

```
presentation (controller + Zod)  ──▶  application (use cases, Result<T,E>)  ──▶  domain (entity + VO + port + errors)
              ▲                                                                          ▲
infrastructure (Prisma repo impl) ────────────────────────────────────────────────────┘  (implements port, zero domain deps)
```

- **Domain** (`packages/domain/src/terciario`): zero deps. Holds the `LlamadoExamen` entity, the
  `RangoFechas` value object (carries INV-RANGE), the two typed errors, and the repository **port**.
- **Application** (`api/src/application/nivel-terciario`): 4 use cases returning `Result<T,E>`, never
  throw. The **overlap policy (INV-OVERLAP) lives here** because it needs a DB query — the domain
  cannot reach persistence.
- **Infrastructure** (`api/src/infrastructure/persistence/prisma`): `PrismaLlamadoExamenRepository`
  implementing the port over the **tenant** client only (`TenantContext.getClient()`).
- **Presentation** (`api/src/presentation/nivel-terciario`): NestJS controller with Zod pipes, guards,
  `@Roles`/`@Levels`, DTO mapping to `{ data }` envelope.

Mirror anchors (real files inspected):

| Concern | Mirror source |
|---|---|
| Entity + VO + softDelete | `packages/domain/src/secundario/entities/mesa-examen.ts` |
| Repository port | `packages/domain/src/secundario/repositories/mesa-examen-repository.ts` |
| Prisma repo (tenant client, toDomain) | `.../prisma/repositories/prisma-mesa-examen.repository.ts` |
| CRUD controller + soft-delete 204 + `{ data }` | `api/src/presentation/nivel-terciario/carrera.controller.ts` |
| Use cases Result pattern | `.../application/nivel-terciario/use-cases/carrera.use-cases.ts` |
| Typed domain error w/ code | `packages/domain/src/.../attendance-type-code-duplicate-error.ts` |
| DI wiring (`useExisting` token + `useFactory`) | `api/src/presentation/nivel-terciario/nivel-terciario.module.ts` |
| Error code → HTTP mapping | `api/src/presentation/shared/filters/exception.filter.ts` |

## 2. Domain layer

### 2.1 Value Object — `RangoFechas` (carries INV-RANGE)

Immutable, self-validating. Encapsulates the `fechaInicio <= fechaFin` invariant so it cannot be
constructed in an invalid state.

```ts
// packages/domain/src/terciario/value-objects/rango-fechas.ts
export class RangoFechas {
  private constructor(
    public readonly inicio: Date,
    public readonly fin: Date,
  ) {}

  static create(inicio: Date, fin: Date): Result<RangoFechas, InvalidLlamadoRangeError> {
    if (inicio.getTime() > fin.getTime()) {
      return err(new InvalidLlamadoRangeError(inicio, fin)); // fechaInicio === fechaFin is VALID
    }
    return ok(new RangoFechas(inicio, fin));
  }

  // pure, testable predicate used by the overlap policy (inclusive overlap)
  overlaps(other: { inicio: Date; fin: Date }): boolean {
    return this.inicio.getTime() <= other.fin.getTime()
        && this.fin.getTime()   >= other.inicio.getTime();
  }
}
```

Rationale: the spec's INV-OVERLAP predicate ("one starts before the other ends, inclusive") is pure
math — placing `overlaps()` on the VO makes it unit-testable without a DB. The use case uses the
repo to fetch candidates and `RangoFechas.overlaps` (or the equivalent SQL filter) to decide.

### 2.2 Entity — `LlamadoExamen`

```ts
// packages/domain/src/terciario/entities/llamado-examen.ts
export interface LlamadoExamenProps {
  id: Id;
  nombre: string;
  anioAcademico: string;        // ← String (see ADR-1), e.g. "2025"
  rango: RangoFechas;
  active: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLlamadoExamenInput {
  nombre: string;
  anioAcademico: string;
  fechaInicio: Date;
  fechaFin: Date;
}

export class LlamadoExamen {
  private constructor(private props: LlamadoExamenProps) {}

  static create(input: CreateLlamadoExamenInput): Result<LlamadoExamen, InvalidLlamadoRangeError> {
    const rango = RangoFechas.create(input.fechaInicio, input.fechaFin);
    if (rango.isErr()) return err(rango.unwrapErr());
    const now = new Date();
    return ok(new LlamadoExamen({
      id: Id.create(),
      nombre: input.nombre,
      anioAcademico: input.anioAcademico,
      rango: rango.unwrap(),
      active: true,
      createdAt: now,
      updatedAt: now,
    }));
  }

  static reconstruct(props: LlamadoExamenProps): LlamadoExamen { return new LlamadoExamen(props); }

  // partial update; re-validates INV-RANGE on the resulting state
  update(input: { nombre?: string; fechaInicio?: Date; fechaFin?: Date }):
      Result<void, InvalidLlamadoRangeError> {
    if (input.fechaInicio || input.fechaFin) {
      const rango = RangoFechas.create(
        input.fechaInicio ?? this.props.rango.inicio,
        input.fechaFin    ?? this.props.rango.fin,
      );
      if (rango.isErr()) return err(rango.unwrapErr());
      this.props.rango = rango.unwrap();
    }
    if (input.nombre !== undefined) this.props.nombre = input.nombre;
    this.props.updatedAt = new Date();
    return ok(undefined);
  }

  softDelete(): void { this.props.active = false; this.props.deletedAt = new Date(); }

  // getters: id, nombre, anioAcademico, fechaInicio (rango.inicio), fechaFin (rango.fin),
  //          rango, active, deletedAt, createdAt, updatedAt
}
```

INV-RANGE is owned entirely by the entity/VO. INV-OVERLAP is NOT — it requires sibling state, so it
is enforced in the use case (Section 3).

### 2.3 Typed errors (mirror attendance-type error style)

```ts
// errors/invalid-llamado-range.error.ts
export class InvalidLlamadoRangeError extends DomainError {
  constructor(inicio: Date, fin: Date) {
    super(`fechaInicio (${inicio.toISOString()}) debe ser <= fechaFin (${fin.toISOString()})`,
          'INVALID_LLAMADO_RANGE');
  }
}

// errors/llamado-overlap.error.ts
export class LlamadoOverlapError extends DomainError {
  constructor(anioAcademico: string) {
    super(`Ya existe un llamado activo solapado en el año académico ${anioAcademico}`,
          'LLAMADO_OVERLAP');
  }
}
```

> No generic `ConflictError` exists in the domain (verified). The codebase models each conflict as a
> dedicated `DomainError` subclass with a stable `code` registered in the exception filter. We follow
> that pattern. The spec's `Result<…, ValidationError | ConflictError>` maps concretely to
> `InvalidLlamadoRangeError | LlamadoOverlapError | NotFoundError`.

### 2.4 Repository port

```ts
// packages/domain/src/terciario/repositories/llamado-examen-repository.ts
export interface LlamadoExamenRepository {
  findById(id: string): Promise<LlamadoExamen | null>;             // returns null if soft-deleted too (use case treats as NotFound)
  findByAnioAcademico(anioAcademico: string): Promise<LlamadoExamen[]>; // active only, ordered fechaInicio ASC
  findOverlapping(anioAcademico: string, inicio: Date, fin: Date, excludeId?: string): Promise<LlamadoExamen[]>;
  save(llamado: LlamadoExamen): Promise<void>;                     // upsert (create + update + softDelete persist)
}
export const LLAMADO_EXAMEN_REPOSITORY = 'LlamadoExamenRepository';
```

`findOverlapping` is the dedicated query backing INV-OVERLAP. It filters at the DB level with the
inclusive interval predicate and excludes soft-deleted + (optionally) the record being edited.

Exports added to `packages/domain/src/terciario/index.ts` (entity, VO, both errors, port + token);
`packages/domain/src/index.ts` already re-exports the terciario barrel.

## 3. Application layer — 4 use cases

File: `api/src/application/nivel-terciario/use-cases/llamado-examen.use-cases.ts`. Each injects the
repo via the `'LlamadoExamenRepository'` token. **Never throw — always `Result`.**

### Overlap policy (shared private helper)

```ts
private async assertNoOverlap(repo, anioAcademico, inicio, fin, excludeId?):
    Promise<Result<void, LlamadoOverlapError>> {
  const clashes = await repo.findOverlapping(anioAcademico, inicio, fin, excludeId);
  return clashes.length > 0 ? err(new LlamadoOverlapError(anioAcademico)) : ok(undefined);
}
```

| Use case | Input | Flow | Result type | Error → HTTP |
|---|---|---|---|---|
| `CreateLlamadoExamenUC` | nombre, anioAcademico, fechaInicio, fechaFin | `LlamadoExamen.create` (INV-RANGE) → `assertNoOverlap` (INV-OVERLAP) → `repo.save` | `Result<LlamadoExamen, InvalidLlamadoRangeError \| LlamadoOverlapError>` | 422 / 409 |
| `UpdateLlamadoExamenUC` | id, {nombre?, fechaInicio?, fechaFin?} | `findById` (404 if null/soft-deleted) → `entity.update` (INV-RANGE) → `assertNoOverlap(excludeId=id)` → `repo.save` | `Result<LlamadoExamen, NotFoundError \| InvalidLlamadoRangeError \| LlamadoOverlapError>` | 404 / 422 / 409 |
| `ListLlamadosExamenUC` | anioAcademico | `repo.findByAnioAcademico` (active only, `fechaInicio ASC`) | `Result<LlamadoExamen[], never>` (or plain `LlamadoExamen[]`) | 200 |
| `DeleteLlamadoExamenUC` | id | `findById` (404 if null/already soft-deleted) → `entity.softDelete` → `repo.save` | `Result<void, NotFoundError>` | 404 / 204 |

> Note: spec uses `Result<void, NotFoundError>` for delete. The existing `DeleteCarreraUC` *throws*
> NotFoundError. We follow the **spec** (return `Result`) since it is the stricter, no-throw contract;
> the controller unwraps the error and lets the filter map it. This is a deliberate, minor deviation
> from the Carrera mirror in favor of the no-throw constraint (NFR).

## 4. Presentation layer

### 4.1 Controller

File: `api/src/presentation/nivel-terciario/llamado-examen.controller.ts`, route base
`terciario/llamados-examen` (final path `/v1/terciario/llamados-examen` via global prefix).

```ts
@Controller('terciario/llamados-examen')
@UseGuards(AuthGuard, RolesGuard, LevelsGuard)
@Levels(EducationalLevelCode.TERCIARIO)
export class LlamadoExamenController {
  // POST    @Roles('ROOT', { module: 'GRADES', action: 'CREATE' }) → 201 { data }
  // GET      @Roles('ROOT', { module: 'GRADES', action: 'READ'   }) ?anioAcademico=… → 200 { data: [] }
  // PATCH/:id @Roles('ROOT', { module: 'GRADES', action: 'UPDATE' }) → 200 { data }
  // DELETE/:id @Roles('ROOT', { module: 'GRADES', action: 'DELETE' }) @HttpCode(204) → 204 no body
}
```

On `result.isErr()` → `throw result.unwrapErr()` (filter maps code→status). Success → `{ data: toDto(...) }`.
List shape and soft-delete `@HttpCode(HttpStatus.NO_CONTENT)` mirror `CarreraController` exactly.

DTO mapper:
```ts
function toDto(l: LlamadoExamen) {
  return { id: l.id.get(), nombre: l.nombre, anioAcademico: l.anioAcademico,
           fechaInicio: l.fechaInicio.toISOString(), fechaFin: l.fechaFin.toISOString(),
           active: l.active };
}
```

### 4.2 Zod schemas

File: `api/src/presentation/nivel-terciario/dto/llamado-examen.dto.ts`.

```ts
export const CreateLlamadoExamenSchema = z.object({
  nombre:        z.string().min(1),
  anioAcademico: z.string().min(1),               // String — see ADR-1
  fechaInicio:   z.string().datetime(),           // ISO; controller → new Date(...)
  fechaFin:      z.string().datetime(),
});
export const UpdateLlamadoExamenSchema = z.object({
  nombre:      z.string().min(1).optional(),
  fechaInicio: z.string().datetime().optional(),
  fechaFin:    z.string().datetime().optional(),
}).refine(d => Object.keys(d).length > 0, 'al menos un campo');
export const ListLlamadosExamenQuerySchema = z.object({ anioAcademico: z.string().min(1) });
```

Controller converts ISO strings to `Date` before calling the use case (mirrors `new Date(body.fecha)`
in `MesaExamenController`). Zod cross-field range check is intentionally NOT added — INV-RANGE belongs
to the domain (single source of truth, returns the `INVALID_LLAMADO_RANGE` code).

### 4.3 Error code → HTTP registration

Add to `DOMAIN_STATUS` in `api/src/presentation/shared/filters/exception.filter.ts`:

```ts
INVALID_LLAMADO_RANGE: 422,
LLAMADO_OVERLAP:       409,
// NOT_FOUND: 404 already registered
```

This is the only edit to an existing shared file. Non-breaking (additive map keys).

## 5. Infrastructure — Prisma repository

File: `api/src/infrastructure/persistence/prisma/repositories/prisma-llamado-examen.repository.ts`.
Mirrors `PrismaMesaExamenRepository`: `TenantContext.getClient()` getter, `toDomain` mapper, `upsert`
in `save`.

```ts
async findByAnioAcademico(anio: string) {
  const rows = await this.client.llamadoExamen.findMany({
    where: { anioAcademico: anio, active: true, deletedAt: null },
    orderBy: { fechaInicio: 'asc' },
  });
  return rows.map(this.toDomain);
}

async findOverlapping(anio, inicio, fin, excludeId?) {
  const rows = await this.client.llamadoExamen.findMany({
    where: {
      anioAcademico: anio,
      active: true,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      fechaInicio: { lte: fin },      // inclusive interval overlap:
      fechaFin:    { gte: inicio },   // start_a <= end_b AND end_a >= start_b
    },
  });
  return rows.map(this.toDomain);
}
```

`toDomain` rebuilds `RangoFechas` via `RangoFechas.create(row.fechaInicio, row.fechaFin).unwrap()`
(DB rows are trusted/already valid) and `LlamadoExamen.reconstruct`.

## 6. Persistence — Prisma model + migration

Add to the Terciario section of `api/prisma_tenant/schema.prisma` (after `ActaExamen`):

```prisma
model LlamadoExamen {
  id            String    @id @default(uuid())
  nombre        String
  anioAcademico String    @map("anio_academico")
  fechaInicio   DateTime  @map("fecha_inicio")
  fechaFin      DateTime  @map("fecha_fin")
  active        Boolean   @default(true)
  deletedAt     DateTime? @map("deleted_at")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  @@index([anioAcademico])
  @@index([fechaInicio])
  @@map("llamados_examen")
}
```

Migration: `pnpm --filter api prisma:migrate:tenant` (dev) → new table `llamados_examen`, **additive /
non-breaking** (no FKs, no changes to existing tables). `anioAcademico` is `String` to match
`InscripcionMateria.anioAcademico` (schema line 1150) and `MateriaCarrera` usage. `nombre` free-text
(D2). No `carreraId`/subject FK (D1).

## 7. DI wiring

In `nivel-terciario.module.ts` add (mirror Carrera block):

```ts
PrismaLlamadoExamenRepository,
{ provide: 'LlamadoExamenRepository', useExisting: PrismaLlamadoExamenRepository },
{ provide: CreateLlamadoExamenUC, useFactory: r => new CreateLlamadoExamenUC(r), inject: ['LlamadoExamenRepository'] },
{ provide: UpdateLlamadoExamenUC, useFactory: r => new UpdateLlamadoExamenUC(r), inject: ['LlamadoExamenRepository'] },
{ provide: ListLlamadosExamenUC,  useFactory: r => new ListLlamadosExamenUC(r),  inject: ['LlamadoExamenRepository'] },
{ provide: DeleteLlamadoExamenUC, useFactory: r => new DeleteLlamadoExamenUC(r), inject: ['LlamadoExamenRepository'] },
```
and register `LlamadoExamenController` in `controllers`.

## 8. Test strategy (Strict TDD — test first, ≥80% domain & api)

Mirror existing test files. Write the failing test before each implementation step.

| Test file | Layer | Covers |
|---|---|---|
| `packages/domain/src/terciario/__tests__/value-objects/rango-fechas.test.ts` | domain | INV-RANGE: inicio<fin ok, inicio==fin ok, inicio>fin → `InvalidLlamadoRangeError`; `overlaps()` inclusive predicate truth table |
| `packages/domain/src/terciario/__tests__/entities/llamado-examen.test.ts` | domain | `create` ok/err, `update` re-validates range, `softDelete` sets active=false + deletedAt |
| `api/src/application/nivel-terciario/__tests__/llamado-examen.use-cases.test.ts` | application | all 4 UCs with a fake repo: create ok/range-err/overlap-err; update 404/range/overlap/self-exclusion; list filters active + order + empty; delete 404/already-deleted/success. Mirrors `mesa-examen.use-cases.test.ts` + `carrera` tests |

Optional: controller test mirroring `attendance-type.controller.test.ts` if guard/Zod coverage is
needed for the 400/403 paths. Overlap-policy edge cases (adjacent non-overlapping `2025-07-15` /
`2025-07-16`, different `anioAcademico`, soft-deleted excluded) covered at the use-case level with a
fake repo driving `findOverlapping`.

## 9. File manifest

**Create**
- `packages/domain/src/terciario/value-objects/rango-fechas.ts`
- `packages/domain/src/terciario/entities/llamado-examen.ts`
- `packages/domain/src/terciario/errors/invalid-llamado-range.error.ts`
- `packages/domain/src/terciario/errors/llamado-overlap.error.ts`
- `packages/domain/src/terciario/repositories/llamado-examen-repository.ts`
- `api/src/application/nivel-terciario/use-cases/llamado-examen.use-cases.ts`
- `api/src/infrastructure/persistence/prisma/repositories/prisma-llamado-examen.repository.ts`
- `api/src/presentation/nivel-terciario/dto/llamado-examen.dto.ts`
- `api/src/presentation/nivel-terciario/llamado-examen.controller.ts`
- 3 test files (Section 8)
- Prisma migration (generated)

**Modify**
- `packages/domain/src/terciario/index.ts` (exports)
- `api/prisma_tenant/schema.prisma` (new model)
- `api/src/presentation/nivel-terciario/nivel-terciario.module.ts` (DI + controller)
- `api/src/presentation/shared/filters/exception.filter.ts` (2 code mappings)

**Delete**: none.

## 10. ADRs

### ADR-1 — `anioAcademico` is `String`, not integer
- **Context**: spec R1 table says `integer`. Real schema stores `InscripcionMateria.anioAcademico`
  (line 1150) as `String @map("anio_academico")`.
- **Decision**: use `String` for `LlamadoExamen.anioAcademico` (entity, Prisma, Zod).
- **Why**: consistency with the existing Terciario academic-year column; change 2
  (`vencimiento-regularidad-terciario`) will compare/count against `fechaRegularidad` + this calendar,
  and a uniform type avoids cross-table coercion bugs.
- **Rejected**: `Int` — would diverge from the only existing `anioAcademico` precedent and force casts.

### ADR-2 — INV-OVERLAP lives in the use case, INV-RANGE in the domain
- **Decision**: range invariant → `RangoFechas` VO (pure, no deps); overlap invariant → use case via
  `repo.findOverlapping`.
- **Why**: overlap needs sibling persistence state; pushing it into the domain would force a repo
  dependency into `packages/domain`, violating the dependency rule. The pure interval predicate
  (`RangoFechas.overlaps`) stays in the domain and is reused/tested independently.
- **Rejected**: a DB unique constraint or exclusion constraint — Postgres `EXCLUDE` would work but is
  invisible to the domain, hard to unit-test, and yields opaque 500s instead of `LLAMADO_OVERLAP` 409.

### ADR-3 — Dedicated typed errors instead of generic `ConflictError`
- **Decision**: `InvalidLlamadoRangeError` (422) and `LlamadoOverlapError` (409) as `DomainError`
  subclasses with stable codes, registered in `AppExceptionFilter`.
- **Why**: matches the entire codebase convention (attendance-type, grading, evaluacion-terciario all
  use per-rule error classes + filter mapping). No generic `ConflictError` exists.

### ADR-4 — Zod validation failures return HTTP 400, not 422
- **Context**: spec R4/R6 scenarios say missing/invalid query → 422. The shared `ZodValidationPipe`
  throws `BadRequestException` → **400** (verified).
- **Decision**: reuse the shared pipe (400) for input-shape validation; reserve 422 for the domain
  invariant `INVALID_LLAMADO_RANGE`.
- **Why**: forking the validation pipe for one feature would fragment a cross-cutting convention used
  by every controller. Mirroring the codebase wins. **This is a spec/code discrepancy surfaced for the
  tasks/verify phases** — see Risks.
- **Rejected**: custom 422 pipe just for llamados — inconsistent, higher maintenance.

## 11. Risks

1. **Spec status-code drift (Zod 422 vs 400)** — ADR-4 resolves toward code reality (400). The spec's
   R4/R6 "422" for Zod errors will fail literal verification. Action: align spec wording in tasks or
   accept 400 as the documented behavior. Domain INV-RANGE correctly returns 422.
2. **Overlap inclusivity at the boundary** — spec scenario treats `2025-07-16` as NON-overlapping with
   `…–2025-07-15`. With day-granularity ISO dates parsed to midnight UTC, `lte fin` / `gte inicio`
   gives the correct result; but if callers send same-day timestamps the inclusive `<=`/`>=` is
   intentional. Covered by an explicit adjacent-boundary test.
3. **Timezone of date-only inputs** — `z.string().datetime()` expects full ISO. If the frontend later
   sends date-only (`2025-07-01`), parsing/normalization must be decided. Out of scope now (backend
   change), flagged for change 2 integration.
4. **DeleteUC deviates from Carrera mirror** (Result vs throw) — low risk, stricter contract; ensure
   the controller awaits and unwraps so a 404 still reaches the filter.
5. No FK to `ActaExamen` (D6) — change 2 must count by date calendar; if a relation is later needed it
   is an additive migration.
</content>
</invoke>
