# Apply Plan: Asignación Directa de Módulos a Usuarios

> **Change**: `user-module-access`
> **TDD Mode**: ACTIVE (`rules.apply.tdd: true` en config.yaml)
> **Total tasks**: 10 | **Estimado total**: ~2h 55m

---

## 1. Dependency Graph

```
T1 ──────────────────────────┐
(filter-module-access.ts)      │
                               ├──► T4 ──┬──► T5 ──────────────────┐
                               │          │   (CreateUserUseCase)   │
                               │          │                         │
T2 ──► T3                     │          └──► T6 ──────────────────┤
(controller) (listUC)          │              (UpdateUserUseCase)    │
                               │                                    ├──► T10
T7 ──┬                        │                                    │   (verify)
(auth-context) │                        │                                    │
     ├──► T9 ◄─────────────────────────────────────────────────────┘
     │   (users.tsx)                                                  │
T8 ──┘                                                                  │
(module-access-grid)                                                │
                                                                      │
  Leyenda:                                                            │
  ──►  depende de                                                    │
  Paralelas: {T1,T2,T7,T8} → {T3,T4} → {T5,T6} → {T9} → {T10}     │
```

### Capacidades paralelas

| Capa | Grupo | Tareas | Paralelismo |
|------|-------|--------|-------------|
| Backend Foundation | G1 | T1, T2 | Simultáneo |
| Frontend Foundation | G1 | T7, T8 | Simultáneo con backend |
| Backend Integration | G2 | T3, T4 | Simultáneo (T3→T2, T4→T1) |
| Backend Core | G3 | T5, T6 | Simultáneo (ambas→T1+T4) |
| Frontend Integration | G4 | T9 | Secuencial (→T7+T8) |
| Verification | G5 | T10 | Secuencial (→todo) |

---

## 2. Execution Order

### Phase 1 — Foundation (paralelo)

| Ord | ID | Tarea | Archivo | Est. |
|-----|----|-------|---------|------|
| 1a | T1 | Crear `filter-module-access.ts` | `api/src/application/users/filter-module-access.ts` | 15m |
| 1b | T2 | Relajar GET /modules @Roles | `api/src/presentation/modules/modules.controller.ts` | 10m |
| 1c | T7 | Exponer `modules` en auth context | `web/src/context/auth-context.tsx` | 10m |
| 1d | T8 | Crear `module-access-grid.tsx` | `web/src/components/users/module-access-grid.tsx` | 30m |

**Verification checkpoint CK1** después de Phase 1:
- `filter-module-access.ts` compila, test unitario pasa (TDD: RED → GREEN → REFACTOR)
- `GET /v1/modules` sigue siendo accesible (T2 no rompió POST/PATCH/DELETE)
- Auth context carga sin errores de tipo

### Phase 2 — Backend Integration

| Ord | ID | Tarea | Archivo | Est. |
|-----|----|-------|---------|------|
| 2a | T3 | ListModulesUseCase + actions | `api/src/application/modules/use-cases/modules.use-cases.ts` | 15m |
| 2b | T4 | users.controller: pasar creatorModules | `api/src/presentation/users/users.controller.ts` | 10m |

**Verification checkpoint CK2**:
- `GET /v1/modules` devuelve `actions: ["READ","CREATE","UPDATE","DELETE","PRINT"]` por módulo
- Controller pasa `moduleAccess` y `creatorModules` al use case (sin persistir todavía)

### Phase 3 — Backend Core

| Ord | ID | Tarea | Archivo | Est. |
|-----|----|-------|---------|------|
| 3a | T5 | CreateUserUseCase: moduleAccess | `api/src/application/users/use-cases/users.use-cases.ts` | 25m |
| 3b | T6 | UpdateUserUseCase: moduleAccess | `api/src/application/users/use-cases/users.use-cases.ts` | 20m |

**Verification checkpoint CK3**:
- API tests pasan: crear usuario con `moduleAccess` persiste en `user_modules`
- API tests pasan: actualizar usuario con `moduleAccess` reemplaza `user_modules`
- API tests pasan: filtrado funciona (no-ROOT no asigna módulos no poseídos)
- API tests pasan: `moduleAccess: []` limpia, ausencia no toca
- Test count: 136 (api)

### Phase 4 — Frontend Integration

| Ord | ID | Tarea | Archivo | Est. |
|-----|----|-------|---------|------|
| 4 | T9 | Integrar ModuleAccessGrid en users.tsx | `web/src/pages/dashboard/users.tsx` | 35m |

**Verification checkpoint CK4**:
- Grid visible debajo de radio buttons de roles
- ROOT ve todos los módulos, no-ROOT solo los que posee
- `handleCreate` serializa `moduleAccess` del grid al body
- `handleUpdate` precarga `moduleAccess` existente (fetch `user_modules` o del row)
- `startEdit` restaura checkboxes del usuario editado

### Phase 5 — Final Verification

| Ord | ID | Tarea | Est. |
|-----|----|-------|------|
| 5 | T10 | Verificar build + tests completos | 5m |

---

## 3. Risk Assessment per Task

| ID | Riesgo | Probabilidad | Impacto | Justificación | Mitigación |
|----|--------|:-----------:|:-------:|--------------|------------|
| T1 | **Low** | Baja | Bajo | Función pura, sin efectos laterales, input/output determinista. | Test unitario exhaustivo (intersección, vacío, null, ROOT bypass, acciones filtradas). |
| T2 | **Medium** | Media | Medio | Cambia el guard de autorización de un endpoint público. Si `@UseGuards(AuthGuard)` queda mal puesto, POST/PATCH/DELETE quedan expuestos sin @Roles. | Verificar que cada método POST/PATCH/DELETE tiene su propio `@Roles('ROOT',...)`. Test de integración: no-ROOT intenta POST → 403. |
| T3 | **Low** | Baja | Bajo | Cambio aditivo: agrega `include` al findMany. No modifica lógica de negocio existente. | Test de integración: respuesta incluye campo `actions`. |
| T4 | **Medium** | Media | Medio | Punto de entrada al use case. Si `getCreatorModules` no extrae bien del JWT, el filtrado falla silenciosamente. | Verificar estructura del `req.user` (AuthGuard populate). Test de integración: request autenticado con JWT que incluye `modules`. |
| T5 | **High** | Media | Alto | Modifica el flujo de creación de usuarios. Si el upsert de `user_modules` falla, el usuario se crea sin permisos. Si el `moduleCode`→`moduleId` falla, hay FK violation. | Test de integración con Prisma en memoria. Verificar que: (a) create user + moduleAccess = user_modules persistido, (b) login subsiguiente incluye módulos en JWT. |
| T6 | **High** | Media | Alto | Modifica el flujo de actualización. `deleteMany` + `createMany` no es atómico. Si `deleteMany` borra y `createMany` falla, usuario queda sin `user_modules`. | Orden: deleteMany PRIMERO, createMany después. Si createMany falla → error se propaga al controller, usuario no recibe confirmación de éxito. Test de integración: verificar reemplazo completo y edge cases (vacío, ausente). |
| T7 | **Low** | Muy baja | Bajo | Campo aditivo en interfaz. Login ya devuelve `modules` — solo hay que propagarlo. | Verificar que `localStorage.getItem('user')` incluye `modules` después del login. Test de renderizado de auth context. |
| T8 | **Medium** | Media | Medio | Componente nuevo con estado complejo (matriz módulo×acción). Posible bug: no limpiar módulo sin acciones checked del output. | Test unitario con testing-library: verificar onChange con datos mock, checkboxes toggle correcto, módulos sin acciones no aparecen en output. |
| T9 | **High** | Media | Alto | Punto de integración completo. Múltiples fuentes de datos (auth context, API modules, form state). Riesgo de deserialización incorrecta: backend recibe `moduleAccess` pero frontend no lo serializó bien. | E2E con Playwright: crear usuario con módulos, verificar que aparecen en tabla. Editar usuario, cambiar módulos, verificar persistencia. |
| T10 | **Low** | Muy baja | Bajo | Solo ejecución de comandos. | `pnpm turbo run build --filter=api --filter=web && pnpm turbo run test --filter=api --filter=@educandow/domain` |

### Heatmap

```
Impacto
  Alto  │          T5  T6       T9
        │
  Medio │          T2  T4       T8
        │
  Bajo  │  T1  T3  T7          T10
        └──────────────────────────────
           Baja    Media    Alta
                  Probabilidad
```

Tareas **High** (T5, T6, T9) requieren verificación exhaustiva antes de marcar completadas.

---

## 4. Rollback Strategy

### Per-Task Rollback

| ID | Revertir | Procedimiento |
|----|----------|---------------|
| T1 | Eliminar archivo | `rm api/src/application/users/filter-module-access.ts`. Si T5/T6 ya lo importan → deshacer T5/T6 primero. |
| T2 | Restaurar class-level @Roles | Re-añadir `@Roles('ROOT')` al decorador de clase. Quitar `@Roles()` de cada método POST/PATCH/DELETE (si se agregaron). GET queda sin @Roles → con AuthGuard solamente. |
| T3 | Revertir include | Quitar `include: { moduleActions: ... }` del findMany. Eliminar mapeo de `actions` en el return. |
| T4 | Quitar extracción | Eliminar `creatorModules` y `moduleAccess` de los parámetros pasados a `createUC.execute()` y `updateUC.execute()`. |
| T5 | Quitar bloque moduleAccess | Eliminar el bloque de filtrado + persistencia de `user_modules` en `CreateUserUseCase.execute()`. Restaurar firma original del input type. |
| T6 | Quitar bloque moduleAccess | Eliminar el bloque de deleteMany + createMany en `UpdateUserUseCase.execute()`. Restaurar firma original. |
| T7 | Quitar campo | Eliminar `modules` de la interfaz `User`. Ningún otro código dependía de este campo. |
| T8 | Eliminar archivo | `rm web/src/components/users/module-access-grid.tsx`. Si T9 lo importa → deshacer T9 primero. |
| T9 | Revertir integración | Eliminar fetch de `/modules`, import de `ModuleAccessGrid`, serialización de `moduleAccess` en `handleCreate`/`handleUpdate`. Restaurar versión previa de `users.tsx`. |
| T10 | N/A | Solo ejecuta comandos de build/test. No modifica archivos. |

### Rollback Completo (emergencia)

Si la feature entera debe revertirse en producción:

```bash
# 1. Revertir commits en orden inverso (T9 → T1)
git revert <commit-T9> <commit-T8> <commit-T7> ... <commit-T1>

# 2. Datos residuales en user_modules
# No se eliminan — son inocuos. El merge en PrismaUserRepository.toDomain()
# sigue funcionando con o sin user_modules.
# Para limpiar si se desea:
# DELETE FROM user_modules WHERE userId IN (...usuarios creados durante la feature...);
```

**Nota**: Los datos en `user_modules` creados durante la feature son inofensivos si se revierte el código — `toDomain()` hace merge con `role_modules`, así que sin el endpoint que escribe `user_modules`, el sistema sigue funcionando solo con roles.

### Puntos de no retorno

| Después de | ¿Reversible sin pérdida de datos? |
|------------|----------------------------------|
| T1-T3 | Totalmente. Solo código, sin datos. |
| T4-T6 | Sí. `user_modules` puede tener entradas residuales → inocuas. Revertir código es suficiente. |
| T7-T9 | Sí. Código frontend. API sigue intacta. |
| T10 | N/A — solo verificación. |

---

## 5. Verification Checkpoints

Cada checkpoint mapea a escenarios de spec. Marcar como `[x]` solo cuando el escenario pase.

### CK1 — Foundation (después de T1+T2+T7+T8)

- [ ] **T1 unit test**: `filterModuleAccess` pasa todos los casos (intersección, vacío, null, acciones filtradas)
- [ ] **T2 no regresión**: `POST /v1/modules` sin ROOT → 403 Forbidden
- [ ] **T2 no regresión**: `PATCH /v1/modules/:id` sin ROOT → 403 Forbidden
- [ ] **T2 no regresión**: `DELETE /v1/modules/:id` sin ROOT → 403 Forbidden
- [ ] **T7 tipo**: `User` interface incluye `modules?: { moduleCode: string; actions: string[] }[]`
- [ ] **T7 render**: AuthProvider se monta sin errores de tipo
- [ ] **T8 render**: ModuleAccessGrid se monta con props válidas, muestra checkboxes

### CK2 — Backend Integration (después de T3+T4)

- [ ] **T3 spec: system-modules-crud / Authenticated user lists modules with actions**
  - `GET /v1/modules` con JWT válido → 200, cada entry tiene `actions: string[]`
- [ ] **T3 spec: system-modules-crud / Module actions populated from module_actions**
  - Módulo USERS incluye `actions: ["READ","CREATE","UPDATE","DELETE","PRINT"]`
- [ ] **T3 spec: system-modules-crud / Soft-deleted modules excluded**
  - Módulos con `active: false` y `deletedAt` no aparecen
- [ ] **T3 spec: system-modules-crud / Unauthenticated request rejected**
  - Sin JWT → 401
- [ ] **T4 wiring**: Controller extrae `moduleAccess` del body y `creatorModules` del JWT

### CK3 — Backend Core (después de T5+T6)

- [ ] **T5 spec: user-management / Create with moduleAccess persists user_modules**
  - ROOT crea usuario con `moduleAccess: [{ moduleCode: "STUDENTS", actions: ["READ","CREATE"] }]` → `user_modules` tiene las entradas
- [ ] **T5 spec: user-management / Create with moduleAccess filters unauthorized modules**
  - DIRECTOR con [USERS, STUDENTS] crea usuario con [USERS, GRADES] → solo USERS persiste
- [ ] **T5 spec: user-module-access / Non-ROOT assigns only owned modules**
  - SECRETARIO con [USERS, STUDENTS, ENROLLMENTS] intenta asignar GRADES → filtrado silencioso
- [ ] **T5 spec: auth-access / ROOT assigns any module without filtering**
  - ROOT asigna cualquier módulo → todos persisten
- [ ] **T5 spec: user-module-access / Empty moduleAccess clears all user_modules**
  - `moduleAccess: []` → `user_modules` del usuario vacío
- [ ] **T5 spec: user-module-access / Absent moduleAccess preserves existing**
  - Request sin `moduleAccess` → no toca `user_modules`
- [ ] **T6 spec: user-management / Update with moduleAccess replaces user_modules**
  - Usuario con [USERS:READ, STUDENTS:CREATE] → PATCH con `moduleAccess: [{GRADES:READ}]` → solo GRADES:READ queda
- [ ] **T6 spec: user-management / Update without moduleAccess preserves existing**
  - PATCH sin `moduleAccess` → `user_modules` sin cambios
- [ ] **Login post-create**: usuario creado con `moduleAccess` → login incluye esos módulos en JWT `modules` claim

### CK4 — Frontend Integration (después de T9)

- [ ] **T9 spec: user-module-access / ROOT sees all modules in grid**
  - ROOT en formulario → grid muestra todos los módulos (típicamente 10)
- [ ] **T9 spec: user-module-access / Non-ROOT sees only owned modules**
  - SECRETARIO con [USERS, STUDENTS, ENROLLMENTS] → grid solo muestra esas 3 filas
- [ ] **T9 spec: user-module-access / Grid serializes to moduleAccess**
  - Check READ + UPDATE en STUDENTS → submit envía `moduleAccess: [{ moduleCode: "STUDENTS", actions: ["READ","UPDATE"] }]`
- [ ] **T9 create flow**: crear usuario con módulos → aparece en tabla, login funciona con módulos
- [ ] **T9 edit flow**: editar usuario → grid precarga módulos existentes, cambiar módulos → persiste
- [ ] **T9 no regresión**: crear/editar usuario sin tocar módulos → `moduleAccess` no se envía, `user_modules` sin cambios

### CK5 — Final (T10)

- [ ] **Build API**: `pnpm turbo run build --filter=api` → sin errores
- [ ] **Build Web**: `pnpm turbo run build --filter=web` → sin errores
- [ ] **Tests API**: `pnpm turbo run test --filter=api` → 136 tests pasan
- [ ] **Tests Domain**: `pnpm turbo run test --filter=@educandow/domain` → 500 tests pasan
- [ ] **E2E smoke**: crear usuario con módulos → login → ver JWT incluye módulos → editar módulos → login refleja cambios

### Coverage Target

| Capa | Threshold | Comando |
|------|-----------|---------|
| domain | 80% | `pnpm turbo run test --filter=@educandow/domain` |
| api | 80% | `pnpm turbo run test --filter=api` |
| web | — | (build pasa) |

---

## 6. TDD Cycle Plan

> **Strict TDD activo** (`rules.apply.tdd: true`). Cada tarea de implementación DEBE seguir RED → GREEN → REFACTOR.

### TDD por tarea

| ID | RED (test first) | GREEN (implement) | REFACTOR |
|----|-----------------|-------------------|----------|
| T1 | `filter-module-access.spec.ts`: intersección, vacío, null, acciones filtradas, ROOT bypass | `filter-module-access.ts`: función pura que pasa tests | Extraer tipos, simplificar lógica |
| T2 | Test de integración: GET /modules sin ROOT → 200, POST sin ROOT → 403 | Mover @Roles a métodos | Limpiar imports sin uso |
| T3 | Test de integración: GET /modules incluye actions array | Agregar include + mapping en ListModulesUseCase | DRY en mapeo si es necesario |
| T4 | Test de integración: request con JWT que incluye modules → controller pasa creatorModules | Agregar getCreatorModules() y pasar params | N/A (cambio mínimo) |
| T5 | Test de integración: crear usuario con moduleAccess → user_modules persistido. Non-ROOT filtrado | Bloque de filtrado + createMany en CreateUserUseCase | Refactor: extraer lógica de persistencia de user_modules a helper |
| T6 | Test de integración: update reemplaza user_modules, vacío limpia, ausente no toca | Bloque deleteMany + createMany en UpdateUserUseCase | Reutilizar helper de T5 |
| T7 | Test de render: AuthContext.User tiene modules | Agregar campo a interfaz User | N/A |
| T8 | Test de componente: checkboxes toggle, onChange con datos mock, módulos sin acciones no aparecen | Componente ModuleAccessGrid | Extraer hook useModuleAccessGrid |
| T9 | E2E Playwright: crear usuario con módulos, ver grid, editar | Integrar grid en users.tsx | Simplificar lógica de filtrado |

### TDD Evidence Table (a llenar durante apply)

| Task | RED (test) | GREEN (impl) | REFACTOR | Status |
|------|:----------:|:------------:|:--------:|:------:|
| T1 | [ ] | [ ] | [ ] | pending |
| T2 | [ ] | [ ] | [ ] | pending |
| T3 | [ ] | [ ] | [ ] | pending |
| T4 | [ ] | [ ] | [ ] | pending |
| T5 | [ ] | [ ] | [ ] | pending |
| T6 | [ ] | [ ] | [ ] | pending |
| T7 | [ ] | [ ] | [ ] | pending |
| T8 | [ ] | [ ] | [ ] | pending |
| T9 | [ ] | [ ] | [ ] | pending |
| T10 | — | — | — | verify only |

---

## 7. Review Workload Forecast

| Métrica | Valor |
|---------|-------|
| Líneas estimadas (total) | ~350-450 |
| Archivos modificados | 6 |
| Archivos creados | 2 |
| ¿Chained PRs? | **Posible**. Si excede 400 líneas → dividir en 2 PRs: Backend (T1-T6) + Frontend (T7-T9) |
| Chain strategy | `stacked-to-main` si se divide |
| PR #1 (backend) | T1-T6 | ~200-250 líneas |
| PR #2 (frontend) | T7-T9 | ~150-200 líneas |
