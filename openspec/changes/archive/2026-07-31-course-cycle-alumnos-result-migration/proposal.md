# Proposal — course-cycle-alumnos-result-migration

> Slice `AlumnosXCurso` del épico error-handling. Diferido por el archivado
> `course-cycle-result-migration`. **Consume** la capability canónica
> `application-error-handling` — no crea una nueva.
> Nivel pedagógico: **N/A** (cambio transversal; enum = ALL).

## Intent

**Problema.** Los 5 use-cases de `AlumnosXCurso` siguen señalando fallos con `throw`
directo, mientras el resto del épico ya migró al patrón `Result<T, E>`. Es la última
isla de inconsistencia dentro de este dominio: rompe la uniformidad del manejo de
errores y obliga a que cada caller razone dos convenciones distintas.

**Por qué ahora.** El épico ya fijó el patrón base (`ApplicationError` + rama en el
filter + idiom `if (isErr) throw unwrapErr()` en el controller). Este slice quedó
explícitamente pendiente al cerrar `course-cycle-result-migration`. Cerrarlo ahora
elimina la deuda antes de que nuevos consumidores se acoplen a los `throw` legacy.

**Éxito.** Los 5 use-cases devuelven `Result`; los 5 endpoints del controller que los
consumen adoptan el idiom `if (isErr) throw unwrapErr()`; el throw de entidad
`PaseFechaInvalidaError` queda **puenteado** a `Result` en el use-case; toda la suite
pasa (Vitest, coverage ≥80%) y **los status HTTP quedan idénticos** a los actuales.

**Encuadre honesto.** A diferencia de los dos slices previos, este NO corrige ningún
bug 500→4xx. **Cero clases nuevas, cero reclasificaciones, cero cambios de comportamiento
externo.** Es una migración pura de consistencia + un único puente de throw de entidad.
El único efecto observable es interno: los fallos se propagan como `Result` en vez de
como excepción hasta el borde del controller, donde se re-lanzan igual que hoy.

## Scope

### In-scope

- Migrar a `Result<T, Error>` los 5 use-cases: `TogglePrintable`,
  `RemoveStudentFromCourseCycle`, `RegistrarPase`, `CascadeStudentMateriasCompetencias`,
  `AddStudentToCourseCycle`.
- Puentear el throw de entidad `PaseFechaInvalidaError` (`student.registrarPase`) a
  `Result` dentro de `RegistrarPaseUseCase` vía try/catch.
- Retrofit del idiom `if (isErr) throw unwrapErr()` en los **5** endpoints in-scope de
  `alumnos-x-curso-x-ciclo.controller.ts`.
- Reescribir los tests de use-case (`.rejects.toThrow` → aserciones sobre `Result`) y
  del controller spec (`mockRejectedValue` → `mockResolvedValue(err(...))`).
- Agregar cobertura nueva RED-first para `togglePrintable` en el controller spec (gap real).

### Out-of-scope

- Crear o modificar la capability `application-error-handling` (se consume tal cual).
- Cualquier clase de error nueva o reclasificación de las existentes.
- Generalizar el helper `unwrap-result-or-throw.ts` (tipado a `PdfError`) — se sigue el
  idiom inline, precedente en `course-cycle.controller.ts` (YAGNI).
- Los 4 endpoints del controller que NO llaman use-cases in-scope.
- Migrar los `.catch()` fire-and-forget de `GenerateCourseCyclesUseCase`
  (`course-cycle.use-cases.ts:421,429`) — backlog del épico, riesgo de bypass silencioso
  del `.catch()` si se migran a Result (documentado abajo en Follow-ups).
- Cualquier cambio de status HTTP o de contrato de respuesta.

## Clasificación de throws (11 filas — verificado leyendo el código)

| # | Ubicación | Condición | Clase | Clasif. | Acción |
|---|---|---|---|---|---|
| 1 | `toggle-printable.use-case.ts:25` | row missing / IDOR | `NotFoundError` | DomainError | mecánico → `err` |
| 2 | `remove-student-from-course-cycle.use-case.ts:28` | CourseCycle not found | `NotFoundError` | DomainError | mecánico → `err` |
| 3 | `remove-student-from-course-cycle.use-case.ts:34` | enrollment missing / IDOR | `NotFoundError` | DomainError | mecánico → `err` |
| 4 | `remove-student-from-course-cycle.use-case.ts:39` | `student.tienePase` | `StudentHasPaseError` | DomainError (409) | mecánico → `err` |
| 5 | `registrar-pase.use-case.ts:35` | CourseCycle not found | `NotFoundError` | DomainError | mecánico → `err` |
| 6 | `registrar-pase.use-case.ts:41` | enrollment missing / IDOR | `NotFoundError` | DomainError | mecánico → `err` |
| 7 | `registrar-pase.use-case.ts:47` | Student not found | `NotFoundError` | DomainError | mecánico → `err` |
| 8 | `cascade-student-materias-competencias.use-case.ts:47` | bridge row missing / IDOR | `NotFoundError` | DomainError | mecánico → `err` |
| 9 | `add-student-to-course-cycle.use-case.ts:33` | CourseCycle not found | `NotFoundError` | DomainError | mecánico → `err` |
| 10 | `add-student-to-course-cycle.use-case.ts:39` | Student not found | `NotFoundError` | DomainError | mecánico → `err` |
| **11** | `registrar-pase.use-case.ts:52` → `student.registrarPase(fecha)` (entidad `student.ts`) | `fecha > hoy` | `PaseFechaInvalidaError` | DomainError | **bridge try/catch** |

**Todos DomainError. Cero ApplicationError, cero clases nuevas, cero reclasificación.**
`StudentHasPaseError` es invariante intrínseco (independiente del caller) → DomainError
correcto, `STUDENT_HAS_PASE: 409` en el filter, sin tocar.

### Return types (por use-case)

| Use-case | Actual | Nuevo |
|---|---|---|
| `TogglePrintable` | `Promise<AlumnosXCursoXCiclo>` | `Promise<Result<AlumnosXCursoXCiclo, Error>>` |
| `RemoveStudentFromCourseCycle` | `Promise<void>` | `Promise<Result<void, Error>>` |
| `RegistrarPase` | `Promise<void>` | `Promise<Result<void, Error>>` (3 throws → `err` + bridge #11) |
| `CascadeStudentMateriasCompetencias` | `Promise<CascadeResult>` | `Promise<Result<CascadeResult, Error>>` — **4 return sites** (60/82/91/107) → `ok(...)` |
| `AddStudentToCourseCycle` | `Promise<AlumnosXCursoXCiclo>` | `Promise<Result<AlumnosXCursoXCiclo, Error>>` |

## Decisión de diseño: bridge de `PaseFechaInvalidaError`

Única decisión **no-mecánica** del slice. `student.registrarPase(fecha)` (y su
contraparte `student.revertirPase()`) es un throw **intrínseco de la entidad** — no se
puede convertir en un `if/return err` como los otros 10, porque el chequeo vive dentro
del agregado, no en el use-case.

**Patrón a fijar (design):** envolver la llamada a la entidad en try/catch y
`return err(e as PaseFechaInvalidaError)`.

**Precedente exacto en el codebase** — `attendance-type.use-cases.ts:102-106`:

```ts
try {
  entity.assertMutable()
} catch (e) {
  return err(e as ...)
}
```

Design DEBE:
1. Fijar este patrón try/catch para las dos ramas de `RegistrarPase`
   (register vs revert; confirmar que ambas devuelven `ok(undefined)`, matcheando
   `RemoveStudent`).
2. Agregar el import de `PaseFechaInvalidaError`.
3. **Verificar el mapeo de `PaseFechaInvalidaError` en `DOMAIN_STATUS`** — que su código
   ya tenga status asignado en el filter; si falta, es un hallazgo para design.

## Estrategia de tests (TDD estricto, Vitest, `pnpm test`, ≥80%)

Dos naturalezas distintas:

1. **Reescrituras mecánicas** (`.rejects.toThrow` / `toBeInstanceOf` → aserciones
   sobre `Result`): toggle-printable (2), remove (4), registrar-pase (5), cascade
   (2 + ~8 happy-path que necesitan envolver los asserts en `result.unwrap()`), add (3).
   Controller spec: 12 tests (`mockRejectedValue` → `mockResolvedValue(err(...))`).
2. **Cobertura nueva RED-first** — dos gaps genuinos:
   - **`togglePrintable` NO tiene cobertura de controller-spec** → ~3 tests nuevos
     (happy 200/204, 404, IDOR), escritos RED-first antes de tocar el controller.
   - **Bridge #11**: test que verifique que el throw de entidad
     (`PaseFechaInvalidaError`) se convierte en un `err(...)` (no escapa como excepción)
     — RED-first contra el use-case.

`CascadeStudentMateriasCompetencias` es la mayor superficie de regresión: 4 return sites
+ ~8 happy-path con `unwrap()`, más de lo que sugiere su único throw. Atención en apply.

## Tamaño + delivery

| Bucket | ~líneas |
|---|---|
| 5 use-cases (prod) | ~45-55 |
| controller (5 endpoints) | ~25-30 |
| 5 test files de use-case | ~90-110 |
| controller spec (12 rewrites + 3 nuevos) | ~65-70 |
| **Total** | **~225-265** |

**Un solo PR (<400 líneas, budget risk Low). NO chained.**

**Por qué no se puede partir:** el cambio de return types acopla use-cases y controller
por el **sistema de tipos**. Un PR-1 que migrara solo los use-cases rompería la
compilación del controller (los endpoints esperarían `Result` sin el idiom de unwrap).
Separarlos exigiría un adapter throwaway — costo sin valor. La cohesión de tipos manda:
un PR. `sdd-tasks` re-forecastea a granularidad de item. Tests co-locados con el
comportamiento que verifican (work-unit commits).

**Rama:** desde `main`. Archivos disjuntos de `course-cycle-result-migration` (aún sin
mergear) — verificado por paths.

## Rollback

Bajo riesgo, additive / idiom-swap:
- Los use-cases pasan de `throw` a `return err(...)`; el controller re-lanza vía
  `unwrapErr()`. **Comportamiento externo idéntico** (mismos status HTTP) → revertir es
  un git revert limpio del PR, sin migración de datos ni de contrato.
- Sin cambios de schema Prisma (master ni tenant), sin cambios de env, sin cambios de API
  pública.

## Follow-ups (fuera de scope)

1. **Fire-and-forget del épico:** los `.catch()` de `GenerateCourseCyclesUseCase`
   (`course-cycle.use-cases.ts:421,429`, apuntan a AutoCreate/Materialize). Si un slice
   futuro los migra a `Result`, un `err(...)` resuelve normal y **bypassea silenciosamente
   el `.catch()`**. Documentado para el backlog — NO se toca acá.
2. **Generalizar `unwrap-result-or-throw.ts`:** hoy tipado a `PdfError`. Si el idiom
   inline prolifera, evaluar un helper genérico. Por ahora YAGNI — no en este slice.
