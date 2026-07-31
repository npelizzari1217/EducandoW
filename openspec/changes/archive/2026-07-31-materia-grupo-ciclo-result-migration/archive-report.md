# Archive Report — materia-grupo-ciclo-result-migration (épico error-handling)

- Change: `materia-grupo-ciclo-result-migration` (el slice más grande del épico)
- Archivado: 2026-07-31
- Delivery: **3 PRs stacked** (A merged, B/C pending push+PR al momento del archive)
- Store: hybrid (openspec + engram)
- **Veredicto final: PASS (0 CRITICAL, 1 WARNING no-bloqueante, 1 SUGGESTION) → ARCHIVADO**

---

## Resultado

Las 17 excepciones de `application/` del área `materia-grupo-ciclo` migraron al patrón `Result`:
**15 mecánicas** (return `err(clase existente)`, status HTTP idéntico), **1 corrección de
comportamiento** (500→422 vía clase nueva), **1 guard de infra deliberadamente diferido**. Con esto
el área queda cerrada dentro del épico.

- **Cobertura de tests real**: `@educandow/domain` 1287/1287, `api` scope materia-grupo-ciclo
  119/119, suite `api` full 2179/2180 (el 1 rojo, `archive-legacy-grading-data.spec.ts`, es
  pre-existente — diff vacío vs `main`). `typecheck` limpio.
- **Diff agregado** (B+C vs main; A ya en main): 21 archivos, 498+/133-. **Exactamente 1 clase de
  error nueva** en todo el change.

## Entrega en 3 slices stacked

| Slice | Rama | Estado | Contenido | Líneas |
|---|---|---|---|---|
| A | `refactor/mgc-result-a` | **MERGED** (PR #115, merge `95feebb`) | 4 use-cases "materia" → Result (mecánico) | 270 |
| B | `refactor/mgc-result-b` | rama (desde main, incluye A) | 4 use-cases "grupo" + helper `validateTeacherLevel` | 369 |
| C | `refactor/mgc-result-c` | rama (stacked sobre B) | `add-student-to-grupo` + `GrupoMateriaMismatchError` + fix 500→422 | 262 |

Se dividió por tamaño (~800-1000 líneas agregadas > budget 400). Cada slice verde e independiente.
El type-coupling NO forzó un PR único (los métodos del controller son independientes), a diferencia
de los slices de course-cycle.

## La corrección de comportamiento (MGC-R4, 500→422)

`add-student-to-grupo.use-case.ts:53` tiraba un `throw new Error(...)` pelado para la invariante
"grupo ⊆ materia" (el alumno debe pertenecer a la misma materia que el grupo). Ese `Error` genérico
caía en el fallback del filter → **HTTP 500**. Se creó `GrupoMateriaMismatchError extends DomainError`
(code `GRUPO_MATERIA_MISMATCH`, en `packages/domain/src/shared/errors/`, hermano de
`AlumnoAlreadyInGrupoError`), se mapeó a **422** en `DOMAIN_STATUS`, y el use-case ahora retorna
`err(new GrupoMateriaMismatchError(...))`. Status 422 (no 409) ratificado contra la taxonomía del
codebase: 409 es "already exists / conflicto de estado"; esto es "relación inválida entre entidades"
= bucket 422 (`INVALID_LLAMADO_RANGE`, `CONDICION_INVALIDA`, etc.).

RED→GREEN real y confirmado: los commits RED (`e0a917d` unit tightening, `1194c30` controller spec)
son test-only y preceden al fix (`77cb6c3`); antes fallaban (el código tiraba `Error` en vez de
`err`), después pasan. Un caso `FILTER-8` nuevo en `exception.filter.spec.ts` prueba 422-no-500
end-to-end.

## Lo deliberadamente NO tocado (documentado, no gaps)

- **Guard de infra** `update-grupo.use-case.ts` (`'No tenant client available'`): sigue como `throw`
  (500 correcto para tenant context ausente). Diferido al follow-up `InfrastructureError` que el doc
  del épico ya trackea (junto con `competency.use-cases.ts:258`).
- **Guards de constructor de entidades** (`packages/domain/.../entities/*.ts`, bare `Error` "X is
  required"): invariantes de programación, fail-fast correcto, fuera de scope.
- **`createGrupo` controller**: hace Prisma directo + `NotFoundException` (viola Clean Arch, pero es
  pre-existente). Backlog.

## Cobertura de requisitos (MGCM-R1..R7) — PASS en los 7

Verificado con contexto fresco, reproduciendo tests y leyendo el código (file:line en verify-report):
R1 (cero throw salvo infra guard), R2 (status preservados), R3 (clase nueva + 422 + RED-first),
R4 (helper Result atómico con ambos callers), R5 (9 endpoints idiom), R6/R7 (sin clases extra, sin
scope creep).

## Commits (por slice, sin atribución IA)

**Slice A** (merged): `f7ca36c`, `ba4ecce`, `c1b2a73`, `1377e41`.
**Slice B**: `5733f5d` (RED), `edd2b4a` (helper+callers atómico), `f2cd136`, `ca67751`, `b6e9f81`.
**Slice C**: `55c87ef` (clase), `e0a917d` (RED unit), `1194c30` (RED controller), `77cb6c3` (fix),
`366dccc` (retrofit).

Divergencia cosmética: mensaje de `77cb6c3` usó `⊆`, mangled por shell quoting → ASCII (mismo
significado).

## Follow-ups del épico que siguen abiertos

- **`InfrastructureError`** — los 2 guards de infra mal tipados (`update-grupo`, `competency.use-cases.ts:258`).
- `reportes`/`asistencia-reporting`/`attendance-type-pdf` (30), `asistencia` (41),
  `attendance-type.use-cases.ts` (5), cola larga, helper `unwrapOrThrow`, `createGrupo` Clean-Arch.

## Trazabilidad (Engram)

| Artefacto | Topic key | Obs |
|-----------|-----------|-----|
| Exploration | `sdd/materia-grupo-ciclo-result-migration/explore` | 1915 |
| Proposal | `sdd/materia-grupo-ciclo-result-migration/proposal` | 1916 |
| Spec | `sdd/materia-grupo-ciclo-result-migration/spec` | 1917 |
| Design | `sdd/materia-grupo-ciclo-result-migration/design` | 1918 |
| Tasks | `sdd/materia-grupo-ciclo-result-migration/tasks` | 1919 |
| Apply progress | `sdd/materia-grupo-ciclo-result-migration/apply-progress` | 1920 |
| Verify report | `sdd/materia-grupo-ciclo-result-migration/verify-report` | 1923 |
| Archive report | `sdd/materia-grupo-ciclo-result-migration/archive-report` | (este documento) |

## Capability

NO se creó capability nueva (CONSUME `application-error-handling`). Se actualizó su sección
"Out of Scope / Follow-up" marcando `materia-grupo-ciclo` como **FULLY MIGRATED**.

## SDD Cycle Complete

Planificado, implementado (3 slices stacked, TDD estricto), verificado (contexto fresco, PASS) y
archivado. El área `materia-grupo-ciclo` queda cerrada dentro del épico error-handling.
