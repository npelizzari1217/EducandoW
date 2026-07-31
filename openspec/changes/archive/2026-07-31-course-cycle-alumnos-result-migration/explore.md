# Exploration — course-cycle-alumnos-result-migration (épico error-handling)

> Follow-up diferido por `course-cycle-result-migration`. El slice `AlumnosXCurso`.
> Diagnóstico verificado leyendo el código (registrar-pase y cascade confirmados de primera mano).

## Resumen ejecutivo

5 use-cases con 10 throws explícitos, TODOS `NotFoundError` o `StudentHasPaseError` (DomainError,
reuso puro) — **cero clases nuevas, cero bugs de 500** (a diferencia de slices anteriores). Hay UN
throw #11 escondido: `student.registrarPase()` (entidad) tira `PaseFechaInvalidaError` — invariante
de dominio intrínseco que el use-case debe **puentear** a `Result` con try/catch (única decisión
no-mecánica). Tamaño estimado **~225-265 líneas → un solo PR** (el preview de 550-700 era
pesimista). Rama desde `main` (archivos disjuntos de course-cycle-result-migration).

## Inventario de throws

| # | Ubicación | Condición | Clase | Clasif. | ¿Bug? |
|---|---|---|---|---|---|
| 1 | `toggle-printable.use-case.ts:25` | row missing / IDOR | `NotFoundError` | DomainError | mecánico |
| 2 | `remove-student-from-course-cycle.use-case.ts:28` | CourseCycle not found | `NotFoundError` | DomainError | mecánico |
| 3 | `remove-student-from-course-cycle.use-case.ts:34` | enrollment missing / IDOR | `NotFoundError` | DomainError | mecánico |
| 4 | `remove-student-from-course-cycle.use-case.ts:39` | `student.tienePase` | `StudentHasPaseError` | DomainError (409) | mecánico |
| 5 | `registrar-pase.use-case.ts:35` | CourseCycle not found | `NotFoundError` | DomainError | mecánico |
| 6 | `registrar-pase.use-case.ts:41` | enrollment missing / IDOR | `NotFoundError` | DomainError | mecánico |
| 7 | `registrar-pase.use-case.ts:47` | Student not found | `NotFoundError` | DomainError | mecánico |
| 8 | `cascade-student-materias-competencias.use-case.ts:47` | bridge row missing / IDOR | `NotFoundError` | DomainError | mecánico |
| 9 | `add-student-to-course-cycle.use-case.ts:33` | CourseCycle not found | `NotFoundError` | DomainError | mecánico |
| 10 | `add-student-to-course-cycle.use-case.ts:39` | Student not found | `NotFoundError` | DomainError | mecánico |
| **11** | `registrar-pase.use-case.ts:52` → `student.registrarPase(fecha)` (entidad `student.ts`) | `fecha > hoy` | `PaseFechaInvalidaError` | DomainError | **bridge try/catch** |

`StudentHasPaseError` = invariante intrínseco ("alumno con pase activo no se puede desmatricular"),
independiente del caller → DomainError correcto, `STUDENT_HAS_PASE: 409` en el filter. Sin
reclasificación. Ningún throw es caller-context → **cero ApplicationError**.

## Return types actuales → nuevos

| Use-case | Actual | Nuevo |
|---|---|---|
| `TogglePrintableUseCase` | `Promise<AlumnosXCursoXCiclo>` | `Promise<Result<AlumnosXCursoXCiclo, Error>>` |
| `RemoveStudentFromCourseCycleUseCase` | `Promise<void>` | `Promise<Result<void, Error>>` |
| `RegistrarPaseUseCase` | `Promise<void>` | `Promise<Result<void, Error>>` (3 throws → err + bridge del #11) |
| `CascadeStudentMateriasCompetenciasUseCase` | `Promise<CascadeResult>` | `Promise<Result<CascadeResult, Error>>` — **4 return sites** (60/82/91/107) → `ok(...)` + 1 throw → err |
| `AddStudentToCourseCycleUseCase` | `Promise<AlumnosXCursoXCiclo>` | `Promise<Result<AlumnosXCursoXCiclo, Error>>` |

Idiom de propagación y unwrap: ya existe verbatim en `course-cycle.controller.ts` (del change
anterior). Hay un helper `unwrap-result-or-throw.ts` pero está tipado a `Result<T, PdfError>` —
NO reutilizable acá sin generalizarlo. El precedente (`course-cycle.controller.ts`) inlinea el
patrón. Recomendación: seguir el inline (YAGNI, no generalizar el helper de PDF).

## Bridge del #11 (PaseFechaInvalidaError) — decisión de diseño

`RegistrarPaseUseCase` debe envolver `student.registrarPase(fecha)` / `student.revertirPase()` en
try/catch y `return err(e as PaseFechaInvalidaError)`. Precedente exacto en el codebase:
`attendance-type.use-cases.ts:102-106` (`try { entity.assertMutable() } catch (e) { return err(e as ...) }`).
Design debe: fijar este patrón + agregar el import de `PaseFechaInvalidaError` + verificar su mapeo
en `DOMAIN_STATUS`.

## Retrofit del controller

`alumnos-x-curso-x-ciclo.controller.ts` tiene 9 endpoints; **5** llaman use-cases in-scope y
necesitan `if(isErr) throw unwrapErr()`:

| Endpoint | Use-case | ¿Retrofit? |
|---|---|---|
| `POST /course-cycles/:ccId/alumnos` | `AddStudentToCourseCycleUseCase` | Sí |
| `DELETE /course-cycles/:ccId/alumnos/:id` | `RemoveStudentFromCourseCycleUseCase` | Sí |
| `PATCH .../:id/printable` | `TogglePrintableUseCase` | Sí |
| `PATCH .../:id/pase` | `RegistrarPaseUseCase` | Sí |
| `POST .../:id/cascade` | `CascadeStudentMateriasCompetenciasUseCase` | Sí |
| `GET .../alumnos`, `PATCH .../printable` (bulk), `GET /students/:id/memberships`, `POST .../cascade` (bulk) | (no tiran) | No |

## Caveats fire-and-forget

`CascadeStudentMateriasCompetenciasUseCase` solo se invoca awaited desde el controller — sin
consumidor fire-and-forget en este slice → migrar a Result sin riesgo de semántica. NOTA para el
backlog del épico (fuera de scope): los `.catch()` fire-and-forget de `GenerateCourseCyclesUseCase`
(course-cycle.use-cases.ts:421,429) apuntan a AutoCreate/Materialize — si esos se migran a Result
en un slice futuro, un `err(...)` resuelve normal y **bypassea silenciosamente el `.catch()`**.

## Impacto en tests

Rewrites `.rejects.toThrow`/`toBeInstanceOf` → `Result`:
- toggle-printable.use-case.test.ts (2), remove-...test.ts (4), registrar-pase.test.ts (5),
  cascade-...test.ts (2 + ~8 happy-path que necesitan `result.unwrap()` alrededor de asserts),
  add-...test.ts (3).
- Controller spec `alumnos-x-curso-x-ciclo.controller.spec.ts`: 12 tests (`mockRejectedValue` →
  `mockResolvedValue(err(...))`). **`togglePrintable` NO tiene cobertura de controller-spec** →
  ~3 tests nuevos (happy 200/204, 404, IDOR), RED-first.

Vitest, TDD estricto, coverage ≥80%.

## Tamaño + delivery

| Bucket | ~líneas |
|---|---|
| 5 use-cases (prod) | ~45-55 |
| controller (5 endpoints) | ~25-30 |
| 5 test files de use-case | ~90-110 |
| controller spec (12 rewrites + 3 nuevos) | ~65-70 |
| **Total** | **~225-265** |

**Un solo PR** (budget risk Low). Chained NO: el cambio de return types acopla use-cases y controller
por el sistema de tipos (PR-1 solo rompería la compilación del controller) → no se puede partir en
PRs independientes sin un adapter throwaway. `sdd-tasks` re-forecast a granularidad de item.

## Rama

Desde `main` — archivos disjuntos de `course-cycle-result-migration` (verificado por paths, no por
`git diff`).

## Riesgos / preguntas para propose

1. **Bridge `PaseFechaInvalidaError`** (registrar-pase:52): decisión de diseño (try/catch), no
   mecánica. Verificar mapeo `DOMAIN_STATUS`.
2. **Cascade tiene 4 return sites** + ~8 happy-path tests con `unwrap()` → superficie de regresión
   mayor que lo que sugiere el throw-count.
3. **togglePrintable sin cobertura de controller-spec** → tests netos nuevos, RED-first.
4. Acople use-case/controller → un PR (no chained).
5. Confirmar en design si las 2 ramas de RegistrarPase (register vs revert) devuelven `ok(undefined)`
   (probable, matchea RemoveStudent).
