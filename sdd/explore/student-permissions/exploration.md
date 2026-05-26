# Exploration: Permisos de Estudiantes en EducandoW

## Current State

### 1. API — Students Controller

Ruta base: `api/src/presentation/student/student.controller.ts`

| Método | Ruta | Decorator `@Roles` | ¿Funciona? |
|--------|------|-------------------|------------|
| POST | `/students` | `ADMIN`, `MANAGER` | Crea estudiante |
| GET | `/students/search?q=&institutionId=` | `ADMIN`, `MANAGER`, `TEACHER` | Búsqueda por texto |
| GET | `/students?institutionId=` | `ADMIN`, `MANAGER`, `TEACHER` | Lista por institución |
| GET | `/students/:id` | `ADMIN`, `MANAGER`, `TEACHER` | Obtiene uno |
| DELETE | `/students/:id` | `ADMIN` | Hard delete |

**Lo que NO existe:**
- No hay PATCH/UPDATE — no se puede modificar un estudiante desde la API
- ROOT no está explícito pero el `RolesGuard` tiene bypass automático para ROOT
- TUTOR, STUDENT y PRECEPTOR NO aparecen en ningún `@Roles` del controller
- No hay endpoint para "mi perfil" (que STUDENT vea sus propios datos)
- No hay endpoint para "mis hijos" (que TUTOR vea sus estudiantes)

### 2. API — Student Use Cases

Archivo: `api/src/application/student/use-cases/student.use-cases.ts`

Use cases implementados:
- `CreateStudentUseCase` — crea, valida DNI único
- `ListStudentsUseCase` — lista por institutionId (el repo lo ignora, va al tenant DB)
- `GetStudentUseCase` — por ID
- `DeleteStudentUseCase` — hard delete

**Lo que NO existe:**
- `UpdateStudentUseCase`
- `GetOwnProfileUseCase` (para STUDENT)
- `GetGuardianChildrenUseCase` (para TUTOR)

### 3. Domain — Student Entity

Archivo: `packages/domain/src/personnel/entities/student.ts`

Campos actuales:
```
id, firstName, lastName, dni, email?, birthDate?,
guardianName?, guardianPhone?, institutionId, active, deletedAt
```

Campos requeridos para TUTOR/STUDENT que FALTAN:
- `address` (Dirección) — ❌
- `phone` (Teléfono del alumno) — ❌
- `photo` / `photoUrl` (Foto) — ❌

### 4. Student ↔ Tutor Relationship

**NO EXISTE.** El modelo `Student` en Prisma tiene `guardianName` y `guardianPhone` como strings planos. No hay tabla `StudentGuardian` ni FK a User.

### 5. Frontend — Students Page

Archivo: `web/src/pages/dashboard/students.tsx`

- Lista + crear + eliminar ✅
- Formulario de edición ❌
- Vista de detalle ❌
- Diferenciación por rol ❌

### 6. Seed — Permisos por Rol

| Rol | Módulo STUDENTS | Acciones |
|-----|----------------|----------|
| ROOT | ✅ | READ, CREATE, UPDATE, DELETE, PRINT |
| ADMIN | ✅ | READ, CREATE, UPDATE, DELETE, PRINT |
| MANAGER | ✅ | READ, CREATE, UPDATE, DELETE, PRINT |
| TEACHER | ✅ | READ |
| TUTOR | ❌ | — |
| STUDENT | ❌ | — |
| PRECEPTOR | ❌ (no seedeado) | — |

### 7. Role Hierarchy

`packages/domain/src/auth/role-hierarchy.ts`:
ROOT(99), ADMIN(60), DIRECTOR(50), SECRETARIO(40), PRECEPTOR(30), TEACHER(20), TUTOR(10), STUDENT(0)

Inconsistencias: MANAGER está seedeado pero no en jerarquía. DIRECTOR/SECRETARIO/PRECEPTOR están en jerarquía pero no seedeados.

---

## Gaps (Resumen)

| # | Gap | Severidad |
|---|-----|-----------|
| 1 | No hay PATCH/UPDATE | 🔴 Crítico |
| 2 | No existe relación Student ↔ Tutor en BD | 🔴 Crítico |
| 3 | Faltan campos: address, phone, photoUrl | 🟡 Alto |
| 4 | TUTOR/STUDENT sin acceso a /students | 🔴 Crítico |
| 5 | No hay GET /students/me | 🔴 Crítico |
| 6 | No hay GET para TUTOR (mis hijos) | 🔴 Crítico |
| 7 | PRECEPTOR en hierarchy pero no seedeado | 🟡 Medio |
| 8 | MANAGER no en jerarquía | 🟡 Medio |
| 9 | Frontend sin edición/detalle | 🟡 Alto |
| 10 | Delete es hard delete | 🟡 Medio |
| 11 | Falta scoping tenant para TUTOR/STUDENT | 🟡 Alto |

---

## Approaches

### 1. Tabla StudentGuardian (studentId → userId)

Crear tabla `StudentGuardian` en tenant DB con `studentId` y `userId` (referencia al master).

- **Pros**: Soporta N:M (múltiples tutores por estudiante, múltiples hijos por tutor).
- **Cons**: Cross-DB reference (tenant → master), sin FK enforcement.
- **Effort**: Medium

### 2. Campo guardianUserId en Student

Agregar `guardianUserId` (FK a User) directamente en Student.

- **Pros**: Simple, una columna.
- **Cons**: Solo 1 tutor por estudiante.
- **Effort**: Low

### 3. Campo userId en Student (para STUDENT role)

Agregar `userId` nullable en Student para vincular con el User de login.

- **Pros**: Resuelve `GET /students/me`.
- **Cons**: Requiere User asociado, no siempre existe hoy.
- **Effort**: Medium

---

## Recommendation

**Enfoque combinado (Approach 1 + 3)**:
1. Tabla `StudentGuardian(studentId, userId)` en tenant — relación tutor-hijos
2. Campo `userId` nullable en Student — vincula alumno con su User
3. Agregar `address`, `phone`, `photoUrl` a Student
4. `UpdateStudentUseCase` + `PATCH /students/:id`
5. `GET /students/me` (STUDENT), `GET /students/my-children` (TUTOR)
6. `@Roles` con TUTOR, STUDENT, PRECEPTOR
7. Seed: agregar PRECEPTOR, MANAGER en jerarquía
8. Frontend: formulario edición + vista detalle

---

## Risks

- **Cross-DB integrity**: StudentGuardian.userId → master.User. Validar en aplicación.
- **Migración**: defaults para address/phone/photoUrl si hay datos existentes.
- **Auth scoping**: Validar institutionId del token coincide con el tenant del estudiante.
- **Performance**: findByGuardian = lookup cross-DB. Considerar caché.

---

## Estimación

| Tarea | Esfuerzo |
|-------|----------|
| Migration DB | 1-2h |
| Domain (entity + repo) | 1-2h |
| Application (use cases) | 2-3h |
| API (endpoints + DTOs) | 2-3h |
| Prisma repo | 2h |
| Seed | 0.5h |
| Frontend | 4-6h |
| Tests | 3-4h |
| **Total** | **15-22h** (~3-4 días) |
