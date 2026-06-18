# Explore: vencimiento-regularidad-terciario

> Phase: sdd-explore · Date: 2026-06-18 · Artifact store: hybrid

## Executive Summary

Terciario exam turns (llamados) are not modeled as first-class entities. `ActaExamen` carries only
a raw `fecha`. `InscripcionMateria` has no `fechaRegularidad`. `Carrera` has no
`llamadosVencimiento`. The recommended approach is on-the-fly expiry computation (no background
job), requiring three schema additions (`fechaRegularidad`, `LlamadoExamen`, `llamadosVencimiento`)
and one new domain error before the policy guard can be implemented.

---

## 1. Turn Model (How Llamados Are/Aren't Modeled)

`ActaExamen` (`schema.prisma` lines 1168–1209) fields:
  id, materiaCarreraId, fecha (DateTime), presidenteId, vocales, libro, folio, active

NO `turno`, `llamado`, `periodoId`, or named period concept exists. Exam turns are implicit (dates only).

Contrast: Secundario's `MesaExamen` has `turno: String` ("DICIEMBRE"|"FEBRERO"). This concept was
never ported to Terciario.

Search for `LlamadoExamen`, `TurnoExamen`, `PeriodoExamen` in schema → zero matches.

CONCLUSION: No first-class llamado entity exists. Counting "N turns since regularidad" is not
computable without adding a `LlamadoExamen` table.

---

## 2. Base Date (fechaRegularidad GAP)

`InscripcionMateria` fields: id, studentId, materiaCarreraId, cuatrimestre, anioAcademico, estado,
notaCursada?, notaFinal?, createdAt, updatedAt.

`fechaRegularidad` is MISSING.

`ConfirmarNotaCursadaUC` sets estado=REGULAR but records no explicit date. Using `updatedAt` is
unsafe — it gets overwritten on any subsequent save (e.g., LIBRE transition after 3rd failure).

GAP-1: `fechaRegularidad DateTime?` must be added to `InscripcionMateria` and written
by `ConfirmarNotaCursadaUC` when condicion=REGULAR.

---

## 3. Integration Points

| Point | File | Required Change |
|---|---|---|
| Guard | `packages/domain/src/terciario/policies/final-eligibility-policy.ts` | New step 1.5 in `check()`: add `llamadosTranscurridos` + `llamadosVencimiento` to input; return `RegularidadVencidaError` when expired |
| UC loader | `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts` RegistrarNotaFinalUC | Load carrera.llamadosVencimiento + count LlamadoExamen after fechaRegularidad |
| Boletín | `api/src/application/reportes/generate-boletin.use-case.ts` buildMateriasTerciario | BT-R5 (deferred from boletin-terciario): show expired status; requires LlamadoExamen count per materia |
| ConfirmarNotaCursadaUC | `nota-cursada-terciario.use-cases.ts` | Set `fechaRegularidad = now()` when condicion=REGULAR |

---

## 4. Approaches

### Approach A — Computed On-the-Fly (RECOMMENDED)
At guard/query time, count LlamadoExamen records where fechaFin > fechaRegularidad AND
fechaInicio <= now, compare with Carrera.llamadosVencimiento. No estado change. No background job.

Pros: fits existing functional FinalEligibilityPolicy pattern; always current; no scheduler.
Cons: every read path needs extra count query; RegistrarNotaFinalUC grows from 4 to 6 data loads.
Effort: Medium.

### Approach B — Persisted via Background Job
NestJS @Cron job flips REGULAR → LIBRE/VENCIDA when expired.

Pros: simple reads; consistent with existing LIBRE exclusion in boletin filter.
Cons: requires scheduler; expiry not real-time; race conditions; operational fragility.
Effort: High.

### Approach C — Lazy Persistent Transition
Expiry detected at RegistrarNotaFinalUC time, atomically transitions estado=LIBRE before error.

Pros: no scheduler; atomic.
Cons: boletin may show stale REGULAR for expired materias that haven't attempted finals.
Effort: Medium-High.

---

## 5. Data Gaps

| GAP | Addition |
|---|---|
| GAP-1 | `InscripcionMateria.fechaRegularidad DateTime?` (schema + entity + ConfirmarNotaCursadaUC) |
| GAP-2 | New `LlamadoExamen` entity: id, carreraId?, nombre, anioAcademico, fechaInicio, fechaFin, active |
| GAP-3 | `Carrera.llamadosVencimiento Int @default(5)` (schema + entity) |
| GAP-4 | New `RegularidadVencidaError` domain error |
| GAP-5 | New repo method: count LlamadoExamen after a given date (for guard + boletin) |
| GAP-6 | `ConfirmarNotaCursadaUC` must write `fechaRegularidad` when condicion=REGULAR |

---

## 6. Open Questions (resolve before proposal)

1. Expiry as soft gate (estado stays REGULAR) or hard transition (REGULAR → LIBRE)?
2. LlamadoExamen scoped per Carrera or institution-wide?
3. Re-regularization after expiry: new InscripcionMateria or reset existing?
4. Count boundary: does the llamado during which approval happened count, or only subsequent ones?
5. Distinct `VENCIDA` estado vs reuse of `LIBRE` — audit trail consideration.
6. Backfill: existing REGULAR inscripciones have no fechaRegularidad — treat NULL as expired or non-expired?

---

## Key Files

- `api/prisma_tenant/schema.prisma` lines 1082–1225 — Terciario models
- `packages/domain/src/terciario/policies/final-eligibility-policy.ts` — primary guard
- `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts` — RegistrarNotaFinalUC
- `api/src/application/reportes/generate-boletin.use-case.ts` lines 394–529 — buildMateriasTerciario
- `packages/domain/src/terciario/entities/inscripcion-materia.ts` — missing fechaRegularidad
- `packages/domain/src/terciario/entities/carrera.ts` — missing llamadosVencimiento
- `packages/domain/src/terciario/value-objects/estado-inscripcion.ts` — REGULAR/LIBRE values
- `openspec/specs/boletin-terciario/spec.md` DEFERRED-1 / BT-R5 — boletin display requirement
