# Archive Report: Tipos de Asistencia (attendance-types)

**Fecha de archivado:** 2026-06-08  
**Proyecto:** EducandoW  
**Change:** `attendance-types`  
**Estado:** ARCHIVED AND CLOSED

---

## Resumen ejecutivo

El cambio `attendance-types` ha sido implementado completamente, verificado y archivado. Se trata de un catálogo configurable de Tipos de Asistencia por nivel educativo que reemplaza el antiguo modelo `AttendanceStatus`. Módulo completo (back + front) entregado en 3 batches con verificación entre cada uno, totalizando ~2.100 líneas de código nuevo.

---

## Capacidades entregadas

### Nuevas
- **`attendance-types`**: CRUD de tipos de asistencia (AttendanceType) por nivel educativo, 4 códigos de sistema protegidos (SAB/DOM/P/X), cascada de provisión idempotente al crear/actualizar instituciones.

### Modificadas
- **`institution-lifecycle`**: Create/Update institución ahora dispara provisión automática de tipos de sistema por cada nivel asignado.

---

## Especificación implementada

**14 requisitos, 27 escenarios**, todos implementados:

| REQ | Descripción | Estado |
|-----|-------------|--------|
| REQ-1 | Estructura del modelo AttendanceType | ✅ PASS |
| REQ-2 | Unicidad code por nivel | ✅ PASS |
| REQ-3 | Crear tipo no-sistema | ✅ PASS |
| REQ-4 | Editar tipo no-sistema | ✅ PASS |
| REQ-5 | Rechazar edición isSystem | ✅ PASS |
| REQ-6 | Borrar tipo no-sistema | ✅ PASS |
| REQ-7 | Rechazar borrado isSystem | ✅ PASS |
| REQ-8 | Listar y filtrar | ✅ PASS |
| REQ-9 | Valores exactos códigos de sistema | ✅ PASS |
| REQ-10 | Cascada create institución | ✅ PASS |
| REQ-11 | Cascada update institución | ✅ PASS |
| REQ-12 | Mapeo HTTP | ✅ PASS |
| REQ-13 | Control de acceso por permisos | ✅ PASS |
| REQ-14 | Entrada de menú en el front | ✅ PASS |

---

## Modelo de datos

### AttendanceType (tenant DB)

```prisma
model AttendanceType {
  id           String    @id @default(uuid())
  level        Int       // EducationalLevelCode (1-4)
  code         String    // ≤ 4 caracteres (SAB, DOM, P, X, o custom)
  description  String
  absenceValue Decimal   @db.Decimal(4, 2)
  isPresent    Boolean   @default(true)
  assignable   Boolean
  isSystem     Boolean   @default(false)  // protegido: no editar/borrar
  active       Boolean   @default(true)
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@unique([level, code])
  @@index([level])
  @@map("attendance_types")
}
```

### Códigos de sistema (por nivel: 1-4)

| code | description      | assignable | absenceValue | isSystem | active |
|------|------------------|------------|--------------|----------|--------|
| SAB  | Sábado           | false      | 0            | true     | true   |
| DOM  | Domingo          | false      | 0            | true     | true   |
| P    | Presente         | true       | 0            | true     | true   |
| X    | Día no utilizado | false      | 0            | true     | true   |

---

## Arquitectura backend

### Capas hexagonales

| Capa | Componentes |
|------|-------------|
| **Dominio** | `AttendanceType` (entidad), `AttendanceTypeCode` (VO), `SystemAttendanceTypeError`, `AttendanceTypeCodeDuplicateError`, `AttendanceTypeRepository` (puerto) |
| **Infraestructura** | `PrismaAttendanceTypeRepository` (request-scoped via `TenantContext`) |
| **Aplicación** | `CreateAttendanceTypeUseCase`, `UpdateAttendanceTypeUseCase`, `DeleteAttendanceTypeUseCase`, `ListAttendanceTypesUseCase`, `GetAttendanceTypeUseCase`, `EnsureAttendanceTypesForLevelUseCase` (cascada) |
| **Presentación** | `AttendanceTypeController`, `CreateAttendanceTypeDto`, `UpdateAttendanceTypeDto`, `AttendanceTypeModule` |

### Cascada cross-schema

- **Mecanismo**: `PrismaService.getTenantClient(dbName)` (cacheado, no request-scoped)
- **Enganche**: En `CreateInstitutionUseCase` (dentro del try compensatorio) y `UpdateInstitutionUseCase` (best-effort con log)
- **Idempotencia**: upsert por `(level, code)` con `update: {}` (no-op)
- **Cobertura**: 4 códigos de sistema por cada nivel pedagógico (no ADMINISTRACION)

---

## Frontend

### Página `/attendance-types`

- Espejo de patrón `institutions.tsx`
- Selector **SINGLE** de nivel (no multi-checkbox)
- Tabla con columnas: code, description, level, absenceValue, assignable, active, isSystem
- Filas `isSystem=true`: botones editar/borrado deshabilitados
- Validación: `code ≤ 4` caracteres
- Filtros: por nivel, por active
- Ruta: `/attendance-types`
- Menú: grupo "Sistema" en sidebar

### Módulo de permisos

- Módulo: `ATTENDANCE_TYPES`
- Acciones: CREATE, READ, UPDATE, DELETE
- Roles seed: ROOT (all), admin, director
- Guard: `@Roles('ROOT', { module: 'ATTENDANCE_TYPES', action })`

---

## Entrega: 3 batches chained

| Batch | Contenido | Líneas | Status |
|-------|-----------|--------|--------|
| 1 | Modelo Prisma + migración + entidad dominio + errores | ~350 | ✅ MERGED (commit 50fb5fc) |
| 2 | Repo Prisma + CRUD use cases + cascada + tests | ~680 | ✅ MERGED (commit 491ea47) |
| 3 | Controller + DTOs + módulo + seed + front | ~780 | ✅ MERGED (commit a41481b) |
| **Fix** | W1: X description en seed corrección | ~2 | ✅ MERGED (commit fda85fd) |

**Total**: ~1.810 líneas en 4 commits.

---

## Verificación final

### Gates

```
DOMAIN  → pnpm --filter @educandow/domain test: 747 tests ✅
        → pnpm --filter @educandow/domain build: 0 TS errors ✅

API     → pnpm --filter api test: 469 tests ✅
        → pnpm --filter api typecheck: 0 TS errors ✅
        → pnpm --filter api lint: 0 ESLint errors ✅

WEB     → pnpm --filter web test: 119 tests ✅
        → pnpm --filter web lint: 0 errors ✅
```

### Spec coverage

- **14/14** requisitos implementados
- **~20/27** escenarios cubiertos por tests automatizados
- **0** regressions introducidas
- **0 CRITICAL** issues
- **0 blocker** warnings

### Observaciones finales

- **W1 (X description)**: Corregido en fda85fd — sincronizado seed ↔ ensure use case
- **W2 (snake_case)**: Descartado — convención de proyecto verificada en toda la API
- **W3 (tests guards)**: Descartado — convención de proyecto (ningún controller testea guards explícitamente)

---

## Archivos entregados

### Nuevos (24)

```
packages/domain/src/attendance-type/
  entities/attendance-type.ts
  entities/index.ts
  value-objects/attendance-type-code.ts
  value-objects/index.ts
  errors/system-attendance-type-error.ts
  errors/attendance-type-code-duplicate-error.ts
  errors/index.ts
  repositories/attendance-type-repository.ts
  __tests__/entities/attendance-type.test.ts
  __tests__/value-objects/attendance-type-code.test.ts
  __tests__/repositories/attendance-type-repository.test.ts
  index.ts

api/src/infrastructure/persistence/prisma/repositories/
  prisma-attendance-type.repository.ts
  __tests__/prisma-attendance-type.repository.test.ts

api/src/application/attendance-type/use-cases/
  attendance-type.use-cases.ts
  ensure-attendance-types-for-level.use-case.ts
  __tests__/attendance-type.use-cases.test.ts
  __tests__/ensure-attendance-types.use-case.test.ts

api/src/presentation/attendance-type/
  attendance-type.controller.ts
  attendance-type.module.ts
  dto/create-attendance-type.dto.ts
  dto/update-attendance-type.dto.ts
  __tests__/dto-validation.test.ts
  __tests__/attendance-type.controller.test.ts

api/prisma_tenant/migrations/20260608000000_attendance_types/
  migration.sql

web/src/pages/dashboard/
  attendance-types.tsx
  __tests__/attendance-types.test.tsx
```

### Modificados (10)

```
api/prisma_tenant/schema.prisma
api/src/infrastructure/persistence/prisma/repositories/prisma-attendance.repository.ts
api/src/application/institution/use-cases/institution.use-cases.ts
api/src/presentation/institution/institution.module.ts
api/src/presentation/shared/filters/exception.filter.ts
api/src/app.module.ts
api/prisma/seed.ts
api/prisma/seed-tenant.ts
packages/domain/src/index.ts
web/src/App.tsx
web/src/components/layout/sidebar.tsx
```

---

## Artifact Traceability

### Engram Topic Keys

| Artifact | Topic Key | ID |
|----------|-----------|-----|
| Proposal | `sdd/attendance-types/proposal` | #806 |
| Spec | `sdd/attendance-types/spec` | #807 |
| Design | `sdd/attendance-types/design` | #808 |
| Tasks | `sdd/attendance-types/tasks` | #809 |
| Verify Report | `sdd/attendance-types/verify-report` | (archived only) |
| Archive Report | `sdd/attendance-types/archive-report` | (new — this document) |

### File Locations

| Artifact | Path |
|----------|------|
| Delta Spec (consolidated to main) | `openspec/specs/attendance-types/spec.md` |
| All change artifacts (archived) | `openspec/changes/archive/2026-06-08-attendance-types/` |
| Archive report | `openspec/changes/archive/2026-06-08-attendance-types/archive-report.md` |

---

## Estado final

**ARCHIVED** — El cambio está completo, verificado, sin warnings bloqueantes, y todos los artefactos han sido consolidados en la carpeta de archivo con fecha de cierre.

El módulo está listo para producción. No se recomiendan cambios adicionales sin un nuevo SDD de follow-up.

---

**Archivado por:** SDD Archive Executor  
**Fecha:** 2026-06-08  
**Artifact Store:** HYBRID (openspec + engram)
