# Proposal: Migrar Institution a 25 campos multi-tenant

## Intent

Convertir el módulo Institutions actual (5 campos en DB monolítica) en la **raíz multi-tenant completa** del sistema: 25 campos con branding, SMTP, notificaciones y creación automatizada de tenant DBs.

## Scope

### In Scope

- **25 campos** en master DB: identificación, contacto, SMTP, branding, notificaciones, config, tenant
- **Schema Prisma separado**: `schema_master.prisma` (institutions + users + refresh_tokens) y `schema_tenant.prisma` (11 tablas pedagógicas)
- **PrismaService dinámico**: factory con `Map<dbName, PrismaClient>` que resuelve conexión por JWT
- **Tenant DB creation**: `POST /institutions` crea DB `educandow_{id}` + corre migrations
- **`GET /institutions/me`**: configuración completa de la institución desde el JWT
- **InstitutionContext** en React: carga config al login, expone colores/logo/flags
- **Tema dinámico**: CSS variables desde `header_color`, `text_color`
- **Soft-delete**: `active=false` en vez de DELETE duro, bloqueo de sesión (R15)
- **Niveles activos**: filtrar sidebar por `levels[]`
- **Feature flags**: `send_email`/`send_messages` activan o desactivan funcionalidad
- **15 reglas de arquitectura** (R1-R15): todas verificables al final

### Out of Scope

- Eliminar `institutionId` de las 11 tablas tenant (se hará progresivamente — no bloquea el core)
- Migrar datos existentes (no hay producción)
- Módulos 02-PlanDeEstudios o superiores
- Tests e2e de creación de DB (requieren infraestructura real — solo unitarios + integración mockeada)

## Capabilities

### New Capabilities

- `institution-branding`: Logo, colores de header/texto, tema dinámico por institución
- `institution-smtp`: Config SMTP encriptada por institución con toggle send_email
- `institution-notifications`: Toggle send_messages + socket_host/port
- `tenant-database`: Creación automática de tenant DB al crear institución (R10)
- `multi-tenant-routing`: PrismaService dinámico que resuelve conexión por dbName del JWT (R4, R7)
- `session-config`: GET /institutions/me que devuelve config completa al login (R11)
- `institution-lifecycle`: Soft-delete con active=false y bloqueo de sesión (R9, R15)

### Modified Capabilities

_Ninguna_ — este es el primer spec formal del módulo.

## Approach

Implementación incremental por **feature slices** — cada slice es autónomo, testeable y mergeable:

| # | Slice | Prioridad | Depende de | Qué entrega |
|---|-------|-----------|------------|-------------|
| 1 | **Schema + Domain** | P0 | — | Separar `schema_master.prisma`, entidad 25 campos, `InstitutionRepository` actualizado |
| 2 | **Multi-tenant infra** | P0 | Slice 1 | `PrismaService` dinámico, tenant DB creation en `POST /institutions`, `dbName` en JWT |
| 3 | **Branding + SMTP** | P1 | Slices 1, 2 | Campos de branding/SMTP en DTOs + endpoints, encriptación AES-256 de `smtp_pass` |
| 4 | **Session & frontend** | P1 | Slice 3 | `GET /institutions/me`, `InstitutionContext`, carga al login |
| 5 | **Theming & flags** | P2 | Slice 4 | CSS variables dinámicas, sidebar filtrado por `levels[]`, feature flags en UI |

## Affected Areas

| Area | Impact | Descripción |
|------|--------|-------------|
| `api/prisma/schema.prisma` | Split | → `schema_master.prisma` + `schema_tenant.prisma` |
| `packages/domain/src/institution/entities/institution.ts` | Modified | 25 campos + Value Objects nuevos |
| `packages/domain/src/institution/repositories/institution-repository.ts` | Modified | Agregar findByCue, softDelete |
| `packages/domain/src/institution/value-objects/` | New | `Cue`, `MinistryReg`, `SmtpConfig`, `Branding`, `HexColor` |
| `api/src/presentation/institution/dto/` | Modified | DTO completo con 25 campos |
| `api/src/presentation/institution/institution.controller.ts` | Modified | Agregar GET /me, cambiar DELETE → soft-delete |
| `api/src/application/institution/use-cases/` | Modified | `CreateInstitutionUseCase` crea tenant DB |
| `api/src/infrastructure/persistence/prisma/prisma.service.ts` | Modified | Singleton → Factory con Map de clientes |
| `api/src/infrastructure/auth/jwt.strategy.ts` | Modified | Agregar `dbName` al payload |
| `api/src/infrastructure/auth/tenant.middleware.ts` | New | Extrae dbName del JWT y setea PrismaService |
| `web/src/context/institution-context.tsx` | New | Contexto React con config de institución |
| `web/src/hooks/use-theme.ts` | New | Hook que aplica CSS variables desde InstitutionContext |
| `web/src/components/layout/sidebar.tsx` | Modified | Filtrar niveles por `levels[]` |
| `web/src/pages/dashboard/institutions.tsx` | Modified | Formulario ampliado con branding + SMTP |

## Risks

| # | Riesgo | Prob. | Mitigación |
|---|--------|-------|------------|
| R1 | Prisma no soporta multi-datasource dinámico nativamente | High | Factory con `Map<string, PrismaClient>`, lazy init por request. Cada cliente usa su propia DATABASE_URL runtime |
| R2 | Creación de tenant DB falla y deja estado inconsistente | High | Transacción atómica: master DB write + DB create + migrations. Rollback en catch |
| R3 | Migraciones desincronizadas entre tenants | Med | Script `migrate-all-tenants` que itera todas las DBs. CI validación |
| R4 | `smtp_pass` en texto plano en memoria | Med | AES-256-GCM con key de environment. Desencriptar solo al usar |
| R5 | `active=false` rompe sesiones activas | Med | Middleware de tenant verifica `active` en cada request. Si false → 403 con motivo |
| R6 | JWT payload crece demasiado con `dbName` | Low | Solo agregar `dbName: string` — 20-30 bytes extra. Irrelevante |
| R7 | Conflicto con código existente que usa `PrismaService` como singleton | High | Migración progresiva: primero factory con fallback al singleton, luego todos los repos usan la nueva API |
| R8 | Cambios en schema Prisma requieren regenerar client | Low | Documentar `prisma generate` post-migration. CI lo ejecuta automáticamente |

## Rollback Plan

1. **Schema**: El schema original está en git. Revertir `schema.prisma` a versión pre-split. Las tenant DBs creadas se ignoran (no hay datos en producción).
2. **PrismaService**: El factory se envuelve en feature flag. `PrismaService.getClient()` → si no hay dbName, usa comportamiento legacy.
3. **Endpoints**: Los endpoints nuevos (`/me`) se agregan — no rompen los existentes. Si falla, eliminar el endpoint del controller.
4. **Frontend**: `InstitutionContext` es opcional. Si falla, el provider devuelve defaults y la UI funciona sin branding.

**Revert completo**: `git revert` del merge commit + eliminar tenant DBs creadas manualmente.

## Dependencies

- Módulo 00-Auth: JWT debe incluir `dbName` y `institutionId` (ya parcialmente listo)
- PostgreSQL con permisos CREATEDB para el usuario de la app
- Variables de entorno: `ENCRYPTION_KEY` (32 bytes para AES-256), `MASTER_DATABASE_URL`

## Success Criteria

- [ ] `schema_master.prisma` tiene `Institution` con los 25 campos del diseño
- [ ] `POST /v1/institutions` crea tenant DB + corre migrations + devuelve 201
- [ ] `GET /v1/institutions/me` devuelve config completa (branding, flags, niveles) desde el JWT
- [ ] `DELETE /v1/institutions/:id` hace soft-delete (`active=false`) — no borra la DB
- [ ] Sesión con `active=false` recibe 403 aunque las credenciales sean válidas
- [ ] `InstitutionContext` carga al login y expone `logo_url`, `header_color`, `levels[]`
- [ ] Sidebar muestra solo niveles de `levels[]`
- [ ] `send_email=false` oculta sección de email en UI
- [ ] `send_messages=false` no inicia conexión WebSocket
- [ ] 15 reglas de arquitectura (R1-R15) pasan verificación
- [ ] Cobertura de tests ≥ 80% en el módulo
