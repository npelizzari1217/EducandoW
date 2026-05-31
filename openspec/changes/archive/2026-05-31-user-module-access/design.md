# Design: Asignación Directa de Módulos a Usuarios

## Technical Approach

Añadir `moduleAccess` al flujo create/update de usuarios, filtrando contra `creatorModules` del JWT para no-ROOT. Exponer GET /modules con `actions` como catálogo público autenticado. Frontend: grid módulo×acción, modules disponibles vía auth context.

## Architecture Decisions

| Decision | Options | Tradeoffs | Verdict |
|---|---|---|---|
| `@Roles` en ModulesController | A: Mover `@Roles('ROOT')` a métodos excepto GET. B: `@Roles()` vacío en GET + `@UseGuards(AuthGuard)` local. | A es más idiomático NestJS; B duplica decoradores. | **A** — class-level solo `@UseGuards`, `@Roles` por método. |
| Persistencia `user_modules` | A: Transacción Prisma (`$transaction`). B: Bulk secuencial (`deleteMany` → `createMany`). | A es atómico pero overkill para bulk ops idempotentes; B es más simple y suficiente porque el bloque es secuencial de todas formas. | **B** — `deleteMany` + `createMany` secuencial. Rollback natural si falla create. |
| Exponer `modules` al frontend | A: Login ya incluye `modules` en respuesta. Solo ampliar auth context. B: Endpoint separado `/users/me/modules`. | A es gratis (login ya los devuelve); B agrega latencia. | **A** — extender `User` en auth-context.tsx con `modules?: ModuleAccess[]`. |
| Grid filtrado no-ROOT | A: Backend devuelve solo módulos del creador. B: GET /modules devuelve el catálogo completo, frontend filtra con `user.modules`. | A duplica lógica de filtrado backend; B mantiene endpoint simple, frontend decide qué mostrar. | **B** — GET /modules es catálogo; frontend cruza con `user.modules`. |
| `filterModuleAccess` como función pura | A: Dentro del use case. B: Función exportable en `application/users/`. | A acopla lógica al use case; B permite test unitario aislado y reúso en create y update. | **B** — `api/src/application/users/filter-module-access.ts`, test unitario. |

## Data Flow

```
POST /v1/users { ..., moduleAccess: [...] }
  │
  ▼
UsersController.create()
  │ req.user.modules ← JWT (AuthGuard)
  ▼
CreateUserUseCase.execute({ creatorModules, moduleAccess, ... })
  │
  ├─ isRoot? → NO filtering
  └─ !isRoot? → filterModuleAccess(requested, creatorModules)
                 │ intersect moduleCode & actions
                 ▼
  ├─ client.user.create(...)
  ├─ client.userRole.createMany(...)
  └─ client.userModule.deleteMany({ userId })  ← si moduleAccess !== undefined
     client.userModule.createMany({ data: [...] })

Login subsequente → PrismaUserRepository.toDomain() → user_modules mergea
  → JWT incluye modules → frontend auth context tiene user.modules
```

```
GET /v1/modules  (cualquier autenticado)
  │
  ▼
ModulesController.list() → ListModulesUseCase.execute()
  │ include: { moduleActions: true }  ← NUEVO
  ▼
{ data: [{ code, name, actions: ["READ","CREATE",...] }, ...] }
  │
  ▼ Frontend
users.tsx → useApiList('/modules')
  │ isRoot? → muestra todos
  └─ !isRoot? → filtra con user.modules
     ▼
ModuleAccessGrid: rows=filteredModules, cols=5 acciones
  │ onSubmit
  ▼
{ moduleAccess: [{ moduleCode: "USERS", actions: ["READ"] }] }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/src/presentation/modules/modules.controller.ts` | Modify | `@Roles('ROOT')` movido a Post/Patch/Delete; GET con solo AuthGuard |
| `api/src/application/modules/use-cases/modules.use-cases.ts` | Modify | `ListModulesUseCase` agrega `include: { moduleActions: true }`, retorna `actions` |
| `api/src/application/users/filter-module-access.ts` | Create | `filterModuleAccess(requested, creator): ModuleAccess[]` — intersección de módulos y acciones |
| `api/src/application/users/use-cases/users.use-cases.ts` | Modify | Create/Update reciben `moduleAccess` + `creatorModules`, filtran si !isRoot, persisten vía deleteMany+createMany |
| `api/src/presentation/users/users.controller.ts` | Modify | `create()` y `update()` extraen `creatorModules` del JWT |
| `web/src/context/auth-context.tsx` | Modify | Agrega `modules` a interfaz `User` (login ya los devuelve) |
| `web/src/pages/dashboard/users.tsx` | Modify | Fetch `/modules`, renderiza `ModuleAccessGrid`, serializa `moduleAccess` en submit |
| `web/src/components/users/module-access-grid.tsx` | Create | Checkbox grid módulo×acción: rows=módulos disponibles, cols=5 acciones |

## Interfaces / Contracts

```typescript
// Ya existe en DTOs (create-user.dto.ts)
interface ModuleAccessItem {
  moduleCode: string;
  actions: string[];
}

// Nueva función pura — api/src/application/users/filter-module-access.ts
function filterModuleAccess(
  requested: ModuleAccessItem[],
  creatorModules: ModuleAccessItem[]
): ModuleAccessItem[]

// Nuevo tipo de respuesta para GET /modules
interface ModuleResponse {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  actions: string[];  // NUEVO — códigos de module_actions
}
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `filterModuleAccess()` | Vitest: intersección, subset vacío, ROOT bypass, filtrado de actions |
| Integration | `CreateUserUseCase` + moduleAccess | Prisma en memoria: crear user + userModule, verificar login incluye modules |
| Integration | `UpdateUserUseCase` reemplazo | Verificar deleteMany + createMany según moduleAccess recibido |
| Integration | `GET /v1/modules` con actions | Supertest: respuesta incluye `actions` array con 5 acciones |
| E2E Frontend | Grid módulo×acción | Playwright: checkear checkboxes, verificar serialización en submit |
| Unit Frontend | `ModuleAccessGrid` render | Vitest + testing-library: verificar checkboxes y onChange con datos mock |

## Migration / Rollout

No migration required — tabla `user_modules` ya existe. Rollback: revertir cambios de archivos listados arriba. Datos residuales en `user_modules` son inocuos (el merge en `toDomain` sigue funcionando).

## Open Questions

None.
