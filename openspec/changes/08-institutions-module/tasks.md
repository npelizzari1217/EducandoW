# Implementation Tasks — 08-institutions-module

> **Dependency rule**: read bottom-to-top. Each phase depends on the previous one being complete. Tests run after each phase.

---

## Phase 1 — Backend: Use Cases (foundation)

The controller depends on these use case signatures. Do this first.

### T1.1 ✅ — Tenant filter en `ListInstitutionsUseCase`
**Priority**: P0
**Description**: Agregar parámetro `tenantId?: string` a `execute()`. Si `tenantId` está presente, filtrar el resultado de `findAll()` para retornar solo la institución que coincide. Si no, retornar todas (ROOT).
**Archivos**:
- `api/src/application/institution/use-cases/institution.use-cases.ts` — `ListInstitutionsUseCase.execute(tenantId?)`
**Tests**:
- Unit: mock repo con 3 instituciones, llamar con `tenantId="xyz"` → solo retorna esa
- Unit: llamar sin `tenantId` → retorna todas
**Criterio de aceptación**:
- `execute()` sin args → `[inst1, inst2, inst3]`
- `execute("xyz")` → `[instXYZ]`

### T1.2 ✅ — Validación admin-own en `UpdateInstitutionUseCase`
**Priority**: P0
**Description**: Agregar parámetro `caller: { institutionId?: string; isRoot: boolean }` a `execute()`. Si `!isRoot && caller.institutionId !== id` → retornar `err(ForbiddenError)`. Si `!isRoot && input.active !== undefined` → retornar `err(ForbiddenError)` (admin no puede cambiar `active`).
**Archivos**:
- `api/src/application/institution/use-cases/institution.use-cases.ts` — `UpdateInstitutionUseCase.execute(id, input, caller)`
- `api/src/application/institution/use-cases/institution.use-cases.ts` — exportar `ForbiddenError` si no existe (verificar en `@educandow/domain`)
**Tests**:
- Unit: admin edita otra institución → 403
- Unit: admin edita su institución → 200
- Unit: admin intenta cambiar `active` → 403
- Unit: ROOT cambia `active` → 200
**Criterio de aceptación**:
- `execute("abc", {}, { institutionId: "xyz", isRoot: false })` → `err` con 403
- `execute("xyz", {}, { institutionId: "xyz", isRoot: false })` → `ok`
- `execute("xyz", { active: false }, { institutionId: "xyz", isRoot: false })` → `err` con 403

### T1.3 ✅ — Nuevo `PrintInstitutionUseCase`
**Priority**: P0
**Description**: Crear use case que recibe `id: string`, llama `repo.findById(id)`, si null → `err(NotFoundError)`, si existe → retorna `ok({ ...toResponse(inst), printed_at, printed_by })`.
**Archivos**:
- `api/src/application/institution/use-cases/institution.use-cases.ts` — nueva clase `PrintInstitutionUseCase`
**Tests**:
- Unit: id existente → `ok` con datos completos
- Unit: id inexistente → `err(NotFoundError)`
**Criterio de aceptación**:
- `execute("valid-uuid")` → `ok(PrintData)`
- `execute("nonexistent")` → `err(NotFoundError)`

---

## Phase 2 — Backend: Controller (decorators + print endpoint)

Depends on Phase 1 (use case signatures must exist first).

### T2.1 ✅ — Corregir `@Roles()` en todos los endpoints
**Priority**: P0
**Description**: Reemplazar los decoradores actuales por el patrón `@Roles('ROOT', { module: 'INSTITUTIONS', action: '...' })` según la tabla del design.md:

| Endpoint | Antes | Después |
|----------|-------|---------|
| `POST /` | `@Roles('ADMIN')` | `@Roles('ROOT', { module: 'INSTITUTIONS', action: 'CREATE' })` |
| `GET /` | `@Roles('ADMIN', 'MANAGER', 'TEACHER')` | `@Roles('ROOT', { module: 'INSTITUTIONS', action: 'READ' })` |
| `GET /:id` | `@Roles('ADMIN', 'MANAGER', 'TEACHER')` | `@Roles('ROOT', { module: 'INSTITUTIONS', action: 'READ' })` |
| `PATCH /:id` | `@Roles('ADMIN')` | `@Roles('ROOT', { module: 'INSTITUTIONS', action: 'UPDATE' })` |
| `DELETE /:id` | `@Roles('ADMIN')` | `@Roles('ROOT')` |

**Archivos**:
- `api/src/presentation/institution/institution.controller.ts`
**Tests**:
- Integration (e2e): token ADMIN → `DELETE /:id` → 403
- Integration (e2e): token ADMIN → `POST /` → 403
**Criterio de aceptación**:
- ROOT puede acceder a todos los endpoints
- ADMIN solo pasa el guard en `GET /` y `PATCH /:id` (y luego el use case valida pertenencia)

### T2.2 ✅ — Pasar contexto del caller al `UpdateInstitutionUseCase`
**Priority**: P0
**Description**: En el handler `update()`, extraer `req.user.institutionId` y `req.user.role === 'ROOT'`, pasarlos al use case como `caller`.
**Archivos**:
- `api/src/presentation/institution/institution.controller.ts` — método `update()`
**Tests**:
- Integration: ADMIN con JWT `institutionId: "xyz"` hace `PATCH /xyz` → 200
- Integration: ADMIN con JWT `institutionId: "xyz"` hace `PATCH /abc` → 403
**Criterio de aceptación**:
- El controller pasa `{ institutionId, isRoot }` al use case

### T2.3 ✅ — Pasar tenant filter al `ListInstitutionsUseCase`
**Priority**: P0
**Description**: En el handler `list()`, extraer `req.user.institutionId`. Si el usuario NO es ROOT, pasarlo al use case. Si es ROOT, pasar `undefined`.
**Archivos**:
- `api/src/presentation/institution/institution.controller.ts` — método `list()`
**Tests**:
- Integration: ROOT `GET /` → todas las instituciones
- Integration: ADMIN `GET /` → solo su institución
**Criterio de aceptación**:
- ROOT ve todas, ADMIN ve solo la suya

### T2.4 ✅ — Nuevo endpoint `GET /:id/print`
**Priority**: P0
**Description**: Agregar handler que usa `@Get(':id/print')` con `@Roles('ROOT', { module: 'INSTITUTIONS', action: 'PRINT' })`. Inyectar `PrintInstitutionUseCase` en el constructor. Retornar `{ data }` con metadata de impresión.
**Archivos**:
- `api/src/presentation/institution/institution.controller.ts` — nuevo método `print()`, agregar `printUC` en constructor
**Tests**:
- Integration: ROOT `GET /:id/print` → 200 con datos
- Integration: ADMIN `GET /:id/print` → 403
- Integration: `GET /nonexistent/print` → 404
**Criterio de aceptación**:
- Endpoint responde 200 con `{ data: { ...toResponse, printed_at, printed_by } }`
- ADMIN recibe 403

---

## Phase 3 — Backend: Seed (RBAC data)

Depends on Phase 2 (controller permissions are correct; seed must match).

### T3.1 ✅ — Corregir `r-admin` en `seed.ts`
**Priority**: P0
**Description**: `r-admin` tiene `ALL_ACTIONS` para todos sus módulos. Necesita acciones específicas para `m-inst`: `['READ', 'UPDATE']`. Para los demás módulos (`m-users`, `m-students`, `m-teachers`, `m-reports`) mantener `ALL_ACTIONS`.
**Archivos**:
- `api/prisma/seed.ts` — L76-79: cambiar la lógica para que `r-admin` use acciones específicas por módulo
**Tests**:
- Manual: correr `pnpm db:seed`, verificar en DB que `rm-r-admin-m-inst.actions = ['READ','UPDATE']`
**Criterio de aceptación**:
- `role_modules` donde `id = 'rm-r-admin-m-inst'` tiene `actions = ['READ','UPDATE']`

### T3.2 ✅ — Corregir `r-admin` en `seed-rbac.sql`
**Priority**: P0
**Description**: L50: cambiar `ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']` → `ARRAY['READ','UPDATE']`.
**Archivos**:
- `api/prisma/seed-rbac.sql` — L50
**Tests**:
- Manual: verificar que el SQL genera el mismo resultado que el seed.ts
**Criterio de aceptación**:
- `rm-r-admin-m-inst` en el SQL tiene solo `READ,UPDATE`

---

## Phase 4 — Frontend: Role conditionals + UI features

Depends on Phase 2 (backend endpoints behave correctly).

### T4.1 ✅ — Corregir condicionales de rol
**Priority**: P0
**Description**: Reemplazar `user?.role === 'ADMIN'` por `isRootOrAdmin` helper donde aplique:
- Botón "Nueva institución" (L305): solo ROOT (antes ADMIN, ahora ROOT crea)
- Botones de acción en tabla (L479-485):
  - "Editar": ROOT o ADMIN (ADMIN solo ve el de su institución — el backend ya valida)
  - "Eliminar": solo ROOT
**Archivos**:
- `web/src/pages/dashboard/institutions.tsx`
**Tests**:
- Frontend: render con user ROOT → ve "Nueva institución", "Editar", "Eliminar"
- Frontend: render con user ADMIN → ve solo "Editar"
**Criterio de aceptación**:
- ROOT ve todos los botones
- ADMIN ve solo "Editar"

### T4.2 ✅ — Botón "Imprimir"
**Priority**: P1
**Description**: Agregar botón "Imprimir" en la columna de acciones, visible solo para ROOT. Al hacer click, llamar `GET /institutions/:id/print` y abrir diálogo de impresión del navegador con los datos.
**Archivos**:
- `web/src/pages/dashboard/institutions.tsx`
**Tests**:
- Frontend: ROOT ve botón "Imprimir" en cada fila
- Frontend: ADMIN NO ve botón "Imprimir"
**Criterio de aceptación**:
- Click en "Imprimir" → abre `window.print()` con datos de la institución

### T4.3 ✅ — Modal de confirmación para delete
**Priority**: P1
**Description**: Reemplazar el `del(i.id).then(() => reload())` directo por un modal de confirmación ("¿Estás seguro de que querés eliminar esta institución?"). Solo ejecutar el delete si el usuario confirma.
**Archivos**:
- `web/src/pages/dashboard/institutions.tsx`
**Tests**:
- Frontend: click en "Eliminar" → aparece modal
- Frontend: click en "Cancelar" → no se ejecuta delete
- Frontend: click en "Confirmar" → se ejecuta delete
**Criterio de aceptación**:
- Delete requiere confirmación explícita

---

## Phase 5 — Tests & Verification

### T5.1 ✅ — Ejecutar suite completa
**Priority**: P0
**Description**: Correr `pnpm test` en el monorepo. Todos los tests existentes deben pasar. Los nuevos tests de las tareas anteriores deben estar incluidos.
**Archivos**:
- Todos los archivos de test creados en T1.1-T1.3, T2.1-T2.4, T4.1-T4.3
**Criterio de aceptación**:
- `pnpm test` → 0 failures

### T5.2 ✅ — Verificación manual de success criteria
**Priority**: P0
**Description**: Verificar cada criterio del proposal.md:
- [ ] ROOT puede listar, crear, modificar, borrar e imprimir cualquier institución
- [ ] ADMIN solo ve y modifica SU institución vía `/me`, no puede borrar ni imprimir
- [ ] `GET /institutions` sin tenant filter devuelve todas para ROOT, solo la suya para ADMIN
- [ ] `DELETE /institutions/:id` devuelve 403 para ADMIN
- [ ] Seed `r-admin` en `m-inst` solo tiene `READ,UPDATE`
- [ ] Frontend muestra botones correctos por rol
- [ ] Eliminar muestra modal de confirmación

---

## Dependency Graph

```
T1.1 (List UC) ──┐
T1.2 (Update UC)─┼──→ T2.1 (Controller @Roles) ──→ T2.2 (caller context) ──┐
T1.3 (Print UC) ─┘                                  T2.3 (tenant filter) ──┤
                                                    T2.4 (print endpoint) ─┤
                                                                           ├──→ T3.1 (seed.ts)
                                                                           ├──→ T3.2 (seed-rbac.sql)
                                                                           ├──→ T4.1 (role conditionals)
                                                                           ├──→ T4.2 (print button)
                                                                           └──→ T4.3 (delete modal)
                                                                                └──→ T5.1 (run tests)
                                                                                      └──→ T5.2 (manual verify)
```

## Effort Estimate

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| 1 — Use Cases | T1.1, T1.2, T1.3 | ~45 min |
| 2 — Controller | T2.1, T2.2, T2.3, T2.4 | ~30 min |
| 3 — Seed | T3.1, T3.2 | ~10 min |
| 4 — Frontend | T4.1, T4.2, T4.3 | ~40 min |
| 5 — Verify | T5.1, T5.2 | ~15 min |
| **Total** | | **~2.5 hrs** |
