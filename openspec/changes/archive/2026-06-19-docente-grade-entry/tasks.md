# Tasks — docente-grade-entry (Fase D, Terciario)

**Delivery**: Single PR · **Size**: exception (estimated ~1 400 changed lines, >400 budget)
**TDD mode**: STRICT — every implementation task has a preceding test task.
Test runner: `pnpm test` · Coverage target: ≥ 80 % for all new code.

---

## Dependency graph (parallel tracks)

```
Track A  T-01 → T-02 ─────────────────────────────────────────→ T-05
Track B  T-03 (independent) ─────────────────────────────────→ T-05
Track C  T-04 (independent) ─────────────────────────────────→ T-05 → T-12
Track D  T-06 → T-07 → T-08 ─────────────────────────→ T-15 → T-17 →─┐
Track E  T-09 (independent) ────────────────────────────────→ T-14     │
Track F  T-10 (independent, master migration)                           │
Track G  T-11 (independent, master seed)                                │
         T-05 → T-13 → T-14 → T-16 ──────────────────────────────────→ T-18 → T-19
                                T-15 → T-17 ─────────────────────────→ T-18
```

Tasks T-01 / T-03 / T-04 / T-06 / T-09 / T-10 / T-11 can all start in parallel.
T-18 (module wiring) gates T-19 (regression pass).

---

## T-01 — [TEST-FIRST] Domain entity `DocenteXMateriaCarrera`

**Track**: A (blocks T-02, feeds T-05, T-08, T-13)
**Spec**: SPEC-1.1, SPEC-1.2, SPEC-1.3, SPEC-1.4

### Step 1 — write failing test
File: `packages/domain/src/nivel-terciario/__tests__/docente-x-materia-carrera.entity.test.ts`

Cover:
- `create()` builds entity with `active = true` by default.
- `unassign()` sets `active = false`, bumps `updatedAt`.
- `reactivate()` sets `active = true` (used by assign-after-soft-unassign, ADR-2).
- `reconstruct()` round-trips all fields.
- Equality invariant: same `(userId, materiaCarreraId, anioAcademico)` produces distinct objects if IDs differ (co-teaching, SPEC-1.3).

### Step 2 — implement entity
File: `packages/domain/src/nivel-terciario/docente-x-materia-carrera.entity.ts`

Fields: `id` (string/UUID), `userId`, `materiaCarreraId`, `anioAcademico`, `active`, `createdAt`, `updatedAt`.
Methods: `static create(props): DocenteXMateriaCarrera` · `static reconstruct(props): DocenteXMateriaCarrera` · `unassign(): void` · `reactivate(): void`.
No FK logic — pure value record (mirrors `DocenteXCiclo` style).

**Done-criteria**: test file compiles and all assertions green; entity has no Prisma or NestJS imports.

---

## T-02 — Domain repository port `DocenteXMateriaCarreraRepository`

**Track**: A (sequential after T-01, blocks T-08, T-13, T-15)
**Spec**: SPEC-1, SPEC-4.3, SPEC-4.4, SPEC-8.1

File: `packages/domain/src/nivel-terciario/repositories/docente-x-materia-carrera-repository.ts`

```ts
export const DOCENTE_X_MATERIA_CARRERA_REPOSITORY = 'DocenteXMateriaCarreraRepository' as const;

export interface DocenteXMateriaCarreraRepository {
  findActiveAssignment(userId: string, materiaCarreraId: string, anioAcademico: string):
    Promise<DocenteXMateriaCarrera | null>;
  findAny(userId: string, materiaCarreraId: string, anioAcademico: string):
    Promise<DocenteXMateriaCarrera | null>;
  findById(id: string): Promise<DocenteXMateriaCarrera | null>;
  listByMateria(materiaCarreraId: string, anioAcademico?: string): Promise<DocenteXMateriaCarrera[]>;
  listByDocente(userId: string): Promise<DocenteXMateriaCarrera[]>;
  save(entity: DocenteXMateriaCarrera): Promise<void>;
}
```

`findActiveAssignment` — hot Door 3 path: must filter `active: true`.
`findAny` — used by assign UC to detect inactive rows for reactivation (ADR-2).
`listByMateria` and `listByDocente` — return **active only** (SPEC-4.C).

**Done-criteria**: file compiles, no runtime imports, token constant exported.

---

## T-03 — Domain port `TerciarioAuthorizerPort`

**Track**: B (independent, blocks T-13)
**Spec**: SPEC-3.1, SPEC-7.4

File: `packages/domain/src/grading/ports/terciario-authorizer.port.ts`

```ts
// Reuse StudentScope from assignment-authorizer.port.ts
export const TERCIARIO_AUTHORIZER = 'TerciarioAuthorizerPort' as const;

export interface TerciarioAuthorizerPort {
  canWriteGrades(userId: string, userRoles: string[], inscripcionMateriaId: string): Promise<boolean>;
  getAllowedStudentIds(
    userId: string,
    userRoles: string[],
    materiaCarreraId: string,
    anioAcademico: string,
  ): Promise<StudentScope>;
}
```

Port names are locked by spec (SPEC-3.1, ADR-1): `canWriteGrades` / `getAllowedStudentIds`.
`StudentScope` is imported from the existing `assignment-authorizer.port.ts` (`string[] | 'all' | null`).

**Done-criteria**: file compiles; token constant `TERCIARIO_AUTHORIZER` exported; no implementation.

---

## T-04 — Domain errors: `DocenteAlreadyAssignedError` + `AssignmentAlreadyInactiveError`

**Track**: C (independent, blocks T-12, T-15)
**Spec**: SPEC-1.2 (409 duplicate), SPEC-4.2 (409 duplicate), SPEC-4.5 (409 already inactive)

Files:
- `packages/domain/src/shared/errors/docente-already-assigned-error.ts`
- `packages/domain/src/shared/errors/assignment-already-inactive-error.ts`

```ts
// docente-already-assigned-error.ts
export class DocenteAlreadyAssignedError extends DomainError {
  constructor() { super('El docente ya está asignado a esta materia y año', 'DOCENTE_ALREADY_ASSIGNED'); }
}

// assignment-already-inactive-error.ts
export class AssignmentAlreadyInactiveError extends DomainError {
  constructor() { super('La asignación ya está inactiva', 'ASSIGNMENT_ALREADY_INACTIVE'); }
}
```

**Note**: ownership denial reuses the existing `ForbiddenError` (`FORBIDDEN` → 403). No new error needed for that case.

**Done-criteria**: both files compile and extend `DomainError` correctly; code strings match exactly what T-12 will register.

---

## T-05 — Domain barrel exports

**Track**: convergence (sequential after T-01–T-04, blocks T-13, T-15)
**Spec**: SPEC-8.1 (domain layer isolation)

Files to modify:
- `packages/domain/src/nivel-terciario/index.ts` (or create if absent) — export entity + repo port + token
- `packages/domain/src/grading/ports/index.ts` (or barrel) — export `TerciarioAuthorizerPort` + `TERCIARIO_AUTHORIZER`
- `packages/domain/src/shared/errors/index.ts` (or equivalent) — export the 2 new error classes
- `packages/domain/src/index.ts` — re-export all new symbols so `@educandow/domain` consumers can import them

**Done-criteria**: running `pnpm --filter @educandow/domain build` passes; all new symbols importable via `@educandow/domain`.

---

## T-06 — Tenant Prisma schema — add `DocenteXMateriaCarrera` model

**Track**: D (can start in parallel with T-01, blocks T-07, T-08)
**Spec**: SPEC-1.1, SPEC-1.2, SPEC-8.1

File: `api/prisma_tenant/schema.prisma`

Add model (exact `@@map("docentes_x_materia_carrera")`):

```prisma
model DocenteXMateriaCarrera {
  id               String   @id @default(uuid())
  userId           String   @map("user_id")
  materiaCarreraId String   @map("materia_carrera_id")
  anioAcademico    String   @map("anio_academico")
  active           Boolean  @default(true)
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt      @map("updated_at")

  materiaCarrera   MateriaCarrera @relation(fields: [materiaCarreraId], references: [id], onDelete: Cascade)

  @@unique([userId, materiaCarreraId, anioAcademico])
  @@index([materiaCarreraId, anioAcademico])
  @@index([userId])
  @@map("docentes_x_materia_carrera")
}
```

Also add back-relation on `MateriaCarrera`:
```prisma
docentesAsignados DocenteXMateriaCarrera[]
```

**Verify before writing**: confirm existing `MateriaCarrera` model uses `@@map("materias_carrera")` — the FK in the migration SQL (`T-07`) depends on this exact table name.

**Done-criteria**: `pnpm --filter api prisma:generate` runs without error; tenant Prisma client exposes `docenteXMateriaCarrera` accessor.

---

## T-07 — Tenant migration SQL

**Track**: D (sequential after T-06, blocks T-08)
**Spec**: SPEC-1.1, SPEC-1.2, SPEC-8.1
**Note**: TENANT migration — applies to per-institution DB, NOT master DB.

File: `api/prisma_tenant/migrations/20260619100000_docentes_x_materia_carrera/migration.sql`

```sql
CREATE TABLE "docentes_x_materia_carrera" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "materia_carrera_id" TEXT NOT NULL,
  "anio_academico" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "docentes_x_materia_carrera_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dxmc_user_materia_anio_key"
  ON "docentes_x_materia_carrera"("user_id","materia_carrera_id","anio_academico");
CREATE INDEX "dxmc_materia_anio_idx"
  ON "docentes_x_materia_carrera"("materia_carrera_id","anio_academico");
CREATE INDEX "dxmc_user_idx"
  ON "docentes_x_materia_carrera"("user_id");
ALTER TABLE "docentes_x_materia_carrera"
  ADD CONSTRAINT "dxmc_materia_carrera_fkey"
  FOREIGN KEY ("materia_carrera_id") REFERENCES "materias_carrera"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

**Done-criteria**: file exists under `api/prisma_tenant/migrations/`; SQL is idempotent-safe for `prisma migrate deploy`; `materias_carrera` table name confirmed from T-06 verification.

---

## T-08 — [TEST-FIRST] `PrismaDocenteXMateriaCarreraRepository`

**Track**: D (sequential after T-06 + T-07, blocks T-15)
**Spec**: SPEC-1.2, SPEC-1.4, SPEC-4.C, SPEC-8.6

### Step 1 — write failing tests
File: `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-docente-x-materia-carrera.repository.test.ts`

Cover (mock the tenant Prisma client via `TenantContext`):
- `findActiveAssignment` returns entity when `active = true`; returns `null` for inactive rows (SPEC-3.D).
- `findAny` returns row regardless of `active` flag.
- `findById` returns entity or `null`.
- `listByMateria` filters `active: true`; also filters by `anioAcademico` when supplied (SPEC-4.3/4.C).
- `listByDocente` filters `active: true` (SPEC-4.4).
- `save` calls `upsert` with the correct shape.

### Step 2 — implement repository
File: `api/src/infrastructure/persistence/prisma/repositories/prisma-docente-x-materia-carrera.repository.ts`

Uses `TenantContext.getClient()` — never injects PrismaService directly (SPEC-8.6).
Implements `DocenteXMateriaCarreraRepository` port.
`save` → `upsert` by `id`.
`findActiveAssignment` → `findFirst({ where: { userId, materiaCarreraId, anioAcademico, active: true } })`.

**Done-criteria**: all test cases green; repository is decorated `@Injectable()`; no cross-DB (master) calls.

---

## T-09 — Verify / add `listByMateria` on `InscripcionRepository` + impl

**Track**: E (independent, blocks T-14)
**Spec**: SPEC-7.4, ADR-6

Files to inspect then modify if needed:
- `packages/domain/src/terciario/repositories/` (or wherever `InscripcionRepository` port lives) — add `listByMateria(materiaCarreraId: string, anioAcademico: string): Promise<InscripcionMateria[]>` if absent.
- `api/src/infrastructure/persistence/prisma/repositories/prisma-inscripcion-materia.repository.ts` — add impl of `listByMateria` if absent. `PrismaInscripcionMateriaRepository` already has `findByMateriaCarrera(materiaCarreraId)` but it ignores `anioAcademico`; add the two-param variant.

**Action**: check whether `InscripcionRepository` port already declares `listByMateria(materiaCarreraId, anioAcademico)`. If yes, only verify the impl. If no, add to port + impl.

Impl:
```ts
async listByMateria(materiaCarreraId: string, anioAcademico: string): Promise<InscripcionMateria[]> {
  const rs = await this.client.inscripcionMateria.findMany({
    where: { materiaCarreraId, anioAcademico },
    orderBy: { studentId: 'asc' },
  });
  return rs.map(r => this.toDomain(r));
}
```

**Done-criteria**: port declares method; impl added; existing tests stay green.

---

## T-10 — MASTER migration SQL: TEACHER gains `GRADES:UPDATE`

**Track**: F (fully independent)
**Spec**: SPEC-2.1, ADR-7
**Note**: MASTER migration — applies to the shared `role_modules` table, NOT tenant DB.

File: `api/prisma_master/migrations/20260619110000_teacher_grades_update/migration.sql`

```sql
-- Idempotent: only runs if UPDATE is not already in the array.
UPDATE "role_modules"
SET "actions" = ARRAY['CREATE','READ','UPDATE']
WHERE "id" = 'rm-r-teach-m-grades'
  AND NOT ('UPDATE' = ANY("actions"));
```

**Done-criteria**: file exists under `api/prisma_master/migrations/`; SQL is safe to re-run; does NOT touch tenant tables.

---

## T-11 — Edit `api/prisma/seed-rbac.sql` — TEACHER GRADES actions

**Track**: G (fully independent)
**Spec**: SPEC-2.1

File: `api/prisma/seed-rbac.sql` (line ~79)

Change:
```sql
-- before
('rm-r-teach-m-grades', 'r-teach', 'm-grades', ARRAY['CREATE','READ'])
-- after
('rm-r-teach-m-grades', 'r-teach', 'm-grades', ARRAY['CREATE','READ','UPDATE'])
```

**Done-criteria**: diff is exactly one line; fresh `prisma:seed` run will seed `GRADES:UPDATE` for TEACHER role.

---

## T-12 — Add new error codes to exception filter

**Track**: C (sequential after T-04)
**Spec**: SPEC-1.2, SPEC-4.2, SPEC-4.5, design §3.4

File: `api/src/presentation/shared/filters/exception.filter.ts`

Add to `DOMAIN_STATUS` map:
```ts
DOCENTE_ALREADY_ASSIGNED: 409,
ASSIGNMENT_ALREADY_INACTIVE: 409,
```

**Done-criteria**: both codes present; existing entries untouched; `ForbiddenError` (`FORBIDDEN → 403`) already registered — no change needed for that.

---

## T-13 — [TEST-FIRST] `TerciarioAuthorizerService`

**Track**: App authorizer (sequential after T-05 — needs T-02, T-03 barrel exports; blocks T-14)
**Spec**: SPEC-3.1, SPEC-3.2, SPEC-3.3, SPEC-3.4, SPEC-8.6, SPEC-8.A

### Step 1 — write failing unit tests
File: `api/src/application/grading/__tests__/terciario-authorizer.service.test.ts`

Cover — mock `DocenteXMateriaCarreraRepository` + stub `TenantContext.getClient()`:

| Scenario | Method | Expected |
|---|---|---|
| Door 2: SECRETARIO role | `canWriteGrades` | `true`, NO repo call (SPEC-3.A) |
| Door 2: DIRECTOR role | `getAllowedStudentIds` | `'all'`, NO repo call |
| Door 3: active assignment | `canWriteGrades` | `true` (SPEC-3.B) |
| Door 3: no assignment | `canWriteGrades` | `false` (SPEC-3.C) |
| Door 3: inactive row | `canWriteGrades` | `false` (SPEC-3.D) |
| null tenant client | `canWriteGrades` | `false`, no throw (SPEC-8.A) |
| missing inscripcion | `canWriteGrades` | `false` (null-safety, SPEC-3.3) |
| Door 3 assigned | `getAllowedStudentIds` | array of `studentId`s (SPEC-7.A) |
| Door 3 not assigned | `getAllowedStudentIds` | `null` (SPEC-7.B) |

Regression guard: verify `AssignmentAuthorizer` tests in `__tests__/assignment-authorizer.service.test.ts` are NOT imported or modified (SPEC-8.5).

### Step 2 — implement service
File: `api/src/application/grading/terciario-authorizer.service.ts`

Implements `TerciarioAuthorizerPort`. Structure mirrors `AssignmentAuthorizer` (see existing file for pattern):
- Constructor injects `DocenteXMateriaCarreraRepository` via `DOCENTE_X_MATERIA_CARRERA_REPOSITORY` token.
- Private `isAssigned(userId, materiaCarreraId, anioAcademico)` calls `repo.findActiveAssignment(...)`.
- `canWriteGrades`: Door 2 check first → null client → raw Prisma read of `inscripcionMateria` (via `TenantContext.getClient()`) → `isAssigned`.
- `getAllowedStudentIds`: Door 2 check first → null client → `isAssigned` → raw `findMany` for `studentId`s.
- `anioAcademico` is ALWAYS derived from `InscripcionMateria.anioAcademico` — never from caller params (SPEC-3.4).
- Fail-closed: any missing link returns `false` / `null`, never throws.

**Done-criteria**: all unit tests green; `AssignmentAuthorizer` tests still pass; TypeScript strict compiles.

---

## T-14 — [TEST-FIRST] Cursada write use-cases ownership integration + `ListInscripcionesDocenteUC`

**Track**: App cursada (sequential after T-13 + T-09; blocks T-16)
**Spec**: SPEC-5, SPEC-6, SPEC-7

### Step 1 — write/update failing tests
File: `api/src/application/nivel-terciario/__tests__/nota-cursada-terciario.use-cases.test.ts`
(Update existing file — add new test cases, do NOT remove existing passing cases.)

New cases to add (mock `TerciarioAuthorizerPort`):

**For `CreateNotaCursadaSlotUC`**:
- Assigned teacher: `canWriteGrades → true` → slot created, returns `ok` (SPEC-5.A).
- Non-assigned: `canWriteGrades → false` → returns `err(ForbiddenError)`, no repo.save call (SPEC-5.B).
- Secretaría bypass: `canWriteGrades → true` (via Door 2 in the service) → slot created (SPEC-5.E).

**For `UpdateNotaCursadaSlotUC`**:
- Assigned: `canWriteGrades → true` → update succeeds (SPEC-5.C).
- Non-assigned: `canWriteGrades → false` → `err(ForbiddenError)` (SPEC-5.D).

**For `ConfirmarNotaCursadaUC`**:
- Assigned, `REGULAR` condicion → ok (SPEC-6.A).
- Assigned, `LIBRE` → ok (SPEC-6.B).
- Assigned, `PROMOCIONAL` → ok (SPEC-6.C).
- Non-assigned → `err(ForbiddenError)` (SPEC-6.D).
- Secretaría bypass → ok (SPEC-6.E).

File (new UC, separate test may be added):
**For `ListInscripcionesDocenteUC`**:
- `getAllowedStudentIds → 'all'` → returns full list (SPEC-7.C).
- `getAllowedStudentIds → ['s1','s2']` → filters list to matching studentIds (SPEC-7.A).
- `getAllowedStudentIds → null` → returns `err(ForbiddenError)` (SPEC-7.B).

### Step 2 — implement changes
File: `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts`

Modify `CreateNotaCursadaSlotUC`, `UpdateNotaCursadaSlotUC`, `ConfirmarNotaCursadaUC`:
- Add constructor parameter `private readonly authz: TerciarioAuthorizerPort`.
- Add `userId: string, userRoles: string[]` as first two parameters to `execute(...)`.
- First statement in each `execute`:
  ```ts
  if (!(await this.authz.canWriteGrades(userId, userRoles, inscripcionMateriaId)))
    return err(new ForbiddenError('No estás asignado a esta materia'));
  ```
- Remaining body unchanged.

Add new use-case `ListInscripcionesDocenteUC` at the end of the same file:
```ts
@Injectable()
export class ListInscripcionesDocenteUC {
  constructor(
    private readonly authz: TerciarioAuthorizerPort,
    private readonly inscripcionRepo: InscripcionRepository,
  ) {}

  async execute(
    userId: string, userRoles: string[],
    materiaCarreraId: string, anioAcademico: string,
  ): Promise<Result<InscripcionMateria[], ForbiddenError>> {
    const scope = await this.authz.getAllowedStudentIds(userId, userRoles, materiaCarreraId, anioAcademico);
    if (scope === null) return err(new ForbiddenError('No estás asignado a esta materia'));
    const all = await this.inscripcionRepo.listByMateria(materiaCarreraId, anioAcademico);
    return ok(scope === 'all' ? all : all.filter(i => scope.includes(i.studentId)));
  }
}
```

**Done-criteria**: all existing + new test cases green; `ListNotaCursadaSlotsUC` signature unchanged (not ownership-gated); `promocionar` UC untouched.

---

## T-15 — [TEST-FIRST] Admin assignment use-cases

**Track**: App admin (sequential after T-08 + T-04 + T-05; blocks T-17)
**Spec**: SPEC-4.1, SPEC-4.2, SPEC-4.3, SPEC-4.4, SPEC-4.5, SPEC-1.B, SPEC-1.C, SPEC-1.D, ADR-2, ADR-5

### Step 1 — write failing tests
File: `api/src/application/nivel-terciario/__tests__/docente-materia.use-cases.test.ts`

Mock `DocenteXMateriaCarreraRepository`. Cover:

**`AssignDocenteMateriaUC`**:
- Non-admin caller → `err(ForbiddenError)` (SPEC-4.1 / 4.B).
- Admin, no existing row → creates new entity, `repo.save` called, returns `ok(entity)` 201 (SPEC-4.A).
- Admin, existing active row → `err(DocenteAlreadyAssignedError)` 409 (SPEC-1.B / 4.2).
- Admin, existing inactive row → calls `reactivate()` + `repo.save`, returns `ok` (ADR-2).

**`ListAssignmentsUC`**:
- Non-admin → `err(ForbiddenError)`.
- Admin, `materiaCarreraId` supplied → calls `listByMateria` (SPEC-4.3).
- Admin, `materiaCarreraId` + `anioAcademico` → passes both to `listByMateria` (SPEC-4.3 filter).
- Admin, `userId` supplied → calls `listByDocente` (SPEC-4.4).
- Result contains only active rows (SPEC-4.C).

**`UnassignDocenteMateriaUC`**:
- Non-admin → `err(ForbiddenError)`.
- Row not found → `err(NotFoundError)` 404 (SPEC-4.5).
- Row already inactive → `err(AssignmentAlreadyInactiveError)` 409 (SPEC-4.E).
- Active row → calls `unassign()` + `repo.save`, returns `ok` 200 (SPEC-4.D).

### Step 2 — implement use-cases
File: `api/src/application/nivel-terciario/use-cases/docente-materia.use-cases.ts` (new file)

Three `@Injectable()` classes: `AssignDocenteMateriaUC`, `ListAssignmentsUC`, `UnassignDocenteMateriaUC`.

Each starts with admin gate:
```ts
if (!resolveAccessScope({ roles: userRoles }).isAdministrative)
  return err(new ForbiddenError('Solo secretaría puede gestionar asignaciones'));
```

`AssignDocenteMateriaUC.execute(userRoles, { userId, materiaCarreraId, anioAcademico })`:
- `repo.findAny(userId, materiaCarreraId, anioAcademico)`.
- Existing active → `Err(DocenteAlreadyAssignedError)`.
- Existing inactive → `entity.reactivate(); await repo.save(entity); return ok(entity)`.
- None → `DocenteXMateriaCarrera.create(...); await repo.save(entity); return ok(entity)`.

`ListAssignmentsUC.execute(userRoles, { materiaCarreraId?, userId?, anioAcademico? })`:
- Dispatch to `listByMateria` or `listByDocente` based on which param is present.

`UnassignDocenteMateriaUC.execute(userRoles, id)`:
- `repo.findById(id)` → null → `Err(NotFoundError)`.
- `entity.active === false` → `Err(AssignmentAlreadyInactiveError)`.
- Else → `entity.unassign(); await repo.save(entity); return ok(entity)`.

All return `Result<T, DomainError>` (SPEC-8.2). No throw.

**Done-criteria**: all test cases green; no HTTP/NestJS imports in use-case file.

---

## T-16 — Update `nota-cursada-terciario.controller.ts`

**Track**: Presentation cursada (sequential after T-14; blocks T-18)
**Spec**: SPEC-5.1, SPEC-5.2, SPEC-6.1, SPEC-7.1, SPEC-8.3

File: `api/src/presentation/nivel-terciario/nota-cursada-terciario.controller.ts`

Changes:
1. Import `CurrentUser` decorator and `ListInscripcionesDocenteUC`.
2. Add `@CurrentUser() user: { userId: string; roles: string[] }` to the three write action methods: `createSlot`, `updateSlot`, `confirmar`.
3. Pass `user.userId, user.roles` as first two args to each respective use-case `execute(...)`.
4. Add new route:
   ```ts
   @Get('inscripciones')
   @Roles('ROOT', { module: 'GRADES', action: 'READ' })
   async listInscripciones(
     @CurrentUser() user: { userId: string; roles: string[] },
     @Query(new ZodValidationPipe(ListInscripcionesQuerySchema)) query: ListInscripcionesQueryDTO,
   ) { ... }
   ```
   Zod schema: `{ materiaCarreraId: z.string().min(1), anioAcademico: z.string().min(4) }`.
   On `result.isErr()` → throw.

Route path `GET /terciario/cursada/inscripciones` (SPEC-7.1).
**Do NOT change** `ListNotaCursadaSlotsUC` call or `promocionar` endpoint.

**Done-criteria**: TypeScript compiles; `@CurrentUser` is forwarded to use-cases; new GET route present with correct Zod validation; no change to existing `GET /terciario/inscripciones` (ENROLLMENTS:READ, different controller).

---

## T-17 — Create `docente-materia-admin.controller.ts`

**Track**: Presentation admin (sequential after T-15; blocks T-18)
**Spec**: SPEC-4.1–4.5, SPEC-8.3

File: `api/src/presentation/nivel-terciario/docente-materia-admin.controller.ts`

```
@Controller('terciario/admin/docentes-materias')
@UseGuards(AuthGuard, RolesGuard, LevelsGuard)
@Levels(EducationalLevelCode.TERCIARIO)
```

Zod schemas (in same file or separate dto file):
```ts
const AssignDocenteSchema = z.object({
  userId: z.string().min(1),
  materiaCarreraId: z.string().min(1),
  anioAcademico: z.string().min(4),
});
const ListAssignmentsQuerySchema = z.object({
  materiaCarreraId: z.string().optional(),
  userId: z.string().optional(),
  anioAcademico: z.string().optional(),
}).refine(q => q.materiaCarreraId || q.userId, { message: 'materiaCarreraId or userId required' });
```

Routes:
| Method | Path | `@Roles` Door 1 | UC | Success |
|---|---|---|---|---|
| POST | `/` | `GRADES:CREATE` | `AssignDocenteMateriaUC` | 201 |
| GET | `/` | `GRADES:READ` | `ListAssignmentsUC` | 200 |
| PATCH | `/:id/unassign` | `GRADES:UPDATE` | `UnassignDocenteMateriaUC` | 200 |

Controller passes `user.roles` to every UC (admin gate lives in the UC, ADR-5).
`isErr()` → throw domain error (AppExceptionFilter maps it).

**Done-criteria**: file compiles; all three routes present; `@CurrentUser` used; Zod pipes applied.

---

## T-18 — Update `nivel-terciario.module.ts`

**Track**: Module wiring (sequential after T-08, T-13, T-14, T-16, T-17; blocks T-19)
**Spec**: all wiring concerns (design §4 DI, §6.2)

File: `api/src/presentation/nivel-terciario/nivel-terciario.module.ts`

Add to `controllers[]`: `DocenteMateriaAdminController`.

Add to `providers[]`:
```ts
// Repo
PrismaDocenteXMateriaCarreraRepository,
{ provide: DOCENTE_X_MATERIA_CARRERA_REPOSITORY, useExisting: PrismaDocenteXMateriaCarreraRepository },

// TerciarioAuthorizerService
{
  provide: TERCIARIO_AUTHORIZER,
  useFactory: (repo: DocenteXMateriaCarreraRepository) => new TerciarioAuthorizerService(repo),
  inject: [DOCENTE_X_MATERIA_CARRERA_REPOSITORY],
},

// Cursada write UCs — update existing factories to inject authz
{
  provide: CreateNotaCursadaSlotUC,
  useFactory: (r: PrismaNotaCursadaTerciarioRepository, authz: TerciarioAuthorizerPort) =>
    new CreateNotaCursadaSlotUC(r, authz),
  inject: ['NotaCursadaTerciarioRepository', TERCIARIO_AUTHORIZER],
},
// (same pattern for UpdateNotaCursadaSlotUC, ConfirmarNotaCursadaUC)

// New UCs
{
  provide: ListInscripcionesDocenteUC,
  useFactory: (authz: TerciarioAuthorizerPort, i: PrismaInscripcionMateriaRepository) =>
    new ListInscripcionesDocenteUC(authz, i),
  inject: [TERCIARIO_AUTHORIZER, 'InscripcionRepository'],
},
{
  provide: AssignDocenteMateriaUC,
  useFactory: (r: PrismaDocenteXMateriaCarreraRepository) => new AssignDocenteMateriaUC(r),
  inject: [DOCENTE_X_MATERIA_CARRERA_REPOSITORY],
},
{
  provide: ListAssignmentsUC,
  useFactory: (r: PrismaDocenteXMateriaCarreraRepository) => new ListAssignmentsUC(r),
  inject: [DOCENTE_X_MATERIA_CARRERA_REPOSITORY],
},
{
  provide: UnassignDocenteMateriaUC,
  useFactory: (r: PrismaDocenteXMateriaCarreraRepository) => new UnassignDocenteMateriaUC(r),
  inject: [DOCENTE_X_MATERIA_CARRERA_REPOSITORY],
},
```

Also add `DocenteMateriaAdminController` to constructor of `NotaCursadaTerciarioController` updates (see T-16 re: `ListInscripcionesDocenteUC`).

**Done-criteria**: `pnpm build` passes with no DI resolution errors; no circular imports.

---

## T-19 — Regression pass: full test suite + coverage check

**Track**: Final gate (sequential after T-18)
**Spec**: SPEC-8.4, SPEC-8.5

Run:
```
pnpm test
pnpm --filter api test:coverage
pnpm build
```

Verify:
- [x] `AssignmentAuthorizer` test file (`__tests__/assignment-authorizer.service.test.ts`) — all cases still green (SPEC-8.5 / 2.C).
- [x] `TerciarioAuthorizerService` coverage ≥ 80 % (SPEC-8.4).
- [x] `PrismaDocenteXMateriaCarreraRepository` coverage ≥ 80 %.
- [x] All admin UCs coverage ≥ 80 %.
- [x] `ListInscripcionesDocenteUC` coverage ≥ 80 %.
- [x] Cursada write UCs coverage ≥ 80 % (including new ownership branch).
- [x] No Primario / Secundario test regressions.
- [x] `pnpm build` exits 0.

**Done-criteria**: `pnpm test` exits 0, all coverage thresholds met, build clean.

---

## Summary table

| # | Task | Layer | Parallel starts with | Blocks |
|---|---|---|---|---|
| T-01 | Entity `DocenteXMateriaCarrera` (test-first) | Domain | T-03, T-04, T-06, T-09–T-11 | T-02 |
| T-02 | Repo port | Domain | — | T-05 |
| T-03 | `TerciarioAuthorizerPort` | Domain | T-01, T-04, T-06 | T-05 |
| T-04 | Domain errors | Domain | T-01, T-03, T-06 | T-05, T-12 |
| T-05 | Barrel exports | Domain | — (waits T-01–T-04) | T-13, T-15 |
| T-06 | Tenant schema update | Infra/DB | T-01, T-03, T-04 | T-07 |
| T-07 | Tenant migration SQL | Infra/DB | — (waits T-06) | T-08 |
| T-08 | Prisma repo impl (test-first) | Infra/DB | — (waits T-06+T-07) | T-15 |
| T-09 | `listByMateria` on InscripcionRepo | Infra/DB | T-01, T-03, T-04 | T-14 |
| T-10 | Master migration SQL | Infra/DB | all | — |
| T-11 | seed-rbac.sql edit | Config | all | — |
| T-12 | Exception filter codes | Infra | waits T-04 | — |
| T-13 | `TerciarioAuthorizerService` (test-first) | Application | waits T-05 | T-14 |
| T-14 | Cursada UCs + `ListInscripcionesDocenteUC` (test-first) | Application | waits T-13+T-09 | T-16 |
| T-15 | Admin UCs (test-first) | Application | waits T-08+T-05 | T-17 |
| T-16 | `nota-cursada-terciario.controller.ts` update | Presentation | waits T-14 | T-18 |
| T-17 | `docente-materia-admin.controller.ts` (new) | Presentation | waits T-15 | T-18 |
| T-18 | `nivel-terciario.module.ts` wiring | Presentation | waits T-16+T-17 | T-19 |
| T-19 | Full regression pass + coverage | Verify | waits T-18 | — |

---

## Review Workload Forecast

| Metric | Estimate |
|---|---|
| New files created | ~14 (entity, 2 ports, 2 error files, 2 migrations, repo impl, authorizer service, 3 admin UCs, admin controller, 5+ test files) |
| Files modified | ~10 (schema.prisma, seed-rbac.sql, 2 domain barrels, inscripcion repo, cursada use-cases, cursada controller, module, exception filter) |
| New lines (implementation) | ~750 |
| New lines (tests) | ~650 |
| Total changed lines | ~1 400 |
| 400-line budget risk | **HIGH** (3.5× over budget) |
| Chained PRs recommended | **No** — single-PR with `size:exception` (per delivery strategy) |
| Decision needed before apply | **No** — strategy is already `single-pr`; flag `size:exception` in PR description |

**Operational risk (ADR-7)**: existing docente JWTs minted before the master migration (`T-10`) will not carry `GRADES:UPDATE`. Docentes must re-login after deployment. Include in release notes.

---

## Key invariants for sdd-apply

1. **TENANT vs MASTER split**: T-07 goes to `api/prisma_tenant/migrations/`; T-10 goes to `api/prisma_master/migrations/`. Never cross these.
2. **Port names locked** (ADR-1): public methods are `canWriteGrades` / `getAllowedStudentIds` — these are what `sdd-verify` will check against the spec.
3. **Fail-closed** (SPEC-8.6): any missing tenant client or missing inscripcion record must return `false` / `null`, never throw.
4. **Admin gate in use-case** (ADR-5): `resolveAccessScope().isAdministrative` check lives inside the use-case, not in a guard.
5. **Ownership in use-case** (ADR-4): `canWriteGrades` is called inside `execute()`, not in the controller.
6. **AssignmentAuthorizer untouched** (SPEC-8.5): no edits to `assignment-authorizer.service.ts` or `access-scope.ts`.
7. **Reactivate-on-assign** (ADR-2): `AssignDocenteMateriaUC` calls `entity.reactivate()` for inactive rows instead of inserting duplicates.
