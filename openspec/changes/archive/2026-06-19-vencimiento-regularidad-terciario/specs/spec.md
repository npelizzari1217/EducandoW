# Delta Spec: vencimiento-regularidad-terciario

> Phase: sdd-spec · Date: 2026-06-18 · Level: TERCIARIO · Artifact store: hybrid

---

## 1. Scope

This spec covers the **delta** — everything that MUST be true after this change is applied,
relative to the baseline after `llamados-examen-terciario` (change 1, merged).

Out-of-scope items are listed in the proposal and are NOT re-stated here.

---

## 2. Functional Requirements

### FR-1 — `InscripcionMateria.fechaRegularidad` field

**FR-1.1** `InscripcionMateria` MUST expose a `fechaRegularidad: Date | null` property.  
**FR-1.2** The Prisma tenant schema MUST add `fechaRegularidad DateTime?` to the
`InscripcionMateria` model. It MUST default to `null`.  
**FR-1.3** `InscripcionMateria.reconstruct()` MUST accept an optional `fechaRegularidad?: Date`
and surface it via a read-only getter.  
**FR-1.4** `InscripcionMateria.create()` MUST NOT accept `fechaRegularidad` (value is set only
by the application layer after estado transitions, never at enrolment time).

---

### FR-2 — `ConfirmarNotaCursadaUC` writes `fechaRegularidad`

**FR-2.1** When `ConfirmarNotaCursadaUC` confirms a cursada with `condicion = REGULAR`,
the use-case MUST persist `fechaRegularidad = now()` (wall-clock UTC at execution time)
alongside the estado change.  
**FR-2.2** `fechaRegularidad` MUST NOT be overwritten on any subsequent `ConfirmarNotaCursadaUC`
call for the same `InscripcionMateria`. Once set, it is immutable.  
**FR-2.3** When `condicion` is LIBRE or PROMOCIONAL, `fechaRegularidad` MUST be left unchanged
(neither set nor cleared).  
**FR-2.4** `InscripcionMateria` MUST expose a method `setFechaRegularidad(date: Date): void` that
sets the value only when it is currently `null`; if `fechaRegularidad` is already set,
the method MUST be a no-op (enforces immutability at entity level).

---

### FR-3 — `Carrera.llamadosVencimiento` field

**FR-3.1** `Carrera` MUST expose a `llamadosVencimiento: number` property.  
**FR-3.2** The Prisma tenant schema MUST add `llamadosVencimiento Int @default(5)` to the
`Carrera` model.  
**FR-3.3** `Carrera.reconstruct()` MUST accept `llamadosVencimiento: number` and surface it
via a read-only getter.  
**FR-3.4** `Carrera.create()` MUST accept an optional `llamadosVencimiento?: number` and default
to `5` when omitted.  
**FR-3.5** `llamadosVencimiento` MUST be a positive integer. The entity MUST throw a
`ValidationError` if a value ≤ 0 is provided.

---

### FR-4 — Expiry computation rule

**FR-4.1** A regularidad is considered **expired** when ALL of the following hold:
  - `inscripcion.estado === REGULAR`
  - `inscripcion.fechaRegularidad !== null`
  - The count of active `LlamadoExamen` records whose `fechaInicio > inscripcion.fechaRegularidad`
    is **≥** `carrera.llamadosVencimiento`

**FR-4.2** A `LlamadoExamen` record MUST be counted only when
`llamado.fechaInicio > inscripcion.fechaRegularidad` (strict greater-than).
A llamado whose `fechaInicio` is equal to `fechaRegularidad` MUST NOT be counted.  
**FR-4.3** When `inscripcion.fechaRegularidad` is `null`, the regularidad MUST be treated as
NOT expired, regardless of how many llamados have occurred.  
**FR-4.4** The scope for counting llamados is **institution-wide** (all active `LlamadoExamen`
for the tenant's `anioAcademico`, regardless of carrera). No carrera filter is applied.  
**FR-4.5** Expiry is a **derived, on-the-fly** computation. The estado in the database
MUST remain `REGULAR`; no write to `InscripcionMateria.estado` occurs as a result of expiry.  
**FR-4.6** No background job (cron) or scheduled task MAY be introduced for expiry.

---

### FR-5 — `FinalEligibilityPolicy` — expiry guard step

**FR-5.1** `FinalEligibilityPolicy.check()` MUST accept two additional input fields:
  - `llamadosTranscurridos: number` — count of active llamados after `fechaRegularidad`
  - `llamadosVencimiento: number` — from `Carrera`

**FR-5.2** The guard evaluation order MUST be updated as follows (step numbers are informational;
only the relative order is normative):

  1. estado not confirmed → `CursadaNoConfirmadaError`
  2. **NEW** estado = REGULAR AND `llamadosTranscurridos >= llamadosVencimiento` → `RegularidadVencidaError`
  3. estado = LIBRE → `AlumnoLibreNoPuedeRendirError`
  4. TP faltante / AUSENTE → `TpObligatorioFaltanteError`
  5. `intentosPrevios >= 3` → `MaxIntentosAlcanzadoError`
  6. OK → return `IntentoFinal`

**FR-5.3** The expiry guard (step 2 above) MUST execute only when `estado === REGULAR`.
When `estado` is LIBRE or any other state, it MUST be skipped; subsequent guards apply normally.  
**FR-5.4** `FinalEligibilityPolicy` MUST remain a pure function (no I/O, no injected dependencies).
The caller is responsible for loading `llamadosTranscurridos` and `llamadosVencimiento` before
invoking the policy.

---

### FR-6 — `RegularidadVencidaError` domain error

**FR-6.1** A new `RegularidadVencidaError` MUST be created in the Terciario domain errors
directory (`packages/domain/src/terciario/errors/`).  
**FR-6.2** It MUST extend `DomainError` and use the code `REGULARIDAD_VENCIDA`.  
**FR-6.3** When mapped through `AppExceptionFilter`, `RegularidadVencidaError` MUST produce
an HTTP **422 Unprocessable Entity** response.

---

### FR-7 — `RegistrarNotaFinalUC` loads expiry data

**FR-7.1** `RegistrarNotaFinalUC` MUST load the expiry inputs before calling the policy.
The additional data-loading steps MUST be performed before `FinalEligibilityPolicy.check()`:
  - Load `LlamadoExamen` records for the current `anioAcademico` (via `LlamadoExamenRepository.findByAnioAcademico`)
  - Filter in-memory (or via a new repo method) those with `fechaInicio > inscripcion.fechaRegularidad`
    to produce `llamadosTranscurridos: number`
  - Load `Carrera` (via carrera ID from `materiaCarrera`) to read `llamadosVencimiento`

**FR-7.2** `RegistrarNotaFinalUC` MUST pass `llamadosTranscurridos` and `llamadosVencimiento`
to `FinalEligibilityPolicy.check()`.  
**FR-7.3** When `inscripcion.fechaRegularidad` is `null`, `RegistrarNotaFinalUC` MUST pass
`llamadosTranscurridos = 0` to the policy (consistent with FR-4.3: not expired).  
**FR-7.4** `RegistrarNotaFinalUC` MUST inject `LlamadoExamenRepository` and a `CarreraRepository`
(or equivalent port) to satisfy the new data loads.

---

### FR-8 — Boletín: exclude expired REGULAR materias from vigente listing

**FR-8.1** `buildMateriasTerciario` MUST exclude from its output any materia where:
  - `inscripcion.estado === REGULAR`
  - `inscripcion.fechaRegularidad !== null`
  - The count of active `LlamadoExamen` with `fechaInicio > inscripcion.fechaRegularidad`
    is `>= carrera.llamadosVencimiento`

**FR-8.2** The exclusion MUST be applied as a **post-DB in-memory filter**, after the existing
Prisma query (which continues to include REGULAR in `ESTADOS_INCLUIDOS` at the DB level).  
**FR-8.3** The filter MUST NOT alter the DB query. The `where.estado.in` clause continues
to include `REGULAR`.  
**FR-8.4** `buildMateriasTerciario` MUST load the llamados count and `llamadosVencimiento`
needed to evaluate expiry for each REGULAR materia. A single bulk load of relevant
`LlamadoExamen` records (for the academic year) SHOULD be used to avoid N+1 queries.  
**FR-8.5** Expired REGULAR materias MUST be silently excluded (no "VENCIDA" label in the output).
The resulting boletín looks identical to a boletín where the materia was never in REGULAR state.

---

## 3. Non-Functional Requirements

**NFR-1** All new and modified production code MUST achieve ≥ 80 % line coverage via Vitest.  
**NFR-2** No cron job, scheduled task, or background process MAY be introduced.  
**NFR-3** All domain operations MUST follow the `Result<T, E>` pattern (`ok` / `err`).  
**NFR-4** All Prisma calls MUST use the tenant client (`TenantPrismaClient`), never the master client.  
**NFR-5** `FinalEligibilityPolicy` MUST remain pure (no side effects, no I/O).  
**NFR-6** The new Prisma migration MUST be backward-compatible: existing rows get
`fechaRegularidad = null` (already NULL-able) and `llamadosVencimiento = 5` (column default).
No data migration script is required.  
**NFR-7** The test command is `pnpm test`; the build command is `pnpm build`.

---

## 4. Acceptance Scenarios

### Scenario A — `fechaRegularidad` is set on first REGULAR confirmation

```
Given an InscripcionMateria in CURSANDO estado with fechaRegularidad = null
When ConfirmarNotaCursadaUC is executed with condicion = REGULAR
Then inscripcion.estado becomes REGULAR
AND  inscripcion.fechaRegularidad is set to approximately now() (non-null)
AND  the value is persisted in the tenant DB
```

### Scenario B — `fechaRegularidad` is NOT overwritten on repeated confirmation

```
Given an InscripcionMateria already in REGULAR estado with fechaRegularidad = T1
When ConfirmarNotaCursadaUC is executed again with condicion = REGULAR
Then inscripcion.fechaRegularidad remains T1 (unchanged)
```

### Scenario C — LIBRE/PROMOCIONAL confirmation does not touch `fechaRegularidad`

```
Given an InscripcionMateria in CURSANDO estado with fechaRegularidad = null
When ConfirmarNotaCursadaUC is executed with condicion = LIBRE
Then inscripcion.fechaRegularidad remains null
```

### Scenario D — NULL `fechaRegularidad` is never expired

```
Given an InscripcionMateria in REGULAR estado with fechaRegularidad = null
AND  a Carrera with llamadosVencimiento = 5
AND  10 active LlamadoExamen records exist after any plausible date
When FinalEligibilityPolicy.check() is called with llamadosTranscurridos = 0 and llamadosVencimiento = 5
Then the result is Ok (not RegularidadVencidaError)
```

*(RegistrarNotaFinalUC passes llamadosTranscurridos = 0 when fechaRegularidad is null — FR-7.3)*

### Scenario E — Expiry fires when llamados count reaches threshold

```
Given an InscripcionMateria in REGULAR estado with fechaRegularidad = T0
AND  a Carrera with llamadosVencimiento = 5
AND  5 active LlamadoExamen with fechaInicio > T0 exist (count = 5 >= 5)
When FinalEligibilityPolicy.check() is called with llamadosTranscurridos = 5, llamadosVencimiento = 5
Then the result is Err(RegularidadVencidaError)
```

### Scenario F — Not yet expired (count below threshold)

```
Given an InscripcionMateria in REGULAR estado with fechaRegularidad = T0
AND  a Carrera with llamadosVencimiento = 5
AND  4 active LlamadoExamen with fechaInicio > T0 exist (count = 4 < 5)
When FinalEligibilityPolicy.check() is called with llamadosTranscurridos = 4, llamadosVencimiento = 5
Then the result is Ok (proceeds to subsequent guards)
```

### Scenario G — Boundary: llamado on the same date as fechaRegularidad does NOT count

```
Given an InscripcionMateria in REGULAR estado with fechaRegularidad = T0
AND  a LlamadoExamen with fechaInicio = T0 (equal, not strictly after)
AND  no other LlamadoExamen after T0
When the llamadosTranscurridos count is computed (fechaInicio > T0)
Then the count is 0
AND  the regularidad is NOT expired (even with llamadosVencimiento = 1)
```

### Scenario H — `RegistrarNotaFinalUC` returns 422 for expired student

```
Given an InscripcionMateria in REGULAR estado with fechaRegularidad = T0
AND  a Carrera with llamadosVencimiento = 3
AND  3 active LlamadoExamen with fechaInicio > T0
When the HTTP endpoint POST /acta-examen/:id/nota-final is called for that student
Then the response is HTTP 422
AND  the error code in the body is REGULARIDAD_VENCIDA
AND  no ActaExamenNota row is created
AND  inscripcion.estado remains REGULAR in the DB
```

### Scenario I — `RegistrarNotaFinalUC` succeeds for student with non-expired regularidad

```
Given an InscripcionMateria in REGULAR estado with fechaRegularidad = T0
AND  a Carrera with llamadosVencimiento = 5
AND  2 active LlamadoExamen with fechaInicio > T0
When the HTTP endpoint POST /acta-examen/:id/nota-final is called for that student
Then the response is HTTP 200 (or HTTP 201)
AND  the final note is persisted
```

### Scenario J — Boletín excludes expired REGULAR materia

```
Given a student with one InscripcionMateria in REGULAR estado with fechaRegularidad = T0
AND  a Carrera with llamadosVencimiento = 5
AND  5 active LlamadoExamen with fechaInicio > T0 exist
When generateBoletin is executed for that student
Then the boletín output does NOT include that materia
AND  no "VENCIDA" or "expired" label appears in the response
```

### Scenario K — Boletín includes non-expired REGULAR materia

```
Given a student with one InscripcionMateria in REGULAR estado with fechaRegularidad = T0
AND  a Carrera with llamadosVencimiento = 5
AND  3 active LlamadoExamen with fechaInicio > T0 exist (count = 3 < 5)
When generateBoletin is executed for that student
Then the boletín output INCLUDES that materia with condicionCursada = "Regular"
```

### Scenario L — Boletín includes REGULAR materia with NULL fechaRegularidad (backfill)

```
Given a student with one InscripcionMateria in REGULAR estado with fechaRegularidad = null
AND  any number of LlamadoExamen records exist
When generateBoletin is executed for that student
Then the boletín output INCLUDES that materia (treated as non-expired — FR-4.3)
```

### Scenario M — `Carrera.llamadosVencimiento` defaults to 5

```
Given Carrera.create() is called without providing llamadosVencimiento
Then carrera.llamadosVencimiento equals 5
```

### Scenario N — `Carrera.llamadosVencimiento` rejects zero or negative values

```
Given Carrera.create() or Carrera.reconstruct() is called with llamadosVencimiento = 0
Then a ValidationError is thrown
```

---

## 5. Error Codes Reference

| Error class               | Code                  | HTTP mapping |
|---------------------------|-----------------------|--------------|
| `RegularidadVencidaError` | `REGULARIDAD_VENCIDA` | 422          |

---

## 6. Invariants

- `InscripcionMateria.fechaRegularidad` is write-once: set on first REGULAR confirmation,
  never modified afterwards.
- Expiry does NOT transition `InscripcionMateria.estado`. The estado stays `REGULAR` in the DB.
- Policy inputs `llamadosTranscurridos` and `llamadosVencimiento` are always provided by the
  application layer before calling the pure policy.
- `fechaRegularidad = null` is always non-expired (safe backfill default).

---

## 7. Files Affected (delta)

| File | Change |
|------|--------|
| `api/prisma_tenant/schema.prisma` | Add `fechaRegularidad DateTime?` to `InscripcionMateria`; add `llamadosVencimiento Int @default(5)` to `Carrera` |
| `packages/domain/src/terciario/entities/inscripcion-materia.ts` | Add `fechaRegularidad?: Date` prop, getter, `setFechaRegularidad()` |
| `packages/domain/src/terciario/entities/carrera.ts` | Add `llamadosVencimiento: number` prop and getter |
| `packages/domain/src/terciario/policies/final-eligibility-policy.ts` | Add guard step 2 (expiry); extend `check()` input shape |
| `packages/domain/src/terciario/errors/regularidad-vencida.error.ts` | New file |
| `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts` | `ConfirmarNotaCursadaUC` writes `fechaRegularidad` when REGULAR |
| `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts` | `RegistrarNotaFinalUC` loads llamados count + `llamadosVencimiento`; passes to policy |
| `api/src/application/reportes/generate-boletin.use-case.ts` | `buildMateriasTerciario` adds post-DB expiry filter |
| `packages/domain/src/terciario/repositories/llamado-examen-repository.ts` | Add `countAfter(fechaRegularidad: Date, anioAcademico: string): Promise<number>` (OR caller filters in-memory; design phase decides) |
| Prisma migration file (new) | DB migration for the two new columns |
