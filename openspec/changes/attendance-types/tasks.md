# Tareas: Tipos de Asistencia (attendance-types)

**Versión:** 1.0  
**Fecha:** 2026-06-08  
**Estrategia de entrega:** 3 batches encadenados (chained PRs) — verificación entre cada uno  
**Modo TDD:** STRICT (RED → GREEN dentro de cada batch)  

---

## Dependencias entre batches

```
Batch 1 (Datos + Dominio)
  └─► Batch 2 (Aplicación + Cascada)
        └─► Batch 3 (Presentación + Front)
```

Batch 2 depende de que Batch 1 esté mergeado y las exportaciones de dominio disponibles.  
Batch 3 depende de que Batch 2 esté mergeado y los use cases + repos disponibles.

---

## Batch 1 — Datos + Dominio

> Alcance: schema Prisma, migración tenant (reemplazo limpio), entidad `AttendanceType`, VO `AttendanceTypeCode`, error `SystemAttendanceTypeError`, exportaciones de dominio y sus tests.

### 1.1 — Tests RED: entidad AttendanceType y VO AttendanceTypeCode

- [x] **T1.1.1** Crear archivo de test de la entidad y el VO  
  Archivo: `packages/domain/src/attendance-type/__tests__/entities/attendance-type.test.ts`  
  Escribir tests que FALLEN (RED):
  - `code` de más de 4 caracteres es rechazado (lanza `ValidationError`) → REQ-1 / Escenario 1.1
  - `code` vacío es rechazado → REQ-1
  - `absenceValue` negativo es rechazado → REQ-1 / Escenario 1.2
  - `level` = 9 (ADMINISTRACION) es rechazado → REQ-1 / Escenario 1.3
  - `level` fuera de rango (0, 5) es rechazado → REQ-1
  - `create` con datos válidos produce entidad con `isSystem = false` por default → REQ-3
  - `assertMutable()` lanza `SystemAttendanceTypeError` cuando `isSystem = true` → REQ-5 / REQ-7
  - `assertMutable()` no lanza cuando `isSystem = false` → REQ-4 / REQ-6
  - `reconstruct` restaura todos los campos incluyendo `id` arbitrario → REQ-1

- [x] **T1.1.2** Crear archivo de test del VO `AttendanceTypeCode`  
  Archivo: `packages/domain/src/attendance-type/__tests__/value-objects/attendance-type-code.test.ts`  
  Tests RED:
  - `AttendanceTypeCode.create("P")` → ok → REQ-1
  - `AttendanceTypeCode.create("SAB")` → ok → REQ-9
  - `AttendanceTypeCode.create("ABCDE")` → err (5 chars) → REQ-1 / Escenario 1.1
  - `AttendanceTypeCode.create("")` → err (vacío) → REQ-1
  - `AttendanceTypeCode.create("ab")` → normaliza a mayúsculas "AB" o falla si no aplica → REQ-1

### 1.2 — Implementación: VO AttendanceTypeCode

- [x] **T1.2.1** Crear VO `AttendanceTypeCode`  
  Archivo: `packages/domain/src/attendance-type/value-objects/attendance-type-code.ts`  
  Regla: `string` normalizado a mayúsculas, longitud 1–4, no vacío. Usa `Result<AttendanceTypeCode, ValidationError>`.  
  REQ-1 / Invariante 1

### 1.3 — Implementación: error SystemAttendanceTypeError

- [x] **T1.3.1** Crear error de dominio `SystemAttendanceTypeError`  
  Archivo: `packages/domain/src/attendance-type/errors/system-attendance-type-error.ts`  
  Extiende `DomainError`. `code = "ATTENDANCE_TYPE_SYSTEM_PROTECTED"`. Mensaje: `"AttendanceType is system-protected and cannot be mutated"`.  
  REQ-5 / REQ-7

### 1.4 — Implementación: entidad AttendanceType

- [x] **T1.4.1** Crear entidad `AttendanceType`  
  Archivo: `packages/domain/src/attendance-type/entities/attendance-type.ts`  
  Métodos requeridos:
  - `static create(props): AttendanceType` — genera `id` nuevo, valida `AttendanceTypeCode`, `absenceValue ≥ 0`, `level ∈ {1,2,3,4}`, `isSystem = false` por default.
  - `static reconstruct(props): AttendanceType` — restaura desde persistencia sin re-validar id.
  - `assertMutable(): void` — lanza `SystemAttendanceTypeError` si `isSystem = true`.
  - Getters: `id`, `level`, `code`, `description`, `absenceValue`, `assignable`, `isSystem`, `active`.  
  REQ-1 / REQ-3 / REQ-5 / REQ-7

### 1.5 — Implementación: archivos de índice del módulo de dominio

- [x] **T1.5.1** Crear barrels de exportación  
  Archivos:
  - `packages/domain/src/attendance-type/entities/index.ts` — exporta `AttendanceType`
  - `packages/domain/src/attendance-type/value-objects/index.ts` — exporta `AttendanceTypeCode`
  - `packages/domain/src/attendance-type/errors/index.ts` — exporta `SystemAttendanceTypeError`
  - `packages/domain/src/attendance-type/index.ts` — re-exporta entidad, VO y errores  
  REQ-1

- [x] **T1.5.2** Agregar exportación del módulo en el índice raíz del paquete de dominio  
  Archivo: `packages/domain/src/index.ts`  
  Agregar: `export { AttendanceType, AttendanceTypeCode, SystemAttendanceTypeError } from './attendance-type';`  
  REQ-1

### 1.6 — Schema Prisma: reemplazo del modelo

- [x] **T1.6.1** Modificar schema Prisma tenant — reemplazar `AttendanceStatus` por `AttendanceType`  
  Archivo: `api/prisma_tenant/schema.prisma`  
  Cambios:
  - Eliminar modelo `AttendanceStatus` (incluida relación `attendances Attendance[]`)
  - Agregar modelo `AttendanceType` con todos los campos según diseño: `id`, `level Int`, `code String`, `description`, `absenceValue Decimal @db.Decimal(4,2)`, `isPresent Boolean`, `assignable`, `isSystem`, `active`, `deletedAt`, `createdAt`, `updatedAt`, relación `attendances Attendance[]`, `@@unique([level, code])`, `@@index([level])`, `@@map("attendance_types")`
  - En modelo `Attendance`: cambiar `status AttendanceStatus` → `status AttendanceType`  
  REQ-1

- [x] **T1.6.2** Modificar repo de asistencia para usar el nuevo nombre del modelo Prisma  
  Archivo: `api/src/infrastructure/persistence/prisma/repositories/prisma-attendance.repository.ts`  
  Cambio: renombrar referencias `attendanceStatus` → `attendanceType` en llamadas al cliente Prisma.  
  REQ-1

### 1.7 — Migración tenant: reemplazo limpio (SQL escrito a mano)

- [x] **T1.7.1** Crear migración tenant `attendance_types`  
  Archivo: `api/prisma_tenant/migrations/20260608000000_attendance_types/migration.sql`  
  Contenido según ADR-01 (orden exacto para evitar FK conflicts):
  1. `ALTER TABLE "attendances" DROP CONSTRAINT IF EXISTS "attendances_statusId_fkey";`
  2. `DROP TABLE IF EXISTS "attendance_statuses";`
  3. `CREATE TABLE "attendance_types" (...)` — todos los campos con tipos exactos
  4. `CREATE UNIQUE INDEX "attendance_types_level_code_key" ON "attendance_types"("level","code");`
  5. `CREATE INDEX "attendance_types_level_idx" ON "attendance_types"("level");`
  6. `ALTER TABLE "attendances" ADD CONSTRAINT "attendances_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "attendance_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`  
  REQ-1 / ADR-01

### 1.8 — GATE Batch 1

- [x] **T1.8.1** Verificar tests dominio GREEN  
  Comando: `pnpm --filter @educandow/domain test`  
  Criterio: todos los tests de `attendance-type/__tests__/` pasan. REQ-1 / REQ-5 / REQ-7

- [x] **T1.8.2** Verificar build del paquete de dominio  
  Comando: `pnpm --filter @educandow/domain build`  
  Criterio: 0 errores TypeScript.

- [x] **T1.8.3** Verificar lint del paquete de dominio  
  Comando: `pnpm --filter @educandow/domain lint`  
  Criterio: 0 warnings ni errores.

---

## Batch 2 — Aplicación + Cascada

> Alcance: puerto del repositorio, repo Prisma tenant, use cases CRUD, `EnsureAttendanceTypesForLevelUseCase`, enganche de cascada en use cases de institución y sus tests.  
> **Dependencia:** requiere Batch 1 mergeado y `@educandow/domain` compilado con las exportaciones de `AttendanceType`.

### 2.1 — Tests RED: puerto/interfaz del repositorio

- [ ] **T2.1.1** Crear test de contrato del puerto (mock)  
  Archivo: `packages/domain/src/attendance-type/__tests__/repositories/attendance-type-repository.test.ts`  
  Verificar que el tipo `AttendanceTypeRepository` compila con todos sus métodos:
  `findById`, `findByLevelCode`, `list`, `save`, `delete`, `existsByLevelCode`.  
  REQ-8 / REQ-2

### 2.2 — Implementación: puerto AttendanceTypeRepository

- [ ] **T2.2.1** Crear interfaz del repositorio  
  Archivo: `packages/domain/src/attendance-type/repositories/attendance-type-repository.ts`  
  Métodos:
  - `findById(id: string): Promise<AttendanceType | null>`
  - `findByLevelCode(level: number, code: string): Promise<AttendanceType | null>`
  - `list(filters?: { level?: number; active?: boolean }): Promise<AttendanceType[]>`
  - `save(entity: AttendanceType): Promise<void>` — crea o actualiza
  - `delete(id: string): Promise<void>` — borrado físico
  - `existsByLevelCode(level: number, code: string, excludeId?: string): Promise<boolean>`  
  REQ-2 / REQ-8

- [ ] **T2.2.2** Exportar `AttendanceTypeRepository` desde el índice del módulo de dominio  
  Archivos: `packages/domain/src/attendance-type/index.ts`, `packages/domain/src/index.ts`  
  REQ-1

### 2.3 — Tests RED: repo Prisma

- [ ] **T2.3.1** Crear test del repo Prisma (con mock del TenantContext)  
  Archivo: `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-attendance-type.repository.test.ts`  
  Tests RED con mock de `TenantContext.getClient()`:
  - `list()` sin filtros devuelve todos los tipos
  - `list({ level: 2 })` filtra por nivel → REQ-8 / Escenario 8.2
  - `list({ active: true })` filtra por activo → REQ-8 / Escenario 8.3
  - `findById` existente retorna entidad → REQ-12
  - `findById` inexistente retorna null → REQ-12
  - `existsByLevelCode` retorna true cuando existe (excluyendo id) → REQ-2
  - `save` llama al cliente con los datos correctos → REQ-3
  - `delete` llama al cliente con el id correcto → REQ-6

### 2.4 — Implementación: PrismaAttendanceTypeRepository

- [ ] **T2.4.1** Crear repositorio Prisma tenant  
  Archivo: `api/src/infrastructure/persistence/prisma/repositories/prisma-attendance-type.repository.ts`  
  Usa `TenantContext.getClient()` para acceso request-scoped.  
  Implementa todos los métodos del puerto: `findById`, `findByLevelCode`, `list`, `save`, `delete`, `existsByLevelCode`.  
  Mapeo `Decimal → number` en `absenceValue`. Usa `AttendanceType.reconstruct()` para construir entidades.  
  REQ-1 / REQ-8 / ADR-02

### 2.5 — Tests RED: use cases CRUD

- [ ] **T2.5.1** Crear tests de los use cases CRUD  
  Archivo: `api/src/application/attendance-type/__tests__/attendance-type.use-cases.test.ts`  
  Tests RED con mock del repositorio:
  - `CreateAttendanceTypeUseCase`: éxito con datos válidos → REQ-3 / Escenario 3.1
  - `CreateAttendanceTypeUseCase`: lanza/retorna error cuando `existsByLevelCode` es true → REQ-2 / Escenario 2.1
  - `UpdateAttendanceTypeUseCase`: éxito actualiza `description`, `absenceValue`, `active`, `assignable` → REQ-4 / Escenario 4.1
  - `UpdateAttendanceTypeUseCase`: rechaza cuando `isSystem = true` → REQ-5 / Escenario 5.1
  - `UpdateAttendanceTypeUseCase`: retorna `NotFoundError` cuando no existe → REQ-12 / Escenario 12.2
  - `DeleteAttendanceTypeUseCase`: éxito → REQ-6 / Escenario 6.1
  - `DeleteAttendanceTypeUseCase`: rechaza cuando `isSystem = true` → REQ-7 / Escenario 7.1
  - `DeleteAttendanceTypeUseCase`: retorna `NotFoundError` cuando no existe → REQ-12
  - `ListAttendanceTypesUseCase`: delega a `repo.list` con filtros → REQ-8
  - `GetAttendanceTypeUseCase`: retorna entidad o `NotFoundError` → REQ-12

### 2.6 — Implementación: use cases CRUD

- [ ] **T2.6.1** Crear use cases CRUD  
  Archivo: `api/src/application/attendance-type/use-cases/attendance-type.use-cases.ts`  
  Implementar:
  - `CreateAttendanceTypeUseCase` — llama `existsByLevelCode` antes de `save`; lanza `DomainError("ATTENDANCE_TYPE_CODE_DUPLICATE")` si duplicado
  - `UpdateAttendanceTypeUseCase` — llama `findById`, `entity.assertMutable()`, actualiza solo campos permitidos (`description`, `absenceValue`, `active`, `assignable`), llama `save`
  - `DeleteAttendanceTypeUseCase` — llama `findById`, `entity.assertMutable()`, llama `delete`
  - `ListAttendanceTypesUseCase` — delega a `repo.list(filters)`
  - `GetAttendanceTypeUseCase` — `findById` o `NotFoundError`  
  REQ-2 / REQ-3 / REQ-4 / REQ-5 / REQ-6 / REQ-7 / REQ-8 / REQ-12

- [ ] **T2.6.2** Agregar `ATTENDANCE_TYPE_CODE_DUPLICATE` a la entidad de dominio  
  Archivo: `packages/domain/src/attendance-type/errors/index.ts` (o un error class separada)  
  Clase `AttendanceTypeCodeDuplicateError extends DomainError` con `code = "ATTENDANCE_TYPE_CODE_DUPLICATE"`.  
  REQ-2

### 2.7 — Tests RED: EnsureAttendanceTypesForLevelUseCase

- [ ] **T2.7.1** Crear tests del use case de cascada  
  Archivo: `api/src/application/attendance-type/__tests__/ensure-attendance-types.use-case.test.ts`  
  Tests RED con mock de `PrismaService.getTenantClient()`:
  - Provisión para nivel SECUNDARIO sin tipos existentes crea exactamente 4 registros (SAB, DOM, P, X con valores correctos) → REQ-9 / Escenario 9.1
  - Provisión para niveles PRIMARIO + SECUNDARIO crea 8 registros en total → REQ-9 / Escenario 9.2
  - Provisión repetida del mismo nivel llama upsert (no insert) — idempotente → REQ-11 / Escenario 11.3
  - `level = 9` (ADMINISTRACION) es ignorado — no se crean tipos → REQ-9 / Escenario 9.2
  - Los valores exactos de los 4 códigos de sistema coinciden con la tabla de REQ-9

### 2.8 — Implementación: EnsureAttendanceTypesForLevelUseCase

- [ ] **T2.8.1** Crear use case de cascada  
  Archivo: `api/src/application/attendance-type/use-cases/ensure-attendance-types-for-level.use-case.ts`  
  Método: `ensure(dbName: string, levels: EducationalLevelCode[]): Promise<void>`  
  - Filtra `levels` para excluir `ADMINISTRACION (9)`
  - Por cada nivel pedagógico, upserta los 4 códigos de sistema via `prismaService.getTenantClient(dbName)` con `update: {}` (no-op para no pisar ediciones del admin)
  - Constante `SYSTEM_ATTENDANCE_TYPES` con los 4 registros (SAB, DOM, P, X) según REQ-9  
  REQ-9 / REQ-10 / REQ-11 / ADR-02

### 2.9 — Tests RED: cascada en use cases de institución

- [ ] **T2.9.1** Crear / ampliar tests de `CreateInstitutionUseCase` para la cascada  
  Archivo: `api/src/application/institution/use-cases/__tests__/create-institution.test.ts`  
  Tests RED:
  - Al crear institución con `institution_levels`, `ensureTypes.ensure()` es llamado con el dbName correcto → REQ-10 / Escenario 10.1
  - Al crear institución sin `institution_levels`, `ensureTypes.ensure()` NO es llamado → REQ-10 / Escenario 10.2
  - Si `ensureTypes.ensure()` lanza, el error propaga hacia el catch compensatorio (instituciones no queda en estado inconsistente) → REQ-10 / ADR-03

- [ ] **T2.9.2** Ampliar tests de `UpdateInstitutionUseCase` para la cascada  
  Archivo: `api/src/application/institution/__tests__/update-institution-auth.test.ts` (o archivo nuevo en `use-cases/__tests__/`)  
  Tests RED:
  - Agregar nivel nuevo dispara `ensureTypes.ensure()` con los niveles actualizados → REQ-11 / Escenario 11.1
  - Actualizar institución sin cambiar niveles: `ensureTypes.ensure()` puede llamarse (best-effort, idempotente) → REQ-11 / Escenario 11.2
  - Si `ensureTypes.ensure()` lanza en update, el error es logueado pero la operación retorna ok → REQ-11 / ADR-03

### 2.10 — Implementación: enganche de cascada en use cases de institución

- [ ] **T2.10.1** Inyectar `EnsureAttendanceTypesForLevelUseCase` en `CreateInstitutionUseCase`  
  Archivo: `api/src/application/institution/use-cases/institution.use-cases.ts`  
  Cambios:
  - Agregar parámetro `ensureTypes: EnsureAttendanceTypesForLevelUseCase` al constructor
  - Dentro del `try` existente (tras `runTenantMigrations`), llamar `await this.ensureTypes.ensure(dbName, distinctLevels(institutionLevels))`
  - Función auxiliar `distinctLevels` que deduplica `EducationalLevelCode` de `InstitutionLevelEntry[]`  
  REQ-10 / ADR-03

- [ ] **T2.10.2** Inyectar `EnsureAttendanceTypesForLevelUseCase` en `UpdateInstitutionUseCase`  
  Archivo: `api/src/application/institution/use-cases/institution.use-cases.ts`  
  Cambios:
  - Agregar parámetro `ensureTypes: EnsureAttendanceTypesForLevelUseCase` al constructor
  - Tras `this.repo.update(updated)`, envolver en try/catch: `await this.ensureTypes.ensure(existing.dbName, distinctLevels(...))` con `catch(e) { logger.error(...) }` (best-effort)  
  REQ-11 / ADR-03

### 2.11 — GATE Batch 2

- [ ] **T2.11.1** Verificar tests de aplicación GREEN  
  Comando: `pnpm --filter api test -- --testPathPattern="attendance-type"`  
  Criterio: todos los tests de `attendance-type/__tests__/` y los tests de institución afectados pasan.  
  REQ-3 / REQ-4 / REQ-5 / REQ-6 / REQ-7 / REQ-8 / REQ-9 / REQ-10 / REQ-11

- [ ] **T2.11.2** Verificar build del API  
  Comando: `pnpm --filter api build`  
  Criterio: 0 errores TypeScript.

- [ ] **T2.11.3** Verificar lint del API  
  Comando: `pnpm --filter api lint`  
  Criterio: 0 warnings ni errores.

---

## Batch 3 — Presentación + Seed + Front

> Alcance: controller NestJS, DTOs zod, módulo, mapeo de errores HTTP, seed de permisos + tipos de sistema, página front, ruta y entrada de menú.  
> **Dependencia:** requiere Batch 2 mergeado y todos los use cases + repos disponibles.

### 3.1 — Tests RED: DTOs y validación

- [ ] **T3.1.1** Crear tests de validación de DTOs  
  Archivo: `api/src/presentation/attendance-type/__tests__/dto-validation.test.ts`  
  Tests RED con `ZodValidationPipe`:
  - `CreateAttendanceTypeDto`: `code` de 5+ chars → 400 → REQ-1 / Escenario 1.1
  - `CreateAttendanceTypeDto`: `absenceValue` negativo → 400 → REQ-1 / Escenario 1.2
  - `CreateAttendanceTypeDto`: `level = 9` → 400 → REQ-1 / Escenario 1.3
  - `CreateAttendanceTypeDto`: payload válido → pasa validación → REQ-3
  - `UpdateAttendanceTypeDto`: campo `code` en el body → es ignorado/rechazado → REQ-4 / Escenario 4.2
  - `UpdateAttendanceTypeDto`: campo `level` en el body → es ignorado/rechazado → REQ-4

### 3.2 — Tests RED: controller HTTP

- [ ] **T3.2.1** Crear tests de integración del controller con supertest  
  Archivo: `api/src/presentation/attendance-type/__tests__/attendance-type.controller.test.ts`  
  Tests RED:
  - POST con datos válidos → 201 con `{ data: {...} }` → REQ-12 / Escenario 12.1
  - POST duplicado `(level, code)` → 409 → REQ-2 / Escenario 2.1 / REQ-12 / Escenario 12.4
  - POST sin auth → 401 → REQ-3 / Escenario 3.2
  - GET lista → 200 con `{ data: [...] }` → REQ-8 / Escenario 8.1
  - GET con `?level=2` → 200, todos `level=2` → REQ-8 / Escenario 8.2
  - GET con `?active=true` → 200, todos `active=true` → REQ-8 / Escenario 8.3
  - GET `:id` existente → 200 → REQ-12
  - GET `:id` inexistente → 404 → REQ-12 / Escenario 12.2
  - PATCH sobre tipo custom → 200 → REQ-4 / Escenario 4.1
  - PATCH sobre tipo isSystem → 409 → REQ-5 / Escenario 5.1 / REQ-12 / Escenario 12.5
  - PATCH sobre id inexistente → 404 → REQ-12 / Escenario 12.2
  - DELETE sobre tipo custom → 204 sin body → REQ-6 / Escenario 6.1 / REQ-12 / Escenario 12.3
  - DELETE sobre tipo isSystem → 409 → REQ-7 / Escenario 7.1 / REQ-12 / Escenario 12.5
  - GET sin permiso → 403 → REQ-13 / Escenario 13.3

### 3.3 — Implementación: DTOs zod

- [ ] **T3.3.1** Crear `CreateAttendanceTypeDto`  
  Archivo: `api/src/presentation/attendance-type/dto/create-attendance-type.dto.ts`  
  Schema Zod: `code` string max 4 chars uppercase, `description` string non-empty, `absenceValue` number min 0, `level` enum z.literal(1,2,3,4), `assignable` boolean, `active` boolean optional default true.  
  REQ-1 / REQ-3

- [ ] **T3.3.2** Crear `UpdateAttendanceTypeDto`  
  Archivo: `api/src/presentation/attendance-type/dto/update-attendance-type.dto.ts`  
  Schema Zod: solo campos `description` (string optional), `absenceValue` (number ≥ 0, optional), `active` (boolean optional), `assignable` (boolean optional). NO incluir `code` ni `level`.  
  REQ-4 / Escenario 4.2

### 3.4 — Implementación: controller

- [ ] **T3.4.1** Crear `AttendanceTypeController`  
  Archivo: `api/src/presentation/attendance-type/attendance-type.controller.ts`  
  Endpoints:
  - `POST /attendance-types` — `@Roles('ROOT', { module: 'ATTENDANCE_TYPES', action: 'CREATE' })` → 201
  - `GET /attendance-types` — `@Roles('ROOT', { module: 'ATTENDANCE_TYPES', action: 'READ' })` → 200, acepta query params `level?` y `active?`
  - `GET /attendance-types/:id` — guard READ → 200 o 404
  - `PATCH /attendance-types/:id` — guard UPDATE → 200, 404 o 409
  - `DELETE /attendance-types/:id` — guard DELETE → 204, 404 o 409
  Patrón: `if (result.isErr()) throw result.unwrapErr()` (idéntico a `InstitutionController`).  
  REQ-3 / REQ-4 / REQ-5 / REQ-6 / REQ-7 / REQ-8 / REQ-12 / REQ-13

### 3.5 — Implementación: mapeo de errores en AppExceptionFilter

- [ ] **T3.5.1** Registrar errores de dominio de attendance-type en `DOMAIN_STATUS`  
  Archivo: `api/src/presentation/shared/filters/exception.filter.ts`  
  Agregar al mapa:
  - `ATTENDANCE_TYPE_CODE_DUPLICATE: 409`
  - `ATTENDANCE_TYPE_SYSTEM_PROTECTED: 409`
  - `ATTENDANCE_TYPE_NOT_FOUND: 404`  
  REQ-12 / Escenario 12.4 / Escenario 12.5

### 3.6 — Implementación: módulo NestJS

- [ ] **T3.6.1** Crear `AttendanceTypeModule`  
  Archivo: `api/src/presentation/attendance-type/attendance-type.module.ts`  
  Registrar:
  - `PrismaService`, `TenantContext`
  - `PrismaAttendanceTypeRepository` + provider `'AttendanceTypeRepository'`
  - `CreateAttendanceTypeUseCase`, `UpdateAttendanceTypeUseCase`, `DeleteAttendanceTypeUseCase`, `ListAttendanceTypesUseCase`, `GetAttendanceTypeUseCase`
  - `AttendanceTypeController`  
  REQ-3

- [ ] **T3.6.2** Registrar `AttendanceTypeModule` en `AppModule`  
  Archivo: `api/src/app.module.ts`  
  Agregar `AttendanceTypeModule` al array `imports`.  
  REQ-3

### 3.7 — Implementación: seed de permisos y tipos de sistema

- [ ] **T3.7.1** Agregar módulo `ATTENDANCE_TYPES` al seed maestro  
  Archivo: `api/prisma/seed.ts`  
  Cambios:
  - Agregar `{ id: 'm-attendance-types', code: 'ATTENDANCE_TYPES', name: 'Tipos de Asistencia' }` al array `modules[]`
  - Asignar acciones READ/CREATE/UPDATE/DELETE al rol ROOT (ALL_ACTIONS) y a `r-admin` y `r-director`  
  REQ-13 / Escenario 13.4

- [ ] **T3.7.2** Actualizar seed tenant para generar tipos de sistema  
  Archivo: `api/prisma/seed-tenant.ts`  
  Cambios:
  - Agregar función `seedSystemAttendanceTypes(client: TenantPrismaClient, levels: EducationalLevelCode[])` que hace upsert de P/SAB/DOM/X por cada nivel pedagógico
  - Llamar la función con los niveles de cada institución seed existente  
  REQ-9 / REQ-10

### 3.8 — Tests RED: página front

- [ ] **T3.8.1** Crear tests de la página front  
  Archivo: `web/src/pages/dashboard/__tests__/attendance-types.test.tsx`  
  Tests RED (Vitest + React Testing Library):
  - La página renderiza sin errores → REQ-14
  - El selector de nivel está presente (un solo `<select>`, no multi-checkbox) → design
  - Filas con `isSystem = true` no muestran botones de edición ni borrado → REQ-14 / Escenario 14.2
  - Filas con `isSystem = false` muestran los controles de acción → REQ-14 / Escenario 14.2
  - El formulario valida `code` ≤ 4 caracteres antes de hacer submit → REQ-1 / Escenario 1.1

### 3.9 — Implementación: página front

- [ ] **T3.9.1** Crear página `attendance-types.tsx`  
  Archivo: `web/src/pages/dashboard/attendance-types.tsx`  
  Espejo de `web/src/pages/dashboard/institutions.tsx`:
  - `PremiumHeader` + `Card` + `Table` + form inline/modal
  - Hooks `useApiList` / `useApiDelete` apuntando a `/attendance-types`
  - Selector de nivel SINGLE (`<select>` de `EducationalLevelCode` 1-4) en el form de creación
  - Columnas: `code`, `description`, `level`, `absenceValue`, `assignable`, `active`, `isSystem`
  - Filas `isSystem = true`: botones editar/borrar deshabilitados o no renderizados
  - Validación `code.length ≤ 4` en el form (client-side)
  - Filtro por nivel y active en la tabla  
  REQ-3 / REQ-4 / REQ-6 / REQ-8 / REQ-14 / Escenario 14.2

### 3.10 — Implementación: ruta y entrada de menú

- [ ] **T3.10.1** Agregar ruta en `App.tsx`  
  Archivo: `web/src/App.tsx`  
  Agregar ruta protegida: `<Route path="/attendance-types" element={<AttendanceTypesPage />} />`  
  REQ-14 / Escenario 14.1

- [ ] **T3.10.2** Agregar entrada de menú en `sidebar.tsx`  
  Archivo: `web/src/components/layout/sidebar.tsx`  
  Agregar dentro del grupo **"Sistema"** (crear el grupo si no existe):
  `{ label: 'Tipos de asistencia', to: '/attendance-types', moduleCode: 'ATTENDANCE_TYPES', icon: ... }`  
  REQ-14 / Escenario 14.1

### 3.11 — GATE Batch 3

- [ ] **T3.11.1** Verificar tests de presentación GREEN (API)  
  Comando: `pnpm --filter api test -- --testPathPattern="attendance-type"`  
  Criterio: tests de controller y DTO pasan. REQ-12 / REQ-13

- [ ] **T3.11.2** Verificar tests front GREEN  
  Comando: `pnpm --filter web test -- --testPathPattern="attendance-types"`  
  Criterio: tests de `attendance-types.test.tsx` pasan. REQ-14

- [ ] **T3.11.3** Verificar build completo del monorepo  
  Comando: `pnpm build`  
  Criterio: 0 errores TypeScript en todos los paquetes.

- [ ] **T3.11.4** Verificar lint completo  
  Comando: `pnpm lint`  
  Criterio: 0 errores ni warnings.

- [ ] **T3.11.5** Verificar criterios de aceptación transversales  
  - `pnpm test` completo → todos los tests pasan (dominio, API, front)
  - Confirmar que `attendance_statuses` no existe en tenant DB (reemplazada por `attendance_types`)
  - Confirmar que `attendances` no tiene registros con referencias rotas
  - Fresh `pnpm seed` produce 4 tipos de sistema por cada nivel pedagógico de cada institución seed  
  REQ-1 / REQ-9 / REQ-13

---

## Review Workload Forecast

| Batch | Archivos nuevos | Archivos modificados | Líneas estimadas |
|---|---|---|---|
| Batch 1 — Datos + Dominio | 8 | 3 | ~350 |
| Batch 2 — Aplicación + Cascada | 7 | 3 | ~680 |
| Batch 3 — Presentación + Front | 9 | 4 | ~780 |
| **Total** | **24** | **10** | **~1.810** |

- **Chained PRs recommended: Yes** (3 batches encadenados con verificación entre cada uno)
- **400-line budget risk: High** (total ~1.810 líneas excede ampliamente el budget de 400)
- **Decision needed before apply: No** (usuario ya eligió estrategia chained/auto-chain con verificación entre batches)
- **Size exception needed: No** (la entrega en 3 PRs chained mantiene cada batch dentro de un rango razonable: ~350 / ~680 / ~780)
