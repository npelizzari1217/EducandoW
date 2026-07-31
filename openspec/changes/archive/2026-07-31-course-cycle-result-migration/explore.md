# Exploration — course-cycle-result-migration (épico error-handling)

> Fase de exploración del follow-up de `app-error-model`. Store: hybrid.
> Diagnóstico verificado call-site por call-site (lectura directa del código).

## Resumen ejecutivo

`course-cycle.use-cases.ts` es una migración a `Result` **a medias, limpia**: 4 de 7 use-cases ya
retornan `Result` correctamente (clase `DomainError` correcta, status correcto vía `DOMAIN_STATUS`).
Lo que queda es 100% throw-based y **no necesita ninguna clase de error nueva** — reuso total del
catálogo existente. Dos bugs reales de HTTP 500 (helpers que descartan un `ValidationError` válido y
tiran `Error` pelado), más un tercero gemelo en `Level.fromParts` (paquete `domain`) sobre el call
path de `generate`.

**Decisión de alcance (con el usuario): Opción A** — solo el archivo nombrado + su controller (7
throws, ~200-260 líneas, un PR) + fix de `Level.fromParts`. El slice `AlumnosXCurso` (10 throws más)
va como change follow-up separado.

## Estado actual (mixed migration)

| Use-case | ¿Result hoy? |
|---|---|
| `CreateCourseCycleUseCase` | ✅ (pero llama helpers que tiran → bug 500) |
| `UpdateCourseCycleUseCase` | ✅ (idem) |
| `ToggleCourseCycleActiveUseCase` | ✅ |
| `GetCourseCycleUseCase` | ✅ |
| `ListCourseCyclesUseCase` | ✅ (no tira) |
| `DeleteCourseCycleUseCase` | ❌ `Promise<void>`, tira |
| `ListStudentsByCourseCycleUC` | ❌ `Promise<EnrolledStudent[]>`, tira |
| `GenerateCourseCyclesUseCase` | ❌ `Promise<CreateManyResult>`, tira |

Los hermanos `grading-period.use-cases.ts` / `grading-phase.use-cases.ts` en la misma carpeta ya
están 100% migrados — el estado "mixed" está confinado a `course-cycle.use-cases.ts`.

## Inventario por throw (archivo nombrado)

| Línea | Sitio | Condición | Clasificación | Clase (reuso) | ¿Bug 500? |
|---|---|---|---|---|---|
| 38 | `buildLevel()` | nivel inválido | DomainError (invariante) | `ValidationError` (descartado hoy) | **SÍ → 4xx** |
| 45 | `buildBimonthPeriod()` | `fin ≤ inicio` | DomainError | `ValidationError` (descartado hoy) | **SÍ → 4xx** |
| 229 | `DeleteCourseCycleUC` | not found | DomainError | `CourseCycleNotFoundError` (404) | no |
| 232 | `DeleteCourseCycleUC` (`cc.ensureActive()`) | ciclo inactivo | DomainError | `CourseCycleClosedError` (409) | no |
| 283 | `ListStudentsByCourseCycleUC` | not found | DomainError | `CourseCycleNotFoundError` (404) | no |
| 315 | `GenerateCourseCyclesUC` | AcademicCycle not found | DomainError | `NotFoundError` (404) | no |
| 318 | `GenerateCourseCyclesUC` | AcademicCycle inactivo | DomainError | `AcademicCycleClosedError` (409) | no |
| 327 | `GenerateCourseCyclesUC` | StudyPlan not found | DomainError | `NotFoundError` (404) | no |
| 355-357 | `GenerateCourseCyclesUC` (loop) | `Level.fromParts` + `.unwrap()` desnudos | DomainError | `ValidationError` | **latente** — ver out-of-scope |

Ninguno es caller-context/autorización → **cero `ApplicationError`**. Regla de clasificación (del
piloto): contexto del llamante → `ApplicationError`; invariante intrínseco del dato → `DomainError`.
Todo acá es lo segundo.

## Bug de 500 (detalle)

`buildLevel`/`buildBimonthPeriod` reciben el `Result` de `Level.create`/`BimonthPeriod.create`,
**descartan** el `ValidationError` del `err` y tiran `throw new Error(...)`. Ese `Error` pelado cae
en el fallback `instanceof Error` del filter (status default 500). Como se llaman desde
`Create`/`Update` (que ya retornan `Result`), hoy un POST/PATCH con nivel inválido o bimestre
`fin ≤ inicio` responde **500 en vez de 400/422**. Mismo root-cause que el bug 403 del piloto,
distinto status objetivo. `Level.fromParts` (line 223, paquete domain) tiene el mismo patrón sobre
el call path de `generate`.

## Estado del controller

`course-cycle.controller.ts` ya adopta `if (isErr) throw unwrapErr()` en 9 de 12 endpoints. Faltan:
`delete` (:241), `listStudents` (:211), `generate` (:263) — porque sus use-cases todavía no
retornan `Result`.

## Impacto en tests

- **Rewrites mecánicos** (status igual, solo idiom): tests de `Delete`/`ListStudents`/`Generate` que
  usan `.rejects.toThrow(...)` → asertar sobre `Result`.
- **Regresión real (RED antes del fix)**: NO existe test de use-case para nivel inválido / bimestre
  `fin ≤ inicio` / composite inválido en generate. Gap genuino de cobertura.
- **Controller specs nuevos** para `delete`/`generate`/`listStudents` (hoy sin spec dedicado).
- Vitest, TDD estricto, coverage ≥ 80%.

## Clases nuevas necesarias

**Ninguna.** Reuso: `ValidationError`, `CourseCycleNotFoundError`, `CourseCycleClosedError`,
`AcademicCycleClosedError`, `NotFoundError`.

## Fuera de scope (follow-up)

1. **Slice `AlumnosXCurso`** — 10 throws en `registrar-pase`, `add/remove-student-from-course-cycle`,
   `cascade-student-materias-competencias`, `toggle-printable` + retrofit completo de
   `AlumnosXCursoXCicloController` (0% del idiom). ~550-700 líneas → chained PRs. Change separado.
2. **Semántica de batch en `GenerateCourseCyclesUseCase`** — los `.unwrap()` desnudos del loop
   (`CourseName.create`, `PassingGrade.create(6)`) son all-or-nothing (un curso malo aborta el
   lote). Migrar a partial-success = decisión de producto. Se **preserva el comportamiento actual**.

## Riesgos / preguntas para propose

1. `Level.fromParts` se llama también desde infra (reconstrucción DB). El fix a `ValidationError`
   es no-breaking (firma `: Level` intacta); en infra el composite ya se normaliza antes (ver
   `prisma-subject.repository.ts:66-72`), no debería dispararse ahí. Verificar mapeo `DOMAIN_STATUS`
   de `VALIDATION_ERROR`.
2. `DeleteCourseCycleUseCase` usa `cc.ensureActive()` (la entidad tira `CourseCycleClosedError`).
   Design decide envolver vs check no-throw, sin cambiar el 409 resultante.
3. Orden TDD: separar los 2 bugfixes (RED→GREEN) de los rewrites mecánicos (refactor puro).

## Recomendación

Proceder a `sdd-propose` con scope Opción A. Sin clases nuevas, 3 bugs de 500 a corregir, 5
migraciones mecánicas seguras.
