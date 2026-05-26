# Proposal: Permisos de Estudiantes con Tutores

## Intent

El módulo students carece de PATCH, relación Student-Tutor (solo strings guardianName/phone), y TUTOR/STUDENT sin acceso. Se agrega entidad `StudentGuardian` (N:M), nuevos campos, endpoints faltantes y RBAC con field-level permissions.

Pedagogical level: **ALL**.

## Scope

### In Scope
- Entidad `StudentGuardian` (N:M Student↔User), campo `userId` en Student
- Campos `address`, `phone`, `photoUrl` en Student
- Migración `guardianName`/`guardianPhone` → `StudentGuardian`
- Endpoints: `PATCH /students/:id`, `GET /students/me`, `GET /students/my-children`
- Field-level permissions: TUTOR/STUDENT solo editan 6 campos (resto → 403)
- `@Roles` con TUTOR, STUDENT, PRECEPTOR
- Seed: `STUDENTS:READ` para TUTOR y STUDENT
- Frontend: tabla TUTOR, ficha STUDENT, campos readonly

### Out of Scope
- Soft-delete / edición masiva / PRECEPTOR seed

## Capabilities

### New Capabilities
- **student-profile**: campos `address`/`phone`/`photoUrl`/`userId`, `PATCH /students/:id` con field-level permissions, `GET /students/me`.
- **student-guardian**: entidad `StudentGuardian` N:M, migración de datos, `GET /students/my-children`.

### Modified Capabilities
- **auth-access**: permissions TUTOR (hijos) y STUDENT (perfil propio). Field-level check en use case de PATCH.

## Approach

Domain-first: entity + repo interfaces → migración `schema_tenant.prisma` → repos Prisma → use cases → controller. Field-level se valida en use case (necesita body + rol). Cross-DB: `StudentGuardian.userId` referencia User master, validación en app layer sin FK.

## Affected Areas

| Layer | Files |
|-------|-------|
| Domain | `student.ts` (+campos), nuevo `student-guardian.ts`, repo interfaces |
| Prisma | `schema_tenant.prisma` (tabla + campos) |
| Infrastructure | `PrismaStudentGuardianRepository`, `PrismaStudentRepository` |
| Application | `PatchStudentUseCase`, `GetMyChildrenUseCase`, `GetOwnStudentUseCase` |
| Presentation | `students.controller.ts` + DTOs |
| Seed | `seed.ts`, `seed-rbac.sql` |
| Frontend | `students.tsx` |

## Risks

| Risk | Mitigation |
|------|------------|
| Cross-DB integrity (StudentGuardian→User) | Validación app layer, log warning |
| guardianName/phone sin User asociado | Insertar con `userId: null` |
| Field-level bypass | Validación en use case + tests por rol |

## Rollback Plan

Revert commit + migración. Seed: eliminar filas TUTOR/STUDENT de `role_modules`. guardianName/phone se preservan durante migración para restauración.

## Dependencies

- `08-institutions-module` (patrón `@Roles` establecido), Prisma migration tooling

## Success Criteria

- [ ] TUTOR ve solo sus hijos en `/my-children`; STUDENT solo su ficha en `/me`
- [ ] `PATCH` bloquea campos no permitidos con 403 para TUTOR/STUDENT
- [ ] ADMIN/MGR/TEACHER/PRECEPTOR editan todos los campos
- [ ] Migración guardianName/phone sin pérdida de datos
- [ ] Frontend: readonly según rol, TUTOR ve tabla filtrada
- [ ] Seed otorga STUDENTS:READ a TUTOR y STUDENT
- [ ] `pnpm test` pasa
