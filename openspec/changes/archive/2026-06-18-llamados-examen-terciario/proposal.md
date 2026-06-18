# Proposal: llamados-examen-terciario

> Phase: sdd-propose · Date: 2026-06-18 · Artifact store: hybrid · Change 1 of 2

## Intent

Terciario has no first-class model of exam turns ("llamados"). `ActaExamen` carries only a loose
`fecha`, so "how many llamados have passed since a cursada became REGULAR" is not computable today.
The downstream change `vencimiento-regularidad-terciario` needs that count to expire regularidad.
This change models the **`LlamadoExamen`** entity and its CRUD, owned by secretaría, so the calendar
of institutional exam turns becomes explicit and countable. Success: secretaría can create, list,
update and delete llamados per academic year; the data exists and is queryable for change 2.

## Scope

**In-scope**
- New tenant/institution-scoped `LlamadoExamen` entity: `id`, `nombre` (e.g. "Julio 2025"),
  `anioAcademico`, `fechaInicio` (DateTime), `fechaFin` (DateTime), `active`, soft-delete (`deletedAt`)
  + `createdAt`/`updatedAt`, consistent with other Terciario tenant models (Carrera, MateriaCarrera).
- Full vertical slice mirroring `MesaExamen`: domain entity + value objects as needed, repository
  **port** + Prisma implementation, application use cases (create / update / list / delete), and a
  presentation controller with Zod validation.
- Authz: `@Roles` GRADES module + `@Levels(TERCIARIO)`.
- Clean Architecture, `Result<T,E>` (no throw), tenant Prisma client only.

**Out-of-scope (explicit)**
- The expiry RULE itself → `vencimiento-regularidad-terciario` (change 2).
- `InscripcionMateria.fechaRegularidad` and `Carrera.llamadosVencimiento` → change 2.
- Any FK linking `ActaExamen` → `LlamadoExamen` (deferred; expiry counts via the llamado date
  calendar, not a relation).
- Web UI (backend-focused, consistent with prior Terciario changes).

## Approach

Replicate the proven `MesaExamen` slice (`api/src/.../nivel-secundario/...mesa-examen.*` +
`prisma-mesa-examen.repository.ts` + domain `MesaExamen`/`TurnoExamen`) under a Terciario namespace.
Schema model lives in the Terciario section of `api/prisma_tenant/schema.prisma` (after `ActaExamen`),
mapped to table `llamados_examen`, with indexes on `anioAcademico` and `fechaInicio`. Unlike
`MesaExamen` (tied to `subjectId`), `LlamadoExamen` is institution-wide: no `carreraId`, no
inscripciones sub-entity. Use cases return `Result` with `ValidationError`/`NotFoundError`, matching
the existing pattern exactly.

## Dependencies

- **Upstream:** none.
- **Downstream:** unblocks `vencimiento-regularidad-terciario` (change 2), which will count these
  llamados from `fechaRegularidad`.

## Risks / Open Questions

1. Scope confirmed institution-wide (per decision #1175) — confirm no per-carrera need now.
2. `nombre`: free-text vs enum — lean free-text for flexibility ("Julio 2025", "Diciembre 2025").
3. Overlap validation: reject llamados with overlapping `[fechaInicio, fechaFin]` ranges in the same
   `anioAcademico`? Flag as a spec decision.
4. `fechaInicio <= fechaFin` invariant — enforce in domain (value object or entity guard).
