# Design: Tipos de Asistencia (attendance-types)

## Enfoque técnico

Reemplazar `AttendanceStatus` (tenant) por `AttendanceType` **por nivel**, replicando el hexagonal de
Institutions. La pieza crítica es la cascada cross-schema: la institución y sus niveles viven en MASTER,
los `AttendanceType` en la tenant DB de cada institución. El mecanismo de conexión cross-schema YA existe:
`PrismaService.getTenantClient(dbName)` construye/cachea un `TenantPrismaClient` por `dbName`
(`educandow_{id}`) **fuera del request-scope**, exactamente lo que necesita la cascada disparada desde
los use cases de institución. El CRUD normal del módulo sigue usando `TenantContext.getClient()`
(request-scoped, como `PrismaAttendanceRepo`).

---

## A. Modelo de datos y migración (tenant DB)

### Modelo Prisma final

```prisma
model AttendanceType {
  id           String    @id @default(uuid())
  level        Int                              // EducationalLevelCode (1..4, 9)
  code         String                           // ≤ 4 chars, mayúsculas: "P","SAB","DOM","X"
  description  String
  absenceValue Decimal   @default(0) @db.Decimal(4, 2) // soporta 0, 0.5, 1, 1.5
  isPresent    Boolean   @default(true)
  assignable   Boolean   @default(true)         // ¿seleccionable en la grilla diaria?
  isSystem     Boolean   @default(false)        // protegido: no editar/borrar
  active       Boolean   @default(true)
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  attendances  Attendance[]

  @@unique([level, code])
  @@index([level])
  @@map("attendance_types")
}
```

`Decimal(4,2)` (no `Float`) por ADR-04. Unicidad **compuesta** `@@unique([level, code])` (ADR-05):
permite que `P` exista una vez por nivel.

### Códigos de sistema (4, por nivel, `isSystem=true`, `active=true`)

| code | description       | isPresent | absenceValue | assignable |
|------|-------------------|-----------|--------------|------------|
| P    | Presente          | true      | 0            | true       |
| SAB  | Sábado            | false     | 0            | false      |
| DOM  | Domingo           | false     | 0            | false      |
| X    | Día inexistente   | false     | 0            | false      |

`SAB/DOM/X` son marcadores de autorrelleno del futuro módulo de grilla → no asignables manualmente.

### Estrategia de migración: REEMPLAZO LIMPIO (ADR-01)

**Hallazgo verificado en código**: NO existe toma de asistencia en el sistema. No hay use case ni
controller de Attendance (solo `prisma-attendance.repository.ts` sin escritura en uso), no hay página
front y NADIE crea registros `Attendance`. El catálogo `attendance_statuses` (PRE/AUS/TAR/JUS/RET) es
solo data de seed SIN registros que lo referencien, y la tabla `attendances` está VACÍA.

Por eso la migración NO preserva datos: es un **reemplazo limpio**. No hay backfill, no hay copia de
filas, no hay re-mapeo de niveles. Los 5 códigos viejos NO se conservan: solo se generan los 4 de
sistema (SAB/DOM/P/X) por nivel vía cascada/seed.

```sql
-- Sin datos a preservar → DROP del catálogo viejo + CREATE del nuevo esquema.
DROP TABLE "attendance_statuses";

CREATE TABLE "attendance_types" (
  "id"           TEXT NOT NULL,
  "level"        INTEGER NOT NULL,
  "code"         TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "absenceValue" DECIMAL(4,2) NOT NULL DEFAULT 0,
  "isPresent"    BOOLEAN NOT NULL DEFAULT true,
  "assignable"   BOOLEAN NOT NULL DEFAULT true,
  "isSystem"     BOOLEAN NOT NULL DEFAULT false,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "deletedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attendance_types_level_code_key" ON "attendance_types"("level","code");
CREATE INDEX "attendance_types_level_idx" ON "attendance_types"("level");

-- Re-apuntar la FK de attendances.statusId al nuevo catálogo (la tabla está VACÍA → seguro).
ALTER TABLE "attendances"
  ADD CONSTRAINT "attendances_statusId_fkey"
  FOREIGN KEY ("statusId") REFERENCES "attendance_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- **FK de `Attendance.statusId`**: el modelo `Attendance` existe pero la tabla está VACÍA → re-apuntar
  la FK a `attendance_types` es una operación segura, sin riesgo de integridad ni necesidad de migrar
  registros. Solo cambia el TIPO del modelo referenciado en Prisma.
- **Orden FK**: aunque el contenido es DROP+CREATE, conviene **escribir el SQL de la migración a mano**
  para controlar el orden (drop de la FK vieja antes del DROP TABLE, recrear FK tras el CREATE TABLE) y
  evitar que `prisma migrate` genere un diff incorrecto. SIN lógica de preservación/backfill.
- **Snapshots de Attendance**: irrelevantes — no hay registros. No se evalúa pérdida de históricos.

---

## B. Cascada cross-schema (master → tenant)

### Mecanismo de conexión

`EnsureAttendanceTypesForLevelUseCase` recibe `PrismaService` y resuelve el cliente tenant por dbName:

```
ensure(dbName, levels: EducationalLevelCode[]):
  client = prismaService.getTenantClient(dbName)   // cacheado, fuera de request-scope
  for level in levels:
    for sysType in SYSTEM_ATTENDANCE_TYPES:         // P, SAB, DOM, X
      client.attendanceType.upsert({
        where:  { level_code: { level, code: sysType.code } },   // idempotente
        create: { level, ...sysType, isSystem: true, active: true },
        update: { }                                  // no-op: NO pisa ediciones del admin
      })
```

Idempotente por `@@unique([level, code])`; `update: {}` evita sobrescribir personalizaciones.

### Enganche en los use cases de institución

```
CreateInstitutionUseCase.execute (dentro del try existente, tras runTenantMigrations):
  await this.adminService.runTenantMigrations(dbName)
  await this.ensureTypes.ensure(dbName, distinctLevels(institutionLevels))   // ← NUEVO
  // si falla → cae al catch existente → rollback total (drop DB + delete master)

UpdateInstitutionUseCase.execute (tras this.repo.update(updated)):
  await this.repo.update(updated)
  try {
    await this.ensureTypes.ensure(existing.dbName, distinctLevels(institutionLevels))  // ← NUEVO
  } catch (e) { logger.error('cascade attendance-types falló', e) }   // best-effort
  return ok(updated)
```

`distinctLevels` deduplica `EducationalLevelCode` (varias modalidades comparten nivel).

### Transaccionalidad (ADR-03)

Master y tenant son **bases distintas** → no hay transacción cross-DB.
- **Create**: la cascada va DENTRO del try existente → si falla, dispara la compensación ya
  implementada (drop tenant DB + delete master). Atómico por compensación.
- **Update**: el master ya commiteó → la cascada es **best-effort con log**. Es seguro porque la
  operación es idempotente: el próximo guardado de la institución (o re-trigger) sana el estado. Fallar
  el update entero tras commitear master dejaría un estado peor.

---

## C. Backend hexagonal (capas)

- **Dominio** (`packages/domain/src/attendance-type/`):
  - `AttendanceType` entidad con `create`/`reconstruct`. Invariantes: `code` ≤ 4 vía VO
    `AttendanceTypeCode` (mayúsculas, no vacío); `assertMutable()` lanza `SystemAttendanceTypeError`
    si `isSystem`.
  - VO `AttendanceTypeCode`. Errores: `SystemAttendanceTypeError` (nuevo); reusa `ValidationError`,
    `NotFoundError`.
  - Puerto `AttendanceTypeRepository` (findById, findByLevel, list, save, softDelete, existsByLevelCode).
- **Infra** (`prisma-attendance-type.repository.ts`): implementa el puerto usando
  `TenantContext.getClient()` (CRUD request-scoped). Mapea `Decimal → number`.
- **Aplicación**:
  - `Create/Update/Delete/List/Get` use cases. `Update`/`Delete` rechazan si `isSystem`
    (`SystemAttendanceTypeError`).
  - `EnsureAttendanceTypesForLevelUseCase` (cascada, usa `PrismaService.getTenantClient`).
- **Presentación**: `AttendanceTypeController` con `@Roles('ROOT', { module: 'ATTENDANCE_TYPES', action })`,
  DTOs zod (`code` ≤4, `level` enum, `absenceValue` ≥0), `ZodValidationPipe`, mapeo de errores a HTTP
  idéntico a Institutions (`if (result.isErr()) throw result.unwrapErr()`).
- **Seed**: módulo `{ id: 'm-attendance-types', code: 'ATTENDANCE_TYPES', name: 'Tipos de Asistencia' }`
  en `modules[]`; asignación a `r-root` (ALL) y `r-admin`/`r-director`. `seedAttendanceStatuses` →
  `seedSystemAttendanceTypes(client, levels)` que upsertea P/SAB/DOM/X por nivel.

### Flujo de datos

```
Crear/editar institución (MASTER)
   └─ UseCase ─ repo.save/update (master) ─→ ensureTypes.ensure(dbName, levels)
                                                  └─ getTenantClient(dbName) ─ upsert P/SAB/DOM/X (TENANT)

CRUD módulo Tipos de Asistencia
   Controller ─ UseCase ─ PrismaAttendanceTypeRepo ─ TenantContext.getClient() (TENANT del usuario logueado)
```

---

## D. Frontend

**Modelo de scoping**: cada INSTITUCIÓN (tenant DB) tiene sus `AttendanceType`, divididos POR NIVEL. Un
`AttendanceType` pertenece a UN solo nivel (campo `level`); unicidad `@@unique([level, code])`. Solo los
4 códigos globales del sistema (SAB/DOM/P/X) se auto-generan en cascada por cada nivel de la institución.
Los demás tipos (Ausente, Tarde, Justificado, etc.) los crea el usuario manualmente, POR NIVEL.

`web/src/pages/dashboard/attendance-types.tsx` espejo de `institutions.tsx`: `PremiumHeader`, `Card`,
form, `Table`, hooks `useApiList/useApiDelete`. Al crear un tipo, el usuario selecciona **UN** nivel con
un **selector single** (`<select>` de nivel, NO multi-checkbox / NO atajo multi-nivel): cada nivel
gestiona sus propios tipos. La grilla/tabla puede mostrar y/o filtrar por nivel. Filas con
`isSystem=true` → sin botones editar/borrar (o deshabilitados). Validación `code` ≤ 4 en el form. Ruta
en `App.tsx` y entrada de menú en `sidebar.tsx` dentro del grupo **Sistema** con
`moduleCode: 'ATTENDANCE_TYPES'`.

---

## E. Manifiesto de archivos

### Nuevos
| Archivo | Capa | Líneas |
|---|---|---|
| `packages/domain/src/attendance-type/entities/attendance-type.ts` | dominio | ~120 |
| `packages/domain/src/attendance-type/value-objects/attendance-type-code.ts` | dominio | ~40 |
| `packages/domain/src/attendance-type/repositories/attendance-type-repository.ts` | dominio | ~20 |
| `packages/domain/src/attendance-type/errors/system-attendance-type-error.ts` | dominio | ~15 |
| `packages/domain/src/attendance-type/{index,entities/index,value-objects/index}.ts` | dominio | ~25 |
| `api/.../prisma/repositories/prisma-attendance-type.repository.ts` | infra | ~110 |
| `api/src/application/attendance-type/use-cases/attendance-type.use-cases.ts` | app | ~200 |
| `api/.../use-cases/ensure-attendance-types-for-level.use-case.ts` | app | ~70 |
| `api/src/presentation/attendance-type/attendance-type.controller.ts` | pres | ~120 |
| `api/src/presentation/attendance-type/attendance-type.module.ts` | pres | ~70 |
| `api/src/presentation/attendance-type/dto/create-attendance-type.dto.ts` | pres | ~30 |
| `api/src/presentation/attendance-type/dto/update-attendance-type.dto.ts` | pres | ~25 |
| `api/prisma_tenant/migrations/XXXX_attendance_types/migration.sql` | datos | ~35 (DROP+CREATE+FK) |
| `web/src/pages/dashboard/attendance-types.tsx` | front | ~350 |
| Tests (entidad, VO, ensure UC, CRUD UC, controller/DTO, front) | test | ~620 |

### Modificados
| Archivo | Cambio | Líneas |
|---|---|---|
| `api/prisma_tenant/schema.prisma` | reemplazar modelo `AttendanceStatus` por `AttendanceType` (esquema nuevo); re-apuntar relación `Attendance.status` | ~+20/-10 |
| `api/.../repositories/prisma-attendance.repository.ts` | `attendanceStatus`→`attendanceType` | ~6 |
| `api/src/application/institution/use-cases/institution.use-cases.ts` | hook cascada create/update | ~+30 |
| `api/src/presentation/institution/institution.module.ts` | inyectar `EnsureAttendanceTypesForLevelUseCase` | ~+15 |
| `api/prisma/seed.ts` | módulo `ATTENDANCE_TYPES` + roles + `seedSystemAttendanceTypes` | ~+45 |
| `api/prisma/seed-tenant.ts` | llamar nuevo seed por nivel | ~+5 |
| `packages/domain/src/index.ts` | export `attendance-type` | ~+2 |
| `api/src/app.module.ts` | registrar `AttendanceTypeModule` | ~+2 |
| `web/src/App.tsx` | ruta `/attendance-types` | ~+3 |
| `web/src/components/layout/sidebar.tsx` | entrada de menú grupo Sistema | ~+2 |

**Totales**: ~22 nuevos, ~10 modificados. **Líneas estimadas ≈ 2.100** (≈1.870 nuevas + ≈230 mod).
Excede el budget de 400 líneas de review → entrega en **3 batches con verificación entre cada uno**
(ver sección G), alineados a chained/stacked PRs.

---

## G. Secuencia de entrega (3 batches)

La implementación va en **3 batches**, con verificación entre cada uno (cada batch ≈ un PR encadenado):

**Batch 1 — Datos + dominio**
- Modelo Prisma `attendance_types` (esquema nuevo) en `schema.prisma`.
- Migración tenant por **reemplazo limpio** (DROP `attendance_statuses` + CREATE `attendance_types` +
  re-apuntar FK de `attendances`).
- Entidad de dominio `AttendanceType` + VO `AttendanceTypeCode`.
- Errores (`SystemAttendanceTypeError`) + tests de dominio.

**Batch 2 — Aplicación + infraestructura + cascada**
- Puerto `AttendanceTypeRepository` + repo Prisma con `TenantContext`.
- Use cases CRUD (`Create/Update/Delete/List/Get`).
- `EnsureAttendanceTypesForLevelUseCase` + enganche de cascada en `Create/UpdateInstitutionUseCase`.
- Tests (repo, use cases, cascada idempotente).

**Batch 3 — Presentación + seed + front**
- Controller + DTOs zod + mapeo de errores HTTP + módulo NestJS.
- Seed: módulo permisos `ATTENDANCE_TYPES` + `seedSystemAttendanceTypes` por nivel.
- Página front + ruta en `App.tsx` + entrada de menú (grupo **Sistema**).
- Tests (controller/DTO, front).

---

## F. ADRs

| # | Decisión | Elegido | Alternativa descartada | Rationale |
|---|---|---|---|---|
| 01 | Migración | **Reemplazo limpio**: DROP `attendance_statuses` + CREATE `attendance_types` + re-apuntar FK; NO se conservan los 5 códigos viejos | RENAME+ALTER+backfill (preservación de datos) | Verificado: NO hay toma de asistencia, tabla `attendances` VACÍA y catálogo viejo sin uso → no hay datos a preservar; el reemplazo limpio es seguro y elimina toda la complejidad/riesgo de backfill |
| 02 | Mecanismo cross-schema | `PrismaService.getTenantClient(dbName)` (cacheado, no request-scoped) en la cascada; `TenantContext` solo en CRUD | Forzar `TenantContext` en cascada | El use case de institución corre fuera del tenant-context del target; `getTenantClient` ya resuelve por dbName |
| 03 | Transaccionalidad cascada | Create: dentro del try (rollback por compensación). Update: best-effort + log | Transacción cross-DB / fallar update entero | No hay tx cross-DB; idempotencia hace que best-effort sane en el próximo save |
| 04 | Tipo `absenceValue` | `Decimal @db.Decimal(4,2)` | `Float` | Float no es exacto para 0.5/1.5; Decimal(4,2) cubre el dominio con margen |
| 05 | Unicidad | `@@unique([level, code])` | `@unique(code)` global | Cada nivel necesita su propio set (P por nivel); evita colisión y habilita cascada idempotente |

## Testing

| Capa | Qué | Cómo |
|---|---|---|
| Unit (dominio) | invariantes `code≤4`, `isSystem` bloquea mutación | tests entidad + VO |
| Unit (app) | `ensure` idempotente (re-run sin duplicar), `Update/Delete` rechazan isSystem | mock repo/client |
| Integration | controller + zod + @Roles; mapeo de errores HTTP | supertest |
| E2E/manual | cascada al crear/editar institución escribe en tenant DB | revisión manual |

## Open Questions

- [x] ~~Backfill a PRIMARIO(2) de los códigos viejos~~ → RESUELTO: migración por reemplazo limpio, no
  hay datos a preservar (verificado: sin toma de asistencia, `attendances` vacía).
- [x] ~~Front multi vs single de nivel~~ → RESUELTO: **selector single** de nivel por tipo; cada nivel
  gestiona sus propios tipos.
