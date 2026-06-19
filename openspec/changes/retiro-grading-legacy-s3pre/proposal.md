# Proposal: retiro-grading-legacy-s3pre

> Fase: sdd-propose · Store: hybrid · Fecha: 2026-06-19
> Basado en explore re-validado 2026-06-19 (premisa CONGELAR obsoleta).

## Intent

Archivar y **dropear el grading legacy** (5 tablas tenant) y limpiar su **dead code**. El path legacy de `NotaTrimestral` en `generate-boletin.use-case.ts` (244-334) es inalcanzable en producción: Inicial migró a InformeEvolutivo, Terciario a InscripcionMateria+ActaExamenNota, y Primario/Secundario usan repos inyectados. Dropear `SubjectAssignment` deja a `teachers` sin lectores de FK → **habilita el change S3b-final** (drop Teacher).

## Nivel pedagógico afectado

**ALL** (se borra el path de boletín compartido), pero **sin cambio funcional observable** — el path ya está muerto. Ningún nivel pierde capacidad: Inicial→InformeEvolutivo, Terciario→modelo nuevo, Primario/Secundario→modelo nuevo.

## Scope (in)

- Script `api/scripts/archive-legacy-grading-data.ts` (+ tests): export por tenant de las 5 tablas a CSV/JSON, idempotente.
- Borrado del legacy path (244-334) y de `resolveDocentesForStudentCC` (906-1001) en `generate-boletin.use-case.ts`.
- Borrado de 7 strategies en `api/src/application/shared/strategies/`.
- Borrado de entidades+repos legacy en `packages/domain/src/pedagogy/` y limpieza de exports.
- Limpieza de stale mocks en tests de boletín.
- DROP migration de 5 tablas (schema tenant), orden FK: `notas → evaluaciones → notas_trimestrales → periodos_evaluacion → subject_assignments`.

## Scope (out)

- Drop de la tabla `Teacher` → es **S3b-final** (change aparte).
- Cualquier cambio en el modelo nuevo de grading.

## Capacidades afectadas

- **Generación de boletín** (todos los niveles): solo se quita código muerto.
- **Persistencia tenant** (DDL): se eliminan 5 modelos.

## Secuencia / delivery (2 PRs encadenados)

- **PR-a (riesgo BAJO):** archival script + decouple/borrado de dead code. SIN migración de schema. Revertible por `git revert`.
- **PR-b (riesgo MEDIO):** DROP migration. Requiere PR-a deployado y archival ejecutado con éxito por tenant.

## Rollback plan

- **PR-a:** `git revert` — no toca datos.
- **PR-b:** rollback inline en la migración recrea la estructura de tablas; los datos se restauran desde los CSV/JSON del archival.
- **Gate obligatorio:** el archival debe correr y tener éxito en TODOS los tenants ANTES de PR-b.

## Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Pérdida de datos sin archival | CRÍTICO | Archival obligatorio antes de PR-b |
| Orden de DROP por FK Restrict | ALTO | Orden explícito en migración |
| PR-b antes que PR-a | ALTO | PR-a merged+deployed primero; guards IF EXISTS |
| Archival falla en algún tenant | ALTO | Aborta tenant, continúa; verificar logs antes de PR-b |

## Next

`sdd-spec` + `sdd-design` (paralelizables).
