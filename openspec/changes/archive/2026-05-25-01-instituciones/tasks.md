# Tasks: Módulo 01 — Instituciones Multi-Tenant

## Slice 1: Schema + Domain (P0)

### T1.1 — Split Prisma schema into master + tenant ✅

**Descripción**: Separar `api/prisma/schema.prisma` en dos schemas independientes:
- `schema_master.prisma`: `Institution` (5 campos actuales), `User`, `RefreshToken` — datasource usa `MASTER_DATABASE_URL`
- `schema_tenant.prisma`: `Student`, `Teacher`, `Enrollment`, `Subject`, `CourseSection`, `SubjectAssignment`, `Grade`, `Attendance` — **sin** `institutionId` ni relación `Institution` en ningún modelo. Generator output: `@prisma/tenant-client`

**Archivos**:
- **Crear**: `api/prisma/schema_master.prisma`, `api/prisma/schema_tenant.prisma`
- **Modificar**: `package.json` (scripts `prisma:generate:master`, `prisma:generate:tenant`)
- **Eliminar**: `api/prisma/schema.prisma`

**Dependencias**: Ninguna

**Criterio de aceptación**:
- `prisma generate --schema=api/prisma/schema_master.prisma` genera `@prisma/client`
- `prisma generate --schema=api/prisma/schema_tenant.prisma` genera `@prisma/tenant-client`
- No hay referencias a `Institution` en `schema_tenant.prisma`
- No hay `institutionId` en ningún modelo tenant

---

### T1.2 — Crear Value Objects: HexColor y Cue ✅

**Descripción**: Crear dos value objects auto-validantes en el domain package:
- `HexColor`: valida regex `^#[0-9a-fA-F]{6}$`, expone `get(): string`
- `Cue`: valida string alfanumérico no vacío, expone `get(): string`

**Archivos**:
- **Crear**: `packages/domain/src/institution/value-objects/hex-color.ts`
- **Crear**: `packages/domain/src/institution/value-objects/cue.ts`
- **Modificar**: `packages/domain/src/institution/value-objects/index.ts` (exportar nuevos VOs)

**Dependencias**: Ninguna

**Criterio de aceptación**:
- `HexColor.create("red")` → `Err` con mensaje de validación
- `HexColor.create("#1a56db")` → `Ok(HexColor)`
- `Cue.create("")` → `Err`
- `Cue.create("ABC123")` → `Ok(Cue)`

---

### T1.3 — Expandir entidad Institution a 25 campos ✅

**Descripción**: Agregar los 20 campos faltantes a `InstitutionProps` y sus getters:
`cue`, `ministryReg`, `city`, `postalCode`, `country`, `website`, `contactEmail`, `logoUrl`, `headerColor` (HexColor?), `headerTextColor` (HexColor?), `bodyTextColor` (HexColor?), `smtpHost`, `smtpUser`, `smtpPass`, `smtpEncryption`, `smtpPort`, `sendEmail`, `sendMessages`, `socketHost`, `socketPort`, `active`, `dbName`, `createdAt`, `updatedAt`.

Actualizar `create()` y `reconstruct()` para aceptar los nuevos campos con defaults apropiados (`active=true`, `country="AR"`, `sendEmail=false`, `sendMessages=false`).

**Archivos**:
- **Modificar**: `packages/domain/src/institution/entities/institution.ts`

**Dependencias**: T1.2 (HexColor, Cue)

**Criterio de aceptación**:
- `Institution.create({ name: "Test", levels: [...] })` funciona con defaults para los 20 campos nuevos
- `institution.active === true` por defecto
- `institution.dbName` se genera como `educandow_{id}` automáticamente
- Todos los 25 campos son accesibles via getters

---

### T1.4 — Actualizar InstitutionRepository interface ✅

**Descripción**: Agregar métodos nuevos al repositorio domain:
- `findByCue(cue: string): Promise<Institution | null>`
- `softDelete(id: string): Promise<void>` — setea `active=false`
- `update(institution: Institution): Promise<void>` — update parcial
- `findByDbName(dbName: string): Promise<Institution | null>`

**Archivos**:
- **Modificar**: `packages/domain/src/institution/repositories/institution-repository.ts`

**Dependencias**: T1.3

**Criterio de aceptación**:
- La interface compila con los 4 métodos nuevos
- El contrato es compatible con la implementación Prisma existente (que se actualizará después)

---

### T1.5 — Crear DTO Zod para creación con 25 campos ✅

**Descripción**: Crear un Zod schema completo para `POST /institutions` que valide los 25 campos:
- `name`: string requerido
- `cue`: string opcional, alfanumérico
- `address`, `city`, `postal_code`, `country`, `phone`, `website`, `contact_email`, `ministry_reg`: opcionales
- `logo_url`: URL válida si se proporciona
- `header_color`, `header_text_color`, `body_text_color`: regex hex color si se proporcionan
- `smtp_host`, `smtp_user`, `smtp_pass`, `smtp_encryption` ("TLS"|"SSL"|"NONE"), `smtp_port` (1-65535): opcionales
- `send_email`, `send_messages`: boolean, default false
- `socket_host`, `socket_port`: opcionales
- `levels`: array de strings, al menos uno

**Archivos**:
- **Crear**: `api/src/presentation/institution/dto/create-institution-full.dto.ts`

**Dependencias**: Ninguna (DTO es independiente del domain)

**Criterio de aceptación**:
- `CreateInstitutionFullSchema.parse({ name: "Test", levels: ["INICIAL"] })` → OK con defaults
- `CreateInstitutionFullSchema.parse({ header_color: "red", ... })` → ValidationError
- `CreateInstitutionFullSchema.parse({ smtp_encryption: "STARTTLS", ... })` → ValidationError

---

### T1.6 — Actualizar PrismaInstitutionRepository para 25 campos ✅

**Descripción**: Actualizar `toDomain()` y `save()` para mapear los 25 campos entre Prisma y la entidad domain. El repositorio sigue usando el client master (no dinámico todavía — eso viene en Slice 2).

**Archivos**:
- **Modificar**: `api/src/infrastructure/persistence/prisma/repositories/prisma-institution.repository.ts`

**Dependencias**: T1.1 (schema_master), T1.3 (entidad 25 campos), T1.4 (repository interface)

**Criterio de aceptación**:
- `save()` persiste los 25 campos correctamente
- `toDomain()` reconstruye la entidad con todos los campos
- `softDelete()` setea `active=false`
- `findByCue()` busca por CUE
- `update()` actualiza campos selectivos

---

### T1.7 — Tests domain: Institution entity + VOs ✅

**Descripción**: Tests unitarios con Vitest para:
- `Institution.create()` con defaults correctos
- `Institution.reconstruct()` desde persistencia
- `HexColor` validación (válido/inválido)
- `Cue` validación (válido/inválido)
- `hasLevel()`, `addLevel()` behavior

**Archivos**:
- **Crear**: `packages/domain/src/institution/__tests__/entities/institution-25fields.test.ts`
- **Crear**: `packages/domain/src/institution/__tests__/value-objects/hex-color.test.ts`
- **Crear**: `packages/domain/src/institution/__tests__/value-objects/cue.test.ts`

**Dependencias**: T1.2, T1.3

**Criterio de aceptación**:
- Todos los tests pasan con `vitest run`
- Cobertura ≥ 80% en los archivos testeados

---

### T1.8 — Tests domain: SmtpConfig VO ✅

**Descripción**: Tests unitarios para el value object `SmtpConfig` (validación de encryption enum TLS/SSL/NONE, rechazo de STARTTLS, campos opcionales).

**Archivos**:
- **Crear**: `packages/domain/src/institution/value-objects/smtp-config.ts`
- **Crear**: `packages/domain/src/institution/__tests__/value-objects/smtp-config.test.ts`

**Dependencias**: T1.2

**Criterio de aceptación**:
- `SmtpConfig.create({ encryption: "TLS" })` → OK
- `SmtpConfig.create({ encryption: "STARTTLS" })` → Err
- Tests pasan con `vitest run`

---

## Slice 2: Multi-Tenant Infra (P0)

### T2.1 — PrismaService factory con Map<dbName, PrismaClient> ✅

**Descripción**: Reemplazar el singleton `PrismaService` por un factory que:
- Mantiene `master: PrismaClient` (siempre conectado a `MASTER_DATABASE_URL`)
- Mantiene `tenants: Map<string, PrismaClient>` (lazy init, keyed by dbName)
- `getClient(dbName?: string): PrismaClient` — retorna master si dbName es null/undefined, sino retorna/crea tenant client
- `onModuleDestroy()` desconecta todos los clientes cacheados
- Construye DATABASE_URL del tenant reemplazando el nombre de DB en `MASTER_DATABASE_URL`

**Archivos**:
- **Modificar**: `api/src/infrastructure/persistence/prisma/prisma.service.ts`

**Dependencias**: T1.1 (schema_master genera el client master)

**Criterio de aceptación**:
- `getClient()` sin dbName → retorna master client
- `getClient("educandow_abc")` → crea y cachea nuevo PrismaClient
- Segunda llamada con mismo dbName → retorna el mismo cliente (cached)
- `onModuleDestroy()` desconecta master + todos los tenants

---

### T2.2 — TenantMiddleware con AsyncLocalStorage ✅

**Descripción**: Crear `TenantMiddleware` que implementa `NestMiddleware`:
- Lee `request.user` (seteado por AuthGuard)
- Extrae `dbName` e `institutionId` del JWT
- Rutas master-only (`/health`, `POST /v1/institutions`, `GET /v1/institutions`, `DELETE /v1/institutions/:id`, `/v1/auth/*`): usa master client
- Rutas tenant-scoped: si `dbName` es null → 403. Sino verifica `active` via master DB → si false → 403. Si true → setea `request.prismaClient = factory.getClient(dbName)`
- Almacena el prismaClient en `AsyncLocalStorage` para que los repos lo accedan sin DI-by-request

**Archivos**:
- **Crear**: `api/src/infrastructure/auth/tenant.middleware.ts`
- **Crear**: `api/src/infrastructure/auth/async-local-storage.ts` (ALS context definition)

**Dependencias**: T2.1 (PrismaService factory)

**Criterio de aceptación**:
- Request sin JWT a `/health` → 200
- Request con JWT `dbName: null` a endpoint tenant → 403
- Request con JWT `dbName: "educandow_abc"` a endpoint tenant → usa cliente correcto
- Request con JWT de institución `active: false` → 403

---

### T2.3 — Agregar dbName al JWT payload ✅

**Descripción**: Actualizar la interfaz de autenticación para incluir `dbName`:
- `JwtPayload` agrega `dbName?: string`
- `AuthPort` agrega `dbName` al payload de sign/verify
- `LoginUseCase` resuelve `dbName` desde la institución del usuario (`educandow_{institutionId}`)

**Archivos**:
- **Modificar**: `api/src/infrastructure/auth/jwt-auth-port.ts`
- **Modificar**: `api/src/application/auth/ports/auth-port.ts`
- **Modificar**: `api/src/application/auth/use-cases/login.use-case.ts`

**Dependencias**: T1.6 (PrismaInstitutionRepository con findByDbName)

**Criterio de aceptación**:
- JWT emitido contiene `{ sub, role, institutionId, dbName, level }`
- Usuario sin institución → `dbName: null` en JWT
- `verify()` extrae `dbName` correctamente

---

### T2.4 — LoginUseCase: verificación de active al login ✅

**Descripción**: Modificar `LoginUseCase.execute()` para verificar que la institución del usuario esté activa antes de emitir JWT. Si `active === false` → retornar error 403 "Institution is inactive".

**Archivos**:
- **Modificar**: `api/src/application/auth/use-cases/login.use-case.ts`

**Dependencias**: T2.3 (dbName en payload), T1.6 (repository con active field)

**Criterio de aceptación**:
- Login con institución activa → JWT emitido con dbName
- Login con institución `active: false` → Error "Institution is inactive"
- Login sin institución (ROOT) → JWT sin dbName, procede normal

---

### T2.5 — Actualizar env.config.ts ✅

**Descripción**: Agregar `MASTER_DATABASE_URL` y `ENCRYPTION_KEY` a la configuración de ambiente. Validar que `ENCRYPTION_KEY` sea 32 bytes al startup.

**Archivos**:
- **Modificar**: `api/src/infrastructure/config/env.config.ts`
- **Modificar**: `.env.example`

**Dependencias**: Ninguna

**Criterio de aceptación**:
- `loadEnvConfig()` retorna `masterDatabaseUrl` y `encryptionKey`
- Si `ENCRYPTION_KEY` no está o tiene longitud != 32 → throw al startup
- Fallback a defaults en desarrollo

---

### T2.6 — Wire TenantMiddleware en AppModule ✅

**Descripción**: Configurar `TenantMiddleware` globalmente en `AppModule.configure()` usando `consumer.apply().forRoutes()`. Excluir rutas de health check.

**Archivos**:
- **Modificar**: `api/src/app.module.ts`

**Dependencias**: T2.2 (TenantMiddleware), T2.1 (PrismaService factory)

**Criterio de aceptación**:
- La app compila y arranca
- Middleware se ejecuta en todas las rutas excepto `/health`
- Repositorios tenant-scoped reciben el cliente correcto via ALS

---

### T2.7 — Tests: PrismaService factory ✅

**Descripción**: Tests de integración para el factory:
- Mismo dbName retorna mismo cliente (cache)
- dbName diferente crea nuevo cliente
- Sin dbName retorna master
- `onModuleDestroy()` desconecta todos

**Archivos**:
- **Crear**: `api/src/infrastructure/persistence/prisma/__tests__/prisma-service.test.ts`

**Dependencias**: T2.1

**Criterio de aceptación**:
- Tests pasan con `vitest run`
- Mock de PrismaClient para no requerir DB real

---

### T2.8 — Tests: TenantMiddleware ✅

**Descripción**: Tests de integración para el middleware:
- Request sin JWT a health → ok
- Request con dbName null a tenant endpoint → 403
- Request con dbName válido → cliente correcto
- Request con active=false → 403

**Archivos**:
- **Crear**: `api/src/infrastructure/auth/__tests__/tenant-middleware.test.ts`

**Dependencias**: T2.2, T2.3

**Criterio de aceptación**:
- Tests pasan con mocks de PrismaService y JWT
- Todos los escenarios del spec cubiertos

---

### T2.9 — Tests: LoginUseCase con dbName + active check

**Descripción**: Tests unitarios para LoginUseCase:
- Login exitoso incluye dbName en JWT
- Login con institución inactiva → error
- Login sin institución → JWT sin dbName

**Archivos**:
- **Crear**: `api/src/application/auth/__tests__/login-use-case.test.ts`

**Dependencias**: T2.4

**Criterio de aceptación**:
- Tests pasan con mocks de repos y authPort
- Verifica que JWT contiene `dbName`

---

## Slice 3: Branding + SMTP (P1)

### T3.1 — EncryptionService AES-256-GCM ✅

**Descripción**: Crear servicio de encriptación usando Node `crypto` module:
- `encrypt(plaintext: string): string` → AES-256-GCM, retorna ciphertext con iv+authTag embebido
- `decrypt(ciphertext: string): string` → recupera plaintext
- Key viene de `ENCRYPTION_KEY` env var (32 bytes)

**Archivos**:
- **Crear**: `api/src/infrastructure/crypto/encryption.service.ts`

**Dependencias**: T2.5 (ENCRYPTION_KEY en env config)

**Criterio de aceptación**:
- `encrypt("secret123")` ≠ `"secret123"`
- `decrypt(encrypt("secret123"))` === `"secret123"`
- Misma plaintext → ciphertext diferente (IV aleatorio)

---

### T3.2 — Crear DTO para actualización parcial

**Descripción**: Crear Zod schema `.partial()` para `PATCH /v1/institutions/:id` que permita actualizar cualquier subset de los 25 campos.

**Archivos**:
- **Crear**: `api/src/presentation/institution/dto/update-institution.dto.ts`

**Dependencias**: T1.5 (create-institution-full.dto.ts como base)

**Criterio de aceptación**:
- `UpdateInstitutionSchema.parse({ header_color: "#1a56db" })` → OK
- `UpdateInstitutionSchema.parse({ header_color: "red" })` → ValidationError
- Todos los campos son opcionales

---

### T3.3 — Actualizar PrismaInstitutionRepository con encriptación ✅

**Descripción**: Integrar `EncryptionService` en el repositorio:
- `save()` y `update()`: encriptar `smtpPass` antes de persistir
- `toDomain()`: NO desencriptar (se desencripta solo al usar SMTP)
- `toResponse()`: excluir `smtpPass` de cualquier respuesta API

**Archivos**:
- **Modificar**: `api/src/infrastructure/persistence/prisma/repositories/prisma-institution.repository.ts`

**Dependencias**: T3.1 (EncryptionService), T1.6 (repository 25 campos)

**Criterio de aceptación**:
- `smtp_pass` se guarda como ciphertext en DB
- Ningún endpoint retorna `smtp_pass` (ni plaintext ni ciphertext)
- Campos de branding se persisten correctamente

---

### T3.4 — Actualizar CreateInstitutionUseCase para 25 campos ✅

**Descripción**: Expandir `CreateInstitutionUseCase` para aceptar los 25 campos del DTO completo. Validar CUE único antes de crear. Generar `db_name` automáticamente como `educandow_{id}`.

**Archivos**:
- **Modificar**: `api/src/application/institution/use-cases/institution.use-cases.ts`

**Dependencias**: T1.5 (DTO 25 campos), T1.6 (repository findByCue)

**Criterio de aceptación**:
- `execute({ name, levels, header_color, ... })` → Institution con 25 campos
- CUE duplicado → ValidationError
- `db_name` se genera automáticamente

---

### T3.5 — Crear UpdateInstitutionUseCase

**Descripción**: Caso de uso para `PATCH /v1/institutions/:id`:
- Busca institución por ID
- Aplica campos parciales del DTO
- Valida campos actualizados
- Persiste via `repository.update()`

**Archivos**:
- **Modificar**: `api/src/application/institution/use-cases/institution.use-cases.ts` (agregar clase)

**Dependencias**: T1.4 (repository update method), T3.2 (update DTO)

**Criterio de aceptación**:
- `execute(id, { header_color: "#1a56db" })` → actualiza solo ese campo
- Institución no encontrada → NotFoundError
- Campos inválidos → ValidationError

---

### T3.6 — Tests: EncryptionService ✅

**Descripción**: Tests unitarios para encrypt/decrypt:
- Roundtrip con key conocida
- Plaintext ≠ ciphertext
- Decrypt recupera original exacto
- Key inválida (wrong size) → error

**Archivos**:
- **Crear**: `api/src/infrastructure/crypto/__tests__/encryption-service.test.ts`

**Dependencias**: T3.1

**Criterio de aceptación**:
- Tests pasan
- Usa key fija de 32 bytes para determinismo

---

### T3.7 — Tests: UpdateInstitutionUseCase

**Descripción**: Tests unitarios para el caso de uso de actualización parcial.

**Archivos**:
- **Crear**: `api/src/application/institution/__tests__/update-institution-use-case.test.ts`

**Dependencias**: T3.5

**Criterio de aceptación**:
- Update parcial funciona
- Institución no encontrada → error
- Campos inválidos → error

---

## Slice 4: Session + Frontend (P1)

### T4.1 — Crear GetMeUseCase ✅

**Descripción**: Caso de uso para `GET /v1/institutions/me`:
- Lee `institutionId` del JWT
- Busca institución en master DB
- Retorna config completa EXCEPTO `smtp_pass`
- Si `institutionId` es null → NotFoundError

**Archivos**:
- **Modificar**: `api/src/application/institution/use-cases/institution.use-cases.ts` (agregar clase)

**Dependencias**: T1.6 (repository con todos los campos)

**Criterio de aceptación**:
- `execute(institutionId)` → Institution sin smtp_pass
- `execute(null)` → NotFoundError
- Todos los campos de branding, SMTP meta, flags, levels incluidos

---

### T4.2 — Agregar endpoint GET /me al controller ✅

**Descripción**: Agregar ruta `GET /v1/institutions/me` al `InstitutionController`:
- Usa `GetMeUseCase`
- Lee `institutionId` del JWT (via decorator o request.user)
- Retorna 200 con config o 404

**Archivos**:
- **Modificar**: `api/src/presentation/institution/institution.controller.ts`

**Dependencias**: T4.1 (GetMeUseCase), T2.3 (dbName en JWT)

**Criterio de aceptación**:
- `GET /v1/institutions/me` con JWT válido → 200 con config
- `GET /v1/institutions/me` con JWT sin institutionId → 404
- `smtp_pass` NO está en la respuesta

---

### T4.3 — Actualizar DELETE para soft-delete ✅

**Descripción**: Cambiar `DeleteInstitutionUseCase` para llamar `repository.softDelete(id)` en vez de `repository.delete(id)`. Idempotente: si ya está inactive, retorna sin error.

**Archivos**:
- **Modificar**: `api/src/application/institution/use-cases/institution.use-cases.ts`
- **Modificar**: `api/src/presentation/institution/institution.controller.ts` (actualizar respuesta)

**Dependencias**: T1.4 (softDelete en repository)

**Criterio de aceptación**:
- `DELETE /v1/institutions/:id` → `active=false` en DB
- Segundo DELETE al mismo ID → 204 sin error
- La DB tenant NO se elimina

---

### T4.4 — Actualizar controller con PATCH y DTOs completos ✅

**Descripción**: Agregar `PATCH /v1/institutions/:id` al controller. Actualizar `POST` para usar `CreateInstitutionFullSchema`. Actualizar `GET /:id` y `GET /` para retornar todos los campos (excepto smtp_pass).

**Archivos**:
- **Modificar**: `api/src/presentation/institution/institution.controller.ts`
- **Modificar**: `api/src/presentation/institution/institution.module.ts` (wire new use cases)

**Dependencias**: T4.2 (GET /me), T4.3 (soft-delete), T3.5 (UpdateInstitutionUseCase), T1.5 (full DTO)

**Criterio de aceptación**:
- `POST /v1/institutions` con DTO 25 campos → 201
- `PATCH /v1/institutions/:id` con campos parciales → 200
- `GET /v1/institutions` retorna todos los campos sin smtp_pass
- Solo ROOT puede POST y PATCH

---

### T4.5 — Tests: GetMeUseCase ✅

**Descripción**: Tests unitarios para el caso de uso GET /me.

**Archivos**:
- **Crear**: `api/src/application/institution/__tests__/get-me-use-case.test.ts`

**Dependencias**: T4.1

**Criterio de aceptación**:
- Retorna config completa sin smtp_pass
- institutionId null → error

---

### T4.6 — Tests: API e2e endpoints institutions

**Descripción**: Tests e2e con Supertest para:
- `POST /v1/institutions` → 201 (mock tenant DB creation)
- `GET /v1/institutions/me` → 200 con config
- `GET /v1/institutions/me` sin institutionId → 404
- `DELETE /v1/institutions/:id` → active=false
- `PATCH /v1/institutions/:id` → campos actualizados
- `smtp_pass` nunca aparece en responses

**Archivos**:
- **Crear**: `api/src/__tests__/institutions.e2e.test.ts`

**Dependencias**: T4.4 (todos los endpoints)

**Criterio de aceptación**:
- Tests pasan con Supertest + DB de test
- Mock de tenant DB creation (no crea DB real)

---

### T4.7 — Crear InstitutionContext (React) ✅

**Descripción**: Crear contexto React que:
- `InstitutionProvider` envuelve la app (sibling de `AuthProvider`)
- Al montar (usuario autenticado): llama `GET /v1/institutions/me`
- Almacena: id, name, logo_url, colores, flags, socket, active, levels[]
- En error: fallback a defaults (levels=[], colores null, send_email=false, active=true)
- Exporta `useInstitution()` hook

**Archivos**:
- **Crear**: `web/src/context/institution-context.tsx`

**Dependencias**: T4.2 (endpoint GET /me)

**Criterio de aceptación**:
- `useInstitution()` retorna config después de login
- Si GET /me falla → defaults sin crash
- Context se limpia al logout

---

### T4.8 — Integrar InstitutionProvider en App ✅

**Descripción**: Envolver la app con `InstitutionProvider` en `App.tsx`, después de `AuthProvider`. Actualizar `login.tsx` para que después del login exitoso, el context se dispare automáticamente.

**Archivos**:
- **Modificar**: `web/src/App.tsx`
- **Modificar**: `web/src/context/auth-context.tsx` (trigger institution fetch on login)

**Dependencias**: T4.7 (InstitutionContext)

**Criterio de aceptación**:
- Después de login, `GET /v1/institutions/me` se llama automáticamente
- La app no crashea si el endpoint falla

---

### T4.9 — Actualizar formulario de institutions a 25 campos ✅

**Descripción**: Expandir el formulario en `institutions.tsx` para incluir todas las secciones:
- Identificación (name, cue, ministry_reg)
- Contacto (address, city, postal_code, country, phone, website, contact_email)
- Branding (logo_url, header_color, header_text_color, body_text_color)
- SMTP (smtp_host, smtp_user, smtp_pass, smtp_encryption, smtp_port, send_email toggle)
- Notificaciones (send_messages toggle, socket_host, socket_port)
- Niveles (checkboxes)

**Archivos**:
- **Modificar**: `web/src/pages/dashboard/institutions.tsx`

**Dependencias**: T4.4 (PATCH endpoint), T4.7 (InstitutionContext para editar existente)

**Criterio de aceptación**:
- Formulario tiene secciones colapsables para cada grupo
- Validación de hex colors en frontend
- Toggle send_email/send_messages visibles
- Crear y editar funcionan

---

## Slice 5: Theming + Flags (P2)

### T5.1 — Crear use-theme hook ✅

**Descripción**: Hook que aplica CSS variables dinámicas desde `InstitutionContext`:
- Lee `header_color`, `header_text_color`, `body_text_color` del context
- Aplica `--header-color`, `--header-text-color`, `--body-text-color` al `:root` o `document.documentElement`
- Se actualiza cuando cambia el context
- Usa defaults si los colores son null

**Archivos**:
- **Crear**: `web/src/hooks/use-theme.ts`

**Dependencias**: T4.7 (InstitutionContext)

**Criterio de aceptación**:
- `useTheme()` aplica CSS variables al montar
- Cambiar institución → variables se actualizan
- Colores null → no se aplican (usan defaults del CSS)

---

### T5.2 — Integrar use-theme en App/Dashboard ✅

**Descripción**: Llamar `useTheme()` en el componente raíz del dashboard para que el tema se aplique globalmente.

**Archivos**:
- **Modificar**: `web/src/pages/dashboard/dashboard.tsx` o `web/src/App.tsx`

**Dependencias**: T5.1 (use-theme)

**Criterio de aceptación**:
- Header cambia de color según `header_color` de la institución
- Texto cambia según `header_text_color` y `body_text_color`

---

### T5.3 — Actualizar sidebar con filtro por levels[] ✅

**Descripción**: Modificar `Sidebar` para:
- Leer `levels[]` de `InstitutionContext`
- Filtrar `navItems` para mostrar solo los niveles activos
- Ocultar secciones según `send_email` y `send_messages` flags
- Si `levels[]` está vacío → mostrar placeholder

**Archivos**:
- **Modificar**: `web/src/components/layout/sidebar.tsx`

**Dependencias**: T4.7 (InstitutionContext)

**Criterio de aceptación**:
- Institution con `levels: ["INICIAL", "SECUNDARIO"]` → solo muestra esos items
- `send_email: false` → oculta secciones de email si las hubiera
- `levels: []` → placeholder "No hay niveles configurados"

---

### T5.4 — Tests: use-theme hook ✅

**Descripción**: Tests para el hook de tema:
- Aplica CSS variables correctamente
- Maneja colores null
- Se actualiza al cambiar context

**Archivos**:
- **Crear**: `web/src/hooks/__tests__/use-theme.test.ts`

**Dependencias**: T5.1

**Criterio de aceptación**:
- Tests pasan con React Testing Library
- Verifica `document.documentElement.style`

---

### T5.5 — Tests: Sidebar filtering ✅

**Descripción**: Tests para el sidebar con InstitutionContext mockeado:
- Filtra por levels[]
- Oculta/muestra según feature flags

**Archivos**:
- **Crear**: `web/src/components/layout/__tests__/sidebar.test.tsx`

**Dependencias**: T5.3

**Criterio de aceptación**:
- Render con mock context → items correctos visibles/ocultos
- `levels: []` → placeholder visible

---

## Orden de ejecución recomendado

```
Slice 1 (P0):  T1.1 → T1.2 → T1.3 → T1.4 → T1.5 → T1.6 → T1.7 → T1.8
Slice 2 (P0):  T2.1 → T2.2 → T2.3 → T2.4 → T2.5 → T2.6 → T2.7 → T2.8 → T2.9
Slice 3 (P1):  T3.1 → T3.2 → T3.3 → T3.4 → T3.5 → T3.6 → T3.7
Slice 4 (P1):  T4.1 → T4.2 → T4.3 → T4.4 → T4.5 → T4.6 → T4.7 → T4.8 → T4.9
Slice 5 (P2):  T5.1 → T5.2 → T5.3 → T5.4 → T5.5
```

**Paralelizables dentro de cada slice**:
- Slice 1: T1.5 puede ir en paralelo con T1.2-T1.4
- Slice 2: T2.5 puede ir en paralelo con T2.1-T2.4
- Slice 3: T3.2 puede ir en paralelo con T3.1
- Slice 4: T4.7 puede ir en paralelo con T4.1-T4.6
- Slice 5: T5.4 y T5.5 pueden ir en paralelo con T5.1-T5.3

## Total: 37 tareas atómicas

| Slice | Impl | Tests | Total |
|-------|------|-------|-------|
| 1 — Schema + Domain | 6 | 2 | 8 |
| 2 — Multi-tenant | 6 | 3 | 9 |
| 3 — Branding + SMTP | 5 | 2 | 7 |
| 4 — Session + Frontend | 6 | 3 | 9 |
| 5 — Theming + Flags | 3 | 2 | 5 |
| **Total** | **26** | **11** | **37** |
