# Tasks: Permisos de Estudiantes con Tutores

**Change**: `09-student-permissions`
**Depends on**: `08-institutions-module`

---

## Fase 1 — Domain

### T1.1 ✅ — StudentGuardian Entity ✅
**Prioridad**: P0
**Archivos**:
- `packages/domain/src/personnel/entities/student-guardian.ts` (create)
- `packages/domain/src/personnel/entities/index.ts` (modify)
**Tests**:
- `packages/domain/src/personnel/__tests__/student-guardian.test.ts` — create, reconstruct, getters, duplicate composite key rejection
**Criterio de aceptación**:
- `StudentGuardian.create()` genera Id propio, valida `relationship` enum, setea `createdAt`
- `StudentGuardian.reconstruct()` acepta props completos con Id existente
- Getters: `id`, `studentId`, `userId`, `relationship`, `createdAt`
- `create` rechaza relationship inválido con DomainError

### T1.2 ✅ — Student Nuevos Campos
**Prioridad**: P0
**Archivos**:
- `packages/domain/src/personnel/entities/student.ts` (modify)
**Tests**:
- `packages/domain/src/personnel/__tests__/student.test.ts` — getters para `address`, `phone`, `photoUrl`, `userId`
**Criterio de aceptación**:
- `StudentProps` incluye `address?: string`, `phone?: string`, `photoUrl?: string`, `userId?: string`
- Getters correspondientes agregados
- `create` y `reconstruct` funcionan con campos opcionales

### T1.3 ✅ — StudentGuardian Repository Interface
**Prioridad**: P0
**Archivos**:
- `packages/domain/src/personnel/repositories/student-guardian-repository.ts` (create)
- `packages/domain/src/personnel/repositories/index.ts` (modify)
**Tests**: No requiere (interface pura)
**Criterio de aceptación**:
- Interface con: `save`, `findById`, `findByStudentId`, `findByGuardianUserId`, `delete`, `findByComposite`
- Re-exportada desde `index.ts`

### T1.4 ✅ — Student Repository Nuevos Métodos
**Prioridad**: P0
**Archivos**:
- `packages/domain/src/personnel/repositories/student-repository.ts` (modify)
**Tests**: No requiere (interface pura)
**Criterio de aceptación**:
- `findByUserId(userId: string): Promise<Student | null>` agregado
- `findByGuardianUserId(guardianUserId: string): Promise<Student[]>` agregado

---

## Fase 2 — Prisma

### T2.1 ✅ — Schema Tenant: Student campos nuevos + StudentGuardian model
**Prioridad**: P0
**Archivos**:
- `api/prisma/schema_tenant.prisma` (modify)
**Tests**: No requiere
**Criterio de aceptación**:
- Model `Student` tiene `address String?`, `phone String?`, `photoUrl String?`, `userId String?`
- Model `StudentGuardian` con `id`, `studentId`, `userId`, `relationship` (enum), `createdAt`
- `@@unique([studentId, userId])` en StudentGuardian
- `@@map("student_guardians")`
- Enum `GuardianRelationship` con `mother`, `father`, `legal_guardian`, `other`

### T2.2 ✅ — Migración Prisma
**Prioridad**: P0
**Archivos**:
- `api/prisma/migrations/<timestamp>_student_permissions/migration.sql` (create — vía `prisma migrate dev`)
**Tests**: No requiere
**Criterio de aceptación**:
- `prisma migrate dev` genera SQL sin errores
- Tabla `student_guardians` creada con índice unique
- Columnas nuevas en `students` sin romper datos existentes

### T2.3 ✅ — Script Migración Legacy Guardians
**Prioridad**: P1
**Archivos**:
- `api/prisma/migrate-guardians.ts` (create)
**Tests**:
- Test manual: ejecutar script y verificar StudentGuardian creados para guardianPhone matching
**Criterio de aceptación**:
- Script idempotente: segunda ejecución no crea duplicados
- Busca User en master DB por phone match
- Crea StudentGuardian con `relationship: 'other'` para matches
- Preserva `guardianName`/`guardianPhone` en Students sin match
- Log de warnings para userId no encontrados en master

---

## Fase 3 — Infrastructure

### T3.1 ✅ — PrismaStudentGuardianRepository
**Prioridad**: P0
**Archivos**:
- `api/src/infrastructure/persistence/prisma/repositories/prisma-student-guardian.repository.ts` (create)
**Tests**:
- `api/test/integration/prisma-student-guardian.repository.test.ts` — CRUD, composite unique, findByGuardianUserId
**Criterio de aceptación**:
- Implementa `StudentGuardianRepository`
- `save` inserta/actualiza via Prisma tenant client
- `findByComposite` verifica duplicados antes de insert
- `delete` lanza NotFoundError si no existe
- `toDomain` / `toPersistence` mappers correctos

### T3.2 ✅ — PrismaStudentRepository Actualización
**Prioridad**: P0
**Archivos**:
- `api/src/infrastructure/persistence/prisma/repositories/prisma-student.repository.ts` (modify)
**Tests**:
- Tests existentes deben seguir pasando
- `api/test/integration/prisma-student.repository.test.ts` — findByUserId, findByGuardianUserId
**Criterio de aceptación**:
- `findByUserId` retorna Student con userId match
- `findByGuardianUserId` usa JOIN a student_guardians para filtrar
- `toDomain` mapea nuevos campos (`address`, `phone`, `photoUrl`, `userId`)
- `save` persiste nuevos campos

---

## Fase 4 — Application

### T4.1 ✅ — PatchStudentUseCase (field-level permissions)
**Prioridad**: P0
**Archivos**:
- `api/src/application/student/use-cases/student.use-cases.ts` (modify)
**Tests**:
- `api/test/unit/patch-student.use-case.test.ts` — 6 escenarios: STUDENT allowed, STUDENT blocked, STUDENT otro student, TUTOR allowed, TUTOR no-child, ADMIN all fields, mixed fields
**Criterio de aceptación**:
- `ALLOWED_TUTOR_FIELDS = ['phone', 'address', 'photoUrl', 'email', 'birthDate', 'guardianPhone']`
- ADMIN/MGR/TEACHER/PRECEPTOR editan todos los campos
- STUDENT solo edita su propio student (userId match)
- TUTOR solo edita hijos (StudentGuardian link)
- Campos bloqueados → `ForbiddenError` con mensaje del campo
- Ownership check antes de actualizar

### T4.2 ✅ — GetMyStudentDataUseCase
**Prioridad**: P0
**Archivos**:
- `api/src/application/student/use-cases/student.use-cases.ts` (modify)
**Tests**:
- `api/test/unit/get-my-student-data.use-case.test.ts` — student found, student not found (404)
**Criterio de aceptación**:
- `execute(userId)` → `studentRepo.findByUserId(userId)`
- Retorna Student o lanza `NotFoundError`

### T4.3 ✅ — GetMyChildrenUseCase
**Prioridad**: P0
**Archivos**:
- `api/src/application/student/use-cases/student.use-cases.ts` (modify)
**Tests**:
- `api/test/unit/get-my-children.use-case.test.ts` — tutor con hijos, tutor sin hijos (array vacío)
**Criterio de aceptación**:
- `execute(userId)` → `studentGuardianRepo.findByGuardianUserId(userId)`
- Mapea guardian records → Students
- Retorna array vacío si no hay hijos

### T4.4 ✅ — AssignGuardianUseCase
**Prioridad**: P1
**Archivos**:
- `api/src/application/student/use-cases/student.use-cases.ts` (modify)
**Tests**:
- `api/test/unit/assign-guardian.use-case.test.ts` — asignación exitosa, duplicado (409), student no existe (404), relationship inválido
**Criterio de aceptación**:
- Valida student existe
- Valida relationship enum
- Verifica no duplicado (composite unique)
- Crea y guarda StudentGuardian
- Log warning si userId no existe en master (cross-DB)

### T4.5 ✅ — RemoveGuardianUseCase
**Prioridad**: P1
**Archivos**:
- `api/src/application/student/use-cases/student.use-cases.ts` (modify)
**Tests**:
- `api/test/unit/remove-guardian.use-case.test.ts` — eliminación exitosa, guardian no existe (404)
**Criterio de aceptación**:
- Valida StudentGuardian existe
- Elimina registro
- Retorna void o lanza `NotFoundError`

---

## Fase 5 — Presentation

### T5.1 ✅ — DTOs
**Prioridad**: P0
**Archivos**:
- `api/src/presentation/student/dto/update-student.dto.ts` (create)
- `api/src/presentation/student/dto/assign-guardian.dto.ts` (create)
**Tests**:
- `api/test/unit/update-student.dto.test.ts` — validación campos permitidos/bloqueados
- `api/test/unit/assign-guardian.dto.test.ts` — userId requerido, relationship enum
**Criterio de aceptación**:
- `UpdateStudentSchema` (Zod): partial de todos los campos de Student
- `AssignGuardianSchema` (Zod): `userId` (uuid, required), `relationship` (enum, required)

### T5.2 ✅ — Student Controller Nuevos Endpoints
**Prioridad**: P0
**Archivos**:
- `api/src/presentation/student/student.controller.ts` (modify)
**Tests**:
- `api/test/e2e/students.controller.e2e.test.ts` — PATCH field-block 403, GET /me 200/404, GET /my-children 200/[], POST guardians 201/403, DELETE guardians 204/403/404
**Criterio de aceptación**:
- `PATCH /v1/students/:id` — `@Roles({ module: 'STUDENTS', action: 'UPDATE' })` O `@Roles({ module: 'STUDENTS', action: 'READ' })` (field-check en use case)
- `GET /v1/students/me` — `@Roles({ module: 'STUDENTS', action: 'READ' })`
- `GET /v1/students/my-children` — `@Roles({ module: 'STUDENTS', action: 'READ' })`
- `POST /v1/students/:id/guardians` — `@Roles('ROOT', 'ADMIN')`
- `DELETE /v1/students/:id/guardians/:guardianId` — `@Roles('ROOT', 'ADMIN')`
- Todos los endpoints pasan userId y roles al use case

### T5.3 ✅ — Student Module Registration
**Prioridad**: P0
**Archivos**:
- `api/src/presentation/student/student.module.ts` (modify)
**Tests**: No requiere
**Criterio de aceptación**:
- Nuevos use cases registrados como providers
- `PrismaStudentGuardianRepository` registrado e inyectado
- `PrismaStudentRepository` actualizado con nuevos métodos

---

## Fase 6 — Seed

### T6.1 ✅ — Seed RBAC: TUTOR y STUDENT permissions
**Prioridad**: P0
**Archivos**:
- `api/prisma/seed-rbac.sql` (modify)
- `api/prisma/seed.ts` (modify)
**Tests**:
- Verificación manual: `pnpm prisma db seed` y consultar `role_modules`
**Criterio de aceptación**:
- `r-tutor` → INSERT en `role_modules` con `m-students`, `READ`
- `r-student` → INSERT en `role_modules` con `m-students`, `READ`
- Solo READ — sin CREATE, UPDATE, DELETE para estos roles
- Idempotente: re-ejecutar seed no duplica filas

---

## Fase 7 — Frontend

### T7.1 ✅ — Modo TUTOR: Tabla Filtrada
**Prioridad**: P1
**Archivos**:
- `web/src/pages/dashboard/students.tsx` (modify)
**Tests**: No requiere (manual UI)
**Criterio de aceptación**:
- Detecta rol TUTOR → llama `GET /v1/students/my-children`
- Renderiza tabla con hijos del tutor
- Sin botón de crear/editar campos bloqueados

### T7.2 ✅ — Modo STUDENT: Ficha Readonly
**Prioridad**: P1
**Archivos**:
- `web/src/pages/dashboard/students.tsx` (modify)
**Tests**: No requiere (manual UI)
**Criterio de aceptación**:
- Detecta rol STUDENT → llama `GET /v1/students/me`
- Muestra ficha del estudiante
- Campos no editables por STUDENT aparecen como readonly
- Campos editables (`phone`, `address`, `photoUrl`, `email`, `birthDate`, `guardianPhone`) habilitados

### T7.3 ✅ — Modo ADMIN/MGR/TEACHER/PRECEPTOR: Full Access
**Prioridad**: P1
**Archivos**:
- `web/src/pages/dashboard/students.tsx` (modify)
**Tests**: No requiere (manual UI)
**Criterio de aceptación**:
- Roles con `STUDENTS:UPDATE` mantienen acceso completo a CRUD
- Sin cambios de comportamiento respecto al estado actual

---

## Fase 8 — Verificación

### T8.1 ✅ — Tests Unitarios Domain
**Prioridad**: P0
**Archivos**:
- `packages/domain/src/personnel/__tests__/student-guardian.test.ts`
- `packages/domain/src/personnel/__tests__/student.test.ts`
**Criterio de aceptación**:
- `pnpm test` pasa en packages/domain
- Cobertura mínima: 80% en entities nuevas

### T8.2 ✅ — Tests Unitarios Application
**Prioridad**: P0
**Archivos**:
- `api/test/unit/patch-student.use-case.test.ts`
- `api/test/unit/get-my-student-data.use-case.test.ts`
- `api/test/unit/get-my-children.use-case.test.ts`
- `api/test/unit/assign-guardian.use-case.test.ts`
- `api/test/unit/remove-guardian.use-case.test.ts`
**Criterio de aceptación**:
- Todos los escenarios de spec cubiertos
- Mock repos funcionando
- `pnpm test` pasa en api

### T8.3 ✅ — Tests Integration Infrastructure
**Prioridad**: P0
**Archivos**:
- `api/test/integration/prisma-student-guardian.repository.test.ts`
- `api/test/integration/prisma-student.repository.test.ts`
**Criterio de aceptación**:
- CRUD de StudentGuardian contra tenant DB
- Composite unique enforcement
- findByGuardianUserId retorna correctos

### T8.4 ✅ — Tests E2E Presentation
**Prioridad**: P0
**Archivos**:
- `api/test/e2e/students.controller.e2e.test.ts`
**Criterio de aceptación**:
- Supertest con JWT mock por rol
- 403 en campos bloqueados, 404 en /me sin student, 200 en /my-children vacío
- 201 en POST guardians, 204 en DELETE
- 403 para TUTOR en POST/DELETE guardians

### T8.5 ✅ — Build Final
**Prioridad**: P0
**Archivos**: Todos
**Criterio de aceptación**:
- `pnpm build` pasa sin errores en workspace completo
- `pnpm lint` sin errores
- `pnpm test` pasa en todos los paquetes
