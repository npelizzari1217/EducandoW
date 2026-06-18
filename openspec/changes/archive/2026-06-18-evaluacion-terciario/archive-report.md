# Archive Report: evaluacion-terciario

> Phase: sdd-archive · Store: hybrid · 2026-06-18
> Branch: feat/evaluacion-terciario
> Verdict: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 2 SUGGESTION)
> Archived to: openspec/changes/archive/2026-06-18-evaluacion-terciario/

---

## What Shipped

**Fase A + B: evaluación estructurada de Terciario — cursada por slots + finales con límite de 3 intentos.**

Antes de este cambio la cursada se guardaba como un float crudo (`notaCursada`) sin parciales, TP ni recuperatorios, y el final (`ActaExamenNota`) no tenía contador de intentos ni enforcement del límite de 3. Ahora:

- La secretaría puede registrar parciales, recuperatorios y TP como `NotaCursadaTerciario` slots.
- La `notaCursada` se confirma manualmente con condición (`REGULAR | PROMOCIONAL | LIBRE`).
- `ActaExamenNota` tiene campo `intento` (1|2|3); el servidor asigna el número server-side.
- Guards de negocio aplicados: REGULAR para rendir, TP obligatorio, límite de 3 intentos, auto-LIBRE al 3er fallo (transacción atómica).
- PROMOCIONAL bypass implementado como supuesto.

**Test result: 1092 domain + 1259 api — ALL PASS · 0 new TS errors (new code) · 35/35 tasks complete.**

---

## Key Architecture Decisions

| ADR | Decision |
|---|---|
| ADR-1 | `condicion` en payload (término de negocio) mapea a `InscripcionMateria.estado`. Se extendió `EstadoInscripcion` con `PROMOCIONAL` en lugar de agregar columna nueva. Evita duplicación de estado. |
| ADR-2 | `intento` en `ActaExamenNota` es dato denormalizado (auditoría/boletín). La verdad del límite se calcula contando filas `DESAPROBADO/AUSENTE`, no confiando en el valor entrante. |
| ADR-3 | Guards como policies puras de dominio (`RecuperatorioPolicy`, `FinalEligibilityPolicy`), compuestas en el use case. Testeable sin DB; cobertura domain ≥89%. |

---

## Canonical Specs Synced

| File | Change |
|---|---|
| `openspec/specs/nota-cursada-terciario/spec.md` | NEW — canonical spec para cursada por slots (`NotaCursadaTerciario`), confirmación manual de `notaCursada`, guards de recuperatorio. Incluye marcadores `[SUPUESTO]` para #3 (TP), #4 (elegibilidad recuperatorio), y nota W1 sobre la implementación actual del TP guard. |
| `openspec/specs/nivel-terciario/spec.md` | UPDATED — agregados 6 nuevos requirements: campo `intento` en `ActaExamenNota`, guard REGULAR, guard PROMOCIONAL bypass [SUPUESTO], guard TP obligatorio [SUPUESTO] (con nota W1), límite de 3 intentos, auto-transición a LIBRE. |

---

## Deferred Items

### W3 — Migración pendiente de ejecución contra DB real

La migración SQL fue escrita manualmente (`api/prisma_tenant/migrations/20260618000000_evaluacion_terciario/migration.sql`) porque no se disponía de DB local. El SQL es estructuralmente correcto (verificado contra el schema Prisma).

**Acción requerida antes de deploy**: ejecutar `pnpm --filter api prisma:migrate:tenant` en un entorno con acceso a la base de datos para validar y aplicar la migración.

---

## Open Product Decisions (carry-forward)

Estos supuestos están implementados y marcados `// [SUPUESTO]` en el código. Requieren validación contra el reglamento institucional antes de considerar el comportamiento como definitivo. Un cambio en cualquiera de ellos implica modificar únicamente las policies de dominio correspondientes (bajo costo).

| ID | Item | Implementado como |
|---|---|---|
| #1 | PROMOCIONAL: ¿bypassa el final? | Sí — `RegistrarPromocionalUC` aprueba sin `ActaExamenNota` |
| #3 | TP obligatorio: ¿bloquea rendir el final? | Sí — guard `TP condicion != AUSENTE` |
| #4 | Elegibilidad de recuperatorio: ¿DESAPROBADO y/o AUSENTE? | Ambos habilitan recuperatorio |
| W1 | TP guard implementado como `condicion !== 'APROBADO'` (bloquea también DESAPROBADO). Si DESAPROBADO debe habilitar el final, cambiar a `=== 'AUSENTE'` en `packages/domain/src/terciario/policies/final-eligibility-policy.ts` línea 41. | Pendiente validación reglamento |

---

## Engram Artifact IDs

| Artifact | Topic Key |
|---|---|
| Proposal | sdd/evaluacion-terciario/proposal |
| Spec (delta — nota-cursada-terciario) | sdd/evaluacion-terciario/spec |
| Spec (delta — final-attempts) | sdd/evaluacion-terciario/spec |
| Design | sdd/evaluacion-terciario/design |
| Tasks | sdd/evaluacion-terciario/tasks |
| Apply progress | sdd/evaluacion-terciario/apply-progress |
| Verify report | sdd/evaluacion-terciario/verify-report |
| Archive report | sdd/evaluacion-terciario/archive-report |

---

## Files Changed (implementation)

### Domain Package
- `packages/domain/src/terciario/value-objects/slot-cursada-terciario.ts` (new)
- `packages/domain/src/terciario/value-objects/condicion-cursada.ts` (new)
- `packages/domain/src/terciario/value-objects/intento-final.ts` (new)
- `packages/domain/src/terciario/value-objects/estado-inscripcion.ts` (modified — PROMOCIONAL + helpers)
- `packages/domain/src/terciario/errors/*.ts` (9 new files)
- `packages/domain/src/terciario/entities/nota-cursada-terciario.ts` (new)
- `packages/domain/src/terciario/entities/acta-examen.ts` (modified — intento field)
- `packages/domain/src/terciario/policies/recuperatorio-policy.ts` (new)
- `packages/domain/src/terciario/policies/final-eligibility-policy.ts` (new)
- `packages/domain/src/terciario/repositories/nota-cursada-terciario-repository.ts` (new)
- `packages/domain/src/terciario/repositories/acta-examen-repository.ts` (modified)
- `packages/domain/src/terciario/index.ts` (modified)
- `packages/domain/src/index.ts` (modified)

### API Package
- `api/prisma_tenant/schema.prisma` (modified — NotaCursadaTerciario model, intento column)
- `api/prisma_tenant/migrations/20260618000000_evaluacion_terciario/migration.sql` (new — manual)
- `api/src/infrastructure/persistence/prisma/repositories/prisma-nota-cursada-terciario.repository.ts` (new)
- `api/src/infrastructure/persistence/prisma/repositories/prisma-acta-examen.repository.ts` (modified)
- `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts` (new)
- `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts` (modified)
- `api/src/presentation/shared/filters/exception.filter.ts` (modified — 9 new codes)
- `api/src/presentation/nivel-terciario/nota-cursada-terciario.controller.ts` (new)
- `api/src/presentation/nivel-terciario/acta-examen.controller.ts` (modified)
- `api/src/presentation/nivel-terciario/nivel-terciario.module.ts` (modified)

---

## Next Steps

- **Fase C (`boletin-terciario`)**: `buildMateriasTerciario` — wires the boletín to `NotaCursadaTerciario` + `ActaExamenNota.intento`; drops the legacy `NotaTrimestral` read path for Terciario.
- **Fase D (`docente-grade-entry`)**: authz de docente Terciario para carga de notas de cursada (hoy solo secretaría).
- **Retiro legacy**: una vez que Fase C esté completa, `NotaTrimestral` y `Teacher` pueden retirarse (última dependencia de esa tabla).
- **Validación reglamento**: resolver supuestos #1, #3, #4, W1 con el PO antes de que secretarías comiencen a usar los nuevos endpoints en producción.
- **Migración DB**: ejecutar `pnpm --filter api prisma:migrate:tenant` contra DB real antes del deploy.
