# Proposal — materia-grupo-ciclo-result-migration

> Slice `materia-grupo-ciclo` del épico **application-error-handling**. Este change **CONSUME** la
> capability canónica `application-error-handling` (ya existente); **NO crea una capability nueva**.
> Migra los 17 `throw` de la capa application del área `materia-grupo-ciclo` al patrón `Result`.
> Nivel pedagógico afectado: **N/A (transversal — aplica a TODOS los niveles)**.

## 1. Intent

**Problema.** El área `materia-grupo-ciclo` todavía señaliza fallos esperados con `throw` desde la capa
application (17 sitios). Eso rompe el contrato del épico (`err(DomainError)` en el borde application) y,
en **un** caso concreto, mapea mal a HTTP: un `throw new Error(...)` desnudo (bare `Error`) que se escapa
como **500** cuando semánticamente es un **422** de cliente.

**Por qué ahora.** Es el último slice grande y menos mecánico del épico de error-handling. Cerrarlo deja
el área alineada con el patrón `Result` ya adoptado en el resto del codebase (precedente:
`alumnos-x-curso-x-ciclo`, terciario, grading-scales) y corrige el único bug de status real del área.

**Cómo se ve el éxito.**
- Los 15 throws mecánicos devuelven `err(<clase existente>)` **sin cambiar el HTTP status** (honestidad:
  no son correcciones de comportamiento, son cambios de mecanismo de señalización).
- El **único** fix de comportamiento (MGC-R4, `add-student-to-grupo:53`) pasa de **500 → 422** vía una
  **clase nueva** `GrupoMateriaMismatchError`, con test **RED-first**.
- Los controllers adoptan el idiom `if (result.isErr()) throw result.unwrapErr()` en los 9 endpoints que
  llaman un use-case migrado.
- Cobertura ≥ 80 % mantenida; 3 gaps de controller-spec cubiertos RED-first.
- Entrega en **3 PRs encadenados (stacked)**, cada uno ≤ 400 líneas, verde e independientemente revisable.

## 2. Scope

### In scope
- Migrar a `Result` los **16** throws "accionables" de application (15 mecánicos + 1 fix 500→422).
- **1 clase nueva**: `GrupoMateriaMismatchError` (code `GRUPO_MATERIA_MISMATCH`, **HTTP 422**), en
  `packages/domain/src/shared/errors/` + su entrada en `DOMAIN_STATUS` (`exception.filter.ts`).
- `validate-teacher-level.ts` helper (dual-caller: Create + Update grupo) migrado a `Result` — debe
  aterrizar **atómico** con sus dos callers (Slice B).
- Retrofit de los 9 endpoints afectados en `materia-grupo-ciclo.controller.ts` al idiom `unwrapErr()`.
- Tests: 13 unit-test files migrados a aserciones `Result`; ~10 controller-specs existentes reescritos;
  **3 controller-specs NUEVOS** (`createGrupo`, `addStudentToMateria`, `addStudentToGrupo`) RED-first.
- Specs (Given/When/Then + RFC 2119): 4 updates + 3 NUEVAS (una por endpoint sin spec dedicado).

### Out of scope / diferido (decisiones cerradas — no reabrir)
- **DEFER — infra guard** `update-grupo.use-case.ts:43` (`throw new Error('No tenant client available')`).
  El **500 es correcto** (misconfiguración de servidor / tenant context no ligado, no es un 4xx de
  cliente). Ya trackeado por el doc del épico como concern aparte (`InfrastructureError` sin modelar).
  Solo se migran los failures esperados de ese use-case (los 2 `NotFoundError`); este throw escapa como
  500 de infra (precedente: el bridge de `PaseFechaInvalidaError` dejó un throw-path justificado).
- **NO tocar** `competency.use-cases.ts:258` (pertenece al follow-up de InfrastructureError, fuera de área).
- **FUERA — guards de constructor de entidades** (`materia-x-curso-x-ciclo.ts:41,44`,
  `grupo-x-curso-x-materia-x-ciclo.ts:39,43`, `alumnos-x-materia-x-curso-x-ciclo.ts:33,36`,
  `alumnos-x-grupo-x-curso-x-materia-x-ciclo.ts:37,41`). Son invariantes de programación ("X is required"),
  inalcanzables por flujo normal (los tipos fuerzan strings no-opcionales). Fail-fast por throw es correcto;
  envolver en `Result` no da valor al cliente = anti-YAGNI.
- **FUERA — anti-patrón Clean Arch en `createGrupo` controller** (`:157-165`: `TenantContext.getClient()` +
  Prisma directo, `NotFoundException` de Nest). Pre-existente y ya usado en el file (enrichment raw-Prisma).
  Backlog (ver Follow-ups).
- **YAGNI estricto**: exactamente **UNA** clase nueva. NO modelar `InfrastructureError`. NO generalizar el
  helper de unwrap del PDF (el idiom va inline).

## 3. Clasificación de los 17 throws (verificada leyendo cada archivo)

| # | Sitio | Throw | Clasificación | HTTP hoy | HTTP correcto | Acción |
|---|---|---|---|---|---|---|
| 1 | `update-grupo:32` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 2 | `update-grupo:38` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 3 | `update-grupo:49` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 4 | `set-materia-es-optativa:19` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 5 | `remove-student-from-materia:25` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 6 | `remove-student-from-grupo:21` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 7 | `list-enrollable-students-for-materia:34` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 8 | `delete-grupo:15` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 9 | `create-grupo:48` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 10 | `add-student-to-materia:33` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 11 | `add-student-to-materia:39` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 12 | `add-student-to-grupo:42` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 13 | `add-student-to-grupo:48` | `NotFoundError` | DomainError existente | 404 | 404 | Mecánico → `err()` |
| 14 | `validate-teacher-level.ts:42` | `ValidationError` | DomainError existente | 400 | 400 | Mecánico → `err()` (**helper dual-caller**) |
| 15 | `add-student-to-grupo:65` | `AlumnoAlreadyInGrupoError` | DomainError existente | 409 | 409 | Mecánico → `err()` |
| 16 | `add-student-to-grupo:53` | bare `Error` (MGC-R4) | **DomainError intrínseco — CLASE NUEVA** | **500 (BUG)** | **422** | **Fix RED-first** |
| 17 | `update-grupo:43` | bare `Error` ("No tenant client available") | **Infraestructura** | 500 | 500 | **DEFER** (no se toca) |

**Conteo honesto:** de 17 → **1 sola corrección de comportamiento** (fila 16, 500→422). Las otras
**14 mecánicas + 1 helper** (filas 1-15) preservan el HTTP status: cambian el *mecanismo* de señalización
(`throw` → `Result`), no el contrato observable. La fila 17 no se toca.

## 4. Decisión: `GrupoMateriaMismatchError` (MGC-R4)

| Atributo | Valor |
|---|---|
| **Nombre** | `GrupoMateriaMismatchError` (nombra la invariante MGC-R4: grupo ⊆ materia) |
| **Code** | `GRUPO_MATERIA_MISMATCH` |
| **HTTP status** | **422 Unprocessable Entity** |
| **Base** | `DomainError` (zero-arg constructor, igual que `AlumnoAlreadyInGrupoError`) |
| **Ubicación** | `packages/domain/src/shared/errors/grupo-materia-mismatch-error.ts` |
| **DOMAIN_STATUS** | agregar `GRUPO_MATERIA_MISMATCH: 422` en `exception.filter.ts` |

**Invariante que nombra (MGC-R4):** el `materiaXCursoXCicloId` del grupo debe igualar el del membership
del alumno. Un `add-student-to-grupo` donde el grupo NO pertenece a la materia del alumno es una relación
inválida entre dos entidades, no un fallo de infra.

**Ratificación del 422 (razonamiento de taxonomía — CONFIRMADO contra el codebase):**
- El bucket **409** en `DOMAIN_STATUS` es **exclusivamente** "already exists / already assigned / closed /
  overlap" (`EMAIL_ALREADY_EXISTS`, `COURSE_CYCLE_ALREADY_EXISTS`, `*_CLOSED`, `ALUMNO_ALREADY_IN_GRUPO`,
  `LLAMADO_OVERLAP`, `DOCENTE_ALREADY_ASSIGNED`...). MGC-R4 **no es un conflicto de estado**.
- MGC-R4 es una **entidad sintácticamente válida pero semánticamente no procesable** — exactamente el bucket
  **422** ya establecido en el codebase (`INVALID_LLAMADO_RANGE`, `CONDICION_INVALIDA`,
  `PREREQUISITE_SLOT_MISSING`, `PARCIAL_YA_APROBADO`, `ALUMNO_LIBRE_NO_PUEDE_RENDIR`...).
- **Veredicto: 422.** No se overridea; el precedente del codebase lo sostiene sin ambigüedad.

## 5. Estrategia de tests (TDD estricto)

Runner **Vitest**, comando **`pnpm test`**, coverage **≥ 80 %**. Contract: nada se marca "done" sin suite verde.

| Categoría | Volumen | Enfoque |
|---|---|---|
| **MGC-R4 fix (500→422)** | 1 unit + 1 controller-spec | **RED-first**: los tests actuales usan `.rejects.toThrow(/regex/)` genérico → tightening a `expect(result.unwrapErr()).toBeInstanceOf(GrupoMateriaMismatchError)` + assert 422 en el controller. RED antes del fix, GREEN después. |
| **3 controller-specs NUEVOS** | `createGrupo`, `addStudentToMateria`, `addStudentToGrupo` | **RED-first** (gaps de cobertura reales — NO existen hoy): happy + error + (en `addStudentToGrupo`) el caso 422 de MGC-R4. Esfuerzo real, no rewrites. |
| **13 unit-test files** | uno por use-case | Mecánico: `.rejects.toThrow/toBeInstanceOf` → aserciones `Result` (`result.isErr()`, `unwrapErr().code`). |
| **~10 controller-specs existentes** | rewrites | `mockRejectedValue(error)` → `mockResolvedValue(err(error))`; success `mockResolvedValue(obj)` → `mockResolvedValue(ok(obj))`. |
| **Integración `.db.test.ts`** | `mgc-s13.isolation`, `mgc-generate` | **No cambian** (repo directo / sin throws de application). |

## 6. Delivery — 3 PRs encadenados (stacked), base `main`

Estimado agregado **~800-1000 líneas** → MUY por encima del budget de 400. El type-coupling NO fuerza un
PR único (cada método del controller depende solo de su use-case → edición incremental del file). Chain:
**Slice A → Slice B (sobre A) → Slice C (sobre B)**. Cada slice verde e independientemente revisable.

**Guard forecast:** `Decision needed before apply: YES · Chained PRs: YES · 400-line budget risk: HIGH`.

### Slice A — use-cases "materia" (~300-350 líneas)
- **Use-cases** (solo `NotFoundError`): `set-materia-es-optativa`, `remove-student-from-materia`,
  `add-student-to-materia`, `list-enrollable-students-for-materia`.
- **Tests**: 4 unit tests migrados + controller-specs (2 updates + **1 NUEVO** `add-student-to-materia` RED-first).
- **Controllers**: retrofit de esos 4 endpoints (`unwrapErr()` idiom).
- **Specs**: 2 updates + **NUEVA** `add-student-to-materia`.
- **Deps**: base `main`. **Out**: nada de grupo ni la clase nueva.

### Slice B — use-cases "grupo" + helper (~350-400 líneas)
- **Use-cases**: `update-grupo` (solo los 2 `NotFoundError`; el guard de infra `:43` **NO se toca**),
  `create-grupo`, `delete-grupo`, `remove-student-from-grupo`.
- **Helper**: `validate-teacher-level.ts` (`ValidationError` → `Result`) — **DEBE** aterrizar atómico con
  sus dos callers (Create + Update grupo). Es la restricción dura de este slice.
- **Tests**: unit tests migrados + controller-specs (2 updates + **1 NUEVO** `create-grupo` RED-first).
- **Controllers**: retrofit de esos 4 endpoints.
- **Specs**: 2 updates + **NUEVA** `create-grupo`.
- **Deps**: sobre Slice A. **Out**: la clase nueva y MGC-R4. **Fallback**: si excede 400 solo, subdividir
  en B1 (update/delete/remove mecánicos) y B2 (create-grupo + helper).

### Slice C — student-membership + clase nueva (~270-320 líneas)
- **Use-case**: `add-student-to-grupo` (2 `NotFoundError` + `AlumnoAlreadyInGrupoError` + **fix MGC-R4**).
- **Clase nueva**: `GrupoMateriaMismatchError` + su unit test + entrada `DOMAIN_STATUS`.
- **Tests**: tighten de `add-student-to-grupo.use-case.test.ts` (**RED 500→422**) + retrofit del endpoint.
- **Specs**: **NUEVA** `add-student-to-grupo` (RED-first, incl. caso 422).
- **Deps**: sobre Slice B. **Out**: guards de infra, entity guards, anti-patrón `createGrupo`.

## 7. Rollback

**Aditivo y de bajo riesgo.** No hay migración de datos, no hay cambio de esquema Prisma, no hay ruptura de
contrato en los 16 sitios que preservan status. El único cambio observable de comportamiento (MGC-R4
500→422) es una **corrección** de un bug, no una regresión. Rollback = revertir el/los PR(s) del chain;
como están stacked, revertir en orden inverso (C → B → A). La clase nueva y la entrada `DOMAIN_STATUS` son
puramente aditivas (no colisionan con codes existentes).

## 8. Follow-ups (backlog — NO en este change)

1. **`InfrastructureError`** para los 2 guards de infra mistyped (`update-grupo:43` y `competency.use-cases.ts:258`)
   — concern separado ya trackeado por el doc del épico; requiere modelar la categoría (fuera de YAGNI acá).
2. **Anti-patrón Clean Arch en `createGrupo` controller** (`:157-165`, raw-Prisma + `NotFoundException` de
   Nest) — refactor a use-case; pre-existente, patrón ya usado en el file.
3. **Guards de constructor de entidades** (4 entidades, "X is required") — evaluar si valen `Result` alguna
   vez; hoy son invariantes de programación con fail-fast correcto.

## 9. Persistencia

- **openspec** (fuente de verdad): este archivo — `openspec/changes/materia-grupo-ciclo-result-migration/proposal.md`.
- **engram**: **backfill pendiente** (`mem_save` no disponible en este sub-agente). Topic key:
  `sdd/materia-grupo-ciclo-result-migration/proposal` · `project: educandow` · `type: architecture` ·
  `scope: project` · `capture_prompt: false`.
