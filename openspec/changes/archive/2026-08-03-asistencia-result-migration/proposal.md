# Proposal — asistencia-result-migration

> **Épico**: error-handling / signature honesty (throw → `Result`).
> **Slice**: EL más grande — 41 throws, 6 use-cases, ~1200-1800 líneas de diff → **4 chained PRs**.
> **Nivel pedagógico afectado**: N/A — transversal (aplica a TODAS las asistencias, sin lógica pedagógica de nivel).

## 1. Intent

### Qué problema
Los 6 use-cases del módulo `asistencia` señalan sus fallos con `throw` (41 en total). Esto rompe la
**honestidad de firma**: el tipo de retorno miente (dice "devuelvo `X`" pero puede explotar). El caller
(controller) no ve en el tipo qué errores puede recibir, y depende de `try/catch` + `instanceof` para
remapear excepciones — 5 de 7 endpoints arrastran bloques `try/catch (ForbiddenError) → ForbiddenException`
que hoy son **dead code** (el `HttpExceptionFilter` ya mapea `FORBIDDEN → 403`).

### Por qué ahora
La capacidad canónica `application-error-handling` ya está establecida y probada en el módulo piloto
`attendance-type` (migrado y archivado). `asistencia` es el consumidor más grande pendiente. Migrarlo
ahora consolida el patrón `Result` en el área de mayor superficie antes de tocar los módulos restantes.

### Cómo se ve el éxito
- Los 41 throws de `application/asistencia/**` se convierten en `return err(...)`.
- Ningún use-case de `asistencia` lanza excepciones; el union de error es explícito en cada firma.
- Los 7 endpoints del controller consumen `Result` de forma uniforme (`if (result.isErr()) throw result.unwrapErr();`).
- **Cero cambio de comportamiento HTTP**: los mismos status (403/404/400/422/409) que hoy.
- Suite verde (`pnpm test`), coverage ≥ 80%.

## 2. Scope

### In-scope
- **Los 41 throws** de los 6 use-cases → `return err(...)`, INCLUIDOS los 22 `ForbiddenError` (migración
  mecánica de idioma, sin reclasificar la clase).
- **Widening de firmas**: cada use-case retorna `Result<Success, ErrorUnion>` en vez de `Promise<Success>`.
- **Controller cleanup** (7 endpoints de `asistencia.controller.ts`): eliminar los 5 `try/catch`
  redundantes; unificar a `if (result.isErr()) throw result.unwrapErr();`. Los 2 endpoints restantes
  ganan el chequeo `isErr`.
- **Tests**: adaptar los ~117 `it()` afectados (no solo los 34 de error-path — ver §5).
- `generate-monthly` (ya medio-migrado): **widen union** con los 4 throws legacy restantes.
- Helper compartido `assertCourseCycleExists` (usado por los 3 use-cases de month-status): su
  tratamiento (Result vs inline) se decide en **design**, no acá.

### Out-of-scope (deferido, explícito)
- **Reclasificar `ForbiddenError` → `ApplicationError`**: `ForbiddenError` queda `extends DomainError`
  EXACTAMENTE como está (code `FORBIDDEN`, ya mapea 403 vía `DOMAIN_STATUS`). Conceptualmente "forbidden"
  ES caller-context (ApplicationError), PERO la reclasificación toca ~19 archivos de producción en 8
  módulos + 4 controllers → es un **épico cross-cutting aparte**. Diferirlo NO es una misclasificación:
  es una decisión deliberada para no inflar este diff con cero beneficio asistencia-específico (YAGNI).
  Idealmente se hace DESPUÉS de migrar todos los módulos que lo lanzan, como un rename+status-move de
  una sola pasada, no un blanco móvil.
- **Tocar `DOMAIN_STATUS`** o agregar cualquier "fix" de status → ver §4.
- Crear cualquier clase de error nueva → ZERO clases nuevas; se reusan todas las existentes.
- Los otros módulos del épico (asistencia-reporting, grading, etc.).

## 3. Clasificación de los 41 throws

| Clase | Extends | Code | HTTP | Count | Clasificación |
|---|---|---|---|---|---|
| `ForbiddenError` | DomainError | FORBIDDEN | **403** | 22 | caller-context — reclasificación **DEFERIDA** (queda DomainError) |
| `NotFoundError` | DomainError | NOT_FOUND | 404 | 6 | intrínseco ✓ (reuso as-is) |
| `ValidationError` | DomainError | VALIDATION_ERROR | 400 | 4 | intrínseco ✓ (reuso as-is) |
| `DayNotAssignableError` | DomainError | DAY_NOT_ASSIGNABLE | 422 | 4 | intrínseco ✓ (reuso as-is) |
| `StatusNotAssignableError` | DomainError | STATUS_NOT_ASSIGNABLE | 400 | 2 | intrínseco ✓ (reuso as-is) |
| `MonthClosedError` | DomainError | MONTH_CLOSED | 409 | 2 | intrínseco ✓ (reuso as-is) |
| `PreviousMonthOpenError` | DomainError | PREVIOUS_MONTH_OPEN | 409 | 1 | intrínseco ✓ (reuso as-is) |

**Total: 41** = 22 Forbidden (caller-context, deferido) + 19 DomainError intrínsecos.

Los 19 no-Forbidden son subclases `DomainError` correctas → se reusan tal cual en `return err(...)`.

## 4. Nota de honestidad — NO change

Esta migración es **puro signature-honesty** (throw → Result). Se declara explícitamente:

- **NO status change**: los mismos 403/404/400/422/409 que hoy. `FORBIDDEN: 403` YA está en
  `DOMAIN_STATUS` (`exception.filter.ts:13`).
- **NO behavior change**: mismas respuestas HTTP, mismos payloads de error.
- **NO `DOMAIN_STATUS` edit**: no se toca el mapa de status ni se agrega ningún "fix". No hay bug de
  status que corregir.

El único cambio observable es de **idioma interno** (excepción → valor de retorno) y la eliminación de
código muerto en el controller.

## 5. Estrategia de tests (TDD, refactor-style)

- **Runner**: Vitest. **Comando**: `pnpm test`. **Coverage**: ≥ 80%.
- **Estilo refactor** (NO RED-first de status): como no hay cambio de comportamiento, no se escribe un
  test que falle por status. Se adaptan los tests existentes al nuevo idioma `Result`, manteniéndolos
  verdes end-to-end del slice.
- **Superficie grande**: `Result` cambia también la forma del **SUCCESS**, no solo el error-path. Hay
  ~117 `it()` (102 use-case + 15 controller); se tocan **casi todos**, no solo los 34 de error:
  - Happy-path use-case: `expect(await uc.execute()).toEqual(x)` → `.unwrap()`.
  - Error-path use-case: `expect(...).rejects.toThrow()` → `expect(result.unwrapErr()).toBeInstanceOf(...)`.
  - Controller: cada mock `UC.execute` pasa a resolver `ok(value)`.
- **Rewrites de identidad de excepción (NO bug fix)**: los tests del controller que hoy verifican
  `toBeInstanceOf(ForbiddenException)` pasan a `toBeInstanceOf(ForbiddenError)` (los 3 endpoints que se
  simplifican). El status sigue siendo 403; cambia la **identidad** de la excepción propagada porque
  desaparece el remap redundante. Esto es consecuencia mecánica del cleanup, **NO un arreglo de bug**.

## 6. Delivery — 4 chained/stacked PRs

Base: **`main`** (verificar que `attendance-type-result-migration` esté mergeado; sin changes activos).
Cada PR targetea al anterior (stacked). **Unidad atómica** = (use-case + sus tests + su(s) endpoint(s)
del controller + tests del controller) — porque `Result` cambia también el tipo de retorno del SUCCESS,
así que el call-site del controller DEBE migrarse en el mismo PR que su use-case.

| PR | Contenido | Throws | Start (dep) | End (green) | Out-of-scope |
|---|---|---|---|---|---|
| **PR1 — list pair** | `list-general-attendance` + `list-subject-attendance` + sus 2 endpoints + tests | 9 Forbidden | rama desde `main` | ambos list use-cases retornan `Result`, endpoints consumen `isErr` | record/generate/month-status; reclasificar Forbidden |
| **PR2 — record-general** | `record-general-attendance-day` + endpoint + tests | 11 | sobre PR1 | record-general en `Result` | record-subject, generate, month-status |
| **PR3 — record-subject** | `record-subject-attendance-day` (el más grande) + endpoint + tests | 15 | sobre PR2 | record-subject en `Result` | generate, month-status |
| **PR4 — generate + month-status** | widen `generate-monthly-attendance` (4 legacy) + `attendance-month-status.use-cases.ts` (3 use-cases, helper `assertCourseCycleExists`) + endpoints + tests | 6 (4+ NotFound×2) | sobre PR3 | módulo `asistencia` sin throws; los 7 endpoints uniformes | reclasificar Forbidden (épico aparte) |

**Caveat de sizing**: aún PR1 puede rozar 400 líneas por el costo del rewrite de success-shape en los
tests. `sdd-tasks` re-forecast exacto; puede requerir **subdividir PR1** (list-general solo / list-subject
solo) o `size:exception` por PR. Los límites de PR son una guía, no un contrato — se ajustan con el diff real.

## 7. Rollback

Riesgo bajo: cada PR es un cambio **aditivo/idiom-swap** (throw→Result) sin migración de datos ni de
schema. Rollback = revertir el PR; como son stacked, se revierten en orden inverso. Cero cambio de
comportamiento HTTP significa que un revert parcial no rompe contrato con el frontend.

## 8. Follow-ups

1. **Reclasificar `ForbiddenError` → `ApplicationError`** (épico cross-cutting, ~19 archivos, 8 módulos +
   4 controllers). Hacer DESPUÉS de migrar todos los módulos que lo lanzan, como rename+status-move de
   una sola pasada. Considerar consolidar con `authorization-errors.ts` (precedente del piloto users).
2. **Guards de infra** (si aplica): revisar si algún filtro/guard global asume el `try/catch` que se
   elimina en el controller (no debería, pero verificar en verify).
3. Continuar el épico con los módulos restantes (asistencia-reporting, grading, etc.).
