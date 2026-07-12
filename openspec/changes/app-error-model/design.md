# Design: app-error-model

## 1. Ubicación de archivos (nuevos)

```
api/src/application/shared/errors/application-error.ts       (nuevo)
api/src/application/shared/errors/authorization-errors.ts     (nuevo)
```

Un solo archivo `application-error.ts` para la base (AEM-R1) y un segundo `authorization-errors.ts`
co-located en el mismo directorio para las 2 subclases (AEM-R3) — separa "contrato base" de
"catálogo de errores concretos", mismo criterio que domain usa (`domain-error.ts` vs
`shared/errors/validation-error.ts`, `auth/errors/user.errors.ts`).

### 1.1 `application-error.ts`

```ts
export abstract class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 422,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

Nota: `this.name = this.constructor.name` replica el patrón de `DomainError` (no el de
`AsistenciaReportingError`, que hardcodea `this.name`) — con clases concretas por subclase,
`constructor.name` da el nombre real (`InsufficientRoleHierarchyError`, etc.), más útil en logs/stack.

### 1.2 `authorization-errors.ts`

```ts
import { ApplicationError } from './application-error';

export class InsufficientRoleHierarchyError extends ApplicationError {
  constructor(message: string) {
    super(message, 'INSUFFICIENT_ROLE_HIERARCHY', 403);
  }
}

export class CrossInstitutionForbiddenError extends ApplicationError {
  constructor(message: string) {
    super(message, 'CROSS_INSTITUTION_FORBIDDEN', 403);
  }
}
```

## 2. Rama del filter (AEM-R2)

`api/src/presentation/shared/filters/exception.filter.ts` — el `catch()` actual encadena
`HttpException → DomainError → Error` (líneas 75-96 hoy). Insertar la rama `ApplicationError`
INMEDIATAMENTE DESPUÉS del bloque `HttpException` y ANTES del bloque `DomainError` (el orden entre
`HttpException` y `ApplicationError` es irrelevante — no hay overlap de tipos — pero debe ir antes
de `DomainError` y del fallback `Error`, por spec AEM-R2):

```ts
    } else if (exception instanceof ApplicationError) {
      status = exception.httpStatus;
      message = exception.message;
      code = exception.code;
    } else if (exception instanceof DomainError) {
```

Import nuevo: `import { ApplicationError } from '../../../application/shared/errors/application-error';`
(junto al `import { DomainError } from '@educandow/domain';` existente en la línea 3).

## 3. `users.use-cases.ts` — los 9 throws, antes/después

| # | Línea hoy | Método | Antes | Después |
|---|---|---|---|---|
| 1 | 205 | `CreateUserUseCase.execute` | `if (existing) throw new EmailAlreadyExistsError(input.email);` | `if (existing) return err(new EmailAlreadyExistsError(input.email));` |
| 2 | 211 | `CreateUserUseCase.execute` | `throw new Error('No tenés jerarquía suficiente para crear...')` | `return err(new InsufficientRoleHierarchyError('No tenés jerarquía suficiente para crear un usuario con estos roles. Solo podés asignar roles de jerarquía igual o inferior al tuyo.'))` |
| 3 | 241 | `CreateUserUseCase.execute` | `if (validationResult.isErr()) { throw validationResult.unwrapErr(); }` | `if (validationResult.isErr()) { return err(validationResult.unwrapErr()); }` |
| 4 | 420 | `UpdateUserUseCase.execute` | `throw new Error('No podés modificar usuarios de otra institución.')` | `return err(new CrossInstitutionForbiddenError('No podés modificar usuarios de otra institución.'))` |
| 5 | 428 | `UpdateUserUseCase.execute` | `throw new Error('No tenés jerarquía suficiente para modificar este usuario...')` | `return err(new InsufficientRoleHierarchyError('No tenés jerarquía suficiente para modificar este usuario. Solo podés gestionar usuarios con roles de jerarquía inferior al tuyo.'))` |
| 6 | 437 | `UpdateUserUseCase.execute` | `throw new Error('No podés asignar roles de jerarquía superior a la tuya.')` | `return err(new InsufficientRoleHierarchyError('No podés asignar roles de jerarquía superior a la tuya.'))` |
| 7 | 446 | `UpdateUserUseCase.execute` | `if (conflict) throw new EmailAlreadyExistsError(input.email);` | `if (conflict) return err(new EmailAlreadyExistsError(input.email));` |
| 8 | 492 | `UpdateUserUseCase.execute` | `if (validationResult.isErr()) { throw validationResult.unwrapErr(); }` | `if (validationResult.isErr()) { return err(validationResult.unwrapErr()); }` |
| 9 | 629 | `DeleteUserUseCase.execute` | `throw new Error('No tenés jerarquía suficiente para eliminar este usuario.')` | `return err(new InsufficientRoleHierarchyError('No tenés jerarquía suficiente para eliminar este usuario.'))` |

`err(...)` y `ok(...)` ya están importados en el archivo (línea 4). Se agrega el import de
`InsufficientRoleHierarchyError, CrossInstitutionForbiddenError` desde
`../../shared/errors/authorization-errors`.

### 3.1 Firmas nuevas por método

**`CreateUserUseCase.execute`** — hoy `async execute(input): Promise<{ data: ... }>` (implícito, sin
tipo declarado). Pasa a:

```ts
async execute(input: {...}):
  Promise<Result<{ data: ReturnType<typeof userToResponse> }, EmailAlreadyExistsError | InsufficientRoleHierarchyError | ValidationError>>
```

Cada `return { data: ... }` de éxito (línea 371 hoy) pasa a `return ok({ data: userToResponse(final as UserRow) });`.

**`UpdateUserUseCase.execute`** — mismo patrón:

```ts
async execute(id, input, creatorRoles, creatorInstitutionId?, creatorModules?):
  Promise<Result<{ data: ReturnType<typeof userToResponse> | null }, EmailAlreadyExistsError | CrossInstitutionForbiddenError | InsufficientRoleHierarchyError | ValidationError>>
```

El caso `if (!existing) return { data: null };` (línea 416, hoy "no encontrado" silencioso, NO es un
error hoy) se mantiene como camino OK: `return ok({ data: null });` — no está en el scope de
AEM-R4 convertirlo en error (el proposal no lo menciona como uno de los 9 throws; cambiar su
semántica sería un cambio de comportamiento no pedido). El éxito final (línea 606) pasa a
`return ok({ data: userToResponse(updated as UserRow) });`.

**`DeleteUserUseCase.execute`** — ver §4.

## 4. `DeleteUserUseCase` — resolución del riesgo 3 (spec)

Hoy: `async execute(id, creatorRoles): Promise<boolean>` — `false` = "no encontrado" (silencioso,
NO throw), `true` = eliminado con éxito. El controller (línea 116 `users.controller.ts`) ya
IGNORA el valor de retorno (`await this.deleteUC.execute(...); return;` — el endpoint es
`@HttpCode(HttpStatus.NO_CONTENT)`, no hay body). El booleano no tiene consumidor real hoy.

**Decisión: `Promise<Result<void, InsufficientRoleHierarchyError>>`**, no `Result<boolean, E>`.
Razón: el `boolean` de retorno nunca se usó para ramificar en el controller — es vestigial. El
patrón hermano ya establecido en el codebase (`attendance-type.controller.ts` L129-136,
`deleteUC.execute` → `Result<void, E>` → `if (isErr) throw unwrapErr(); return;`) es exactamente
este shape. Usar `void` evita que el próximo desarrollador crea que el `boolean` importa (YAGNI) y
alinea el use-case con el idiom ya usado 23+ veces.

```ts
async execute(id: string, creatorRoles: string[]): Promise<Result<void, InsufficientRoleHierarchyError>> {
  const client = this.prisma.getMasterClient();
  const isRoot = creatorRoles.includes('ROOT');

  const existing = await client.user.findUnique({
    where: { id },
    include: { userRoles: { include: { role: true } } },
  });
  if (!existing) return ok(undefined);   // no encontrado → no-op idempotente (comportamiento hoy: false, sin error)

  const targetRoles = (existing.userRoles ?? []).map((ur) => ur.role.name);
  if (!isRoot && !canManageUser(creatorRoles, targetRoles)) {
    return err(new InsufficientRoleHierarchyError('No tenés jerarquía suficiente para eliminar este usuario.'));
  }

  await client.user.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
  return ok(undefined);
}
```

Controller (`users.controller.ts` L112-118):

```ts
@Delete(':id')
@Roles('ROOT', { module: 'USERS', action: 'DELETE' })
@HttpCode(HttpStatus.NO_CONTENT)
async delete(@Req() req: Request, @Param('id') id: string) {
  const result = await this.deleteUC.execute(id, this.getCreatorRoles(req));
  if (result.isErr()) throw result.unwrapErr();
  return;
}
```

## 5. Los 4 throws domain (L205/446 EmailAlreadyExistsError, L241/492 re-throw de Result interno)

L205 y L446 son directos: `throw new X(...)` → `return err(new X(...))` (ver tabla §3, filas 1 y 7).

L241 y L492 son un caso distinto: **hoy es un re-throw de un `Result` YA COMPUTADO
internamente** (`validateLevelsSubset` devuelve `Result<void, ValidationError>`; el use-case
llama `.unwrapErr()` sobre ese resultado y lo tira). No hay que construir un error nuevo — el
`ValidationError` ya existe dentro de `validationResult`. El cambio es puramente de propagación,
NO de construcción:

```ts
// Antes (L239-243 / L490-494)
if (validationResult.isErr()) {
  throw validationResult.unwrapErr();
}

// Después
if (validationResult.isErr()) {
  return err(validationResult.unwrapErr());
}
```

`validationResult.unwrapErr()` sigue devolviendo el mismo `ValidationError` — solo cambia el
verbo (`return err(...)` en vez de `throw`). Esto es la instancia MÁS SIMPLE de todo el design: el
`Result` interno ya modelaba el fallo, el `throw` era el único punto no-Result del flujo.

## 6. Controllers — inserción del idiom, confirmación "sin try/catch"

**Confirmado** (releído `users.controller.ts` completo, líneas 1-119): NINGÚN método (`create`,
`update`, `delete`, `list`) tiene `try/catch`. Los 3 métodos afectados simplemente hacen
`return this.xUC.execute(...)` (create/update) o `await this.deleteUC.execute(...); return;`
(delete) sin envoltorio. Esto reconfirma lo que el proposal ya había verificado: no hay
interceptor local que altere `status` antes de llegar al `AppExceptionFilter` global — el filter
es la única capa de mapeo error→HTTP para estos 3 endpoints.

| Endpoint | Línea hoy | Después |
|---|---|---|
| `POST /users` (`create`) | 81: `return this.createUC.execute({...});` | `const result = await this.createUC.execute({...}); if (result.isErr()) throw result.unwrapErr(); return result.unwrap();` |
| `PATCH /users/:id` (`update`) | 109: `return this.updateUC.execute(id, body, ...);` | `const result = await this.updateUC.execute(id, body, ...); if (result.isErr()) throw result.unwrapErr(); return result.unwrap();` |
| `DELETE /users/:id` (`delete`) | 115-118 (ver §4) | ver snippet §4 |

Nota: `create`/`update` ya tenían `return this.xUC.execute(...)` SIN `await` explícito (NestJS
resuelve la Promise del controller method automáticamente) — al introducir la rama `isErr()` hace
falta `await` explícito porque ahora se inspecciona el `Result` antes de devolver.

## 7. Orden TDD (RED antes de GREEN, por capa)

1. **`application-error.ts`** — test unitario: subclase concreta de prueba (`class TestError extends ApplicationError`) → verifica `message`/`code`/`httpStatus` (explícito y default 422) + `instanceof DomainError === false` (AEM-R1, 3 scenarios). RED: el archivo no existe. GREEN: crear la clase.
2. **`authorization-errors.ts`** — test unitario: `new InsufficientRoleHierarchyError('msg')` → `code === 'INSUFFICIENT_ROLE_HIERARCHY'`, `httpStatus === 403`; ídem `CrossInstitutionForbiddenError` (AEM-R3, 2 scenarios). RED → GREEN.
3. **Filter branch** — test sobre `AppExceptionFilter.catch()`: stub de `ApplicationError` concreto (403) → responde `{status:403, code, message}`, NO cae en fallback 500; y test de regresión que confirma `DomainError` sigue mapeando igual (AEM-R2, 4 scenarios). RED (branch no existe, cae a `instanceof Error` → 500) → GREEN (insertar rama).
4. **Use-cases** (`users.use-cases.ts`) — por cada uno de los 9 sites, test que fuerza la
   condición de fallo y verifica `isErr()` + `unwrapErr() instanceof X` + `code` (AEM-R4, AEM-R5).
   Incluye explícitamente:
   - Los 5 tests de "denegación → 403, no 500" (AEM-R5) — estos son el corazón de la corrección
     de comportamiento; deben fallar en RED contra el código actual (que da 500) y pasar en GREEN.
   - Tests de regresión "no rompas ROOT bypass" y "paths autorizados siguen OK" (AEM-R6): ROOT
     bypassea todo, caller con jerarquía suficiente sigue en `isOk()`, update misma institución no
     da `CrossInstitutionForbiddenError`.
   - Si existe algún test previo que asuma `500` para estas 5 condiciones, ACTUALIZARLO a `403`
     en este mismo paso (AEM-R6 / R5 scenario "Regression").
5. **Controllers** (`users.controller.ts`) — tests de integración/e2e (si existen para estos
   endpoints) o unitarios de controller: verifican que `isErr()` propaga como `throw` y que el
   status HTTP final es el correcto (403/409/400 según código) vía el filter real o un stub.

Cada paso se commitea solo tras ver el RED fallar por la razón esperada (no por error de tipeo) y
luego el GREEN pasar. No se escribe código de producción antes que su test.

## 8. Estimación por archivo (líneas netas, add+mod)

| Archivo | Tipo | Líneas est. |
|---|---|---|
| `application/shared/errors/application-error.ts` | nuevo | ~12 |
| `application/shared/errors/authorization-errors.ts` | nuevo | ~16 |
| `application/shared/errors/__tests__/application-error.test.ts` | nuevo (test) | ~35 |
| `application/shared/errors/__tests__/authorization-errors.test.ts` | nuevo (test) | ~25 |
| `presentation/shared/filters/exception.filter.ts` | mod | ~8 |
| `presentation/shared/filters/__tests__/exception.filter.test.ts` (o donde viva su suite) | mod | ~30 |
| `application/users/use-cases/users.use-cases.ts` | mod | ~40 (firmas + 9 sites + imports) |
| `application/users/use-cases/__tests__/users.use-cases.test.ts` (o equivalente) | mod/nuevo | ~120 (9 casos de error + regresión 500→403 + ROOT bypass + paths autorizados) |
| `presentation/users/users.controller.ts` | mod | ~10 |
| `presentation/users/__tests__/users.controller.test.ts` (si existe suite de integración) | mod | ~20 |

**Total estimado: ~316 líneas** — dentro del presupuesto <400 declarado en el proposal (~200-300
+ margen de tests, que suelen pesar más de lo estimado). Un solo PR, sin `size:exception`, sin
chained PRs.

## 9. Fuera de scope (recordatorio, no re-litigar)

`materia-grupo-ciclo` (MGC-R4 nuevo DomainError + 16 throws), `asistencia` (41), `course-cycle`
(17), `attendance-type` (5), `reportes`/`reporting`/`attendance-type-pdf` (post-#111), 2 guards de
infra mal tipados, helper compartido `unwrapOrThrow`. El módulo `auth` (login/token) NO se toca.
