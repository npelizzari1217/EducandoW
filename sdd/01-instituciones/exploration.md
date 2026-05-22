# Exploration: Módulo 01 — Instituciones (25 campos, Multi-Tenant, Branding)

> **Fecha**: 2026-05-22 | **Fase**: EXPLORE | **Agente**: sdd-explore

---

## Current State

El módulo de Instituciones está implementado con un modelo **básico de 5 campos** (name, address, phone, email, levels) sobre una arquitectura **single-database**. El diseño exige **25 campos**, arquitectura **multi-tenant database-per-tenant**, soporte de **branding dinámico**, configuración **SMTP** por institución, y **flags de notificaciones**.

### ¿Qué existe?
- **API**: 4 de 6 endpoints (falta `GET /me`, el `POST` no crea tenant DB, el `DELETE` es hard-delete)
- **Domain**: Entidad `Institution` con 5 campos (name, address, phone, email, levels)
- **Repository**: `PrismaInstitutionRepository` — mapea solo 5 campos, usa `PrismaService` single-DB
- **Frontend**: Página de listado + formulario de creación con 5 campos, sin `InstitutionContext`
- **Tests**: 4 tests de entidad + 8 tests de VO Level

### ¿Qué NO existe?
- **20 campos** del modelo de 25 están AUSENTES en schema, entidad, repositorio y DTOs
- **Arquitectura multi-tenant**: `PrismaService` es un singleton, no hay factory dinámica
- **Separación de schemas Prisma**: todo está en un solo `schema.prisma`
- **Creación de tenant DB** al crear institución (R10)
- **Endpoint `/institutions/me`** (R11)
- **InstitutionContext** en React (R11-R15)
- **Tema dinámico** con CSS variables desde colores institucionales (R12)
- **Soft-delete** (`active=false` en vez de DELETE físico)
- **Encriptación AES-256** para `smtp_pass`
- **JWT con `dbName`** — el auth context actual solo tiene `institutionId`

---

## Affected Areas (Archivo por Archivo)

### `api/prisma/schema.prisma`
- **Estado actual**: 1 schema, 11 tablas, todas con `institutionId` FK
- **Model Institution**: 7 columnas (id, name, address, phone, email, levels[], timestamps)
- **GAP**: Solo 5 de 25 campos de negocio. Faltan: city, postal_code, country, ministry_reg, cue, website, contact_email, smtp_host, smtp_user, smtp_pass, smtp_encryption, smtp_port, send_email, send_messages, logo_url, header_color, header_text_color, body_text_color, active, socket_host, socket_port, db_name
- **GAP**: No hay separación master vs tenant. Todo está en una sola DB
- **GAP**: Todas las tablas tenant tienen `institutionId` (viola R3 — "sin institutionId en tenant")
- **Riesgo**: Separar el schema rompe TODAS las relaciones y repositorios existentes

### `packages/domain/src/institution/entities/institution.ts`
- **Estado actual**: 4 campos requeridos (name, levels) + 3 opcionales (address, phone, email)
- **GAP**: Faltan 20 campos. La entidad no conoce city, postal_code, country, ministry_reg, cue, etc.
- **GAP**: No modela los grupos lógicos (SMTP como sub-entidad o value object, Branding como value object)
- **GAP**: No tiene `active` (soft-delete), `db_name` (tenant routing)
- **Nota**: El diseño no menciona `email` sino `contact_email` — posible renaming

### `packages/domain/src/institution/value-objects/level.ts`
- **Estado**: VO `Level` bien implementado con `LevelType` enum (INICIAL|PRIMARIO|SECUNDARIO|TERCIARIO)
- **OK**: Validación, equals, toString. Tests cubren todos los casos
- **GAP MENOR**: Podría necesitar `academicYear` si el array de niveles necesita año académico (`levels[]` en el diseño del README menciona año académico en el endpoint `GET :id/levels`)

### `packages/domain/src/institution/repositories/institution-repository.ts`
- **Estado actual**: 5 métodos (findById, findAll, save, delete, existsByName)
- **GAP**: Falta `existsByCue(cue)` — CUE debe ser único a nivel nacional
- **GAP**: Falta `findByDbName(dbName)` — necesario para tenant routing
- **GAP**: Falta `update(id, data)` — actualmente se usa `save()` con upsert
- **GAP**: El repositorio debería ser EXPLÍCITO que habla con la MASTER DB (no el tenant)

### `api/src/infrastructure/persistence/prisma/prisma.service.ts`
- **Estado actual**: `extends PrismaClient`, `onModuleInit()` conecta una sola DB
- **GAP CRÍTICO**: Viola R7 — debe ser un factory dinámico con `Map<dbName, PrismaClient>`
- **GAP CRÍTICO**: No resuelve cliente por request usando el `dbName` del JWT
- **Impacto**: Este es el cambio arquitectónico MÁS GRANDE. Afecta TODOS los repositorios.

### `api/src/infrastructure/persistence/prisma/repositories/prisma-institution.repository.ts`
- **Estado actual**: Usa `PrismaService` (single-DB), mapea 5 campos en `toDomain()`
- **GAP**: `toDomain()` necesita mapear 25 campos
- **GAP**: `save()` necesita persistir 25 campos
- **GAP**: Debe usar conexión a MASTER DB (no al tenant)
- **GAP**: `delete()` debería ser `softDelete()` (set `active=false`)

### `api/src/presentation/institution/institution.controller.ts`
- **Estado actual**: 4 endpoints: POST, GET (list), GET :id, DELETE :id
- **GAP**: Falta `GET /institutions/me` — endpoint MÁS IMPORTANTE para el frontend (R11)
- **GAP**: POST no crea tenant DB (R10) — es el cambio más complejo
- **GAP**: DELETE es hard-delete, debe ser soft-delete (`active=false`)
- **GAP**: Las respuestas no incluyen los 25 campos (solo 5)
- **GAP MENOR**: El controller usa `@Controller('institutions')` sin prefijo `/v1`
- **OK**: Guards `@UseGuards(AuthGuard, RolesGuard)` y `@Roles('ROOT')` en POST/DELETE

### `api/src/presentation/institution/dto/create-institution.dto.ts`
- **Estado actual**: Re-exporta `CreateInstitutionSchema` desde auth/dto/register.request.ts
- **Definición actual**: 5 campos (name, address, phone, email, levels)
- **GAP**: Faltan TODOS los campos de: ciudad, código postal, país, CUE, ministry_reg, website, SMTP (5 campos), branding (4 campos), notificaciones (2 campos), socket (2 campos), active
- **GAP**: `email` debe ser `contact_email` según el diseño
- **GAP**: No hay DTO para update de institución

### `api/src/application/institution/use-cases/institution.use-cases.ts`
- **Estado actual**: 4 use cases (Create, List, Get, Delete)
- **GAP**: `CreateInstitutionUseCase` no implementa R10 (crear DB + migrations + admin)
- **GAP**: Falta `GetInstitutionMeUseCase` — obtener config desde institutionId del JWT
- **GAP**: Falta `UpdateInstitutionUseCase` — editar config (branding, SMTP, etc.)
- **GAP**: `DeleteInstitutionUseCase` hace hard-delete, debe ser soft-delete y potencialmente desactivar tenant DB
- **GAP**: Validación de unicidad solo por `name` — debe validar `cue` UNIQUE también

### `web/src/pages/dashboard/institutions.tsx`
- **Estado actual**: Listado + formulario de creación con 5 campos
- **GAP**: Formulario solo tiene name, address, phone, email, levels (checkboxes)
- **GAP**: No incluye: datos institucionales (city, postal_code, country, CUE, ministry_reg, website)
- **GAP**: No incluye: configuración SMTP
- **GAP**: No incluye: branding (logo, colores)
- **GAP**: No incluye: flags de notificaciones (send_email, send_messages)
- **GAP**: No incluye: configuración de socket
- **GAP**: Delete es hard-delete desde la UI
- **GAP**: La tabla no muestra todos los campos relevantes
- **Nota**: La condición `user?.role === 'ADMIN'` para mostrar botones NO contempla el rol ROOT

### `web/src/context/auth-context.tsx`
- **Estado actual**: User interface con 6 campos: id, email, name, role, institutionId?, level?
- **GAP**: No incluye `dbName` — necesario para el tenant routing
- **GAP**: No carga config de institución al hacer login (R11)
- **GAP**: No expone `InstitutionContext` con colores, logo, flags de features
- **Impacto**: TODO el frontend necesita este contexto para R12-R15

### `web/` (Archivos que NO existen)
- **NO existe**: `web/src/context/institution-context.tsx` — el contexto que carga y expone la config
- **NO existe**: `web/src/hooks/use-theme.ts` — hook que aplica CSS variables desde InstitutionContext
- **NO existe**: `web/src/components/layout/institution-sidebar.tsx` — sidebar que filtra por `levels[]` y oculta features por flags

### `packages/domain/src/institution/__tests__/entities/institution.test.ts`
- **Estado actual**: 4 tests (create, hasLevel, addLevel, reconstruct)
- **GAP**: Necesita tests para TODOS los 25 campos
- **GAP**: Necesita tests para validación de CUE único, encriptación SMTP, active/inactive
- **GAP**: Necesita tests para el método `deactivate()` (soft-delete)

### `packages/domain/src/institution/__tests__/value-objects/level.test.ts`
- **Estado**: 8 tests bien estructurados con `it.each`, validación de errores
- **OK**: Cobertura completa del VO Level
- **GAP MENOR**: Podría agregar test para `toJSON()` o serialización si se necesita

---

## Gaps por Regla de Arquitectura

| Regla | Descripción | Cumple? | Gap |
|---|---|---|---|
| R1 | Master DB solo auth + institutions | ❌ | Todo está en una DB, sin separación |
| R2 | Tenant DB = 1 institución | ❌ | No existe el concepto de tenant DB |
| R3 | Sin institutionId en tenant | ❌ | Todas las tablas tienen FK a institution |
| R4 | JWT transporta el tenant (dbName) | ❌ | JWT no incluye dbName |
| R5 | Usuario = 1 institución | ✅ | User tiene institutionId FK |
| R6 | Usuario = N niveles | ❌ | Implementado parcial (level string, no array) |
| R7 | PrismaService dinámico | ❌ | Es un singleton que extiende PrismaClient |
| R8 | Migrations por tenant | ❌ | No existe creación de DBs por tenant |
| R9 | Health check → master DB | ❌ | No hay distinción master vs tenant |
| R10 | Registro = crear DB + migrations + admin | ❌ | POST solo inserta un registro |
| R11 | Institución en sesión (/me) | ❌ | Endpoint y contexto NO existen |
| R12 | Tema dinámico (CSS vars) | ❌ | No implementado |
| R13 | Features condicionales (flags) | ❌ | No existen send_email/send_messages |
| R14 | Niveles activos filtran menú | ❌ | No existe el filtro |
| R15 | Bloqueo por active=false | ❌ | No existe campo active ni lógica de rechazo |

**Total: 1 de 15 reglas cumple (R5). 14 reglas con gaps críticos.**

---

## Gaps por Campo (25 campos del diseño)

| # | Campo | Tipo | Actual? | Gap |
|---|---|---|---|---|
| 1 | name | STRING | ✅ | — |
| 2 | address | STRING? | ✅ | — |
| 3 | city | STRING? | ❌ | **NUEVO** |
| 4 | postal_code | STRING? | ❌ | **NUEVO** |
| 5 | country | STRING? | ❌ | **NUEVO** |
| 6 | ministry_reg | STRING? | ❌ | **NUEVO** |
| 7 | cue | STRING? UNIQUE | ❌ | **NUEVO — validación de unicidad nacional** |
| 8 | phone | STRING? | ✅ | — |
| 9 | website | STRING? | ❌ | **NUEVO** |
| 10 | contact_email | STRING? | ✅ (como `email`) | Rename: `email` → `contact_email` |
| 11 | smtp_host | STRING? | ❌ | **NUEVO** |
| 12 | smtp_user | STRING? | ❌ | **NUEVO** |
| 13 | smtp_pass | STRING? (AES-256) | ❌ | **NUEVO — encriptación requerida** |
| 14 | smtp_encryption | "TLS"\|"SSL"\|"NONE" | ❌ | **NUEVO — enum de 3 valores** |
| 15 | smtp_port | INT? | ❌ | **NUEVO** |
| 16 | send_email | BOOL | ❌ | **NUEVO — flag global email** |
| 17 | send_messages | BOOL | ❌ | **NUEVO — flag global WebSocket** |
| 18 | logo_url | STRING? | ❌ | **NUEVO — URL S3/local** |
| 19 | header_color | STRING? (hex) | ❌ | **NUEVO — "#1a56db"** |
| 20 | header_text_color | STRING? (hex) | ❌ | **NUEVO** |
| 21 | body_text_color | STRING? (hex) | ❌ | **NUEVO** |
| 22 | active | BOOL | ❌ | **NUEVO — soft-delete + bloqueo sesión** |
| 23 | socket_host | STRING? | ❌ | **NUEVO** |
| 24 | socket_port | INT? | ❌ | **NUEVO** |
| 25 | db_name | STRING | ❌ | **NUEVO — "educandow_{id}"** |
| — | levels[] | STRING[] | ✅ | Ya existe |
| — | created_at | TIMESTAMP | ✅ | — |
| — | updated_at | TIMESTAMP | ✅ | — |

**Resumen: 5 de 25 campos existen. 20 campos NUEVOS. 1 rename (email → contact_email).**

---

## Riesgos Identificados

### Riesgos Técnicos
1. **Separación de schemas Prisma** (ALTO): Prisma no soporta múltiples datasources de forma nativa en un mismo cliente. Se necesitan dos `PrismaClient` distintos (master + tenant factory), y las migraciones deben ejecutarse por separado.
2. **Creación programática de DBs** (ALTO): `CREATE DATABASE` requiere permisos de superusuario en PostgreSQL. El `PrismaService` factory debe ejecutar DDL raw.
3. **Migración de datos existentes** (MEDIO): Si hay datos en producción, migrar de single-DB a multi-tenant requiere un script de migración complejo.
4. **PrismaClient caching** (MEDIO): El `Map<dbName, PrismaClient>` puede causar memory leaks si no se limpian clientes inactivos.
5. **Encriptación AES-256** (MEDIO): Necesita clave de encriptación gestionada de forma segura (env vars, KMS, o vault).
6. **Circular dependency Auth ↔ Institution** (BAJO): InstitutionModule importa AuthModule; si Auth depende de Institution, hay ciclo.

### Riesgos Funcionales
7. **Validación CUE UNIQUE** (MEDIO): El CUE debe ser único a nivel nacional. La validación cross-tenant es compleja (todas las instituciones están en la master DB — esto ayuda).
8. **Consistencia en creación de tenant** (ALTO): Si el POST falla a medio camino (DB creada pero migrations no), queda un estado inconsistente. Necesita transacción o compensación.
9. **Inactive ≠ deleted** (MEDIO): El soft-delete (`active=false`) debe propagarse: rechazar sesiones activas, deshabilitar WebSocket, etc.

### Riesgos de Frontend
10. **Breaking change en formulario** (ALTO): El formulario de creación pasa de 5 a 25 campos. UX compleja.
11. **InstitutionContext loading** (MEDIO): Si `/me` falla después del login, ¿qué muestra el frontend?
12. **CSS variables dinámicas** (BAJO): Aplicar colores institucionales en runtime es técnicamente simple pero requiere testing cross-browser.

---

## Approaches

### Enfoque 1: "Big Bang" — Todo el módulo de una vez
Migrar los 25 campos, multi-tenant, branding, SMTP en un solo cambio grande.

- **Pros**: Coherencia total, sin estados intermedios inconsistentes, un solo PR
- **Cons**: Complejidad altísima, difícil de revisar, muchos archivos (50+), riesgo de regresiones masivas
- **Effort**: ALTO

### Enfoque 2: "Incremental por capa" 
Fase 1: Domain (entidad + VOs + tests). Fase 2: Schema + Repositorio. Fase 3: Use cases + Controller. Fase 4: Frontend.

- **Pros**: Revisable, cada capa agrega valor, se puede testear en aislamiento
- **Cons**: Estados intermedios donde la API devuelve campos que el frontend no usa (o viceversa)
- **Effort**: MEDIO-ALTO

### Enfoque 3: "Feature slices" — Agrupar por funcionalidad
Slice 1: Campos de identificación (city, postal_code, country, ministry_reg, cue, website). Slice 2: SMTP. Slice 3: Branding + tema. Slice 4: Multi-tenant (db_name, PrismaService, tenant routing). Slice 5: Frontend (InstitutionContext, formulario completo).

- **Pros**: Cada slice es independiente y testeable, se puede deployear incrementalmente, menos riesgo de regresión
- **Cons**: El slice 4 (multi-tenant) tiene dependencias con todos los demás, requiere coordinación
- **Effort**: MEDIO (distribuido en varios PRs)

---

## Recommendation

**Enfoque 3: Feature slices**, con el siguiente orden:

1. **Slice 1 — Schema + Domain (25 campos)**: Actualizar `schema.prisma` con los 25 campos EN LA MASTER DB (sin separar schemas aún). Actualizar entidad `Institution` con todos los campos. Actualizar repositorio y DTO. Este slice NO rompe nada existente — solo AGREGA columnas (nullable).
2. **Slice 2 — Branding + SMTP + Notificaciones**: Agregar value objects para SMTP config, Branding colors. Agregar `send_email`/`send_messages` flags. Este slice es relativamente aislado.
3. **Slice 3 — Multi-tenant (db_name + PrismaService factory)**: Este es el cambio MÁS GRANDE. Separar schemas, crear `PrismaService` dinámico, agregar `db_name`, modificar JWT payload, crear `TenantMiddleware`.
4. **Slice 4 — Endpoints /me + soft-delete**: Agregar `GET /institutions/me`, cambiar DELETE a soft-delete, validación de `active` en login.
5. **Slice 5 — Frontend completo**: InstitutionContext, formulario de creación completo, tema dinámico, sidebar con filtro por niveles.

**Por qué este orden**: El slice 1 se puede mergear rápido y agrega los campos sin romper nada. El slice 3 (el más riesgoso) se aborda cuando ya están los campos definidos. El frontend va al final porque consume lo que la API ya expone.

---

## Ready for Proposal

**Sí**. La exploración es exhaustiva: se revisaron todos los archivos del módulo, se mapearon los 25 campos del diseño contra el código real, y se identificaron 14 reglas de arquitectura con gaps. La recomendación de feature slices está alineada con el pipeline SDD del README del módulo.

### Próximo paso
Ejecutar **PROPOSE** para crear la propuesta formal: "Migrar Institution a 25 campos con multi-tenant y branding — Feature Slices".
