# Design: Corrección de permisos y completitud del módulo Instituciones

## Technical Approach

Alinear los `@Roles` del controller con el patrón `@Roles('ROOT', { module, action })` usado en `users.controller` para aprovechar el bypass de ROOT en `RolesGuard` (L40-42). Agregar filtro por tenant en el use case de listado, validación de pertenencia en update, y nuevo endpoint print. Todo en capa presentation/application, sin modificar dominio ni repositorio.

## Architecture Decisions

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Decorators | `@Roles('ROOT')` solamente | `@Roles('ROOT', { module:'INSTITUTIONS', action:'READ' })` | **B** | ROOT bypass por rol, otros roles validan por module+action. Consistente con `users.controller`. |
| Tenant filter en list | Nuevo método en `InstitutionRepository` | Filtrar en el use case tras `findAll()` | **B** | Evita contaminar la interfaz de dominio con concerns de autorización. Aceptable para baja cardinalidad de instituciones. |
| Print endpoint | Soft-delete con `GET /institutions/:id/print` | `POST /institutions/:id/print` | **A** | GET es idempotente semánticamente; solo retorna datos, no muta. |
| Validación active en PATCH | En controller (detecta campo `active` en body) | En use case (recibe `callerRole`) | **B** | La lógica de dominio pertenece al use case. Controller solo pasa contexto del request. |
| Admin-own en update | Filtrar en controller comparando `req.user.institutionId` con `:id` | Pasar `callerInstitutionId` al use case | **B** | El use case valida pertenencia — la capa presentation no debería tomar decisiones de autorización de dominio. |

## Data Flow

```
ROOT crea institución:
  POST /institutions  ──→ RolesGuard(ROOT bypass) ──→ CreateInstitutionUseCase ──→ InstitutionRepository.save()
                                                                                         │
                                                                                  Prisma (master DB)

ADMIN edita su institución:
  PATCH /institutions/:id ──→ RolesGuard(check INSTITUTIONS:UPDATE)
       │                            │
       req.user.institutionId ──────┘
       │
       └──→ UpdateInstitutionUseCase.execute(id, input, callerInstitutionId)
                │
                ├── ¿id === callerInstitutionId? → No → 403
                ├── ¿input.active? → Sí → 403 (solo ROOT)
                └──→ InstitutionRepository.update()

ROOT imprime:
  GET /institutions/:id/print ──→ RolesGuard(ROOT bypass | INSTITUTIONS:PRINT)
       │
       └──→ PrintInstitutionUseCase.execute(id) ──→ InstitutionRepository.findById()
                └── toResponse() + { printed_at, printed_by }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/src/presentation/institution/institution.controller.ts` | Modify | Corregir todos los `@Roles()`, agregar endpoint `GET /:id/print` |
| `api/src/application/institution/use-cases/institution.use-cases.ts` | Modify | Tenant filter en `ListInstitutionsUseCase`, validación admin-own en `UpdateInstitutionUseCase`, nuevo `PrintInstitutionUseCase` |
| `api/prisma/seed.ts` | Modify | `r-admin` en `m-inst`: `ALL_ACTIONS` → `['READ','UPDATE']` |
| `api/prisma/seed-rbac.sql` | Modify | L50: actions de `rm-r-admin-m-inst` → `ARRAY['READ','UPDATE']` |
| `web/src/pages/dashboard/institutions.tsx` | Modify | Cambiar condicionales de `user?.role === 'ADMIN'` a `user?.role === 'ROOT' \|\| user?.role === 'ADMIN'`; agregar botón Imprimir y modal de confirmación para delete |

## Interfaces / Contracts

### Controller — nuevos decorators

```typescript
// POST — solo ROOT con INSTITUTIONS:CREATE
@Post()
@Roles('ROOT', { module: 'INSTITUTIONS', action: 'CREATE' })

// GET / — ROOT o cualquier rol con INSTITUTIONS:READ
@Get()
@Roles('ROOT', { module: 'INSTITUTIONS', action: 'READ' })

// GET /:id — ROOT o INSTITUTIONS:READ
@Get(':id')
@Roles('ROOT', { module: 'INSTITUTIONS', action: 'READ' })

// PATCH /:id — ROOT o INSTITUTIONS:UPDATE; el use case valida pertenencia para ADMIN
@Patch(':id')
@Roles('ROOT', { module: 'INSTITUTIONS', action: 'UPDATE' })

// DELETE /:id — solo ROOT (no module-action, porque ADMIN no debe poder ni por permiso)
@Delete(':id')
@Roles('ROOT')

// GET /:id/print — ROOT o INSTITUTIONS:PRINT
@Get(':id/print')
@Roles('ROOT', { module: 'INSTITUTIONS', action: 'PRINT' })
```

### Use case signatures (nuevos parámetros)

```typescript
// ListInstitutionsUseCase — ahora recibe institutionId opcional
async execute(tenantId?: string): Promise<Institution[]>

// UpdateInstitutionUseCase — recibe contexto del caller
async execute(
  id: string,
  input: UpdateInstitutionInput,
  caller: { institutionId?: string; isRoot: boolean }
): Promise<Result<Institution, ValidationError | NotFoundError>>

// PrintInstitutionUseCase — nuevo
async execute(id: string): Promise<Result<PrintData, NotFoundError>>
```

### Print response

`GET /:id/print` → 200 con `{ data: { ...toResponse(inst), printed_at, printed_by } }` — misma estructura que el GET normal + metadata de impresión.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (use case) | `ListInstitutionsUseCase` filtra por `tenantId` | Mock repo, verificar que solo retorna institución del tenant |
| Unit (use case) | `UpdateInstitutionUseCase` rechaza admin editando otra institución | Mock repo, llamar con `caller.institutionId !== id` → 403 |
| Unit (use case) | `UpdateInstitutionUseCase` rechaza admin cambiando `active` | Mock repo, input con `active: false`, caller no-root → 403 |
| Unit (use case) | `PrintInstitutionUseCase` retorna 404 para id inexistente | Mock repo retorna null |
| Integration (e2e) | `DELETE` con token ADMIN → 403 | Supertest con JWT admin |
| Integration (e2e) | `GET /:id/print` con token ADMIN → 403 | Supertest con JWT admin |
| Frontend | Botón Imprimir visible solo para ROOT | Renderizar componente con user ROOT vs ADMIN |

## Migration / Rollout

No migration required. El seed usa `upsert` — las instalaciones existentes necesitan correr manualmente:
```sql
UPDATE role_modules SET actions = ARRAY['READ','UPDATE'] WHERE id = 'rm-r-admin-m-inst';
```
Rollback: revertir commit. Cambios son aditivos (print endpoint) y correctivos (permisos).

## Open Questions

- [ ] ¿El print endpoint debe devolver HTML formateado o JSON crudo? La propuesta indica JSON; confirmar si a futuro se necesita template HTML.
