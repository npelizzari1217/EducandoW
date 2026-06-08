# Proposal: Tipos de Asistencia (attendance-types)

## Intent

EducandoW necesita un catálogo configurable de **Tipos de Asistencia** por nivel educativo, administrable desde el módulo Sistema. El modelo actual `AttendanceStatus` (tenant DB) es global, sin nivel, sin distinción de códigos protegidos del sistema ni de asignabilidad. Se reemplaza por `AttendanceType` como única fuente de verdad, base imprescindible para el futuro módulo de toma de asistencia diaria.

Pedagogical level: **ALL**.

## Scope

### In Scope
- Modelo `AttendanceType` (tenant DB) + migración desde `AttendanceStatus`
- Dominio (entidad, VOs, errores, repo interfaz) + repo Prisma con `TenantContext`
- Use cases CRUD + controller + DTOs zod + módulo NestJS
- 4 códigos de sistema protegidos por nivel: SAB, DOM, P, X
- Cascada idempotente por nivel en Create/Update institución (cross-schema master→tenant)
- Módulo de permisos `ATTENDANCE_TYPES` en seed + entrada de menú (grupo Sistema)
- Página front CRUD reusando patrón Instituciones; isSystem read-only
- Tests (strict TDD)

### Out of Scope
- Grilla mensual / toma de asistencia diaria (rellenar P en L-V, X días inexistentes) → módulo futuro
- Reportes de presentismo y cómputo de inasistencias

## Capabilities

### New Capabilities
- `attendance-types`: CRUD de tipos de asistencia por nivel, códigos de sistema protegidos, cascada de provisión por nivel

### Modified Capabilities
- `institution-lifecycle`: Create/Update institución dispara provisión idempotente de tipos de sistema por cada nivel asignado

## Approach

- **Datos**: migrar `AttendanceStatus` → `AttendanceType` agregando `level`, `assignable`, `isSystem`; preservar históricos vía snapshots inmutables en `Attendance` (no se tocan). Enfoque fino (rename+alter vs nuevo+backfill) se decide en design.
- **Backend**: replicar hexagonal de Institutions. `code` máx 4 chars único por `(level, code)`; `absenceValue` Decimal (1.5). Tipos isSystem rechazan edición/borrado en dominio.
- **Cascada**: extraer servicio `ensureAttendanceTypes(institution, levels)` idempotente (upsert por level+code), invocado desde Create/UpdateInstitutionUseCase. Escribe en tenant DB de la institución target → cross-schema.
- **Permisos/Front**: `@Roles('ROOT', { module: 'ATTENDANCE_TYPES', action })`; página espejo de `institutions.tsx` con acciones deshabilitadas en filas isSystem.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/prisma_tenant/schema.prisma` | Modified | `AttendanceStatus`→`AttendanceType` + migración |
| `packages/domain/src/attendance-type/` | New | Entidad, VOs, errores, repo interfaz |
| `api/src/{infrastructure,application,presentation}/attendance-type/` | New | Repo Prisma, use cases, controller, DTOs, módulo |
| `api/src/application/institution/.../institution.use-cases.ts` | Modified | Hook cascada en create/update |
| `api/prisma/seed.ts`, `seed-tenant.ts` | Modified | Módulo `ATTENDANCE_TYPES` + provisión por nivel |
| `web/src/pages/dashboard/attendance-types.tsx`, `sidebar.tsx`, `App.tsx` | New/Modified | Página CRUD + menú + ruta |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migración rompe FK a `Attendance` históricos | Med | Snapshots inmutables ya desacoplan; preservar id/FK en migración |
| Cascada cross-schema (master→tenant) | High | Resolver tenant client por institución; transaccional por tenant; design define el mecanismo |
| Cascada no idempotente duplica códigos | Med | Upsert por `(level, code)`; unique compuesto |

## Rollback Plan

Revertir migración Prisma (down restaura `AttendanceStatus`) y commit. Sin pérdida de históricos: `Attendance` conserva snapshots. Quitar módulo `ATTENDANCE_TYPES` del seed para nuevas instalaciones.

## Dependencies

Ninguna externa. Reusa `EducationalLevelCode`, `TenantContext`, patrón Institutions.

## Success Criteria

- [ ] `AttendanceType` migrado, históricos intactos
- [ ] 4 códigos de sistema por nivel, protegidos
- [ ] Cascada idempotente al guardar niveles de institución
- [ ] CRUD funcional con permisos `ATTENDANCE_TYPES`
- [ ] Página front operativa; isSystem read-only
- [ ] Tests pasan (`pnpm test`)
