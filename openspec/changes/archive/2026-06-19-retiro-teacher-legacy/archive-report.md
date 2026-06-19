# Archive Report: retiro-teacher-legacy (Epic Umbrella)

> Status: COMPLETE — Epic cerrado
> Archived: 2026-06-19

## Resumen del epic

`retiro-teacher-legacy` era el epic de retiro escalonado de la tabla `teachers` y toda la
infraestructura asociada. El epic se inició el 2026-06-16 con un análisis de FKs y riesgos,
y se cerró el 2026-06-19 con el drop efectivo de la tabla en producción (dev verificado, PR #37).

## Slices entregados (orden cronológico)

| Slice | Change archivado | Fecha | PR / commit | Estado |
|---|---|---|---|---|
| S1 — borrado dead code CRUD SubjectAssignment | `retiro-evaluaciones-legacy-s1` | 2026-06-16 | `bdd6b4b` | DONE |
| S2 — migrar lookup docente en boletín | `retiro-boletin-docente-s2` | 2026-06-17 | — | DONE |
| S3a — migrar homeroom a AsignacionCursoXCiclo(TITULAR) | `retiro-homeroom-titular-s3a` | 2026-06-17 | — | DONE |
| S3b-0 — drop columna `homeroomTeacherId` | `retiro-homeroom-column-s3b0` | 2026-06-17 | `9e3deb3` | DONE |
| S3b-1 — drop `Sala/Grado/Curso.teacherId` | `retiro-sala-grado-curso-teacher-s3b1` | 2026-06-17 | `8dcdd02, ed73d2c, 90d0aec` | DONE |
| S3b-2 — retirar `/teachers` admin | `retiro-teachers-admin-s3b2` | 2026-06-17 | — | DONE |
| S3b-3 — migrar `MesaExamen/ActaExamen.presidenteId` | `retiro-examenes-presidente-s3b3` | 2026-06-17 | — | DONE |
| S3-pre — retiro grading legacy (SubjectAssignment FK gate) | `retiro-grading-legacy-s3pre` | 2026-06-19 | — | DONE |
| S3b-final — drop tabla `teachers` + entidad + repo | `retiro-teacher-legacy-s3b-final` | 2026-06-19 | PR #37 | DONE |

## Resultado final

La tabla `teachers` fue dropeada exitosamente. La identidad docente vive 100% en:
- `User` (master): persona + rol `'TEACHER'`
- `DocenteXCiclo` (tenant): enrolamiento por ciclo
- `AsignacionCursoXCiclo(rol=TITULAR)`: asignación homeroom

El epic inició con 8 FKs restringidas bloqueando el drop. Cada slice desactivó un bloqueo
hasta que `teachers` quedó sin FK children y el drop fue seguro.

## Specs canónicas actualizadas

- `openspec/specs/teacher-identity-authz/spec.md` — marcada RETIRED (2026-06-19):
  los requirements TIA-R1/R2 asumían la existencia de la tabla/entidad `Teacher`, que ya no existe.
- `openspec/specs/evaluation-frontend/spec.md` — marcada RETIRED en S1.
- `openspec/specs/report-cards/spec.md` — Requirement "Docente Name Source" actualizado en S2.
