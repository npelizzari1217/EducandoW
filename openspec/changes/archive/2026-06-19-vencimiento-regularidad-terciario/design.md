# Design: vencimiento-regularidad-terciario

> Phase: sdd-design · Date: 2026-06-18 · Level: TERCIARIO · Artifact store: hybrid

## Technical Approach

On-the-fly expiry (proposal Approach A). The DB `estado` stays `REGULAR`; expiry is DERIVED
at two call sites (the final-exam guard and the boletín) from `inscripcion.fechaRegularidad`
+ a count of institution-wide `LlamadoExamen` with `fechaInicio > fechaRegularidad` compared
against `carrera.llamadosVencimiento`. `FinalEligibilityPolicy` stays a PURE function: callers
load the two scalars and pass them in. Two new nullable/defaulted columns make the migration
non-breaking. Clean/Hexagonal boundaries preserved: domain (entities, policy, error, ports)
in `packages/domain`, orchestration in `api` use-cases, I/O in Prisma repos.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| ADR-1 | Count strategy: guard path | New `LlamadoExamenRepository.countAfter(anioAcademico, afterDate)` → Prisma `count` with `fechaInicio: { gt }`, `active:true`, `deletedAt:null` | `findByAnioAcademico` + in-memory `.filter().length` | Guard handles ONE inscripcion; a `count` query is the minimal load and avoids hydrating entities. No N+1 (single call). |
| ADR-2 | Count strategy: boletín path | Bulk `findMany` of the year's active llamados ONCE, then count `fechaInicio > fechaRegularidad` in-memory per REGULAR inscripcion | `countAfter` per inscripcion (N+1) | Boletín is multi-materia for one student; llamados are institution-wide and few. One query + in-memory counting matches the existing REQ-8 bulk pattern (`buildMateriasTerciario` already does Q1/Q2 bulk). |
| ADR-3 | Resolve carrera from materiaCarrera (guard) | Add `CarreraRepository.findByMateriaCarreraId(materiaCarreraId): Promise<Carrera \| null>` (single join `MateriaCarrera → Carrera`) | New `MateriaCarreraRepository`; load full MateriaCarrera then carrera | `acta.materiaCarreraId` is a MateriaCarrera id, not a carreraId. One extra port method on the existing `CarreraRepository` is lighter than a whole new port. |
| ADR-4 | Policy purity | Extend `check()` input with `llamadosTranscurridos` + `llamadosVencimiento`; new guard step 2 runs only when `estado === REGULAR` | Inject repos into the policy | NFR-5 + existing pattern. Keeps unit tests trivial (pure fn). |
| ADR-5 | `fechaRegularidad` immutability | Enforced in the ENTITY via `setFechaRegularidad(date)` no-op when already set (write-once) | Enforce only in the UC | Invariant belongs in the aggregate; UC stays thin and the rule can't be bypassed. |
| ADR-6 | Boletín exclusion | Post-DB in-memory filter; DB `where.estado.in` still includes REGULAR | DB-level filter | Expiry is derived, not a persisted state — can't be expressed as a `where` on `estado`. Silent exclusion (no VENCIDA label) per FR-8.5. |
| ADR-7 | Backfill | `fechaRegularidad = null ⇒ not expired` (guard passes `llamadosTranscurridos = 0`) | Data migration backfilling dates | Safe default; no historical regularidad is broken; no migration script (NFR-6). |

## Data Flow

Guard (RegistrarNotaFinalUC):

    HTTP POST nota-final
      → load acta, inscripcion, intentosPrevios, tpSlot
      → carrera = CarreraRepository.findByMateriaCarreraId(acta.materiaCarreraId)
      → llamadosTranscurridos = (insc.fechaRegularidad == null)
              ? 0
              : LlamadoExamenRepository.countAfter(insc.anioAcademico, insc.fechaRegularidad)
      → FinalEligibilityPolicy.check({ estado, tpSlot, intentosPrevios,
                                       llamadosTranscurridos, llamadosVencimiento })
              → Err(RegularidadVencidaError) → AppExceptionFilter → 422

Boletín (buildMateriasTerciario):

    Q1 inscripciones (estado.in incl. REGULAR, materiaCarrera.carrera incl. llamadosVencimiento)
    Q3 llamados = client.llamadoExamen.findMany({ anioAcademico, active, deletedAt:null })  // ONCE
      → per REGULAR insc with fechaRegularidad != null:
           count = llamados.filter(l => l.fechaInicio > fechaRegularidad).length
           if count >= carrera.llamadosVencimiento → EXCLUDE materia

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/prisma_tenant/schema.prisma` | Modify | `InscripcionMateria.fechaRegularidad DateTime? @map("fecha_regularidad")`; `Carrera.llamadosVencimiento Int @default(5) @map("llamados_vencimiento")` |
| Prisma migration (new) | Create | Two ADD COLUMN (nullable + defaulted). No data migration. |
| `packages/domain/src/terciario/entities/inscripcion-materia.ts` | Modify | Add `fechaRegularidad?: Date` prop + getter; `setFechaRegularidad(date)` write-once no-op |
| `packages/domain/src/terciario/entities/carrera.ts` | Modify | Add `llamadosVencimiento: number` prop + getter; `create()` defaults 5; validate `> 0` (ValidationError) in create + reconstruct |
| `packages/domain/src/terciario/errors/regularidad-vencida.error.ts` | Create | extends `DomainError`, code `REGULARIDAD_VENCIDA` |
| `packages/domain/src/terciario/policies/final-eligibility-policy.ts` | Modify | Add `llamadosTranscurridos` + `llamadosVencimiento` to input; insert guard step 2 (REGULAR + count ≥ threshold → error) |
| `packages/domain/src/terciario/repositories/llamado-examen-repository.ts` | Modify | Add `countAfter(anioAcademico: string, afterDate: Date): Promise<number>` |
| `packages/domain/src/terciario/repositories/carrera-repository.ts` | Modify | Add `findByMateriaCarreraId(materiaCarreraId: string): Promise<Carrera \| null>` |
| `packages/domain/src/terciario/{index,errors}` + `packages/domain/src/index.ts` | Modify | Export new error |
| `api/src/infrastructure/.../prisma-llamado-examen.repository.ts` | Modify | Implement `countAfter` (`count` where `fechaInicio:{gt}`, active, deletedAt:null) |
| `api/src/infrastructure/.../prisma-carrera.repository.ts` | Modify | Map `llamadosVencimiento` in `toDomain`/`save`; implement `findByMateriaCarreraId` |
| `api/src/infrastructure/.../prisma-inscripcion-materia.repository.ts` | Modify | Map `fechaRegularidad` in `toDomain` + `save` (create + update) |
| `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts` | Modify | `ConfirmarNotaCursadaUC`: when `condicion === REGULAR` call `inscripcion.setFechaRegularidad(new Date())` |
| `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts` | Modify | `RegistrarNotaFinalUC`: inject `LlamadoExamenRepository` + `CarreraRepository`; compute inputs; pass to policy |
| `api/src/application/reportes/generate-boletin.use-case.ts` | Modify | `buildMateriasTerciario`: bulk-load year llamados once + post-DB expiry filter |
| `api/src/presentation/shared/filters/exception.filter.ts` | Modify | Add `REGULARIDAD_VENCIDA: 422` to `DOMAIN_STATUS` |
| `api/src/presentation/nivel-terciario/nivel-terciario.module.ts` | Modify | `RegistrarNotaFinalUC` factory: add `LLAMADO_EXAMEN_REPOSITORY` + `'CarreraRepository'` to `inject` |

## Interfaces / Contracts

```ts
// FinalEligibilityPolicy.check input (added fields)
{ estado; tpSlot; intentosPrevios; llamadosTranscurridos: number; llamadosVencimiento: number }
// guard step 2 (after "not confirmed", before LIBRE):
if (estado.esRegular() && llamadosTranscurridos >= llamadosVencimiento)
  return err(new RegularidadVencidaError());

// ports
interface LlamadoExamenRepository { countAfter(anioAcademico: string, afterDate: Date): Promise<number>; /* …existing */ }
interface CarreraRepository { findByMateriaCarreraId(materiaCarreraId: string): Promise<Carrera | null>; /* …existing */ }
```

Note: confirm `EstadoInscripcion.esRegular()` exists; if not, compare `estado.get() === 'REGULAR'`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (domain) | Policy guard step 2: Scenarios D/E/F/G; order vs LIBRE/TP/intentos | Extend `final-eligibility-policy` tests — pure fn, no mocks. **Update ALL existing callers/tests** to pass the 2 new fields (breaking signature). |
| Unit (domain) | `InscripcionMateria.setFechaRegularidad` write-once (B); `Carrera.llamadosVencimiento` default 5 (M) + `>0` ValidationError (N) | Entity unit tests |
| Unit (UC) | `RegistrarNotaFinalUC` 422 path (H) + success (I) + null→0 (FR-7.3); `ConfirmarNotaCursadaUC` sets/doesn't overwrite (A/B/C) | Mock `LlamadoExamenRepository`, `CarreraRepository`, others |
| Unit (UC) | Boletín exclude expired (J), include non-expired (K), include null (L) | Mock tenant client incl. `llamadoExamen.findMany` |
| Integration | Prisma `countAfter` strict `>` + `fechaRegularidad` round-trip | Optional if test DB available; else covered by mocked UC tests |

TDD strict: write failing test first per FR. Coverage ≥ 80% (NFR-1). `pnpm test` / `pnpm build`.

## Migration / Rollout

Single Prisma tenant migration: two ADD COLUMN, both backward-compatible (nullable / DEFAULT 5).
No data backfill. Run `prisma:migrate:tenant` (dev) / `:deploy` (prod) + `prisma:generate`.

## Open Questions

- [ ] Confirm `EstadoInscripcion.esRegular()` exists (else use `.get() === 'REGULAR'`).
- [ ] `ConfirmarNotaCursadaUC` write-once: rely on entity no-op only, or also skip when estado already REGULAR? (entity no-op is sufficient per ADR-5).
