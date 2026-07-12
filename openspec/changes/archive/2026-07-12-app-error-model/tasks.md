# Tasks: app-error-model

Fuente: `specs/spec.md` (AEM-R1..R6) + `design.md` (tabla de 9 throws, orden TDD §7).
Orden: base → clases concretas → filter → use-cases (por método) → controllers, TDD estricto
(RED antes de GREEN, test primero, tests van con el código en el mismo work unit — no en
commits separados).

## Confirmación de rutas de test (obligatoria antes de escribir tasks)

Verificado con `Glob`/`Grep` sobre el repo real (no se asume `use-cases/__tests__/` como decía el design):

- Tests de `users.use-cases.ts` viven en **`api/src/application/users/__tests__/users.use-cases.test.ts`**
  (un nivel arriba de `use-cases/`, NO en `use-cases/__tests__/`). Hoy solo cubre
  `userToResponse`, `validateLevelsSubset` y `ListUsersUseCase` — **no existe ningún test de
  `CreateUserUseCase`, `UpdateUserUseCase` ni `DeleteUserUseCase`** (grep sin matches). Consecuencia:
  la escena de regresión AEM-R5.S6 ("tests preexistentes que asuman 500 deben pasar a 403") **NO
  aplica** — no hay ningún test previo que assertee 500 en estos casos porque no hay tests previos
  de estos casos en absoluto. Se crean tests nuevos directamente en 403 (sin paso de "corregir
  assertion vieja").
- Tests del filter viven en **`api/src/presentation/shared/filters/__tests__/exception.filter.spec.ts`**
  (extensión `.spec.ts`, no `.test.ts` — el design usaba el nombre genérico). Sigue el patrón
  `describe('AppExceptionFilter')` + `makeMockHost()` ya establecido — se reutiliza.
- **No existe ningún test de `users.controller.ts`** (`Grep` sobre `presentation/users/` y sobre
  todo `api/src` para `UsersController` en archivos `*.test.ts`/`*.spec.ts`: sin matches). Se crea
  `api/src/presentation/users/__tests__/users.controller.test.ts` nuevo (unitario, casos de uso
  mockeados) — es la única forma de cubrir el nuevo idiom `isErr() → throw` en la capa controller
  bajo TDD estricto, ya que no hay suite existente que extender.

## Checklist

### Work unit 1 — `ApplicationError` base (AEM-R1)

- [x] 1.1 Test RED: `api/src/application/shared/errors/__tests__/application-error.test.ts` (nuevo).
      Subclase de prueba `class TestError extends ApplicationError` (no exportada, local al test).
      Casos: (a) `message`/`code`/`httpStatus` explícito quedan seteados en la instancia — AEM-R1.S1;
      (b) `httpStatus` default `422` si el subclass no lo pasa a `super()` — AEM-R1.S2; (c)
      `instance instanceof DomainError === false` — AEM-R1.S3. Correr `pnpm --filter api test` y
      confirmar RED por "module not found" (el archivo de producción no existe).
- [x] 1.2 Código GREEN: `api/src/application/shared/errors/application-error.ts` (nuevo).
      `abstract class ApplicationError extends Error` con `constructor(message, code, httpStatus = 422)`,
      `code`/`httpStatus` readonly, `this.name = this.constructor.name` (igual patrón que `DomainError`).
      Correr tests, confirmar GREEN.

### Work unit 2 — Clases concretas de autorización (AEM-R3)

- [x] 2.1 Test RED: `api/src/application/shared/errors/__tests__/authorization-errors.test.ts` (nuevo).
      `new InsufficientRoleHierarchyError('msg')` → `code === 'INSUFFICIENT_ROLE_HIERARCHY'`,
      `httpStatus === 403`, `message === 'msg'` — AEM-R3.S1. Ídem `CrossInstitutionForbiddenError`
      → `code === 'CROSS_INSTITUTION_FORBIDDEN'`, `httpStatus === 403` — AEM-R3.S2. RED por
      "module not found".
- [x] 2.2 Código GREEN: `api/src/application/shared/errors/authorization-errors.ts` (nuevo).
      Ambas clases `extends ApplicationError`, `code`/`httpStatus` fijos, `message` pass-through
      al `super()`. GREEN.

### Work unit 3 — Rama `ApplicationError` en el filter (AEM-R2)

- [x] 3.1 Test RED: agregar casos a `api/src/presentation/shared/filters/__tests__/exception.filter.spec.ts`
      (archivo existente). Nuevo `describe('AEM-R2: ApplicationError branch')`: (a) instancia stub
      `instanceof ApplicationError` con `httpStatus=403, code='SOME_CODE'` → response
      `{status:403, code:'SOME_CODE', message}` — AEM-R2.S1; (b) mismo stub → `status !== 500`
      (no cae al fallback genérico) — AEM-R2.S2; (c) regresión: un `DomainError` existente
      (ya cubierto arriba, p. ej. `NotFoundError`) sigue mapeando igual que antes — AEM-R2.S3
      (puede ser assertion adicional sobre un test ya existente, no hace falta duplicar). RED:
      hoy el stub cae en `instanceof Error` → `status` queda en 500 default, test falla por eso
      (no por typo).
- [x] 3.2 Código GREEN: `api/src/presentation/shared/filters/exception.filter.ts` (mod).
      Import `ApplicationError` desde `../../../application/shared/errors/application-error`.
      Insertar `else if (exception instanceof ApplicationError) { status = exception.httpStatus;
      message = exception.message; code = exception.code; }` INMEDIATAMENTE DESPUÉS del bloque
      `HttpException` y ANTES del bloque `DomainError`. GREEN.

### Work unit 4 — `CreateUserUseCase` → Result (AEM-R4 sites #1/#2/#3, AEM-R5, AEM-R6)

- [x] 4.1 Test RED: agregar a `api/src/application/users/__tests__/users.use-cases.test.ts`
      nuevo `describe('CreateUserUseCase')`. Casos:
      - `isErr()` true + `unwrapErr() instanceof InsufficientRoleHierarchyError` cuando el caller
        no tiene jerarquía suficiente para los roles pedidos — AEM-R4.S1.
      - Response HTTP no es parte de este test (es unitario de use-case), pero el `code` de la
        instancia debe ser `INSUFFICIENT_ROLE_HIERARCHY` — sienta la base de AEM-R5.S1 (la
        confirmación end-to-end 403 va en WU7, controller).
      - `isErr()` true + `unwrapErr() instanceof EmailAlreadyExistsError` cuando el email ya
        existe — AEM-R4.S6 (rama domain, sitio #1 de la tabla design §3).
      - `isErr()` true + `unwrapErr() instanceof ValidationError` cuando `levels` no es subconjunto
        de los niveles de la institución — AEM-R4.S6 (sitio #3).
      - Regresión: caller `ROOT` con roles de cualquier jerarquía → `isOk()` true — AEM-R6.S1.
      - Regresión: caller no-ROOT con jerarquía estrictamente suficiente → `isOk()` true — AEM-R6.S2.
      RED: hoy el método hace `throw`, no devuelve `Result` — el test falla porque no hay
      `.isErr()`/`.unwrapErr()` en lo que retorna (o porque el `throw` no capturado revienta el test).
- [x] 4.2 Código GREEN: `api/src/application/users/use-cases/users.use-cases.ts` (mod, `CreateUserUseCase.execute`).
      Firma → `Promise<Result<{ data: ... }, EmailAlreadyExistsError | InsufficientRoleHierarchyError | ValidationError>>`.
      Sitios #1 (L205), #2 (L211), #3 (L241 de la tabla design §3) pasan de `throw` a `return err(...)`.
      Éxito final pasa a `return ok({ data: ... })`. Import de `InsufficientRoleHierarchyError` desde
      `../../shared/errors/authorization-errors`. GREEN.

### Work unit 5 — `UpdateUserUseCase` → Result (AEM-R4 sites #4-#8, AEM-R5, AEM-R6)

- [x] 5.1 Test RED: agregar a `api/src/application/users/__tests__/users.use-cases.test.ts`
      nuevo `describe('UpdateUserUseCase')`. Casos:
      - `isErr()` + `unwrapErr() instanceof CrossInstitutionForbiddenError` cuando
        `creatorInstitutionId` difiere del `institutionId` del target — AEM-R4.S2 (sitio #4).
      - `isErr()` + `unwrapErr() instanceof InsufficientRoleHierarchyError` cuando el caller no
        puede gestionar al target por `canManageUser` — AEM-R4.S3 (sitio #5).
      - `isErr()` + `unwrapErr() instanceof InsufficientRoleHierarchyError` cuando el caller
        intenta asignar roles de jerarquía superior a la suya — AEM-R4.S4 (sitio #6).
      - `isErr()` + `unwrapErr() instanceof EmailAlreadyExistsError` en conflicto de email —
        AEM-R4.S6 (sitio #7).
      - `isErr()` + `unwrapErr() instanceof ValidationError` en levels inválidos — AEM-R4.S6 (sitio #8).
      - Caso "no encontrado" (`!existing`) sigue siendo camino OK con `data: null`, NO error —
        confirma que el design NO cambia esta semántica (nota design §3.1).
      - Regresión: `ROOT` bypassea todo → `isOk()` — AEM-R6.S1.
      - Regresión: jerarquía suficiente → `isOk()` — AEM-R6.S2.
      - Regresión: misma institución → el resultado NUNCA es `CrossInstitutionForbiddenError` —
        AEM-R6.S3.
      RED por la misma razón que 4.1 (throw, no Result).
- [x] 5.2 Código GREEN: `api/src/application/users/use-cases/users.use-cases.ts` (mod, `UpdateUserUseCase.execute`).
      Firma → `Promise<Result<{ data: ... | null }, EmailAlreadyExistsError | CrossInstitutionForbiddenError | InsufficientRoleHierarchyError | ValidationError>>`.
      Sitios #4 (L420, `CrossInstitutionForbiddenError`), #5 (L428), #6 (L437) (ambos
      `InsufficientRoleHierarchyError`), #7 (L446, `EmailAlreadyExistsError`), #8 (L492,
      `ValidationError` vía `err(validationResult.unwrapErr())`) pasan de `throw` a `return err(...)`.
      `!existing` → `return ok({ data: null })`. Éxito final → `return ok({ data: ... })`. Import
      `CrossInstitutionForbiddenError` desde el mismo módulo que WU4. GREEN.

### Work unit 6 — `DeleteUserUseCase` → Result (AEM-R4 site #9, AEM-R5, AEM-R6)

- [x] 6.1 Test RED: agregar a `api/src/application/users/__tests__/users.use-cases.test.ts`
      nuevo `describe('DeleteUserUseCase')`. Casos:
      - `isErr()` + `unwrapErr() instanceof InsufficientRoleHierarchyError` cuando el caller no
        puede gestionar al target por `canManageUser` — AEM-R4.S5 (sitio #9).
      - Caso "no encontrado" → `isOk()` con `ok(undefined)` (no-op idempotente, comportamiento hoy
        preservado, design §4).
      - Regresión: `ROOT` bypassea la jerarquía → `isOk()` — AEM-R6.S1.
      - Regresión: jerarquía suficiente → `isOk()` — AEM-R6.S2.
      RED: hoy retorna `Promise<boolean>` con `throw`, no `Result`.
- [x] 6.2 Código GREEN: `api/src/application/users/use-cases/users.use-cases.ts` (mod, `DeleteUserUseCase.execute`).
      Firma → `Promise<Result<void, InsufficientRoleHierarchyError>>` (decisión design §4: NO
      `Result<boolean, E>` — el booleano de retorno es vestigial, el controller ya lo ignora).
      Sitio #9 (L629) pasa de `throw` a `return err(new InsufficientRoleHierarchyError(...))`.
      `!existing` → `return ok(undefined)`. Éxito → `return ok(undefined)`. GREEN.

### Work unit 7 — Controllers `users.controller.ts` (AEM-R2/R5 end-to-end, idiom del proyecto)

- [x] 7.1 Test RED: nuevo `api/src/presentation/users/__tests__/users.controller.test.ts`.
      Unitario con los 4 use cases mockeados (`ListUsersUseCase`, `CreateUserUseCase`,
      `UpdateUserUseCase`, `DeleteUserUseCase` como mocks/stubs inyectados al controller, sin
      levantar Nest module completo — sigue el patrón unitario liviano, no e2e). Casos:
      - `create`: mock del `createUC.execute` resuelve `err(new InsufficientRoleHierarchyError(...))`
        → `controller.create(...)` DEBE lanzar (`throw`) esa misma instancia (no debe swallowear
        ni transformar) — confirma el idiom `if (isErr) throw unwrapErr()`, base de AEM-R5.S1 a
        nivel controller.
      - `create`: mock resuelve `ok({ data })` → `controller.create(...)` retorna `data` (NO el
        `Result` envolvente) — confirma `return result.unwrap()`.
      - `update`: mismo par de casos (`err(CrossInstitutionForbiddenError)` → throw; `ok` → unwrap) —
        AEM-R5.S2/S3/S5 a nivel controller.
      - `delete`: mock resuelve `err(new InsufficientRoleHierarchyError(...))` →
        `controller.delete(...)` DEBE lanzar; mock resuelve `ok(undefined)` → `controller.delete(...)`
        retorna `undefined` sin lanzar — AEM-R5.S4 a nivel controller.
      RED: hoy los 3 métodos hacen `return this.xUC.execute(...)` directo (create/update, sin
      `isErr()`) o ignoran el resultado (delete) — el mock `err(...)` no se traduce hoy en un
      `throw`, el test falla porque el controller devuelve el `Result` crudo en vez de lanzar/unwrappear.
- [x] 7.2 Código GREEN: `api/src/presentation/users/users.controller.ts` (mod).
      `create`/`update`: `const result = await this.xUC.execute(...); if (result.isErr()) throw result.unwrapErr(); return result.unwrap();`
      (agregar `await` explícito — hoy no lo tienen, hace falta para inspeccionar el `Result` antes
      de devolver, nota design §6). `delete`: `const result = await this.deleteUC.execute(...);
      if (result.isErr()) throw result.unwrapErr(); return;`. GREEN.
- [x] 7.3 Verificación manual de spec (no requiere código nuevo): correr
      `pnpm --filter api test` completo y confirmar que las 5 escenas AEM-R5 (S1-S5, denegación →
      403 no 500) están cubiertas transitivamente: use-case devuelve `ApplicationError` concreto
      (WU4-6) → controller lo relanza sin envolver (WU7) → `AppExceptionFilter` lo mapea a
      `httpStatus`/`code` (WU3). Si se quiere una prueba end-to-end explícita del filter real (no
      mockeado) contra estos 3 endpoints, evaluarlo como test adicional opcional — NO es requisito
      duro de esta fase porque ya queda cubierto por la cadena de unit tests de WU3+WU4-6+WU7
      (fuera de scope crear infraestructura e2e nueva para users, que hoy no existe).

## Work units / commits (conventional, sin atribución IA)

1. `feat(application): add ApplicationError base class` — WU1 (test + código juntos)
2. `feat(application): add InsufficientRoleHierarchyError and CrossInstitutionForbiddenError` — WU2
3. `feat(presentation): map ApplicationError to HTTP status in exception filter` — WU3
4. `refactor(application): migrate CreateUserUseCase to Result` — WU4
5. `refactor(application): migrate UpdateUserUseCase to Result` — WU5
6. `refactor(application): migrate DeleteUserUseCase to Result` — WU6
7. `refactor(presentation): adopt isErr/throw idiom in users controller` — WU7

7 work units, 7 commits. Secuenciales (cada uno depende del anterior: base → clases → filter →
use-cases → controller). No hay paralelismo real posible dentro de este scope — todas las tasks
tocan la misma cadena de archivos en orden de dependencia (el filter necesita `ApplicationError`
ya creada; los use-cases necesitan las 2 clases concretas; los controllers necesitan que los
use-cases ya devuelvan `Result`).

## Cobertura de spec (AEM-Sx → task)

| Escenario | Task |
|---|---|
| AEM-R1.S1 (subclase expone code/httpStatus/message) | 1.1 |
| AEM-R1.S2 (httpStatus default 422) | 1.1 |
| AEM-R1.S3 (no es DomainError) | 1.1 |
| AEM-R2.S1 (ApplicationError mapea su httpStatus/code) | 3.1 |
| AEM-R2.S2 (no cae al fallback genérico) | 3.1 |
| AEM-R2.S3 (DomainError sin cambios) | 3.1 |
| AEM-R3.S1 (InsufficientRoleHierarchyError code/status fijos) | 2.1 |
| AEM-R3.S2 (CrossInstitutionForbiddenError code/status fijos) | 2.1 |
| AEM-R4.S1 (Create → err jerarquía) | 4.1 |
| AEM-R4.S2 (Update → err cross-institution) | 5.1 |
| AEM-R4.S3 (Update → err jerarquía manage) | 5.1 |
| AEM-R4.S4 (Update → err jerarquía asignación roles) | 5.1 |
| AEM-R4.S5 (Delete → err jerarquía) | 6.1 |
| AEM-R4.S6 (domain errors siguen propagando vía Result) | 4.1, 5.1 |
| AEM-R5.S1 (create 403 no 500) | 4.1 (unit) + 7.1/7.3 (end-to-end) |
| AEM-R5.S2 (update target roles 403 no 500) | 5.1 + 7.1/7.3 |
| AEM-R5.S3 (update roles asignados 403 no 500) | 5.1 + 7.1/7.3 |
| AEM-R5.S4 (delete 403 no 500) | 6.1 + 7.1/7.3 |
| AEM-R5.S5 (cross-institution update 403 no 500) | 5.1 + 7.1/7.3 |
| AEM-R5.S6 (regresión tests viejos que asumían 500) | N/A — no existen tests previos de estos casos (ver confirmación de rutas arriba) |
| AEM-R6.S1 (ROOT bypass) | 4.1, 5.1, 6.1 |
| AEM-R6.S2 (jerarquía suficiente OK) | 4.1, 5.1, 6.1 |
| AEM-R6.S3 (misma institución OK) | 5.1 |
| AEM-R6.S4 (auth module intacto) | No requiere task — verificación: ningún archivo bajo `auth`/`infrastructure/auth` aparece en el diff de este change (chequeo de PR, no de test) |

## Review Workload Forecast

- Líneas estimadas: **~316** (ver design.md §8, desglose por archivo)
- Chained PRs recommended: **No**
- 400-line budget risk: **Low** (316 está ~21% bajo el límite de 400; margen razonable incluso si
  los tests nuevos de WU4-7 pesan más de lo estimado, que es el patrón usual)
- Decision needed before apply: **No**
- Delivery strategy: `ask-on-risk` (cacheada; no se dispara — no hay riesgo que preguntar)

## Fuera de scope (recordatorio)

`materia-grupo-ciclo` (MGC-R4), `asistencia`, `course-cycle`, `attendance-type`, `reportes`,
2 guards de infra, helper compartido `unwrapOrThrow`. Módulo `auth` NO se toca (WU alguno no debe
tocar archivos bajo `auth`/`infrastructure/auth`).
