# Plan: RBAC + Evaluación Jerárquica

> **Arquitectura**: Multi-tenant SaaS (master DB + tenant DB)
> **Objetivo**: Implementar control de acceso granular (RBAC) y modelo de evaluación jerárquico

---

## 1. RBAC — Roles, Permisos, Usuarios (Módulo 1, tablas 2,3,7,8)

### 1.1 Dónde vive cada tabla

| Tabla | DB | Justificación |
|-------|-----|--------------|
| `Role` | **MASTER** | Los roles son transversales a todas las instituciones |
| `Permission` | **MASTER** | Los permisos definen capacidades del sistema, no varían por tenant |
| `UserRole` | **MASTER** | Asignación usuario→rol. Un usuario puede tener roles en distintas instituciones |
| `RolePermission` | **MASTER** | Asignación rol→permiso. Transversal |

### 1.2 Modelos Prisma

```prisma
// schema_master.prisma

model Role {
  id          String   @id @default(uuid())
  name        String   @unique   // "ROOT", "ADMIN", "MANAGER", "TEACHER", "TUTOR", "STUDENT"
  description String              // "Administrador del sistema", etc.
  active      Boolean  @default(true)
  deletedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userRoles       UserRole[]
  rolePermissions RolePermission[]

  @@map("roles")
}

model Permission {
  id          String   @id @default(uuid())
  code        String   @unique   // "USERS_CREATE", "GRADES_EDIT", "ATTENDANCE_VIEW"
  description String              // "Crear usuarios", "Editar calificaciones"
  active      Boolean  @default(true)
  deletedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  rolePermissions RolePermission[]

  @@map("permissions")
}

model UserRole {
  id     String @id @default(uuid())
  userId String
  roleId String

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId])
  @@map("user_roles")
}

model RolePermission {
  id           String @id @default(uuid())
  roleId       String
  permissionId String

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([roleId, permissionId])
  @@map("role_permissions")
}
```

### 1.3 Cambios en User

```prisma
model User {
  // ... campos existentes ...
  
  // ELIMINAR: role String @default("ADMIN")   ← ya no es un string
  // AGREGAR:
  userRoles UserRole[]
  
  // Helper para backward compat: devuelve el primer rol o "TEACHER"
  // (esto se maneja en el domain entity, no en Prisma)
}
```

### 1.4 Roles y permisos por defecto (seed)

```sql
-- Roles
INSERT INTO roles (id, name, description) VALUES
  ('r-root', 'ROOT', 'Super administrador — acceso total'),
  ('r-admin', 'ADMIN', 'Administrador de institución'),
  ('r-mgr', 'MANAGER', 'Gestor académico'),
  ('r-teach', 'TEACHER', 'Docente'),
  ('r-tutor', 'TUTOR', 'Padre/Madre/Tutor legal'),
  ('r-student', 'STUDENT', 'Alumno');

-- Permisos
INSERT INTO permissions (id, code, description) VALUES
  ('p-inst-c', 'INSTITUTIONS_CREATE', 'Crear instituciones'),
  ('p-inst-u', 'INSTITUTIONS_UPDATE', 'Modificar instituciones'),
  ('p-inst-d', 'INSTITUTIONS_DELETE', 'Eliminar instituciones'),
  ('p-users-c', 'USERS_CREATE', 'Crear usuarios'),
  ('p-users-u', 'USERS_UPDATE', 'Modificar usuarios'),
  ('p-users-d', 'USERS_DELETE', 'Eliminar usuarios'),
  ('p-students-c', 'STUDENTS_CREATE', 'Crear alumnos'),
  ('p-students-v', 'STUDENTS_VIEW', 'Ver alumnos'),
  ('p-grades-c', 'GRADES_CREATE', 'Crear calificaciones'),
  ('p-grades-v', 'GRADES_VIEW', 'Ver calificaciones'),
  ('p-att-c', 'ATTENDANCE_CREATE', 'Registrar asistencia'),
  ('p-att-v', 'ATTENDANCE_VIEW', 'Ver asistencia');

-- Role → Permission
-- ROOT: todos los permisos
-- ADMIN: INSTITUTIONS_*, USERS_*, STUDENTS_*
-- MANAGER: STUDENTS_*, GRADES_*, ATTENDANCE_*
-- TEACHER: GRADES_CREATE, ATTENDANCE_CREATE, STUDENTS_VIEW
-- TUTOR: GRADES_VIEW, ATTENDANCE_VIEW (solo sus hijos)
-- STUDENT: GRADES_VIEW (solo sus propias notas)
```

---

## 2. Evaluación Jerárquica (Módulo 4, tablas 20-23)

### 2.1 Modelo actual vs nuevo

```
ACTUAL:                           NUEVO (DER):
SubjectAssignment ──→ Grade       SubjectAssignment ──→ Evaluacion ──→ Nota
(calificación directa)            (una asignación)     (un examen)   (nota individual)
                                  │                    │             │
                                  │ 1:N                │ 1:N         │
                                  ▼                    ▼             ▼
                                  tiene muchas         tiene muchas  una por alumno
                                  evaluaciones         notas
```

### 2.2 Modelos Prisma (tenant)

```prisma
// schema_tenant.prisma

model Evaluacion {
  id              String   @id @default(uuid())
  assignmentId    String              // FK → SubjectAssignment
  title           String              // "Examen Parcial 1", "TP Integrador"
  description     String?             // instrucciones, consignas
  evaluationDate  DateTime            // fecha del examen
  weight          Float    @default(1) // ponderación (1 = normal, 2 = doble, 0.5 = medio)
  active          Boolean  @default(true)
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  assignment SubjectAssignment @relation(fields: [assignmentId], references: [id])
  notas      Nota[]

  @@map("evaluaciones")
}

model Nota {
  id            String   @id @default(uuid())
  evaluationId  String              // FK → Evaluacion
  studentId     String              // FK → Student
  numericValue  Float?              // nota numérica (ej: 8.5 sobre 10)
  qualitativeValue String?          // nota conceptual (ej: "Excelente", "A")
  comments      String?             // devolución del docente
  registeredAt  DateTime @default(now())
  active        Boolean  @default(true)
  deletedAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  evaluation Evaluacion @relation(fields: [evaluationId], references: [id])
  student    Student    @relation(fields: [studentId], references: [id])

  @@unique([evaluationId, studentId])
  @@map("notas")
}

model PeriodoEvaluacion {
  id            String   @id @default(uuid())
  academicYear  String              // "2026"
  name          String              // "Primer Trimestre", "Primer Bimestre"
  startDate     DateTime
  endDate       DateTime
  active        Boolean  @default(true)
  deletedAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  notasTrimestrales NotaTrimestral[]

  @@map("periodos_evaluacion")
}

model NotaTrimestral {
  id             String   @id @default(uuid())
  studentId      String
  assignmentId   String              // FK → SubjectAssignment
  periodId       String              // FK → PeriodoEvaluacion
  finalGrade     Float               // nota de cierre del período
  attendancePct  Float?              // % de asistencia en el período
  active         Boolean  @default(true)
  deletedAt      DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  student    Student           @relation(fields: [studentId], references: [id])
  assignment SubjectAssignment @relation(fields: [assignmentId], references: [id])
  period     PeriodoEvaluacion @relation(fields: [periodId], references: [id])

  @@unique([studentId, assignmentId, periodId])
  @@map("notas_trimestrales")
}
```

### 2.3 Migración de Grade → Evaluacion + Nota

El modelo `Grade` actual se ELIMINA y se reemplaza. Migración conceptual:
- `Grade.subjectId` + `Grade.courseSectionId` → buscar `SubjectAssignment` → crear `Evaluacion` + `Nota`
- `Grade.period` → crear `PeriodoEvaluacion` correspondiente
- `Grade.numericValue` → `Nota.numericValue`
- `Grade.qualitativeValue` → `Nota.qualitativeValue`

---

## 3. Decisiones SaaS (master vs tenant)

| Tabla | DB | Razón |
|-------|-----|-------|
| Role, Permission, UserRole, RolePermission | **MASTER** | Son configuración global del SaaS |
| User | **MASTER** | Identidad global |
| Institution | **MASTER** | Registro de tenants |
| Student, Teacher | **TENANT** | Datos de cada escuela |
| Subject, CourseSection, SubjectAssignment | **TENANT** | Pedagógico por escuela |
| AcademicCycle, Enrollment | **TENANT** | Ciclos y matrículas por escuela |
| Attendance, AttendanceStatus | **TENANT** | Asistencia por escuela |
| Evaluacion, Nota, PeriodoEvaluacion, NotaTrimestral | **TENANT** | Evaluación por escuela |
| Futuros: Finanzas, LMS, Transporte, etc. | **TENANT** | Operativos por escuela |

---

## 4. Orden de implementación

```
PASO 1 — RBAC (master schema + domain + guards)
  ├── Role, Permission, UserRole, RolePermission → Prisma master
  ├── User refactor: eliminar role string, agregar userRoles relation
  ├── Domain entities nuevos + actualizar User entity
  ├── Auth guard: pasar de chequear role string a chequear permisos
  ├── Seed: roles y permisos por defecto
  └── DB push master

PASO 2 — Evaluación jerárquica (tenant schema + domain + repos)
  ├── Evaluacion, Nota, PeriodoEvaluacion, NotaTrimestral → Prisma tenant
  ├── ELIMINAR modelo Grade
  ├── Domain entities nuevos, eliminar Grade entity
  ├── Repositorios nuevos, eliminar Grade repository
  ├── Use cases + controllers + DTOs nuevos
  └── DB push tenant

PASO 3 — Integración y tests
  ├── Actualizar tests existentes que usaban Grade
  ├── Tests nuevos para RBAC y Evaluación
  ├── Build completo (domain + API + web)
  └── Verificación end-to-end
```

---

## 5. Impacto en el frontend

- **RBAC**: Sidebar y rutas protegidas ahora chequean permisos en vez de roles
- **Evaluación**: Formulario de calificaciones cambia: primero se crea Evaluacion, luego se cargan Notas por alumno
- **Boletines**: Se calculan desde NotaTrimestral en vez de Grade directo
