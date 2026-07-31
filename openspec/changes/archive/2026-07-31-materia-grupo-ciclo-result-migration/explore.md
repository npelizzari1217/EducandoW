# Exploration — materia-grupo-ciclo-result-migration (épico error-handling)

> Slice `materia-grupo-ciclo`. El más grande y menos mecánico del épico: 17 throws, 1 clase nueva,
> ~800-1000 líneas → chained PRs. Diagnóstico verificado leyendo cada archivo.

## Resumen ejecutivo

De los 17 throws de application: **15 mecánicos** (return `err(clase existente)`, sin cambio de
status), **1 bug real 500→422** (MGC-R4, `add-student-to-grupo:53`, bare `Error`) que necesita una
**clase `DomainError` nueva**, y **1 guard de infra** (`update-grupo:43`) que se **defiere** (el propio
doc del épico lo marca como concern aparte, `InfrastructureError` sin modelar; 500 es correcto para un
tenant client ausente). Tamaño ~800-1000 líneas → **chained PRs (3 slices)**. Rama desde `main`.

## Inventario de los 17 throws (verificado)

| # | Sitio | Throw | Clasif. | HTTP hoy | HTTP correcto |
|---|---|---|---|---|---|
| 1-13 | `update-grupo`(×3: 32/38/49), `set-materia-es-optativa:19`, `remove-student-from-materia:25`, `remove-student-from-grupo:21`, `list-enrollable-students-for-materia:34`, `delete-grupo:15`, `create-grupo:48`, `add-student-to-materia`(×2: 33/39), `add-student-to-grupo`(×2: 42/48) | `NotFoundError` | DomainError existente | 404 | 404 (igual) |
| 14 | `validate-teacher-level.ts:42` | `ValidationError` | DomainError existente | 400 | 400 (igual). **Helper compartido** (lo llaman Create+Update grupo) |
| 15 | `add-student-to-grupo.use-case.ts:65` | `AlumnoAlreadyInGrupoError` | DomainError existente | 409 | 409 (igual) |
| 16 | `add-student-to-grupo.use-case.ts:53` | bare `Error` (MGC-R4) | **DomainError intrínseco — CLASE NUEVA** | **500 (BUG)** | **422** |
| 17 | `update-grupo.use-case.ts:43` | bare `Error` ("No tenant client available") | **Infraestructura** | 500 | 500 (igual) — **DEFER** |

## Clase nueva (MGC-R4)

- **Nombre**: `GrupoMateriaMismatchError` (nombra la invariante: el `materiaXCursoXCicloId` del grupo
  debe igualar el del membership del alumno).
- **Code**: `GRUPO_MATERIA_MISMATCH`. **Status: 422** (no 409). Razón: 409 en `DOMAIN_STATUS` es
  exclusivo de "already exists / already assigned / closed"; MGC-R4 no es conflicto de estado sino
  "relación inválida entre dos entidades" — el bucket 422 del codebase (`INVALID_LLAMADO_RANGE`,
  `CONDICION_INVALIDA`, `PREREQUISITE_SLOT_MISSING`, `GRADING_PHASE_NOT_APPLICABLE`).
- **Ubicación**: `packages/domain/src/shared/errors/grupo-materia-mismatch-error.ts` — igual que su
  hermano `AlumnoAlreadyInGrupoError` (materia-grupo-ciclo no tiene carpeta `errors/` propia).
- **DOMAIN_STATUS**: agregar `GRUPO_MATERIA_MISMATCH: 422` en `exception.filter.ts`.
- **RED-first**: es un fix 500→422. Los tests actuales de MGC-R4 usan `.rejects.toThrow(/regex/)` /
  genérico → tightening a `instanceof GrupoMateriaMismatchError` + 422 (unit + controller-spec nuevo).

## Fork 1 — guard de infra (`update-grupo:43`) → DEFER (Option A)

Dejar `throw new Error('No tenant client available')` como está. 500 es semánticamente correcto
(misconfiguración de servidor / tenant context no ligado, no es un 4xx de cliente). Se migran solo
los failures esperados (los 2 `NotFoundError` de update-grupo) a `Result`; este throw escapa como
500 de infra (precedente: el bridge de `PaseFechaInvalidaError` dejó un throw-path justificado).
**Ya resuelto por el doc del épico** (`application-error-handling/spec.md`, Out of Scope: "2 mistyped
infrastructure guards ... need a minimal InfrastructureError — separate concern, not yet modeled").
Option B (modelar InfrastructureError ahora + tocar `competency.use-cases.ts:258`) = scope creep.

## Fork 2 — guards de constructor de entidades → FUERA DE SCOPE

`materia-x-curso-x-ciclo.ts:41,44`, `grupo-x-curso-x-materia-x-ciclo.ts:39,43`,
`alumnos-x-materia-x-curso-x-ciclo.ts:33,36`, `alumnos-x-grupo-x-curso-x-materia-x-ciclo.ts:37,41`.
Son guards `.create()` "X is required" (invariantes de programación, no alcanzables por flujo normal
— todo caller pasa strings no-opcionales por tipos). Fail-fast por throw es correcto. Envolverlos en
`Result` no da valor al cliente = anti-YAGNI. El épico dejó consistentemente esta categoría intacta.

## Controller

- `materia-grupo-ciclo.controller.ts:157-165` (`createGrupo`) hace `TenantContext.getClient()` +
  Prisma directo, tira `NotFoundException` de Nest — viola Clean Arch pero es PRE-EXISTENTE y patrón
  ya usado en el file (enrichment raw-Prisma). Dejar como está (fuera de application). Backlog.
- **Retrofit**: 9 de 13 endpoints llaman un use-case migrado → adoptan `if(isErr) throw unwrapErr()`
  (addStudentToMateria, createGrupo, listEnrollableStudents [rama condicional], removeStudentFromMateria,
  setMateriaEsOptativa, addStudentToGrupo, updateGrupo, deleteGrupo, removeStudentFromGrupo). Idiom
  inline (precedente `alumnos-x-curso-x-ciclo.controller.ts`; el helper compartido es PDF-específico).

## Impacto en tests

- **13 test files unit** (uno por use-case): `.rejects.toThrow/toBeInstanceOf` → `Result`.
- **~10 controller-spec files** existentes: `mockRejectedValue(error)` → `mockResolvedValue(err(error))`;
  success `mockResolvedValue(obj)` → `mockResolvedValue(ok(obj))`.
- **Gap de cobertura**: NO existe controller-spec para `createGrupo`, `addStudentToMateria`,
  `addStudentToGrupo` → **3 specs NUEVOS RED-first** (happy + error + el caso 422 de MGC-R4).
- Integración `.db.test.ts`: `mgc-s13.isolation` (repo directo) y `mgc-generate` (MaterializeMaterias,
  sin throws) → **no cambian**.

## Tamaño + delivery → CHAINED PRs (3 slices)

Estimado **~800-1000 líneas** (14 use-case files + helper dual-caller + 9 endpoints + clase nueva +
13 unit tests + ~10 controller-specs + 3 specs nuevos). MUY por encima del budget de 400. A diferencia
del slice anterior, el type-coupling NO fuerza un PR único (cada método del controller depende solo de
su use-case → el file se edita incrementalmente). **Chained/stacked PRs factibles y recomendados.**

Breakdown propuesto (feature-branch chain, cada slice verde de forma independiente):
- **Slice A — use-cases "materia"** (~300-350): `set-materia-es-optativa`, `remove-student-from-materia`,
  `add-student-to-materia`, `list-enrollable-students-for-materia` (solo NotFoundError) + 4 unit tests +
  retrofit de esos 4 endpoints + 3 controller-specs (2 updates + 1 nuevo `add-student-to-materia`).
- **Slice B — use-cases "grupo" + helper** (~350-400): `update-grupo`, `create-grupo`, `delete-grupo`,
  `remove-student-from-grupo` + `validate-teacher-level.ts` (helper — debe ir junto con sus 2 callers) +
  unit tests + retrofit de esos 4 endpoints + specs (2 updates + 1 nuevo `create-grupo`). Si pasa 400
  solo, subdividir en B1 (update/delete/remove mecánicos) y B2 (create-grupo + helper).
- **Slice C — student-membership + clase nueva** (~270-320): `add-student-to-grupo` (2 NotFoundError +
  AlumnoAlreadyInGrupo + fix MGC-R4) + `GrupoMateriaMismatchError` nueva + su unit test + entrada
  DOMAIN_STATUS + tighten de `add-student-to-grupo.use-case.test.ts` (RED 500→422) + retrofit del
  endpoint + spec nuevo `add-student-to-grupo` (RED, incl. caso 422).

Guard lines: **Decision needed before apply: YES · Chained PRs: YES · 400-line budget risk: HIGH**.

## Rama

Desde `main` (ad947ad). Archivos disjuntos de las dos ramas course-cycle sin mergear (verificado por
path; solo hay una mención de texto en el archive-report, no código).

## Riesgos / preguntas para propose

1. Tamaño agregado alto → chaining disciplinado obligatorio (si apply lo colapsa en 1 PR, duplica el budget).
2. `validate-teacher-level.ts` es helper dual-caller → su cambio de firma debe aterrizar atómico con
   Create+Update grupo (Slice B).
3. 3 endpoints sin spec dedicado (createGrupo, addStudentToMateria, addStudentToGrupo) → specs nuevos
   RED-first (esfuerzo real, no solo rewrites).
4. Status de `GRUPO_MATERIA_MISMATCH` (422 vs 409) es judgment call — 422 recomendado, propose ratifica.
5. Decisión de delivery (3 chained PRs vs 1 PR con size:exception vs otra partición) — para el usuario.

## Recomendación

Proceder a propose con: `GrupoMateriaMismatchError` (422, shared/errors/), infra guard DEFER, entity
guards fuera de scope, delivery en 3 chained PRs, rama desde main.
