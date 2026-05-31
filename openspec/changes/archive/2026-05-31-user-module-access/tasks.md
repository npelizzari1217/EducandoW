# Tasks: Asignación Directa de Módulos a Usuarios

## T1 — Crear `filter-module-access.ts` (función pura)

**Archivo**: `api/src/application/users/filter-module-access.ts`

Función pura que filtra `moduleAccess` contra los módulos del creador. Intersección de módulos y acciones.

```typescript
function filterModuleAccess(
  requested: ModuleAccessItem[],
  creatorModules: ModuleAccessItem[]
): ModuleAccessItem[]
```

- Solo incluye módulos donde `moduleCode` existe en creatorModules
- Solo incluye acciones presentes en el módulo del creador
- Si creatorModules es undefined/null → devuelve array vacío (no-ROOT sin permisos)
- Si requested es undefined/null → devuelve []

**Dependencias**: ninguna  
**Estimación**: 15 min

---

## T2 — Modificar `modules.controller.ts`: relajar GET /modules

**Archivo**: `api/src/presentation/modules/modules.controller.ts`

- Mover `@Roles('ROOT', ...)` del class-level a cada método excepto GET
- GET `/modules` solo requiere `@UseGuards(AuthGuard)` (sin @Roles)
- POST/PATCH/DELETE mantienen `@Roles('ROOT', ...)`

**Dependencias**: ninguna  
**Estimación**: 10 min

---

## T3 — Modificar `ListModulesUseCase`: incluir acciones

**Archivo**: `api/src/application/modules/use-cases/modules.use-cases.ts`

- Agregar `include: { moduleActions: { select: { action: true } } }` al findMany
- Mapear respuesta para incluir array `actions` con códigos (READ, CREATE, etc.)
- Filtrar solo módulos activos y no eliminados

**Dependencias**: T2  
**Estimación**: 15 min

---

## T4 — Modificar `users.controller.ts`: pasar creatorModules

**Archivo**: `api/src/presentation/users/users.controller.ts`

- Agregar método `getCreatorModules(req)` que extrae `user?.modules` del JWT
- Pasar `creatorModules` a `CreateUserUseCase.execute()` y `UpdateUserUseCase.execute()`
- Pasar `moduleAccess` del body a ambos use cases

**Dependencias**: T1  
**Estimación**: 10 min

---

## T5 — Modificar `CreateUserUseCase`: aceptar moduleAccess

**Archivo**: `api/src/application/users/use-cases/users.use-cases.ts`

- Agregar `moduleAccess` y `creatorModules` al input interface
- Si `moduleAccess` viene definido:
  - Si no es ROOT: `filtered = filterModuleAccess(moduleAccess, creatorModules)`
  - Si es ROOT: `filtered = moduleAccess`
  - Después de crear el usuario: `createMany` en `userModule` con los módulos filtrados
  - Mappear `moduleCode` a `moduleId` buscando en la tabla `module`

**Dependencias**: T1, T4  
**Estimación**: 25 min

---

## T6 — Modificar `UpdateUserUseCase`: aceptar moduleAccess

**Archivo**: `api/src/application/users/use-cases/users.use-cases.ts`

- Agregar `moduleAccess` y `creatorModules` a los parámetros
- Si `moduleAccess !== undefined`:
  - Mismo filtrado que en create
  - `deleteMany` de user_modules existentes
  - `createMany` con los nuevos (filtrados)
- Si `moduleAccess === undefined`: no tocar user_modules

**Dependencias**: T1, T4  
**Estimación**: 20 min

---

## T7 — Extender `auth-context.tsx`: exponer modules ✅

**Archivo**: `web/src/context/auth-context.tsx`

- [x] Agregar `modules?: { moduleCode: string; actions: string[] }[]` a la interfaz `User`
- [x] El login ya devuelve `modules` en la respuesta — solo propagarlo al contexto

**Dependencias**: ninguna  
**Estimación**: 10 min

---

## T8 — Crear `module-access-grid.tsx` ✅

**Archivo**: `web/src/components/users/module-access-grid.tsx`

- [x] Componente React con props: `availableModules`, `value`, `onChange`
- [x] Grid: filas = módulos, columnas = READ | CREATE | UPDATE | DELETE | PRINT
- [x] Checkboxes por celda con toggle y serialización a `ModuleAccessItem[]`
- [x] Si un módulo tiene al menos una acción checked, se incluye en el output
- [x] Estilos inline con CSS variables consistentes con users.tsx

**Dependencias**: ninguna  
**Estimación**: 30 min

---

## T9 — Integrar ModuleAccessGrid en `users.tsx` ✅

**Archivo**: `web/src/pages/dashboard/users.tsx`

- [x] Fetch de `GET /modules` al montar: `useApiList('/modules', {})`
- [x] Para no-ROOT: filtrar módulos disponibles con `user.modules`
- [x] Renderizar `<ModuleAccessGrid>` debajo de los radio buttons de roles
- [x] En `handleCreate`: serializar `moduleAccess` del grid
- [x] En `handleUpdate`: serializar `moduleAccess` del grid
- [x] En `startEdit`: precargar módulos del usuario editado (compatible con backend futuro)
- [x] En `resetForm`: limpiar `moduleAccess`

**Dependencias**: T7, T8  
**Estimación**: 35 min

---

## T10 — Verificar build y tests

- `pnpm turbo run build --filter=api` — sin errores
- `pnpm turbo run build --filter=web` — sin errores
- `pnpm turbo run test --filter=api` — 136 tests pasan
- `pnpm turbo run test --filter=@educandow/domain` — 500 tests pasan

**Dependencias**: T1-T9  
**Estimación**: 5 min

---

## Resumen

| ID | Tarea | Est. | Deps |
|----|-------|------|------|
| T1 | filter-module-access.ts | 15m | — |
| T2 | modules.controller.ts | 10m | — |
| T3 | ListModulesUseCase | 15m | T2 |
| T4 | users.controller.ts | 10m | T1 |
| T5 | CreateUserUseCase | 25m | T1, T4 |
| T6 | UpdateUserUseCase | 20m | T1, T4 |
| T7 | auth-context.tsx | 10m | — |
| T8 | module-access-grid.tsx | 30m | — |
| T9 | users.tsx | 35m | T7, T8 |
| T10 | Verificar build + tests | 5m | T1-T9 |

**Total estimado**: ~2h 55m
