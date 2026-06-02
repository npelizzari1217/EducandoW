# Exploration: Curso, AcademicCycle, StudyPlan — Modelo de Datos Actual

> **Cambio objetivo**: Diseñar el módulo **CursoPorCiclo** que relacione un `Curso` con un `AcademicCycle` generando una nueva entidad.

## Current State

### 1. Tablas/Modelos Prisma (schema_tenant.prisma)

#### Curso (línea 649–671)

```prisma
model Curso {
  id              String   @id @default(uuid())
  courseSectionId String?  @map("course_section_id")
  year            Int                              // 1..6
  division        String                           // "A"|"B"|"C"
  orientacion     String?                          // "NATURALES"|"SOCIALES"|"ECONOMIA"|"ARTE"
  academicYear    String   @map("academic_year")
  active          Boolean  @default(true)
  deletedAt       DateTime? @map("deleted_at")

  courseSection    CourseSection?           @relation(fields: [courseSectionId], references: [id], onDelete: SetNull)
  teacher          Teacher?                 @relation(fields: [teacherId], references: [id], onDelete: SetNull)
  teacherId        String?                  @map("teacher_id")
  calificaciones   CalificacionSecundario[]
  regimenAcademico RegimenAcademico[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  @@index([academicYear])
  @@index([courseSectionId])
  @@map("cursos")
}
```

**Relaciones de Curso**:
- `CourseSection` (opcional, FK → course_sections)
- `Teacher` (opcional, FK → teachers)
- `CalificacionSecundario` (1:N)
- `RegimenAcademico` (1:N)

**CRÍTICO**: Curso tiene `academicYear` como **string** pero NO tiene FK a `AcademicCycle`. La relación entre un Curso y un Ciclo Lectivo específico **no existe actualmente**.

#### AcademicCycle (línea 107–127)

```prisma
model AcademicCycle {
  id        String   @id @default(uuid())
  name      String
  level     Int
  modality  Int    @default(0)
  startDate DateTime @map("start_date")
  endDate   DateTime @map("end_date")
  active    Boolean  @default(true)
  deletedAt DateTime?

  enrollments Enrollment[]
  attendances Attendance[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([level])
  @@index([active])
  @@map("academic_cycles")
}
```

**Relaciones de AcademicCycle**:
- `Enrollment` (1:N) — las inscripciones pueden tener `cycleId` opcional
- `Attendance` (1:N) — asistencias pueden tener `cycleId` opcional
- **NO tiene relación con Curso ni con CourseSection**

#### Enrollment (línea 131–157) — referencia para contexto

```prisma
model Enrollment {
  id           String   @id @default(uuid())
  studentId    String
  cycleId      String?
  level        Int
  modality     Int    @default(0)
  academicYear String
  grade        String?
  division     String?
  status       String   @default("ACTIVE")

  student Student       @relation(fields: [studentId], references: [id], onDelete: Cascade)
  cycle   AcademicCycle? @relation(fields: [cycleId], references: [id], onDelete: SetNull)
}
```

Enrollment ya une `studentId` + `cycleId` + `level` + `academicYear` + `grade` + `division`. CursoPorCiclo sería el equivalente para `Curso` + `AcademicCycle`.

#### StudyPlan (línea 427–444)

```prisma
model StudyPlan {
  id           String   @id @default(uuid())
  name         String
  level        Int
  modality     Int      @default(0)
  academicYear String
  active       Boolean  @default(true)
  deletedAt    DateTime?

  courses StudyPlanCourse[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([level])
  @@index([academicYear])
  @@map("study_plans")
}
```

**Relación de StudyPlan con Curso**: StudyPlan **NO** se relaciona directamente con Curso. Se relaciona con **CourseSection** a través de la tabla intermedia `StudyPlanCourse`:

```prisma
model StudyPlanCourse {
  id              String @id @default(uuid())
  studyPlanId     String
  courseSectionId String
  studyPlan     StudyPlan     @relation(...)
  courseSection CourseSection @relation(...)
  subjects      StudyPlanSubject[]
  @@unique([studyPlanId, courseSectionId])
}
```

### 2. Nivel (Level) — Sistema de codificación

El nivel se maneja con un **sistema de códigos compuestos** en dos capas:

**EducationalLevelCode** (nivel base): 1=Inicial, 2=Primario, 3=Secundario, 4=Terciario, 9=Administración

**EducationalModalityCode** (modalidad): 0=Común, 1=Talleres, 2=Bilingüismo, 9=Todos

**Código compuesto (LevelType)**: `level * 10 + modality`:
- 10 = Inicial Común, 11 = Talleres Inicial, 12 = Bilingüismo Inicial
- 20 = Primario Común, 21 = Talleres Primario, 22 = Bilingüismo Primario
- 30 = Secundario Común, 31 = Talleres Secundario, 32 = Bilingüismo Secundario
- 40 = Terciario Común
- 90 = Administración, 99 = Todos

En la DB, `level` es un `Int` que almacena el código compuesto. En el dominio se modela como `Level` value object con descomposición a `EducationalLevelCode` + `EducationalModalityCode`.

### 3. Entidades de Dominio (packages/domain/src/)

#### Curso (`secundario/entities/curso.ts`)

```typescript
interface CursoProps {
  id: Id;
  courseSectionId?: string;
  year: number;              // 1..6
  division: string;          // "A"|"B"|"C"
  orientacion?: Orientacion; // "NATURALES"|"SOCIALES"|"ECONOMIA"|"ARTE"
  academicYear: string;      // string! no tiene FK a ciclo
  active: boolean;
  deletedAt?: Date;
}

class Curso {
  static create(input: CreateCursoInput): Curso
  static reconstruct(props: CursoProps): Curso
  get id(): Id
  get courseSectionId(): string | undefined
  get year(): number
  get division(): string
  get orientacion(): Orientacion | undefined
  get academicYear(): string
  get active(): boolean
  update(input: Partial<CreateCursoInput>): void
  softDelete(): void
}
```

#### AcademicCycle (`pedagogy/entities/academic-cycle.ts`)

```typescript
interface AcademicCycleProps {
  id: Id;
  name: string;
  level: EducationalLevelCode;
  modality: EducationalModalityCode;
  startDate: Date;
  endDate: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class AcademicCycle {
  static reconstruct(props: AcademicCycleProps): AcademicCycle
  // NO tiene factory create() — se crea desde DB
  get id(): Id
  get name(): string
  get level(): EducationalLevelCode
  get modality(): EducationalModalityCode
  get startDate(): Date
  get endDate(): Date
  get active(): boolean
  isCurrent(): boolean  // ¿startDate <= now <= endDate?
}
```

#### StudyPlan (`pedagogy/entities/study-plan.ts`)

```typescript
interface StudyPlanProps {
  id: Id;
  name: string;
  level: EducationalLevelCode;
  modality: EducationalModalityCode;
  academicYear: string;
  active: boolean;
  deletedAt?: Date;
}

class StudyPlan {
  static create(props): StudyPlan
  static reconstruct(props: StudyPlanProps): StudyPlan
  get id(): Id
  get name(): string
  get level(): EducationalLevelCode
  get academicYear(): string
  softDelete(): void
}
```

### 4. Repositorios (interfaces en domain, implementaciones en infra)

| Interfaz | Métodos | Implementación |
|----------|---------|----------------|
| `CursoRepository` | `findById`, `findAll`, `save`, `delete` | `PrismaCursoRepository` |
| `AcademicCycleRepository` | `findActive(level?)`, `findById` | `PrismaAcademicCycleRepository` |
| `StudyPlanRepository` | `findById`, `findAll`, `save`, `softDelete`, `addCourse`, `removeCourse`, `addSubject`, `removeSubject`, `findPlanCourseById`, `findPlanCoursesByPlan` | `PrismaStudyPlanRepository` |

### 5. Endpoints/Rutas existentes

| Endpoint | Método | Controller | Módulo RBAC |
|----------|--------|------------|--------------|
| `GET /academic-cycles?level=` | GET | PedagogyController | COURSES:READ |
| `GET /course-sections` | GET | PedagogyController | COURSES:READ |
| `POST /course-sections` | POST | PedagogyController | COURSES:CREATE |
| `PATCH /course-sections/:id` | PATCH | PedagogyController | COURSES:UPDATE |
| `DELETE /course-sections/:id` | DELETE | PedagogyController | COURSES:DELETE |
| `GET /study-plans` | GET | PedagogyController | STUDY_PLANS:READ |
| `POST /study-plans` | POST | PedagogyController | STUDY_PLANS:CREATE |
| `GET /study-plans/:id` | GET | PedagogyController | STUDY_PLANS:READ |
| `PATCH /study-plans/:id` | PATCH | PedagogyController | STUDY_PLANS:UPDATE |
| `DELETE /study-plans/:id` | DELETE | PedagogyController | STUDY_PLANS:DELETE |
| `POST /study-plans/:id/courses` | POST | PedagogyController | STUDY_PLANS:UPDATE |
| `DELETE /study-plans/:id/courses/:courseId` | DELETE | PedagogyController | STUDY_PLANS:UPDATE |
| `GET /v1/secundario/cursos` | GET | CursoController | COURSES:READ |
| `POST /v1/secundario/cursos` | POST | CursoController | COURSES:CREATE |
| `GET /v1/secundario/cursos/:id` | GET | CursoController | COURSES:READ |
| `PATCH /v1/secundario/cursos/:id` | PATCH | CursoController | COURSES:UPDATE |
| `DELETE /v1/secundario/cursos/:id` | DELETE | CursoController | COURSES:DELETE |

**No existe ningún endpoint para AcademicCycle (solo lectura)**. Los ciclos solo se listan, no se crean/editan vía API actualmente.

### 6. Páginas Frontend

| Página | Ruta | Archivo |
|--------|------|---------|
| Planes de Estudio | `/study-plans` | `web/src/pages/dashboard/study-plans.tsx` |
| Secciones (CourseSection) | `/course-sections` | `web/src/pages/dashboard/course-sections.tsx` |
| Cursos (Secundario) | `/secundario/cursos` | `web/src/niveles/secundario/cursos/page.tsx` |
| Alumnos por curso | `/students-by-course` | (referenciado en sidebar.tsx) |

**No existe página para AcademicCycle / Ciclos Lectivos.**

### 7. Relaciones entre entidades (diagrama conceptual)

```
AcademicCycle ──(cycleId)──→ Enrollment ──→ Student
                              │
                              ├── level (Int compuesto)
                              ├── academicYear (string)
                              ├── grade (string?)
                              └── division (string?)

Curso ──(courseSectionId?)──→ CourseSection
  │                            │
  ├── year (1..6)              ├── level (Level → compuesto)
  ├── division                 ├── grade
  ├── academicYear (string)    ├── division
  └── orientacion?             └── academicYear

StudyPlan ──→ StudyPlanCourse ←── CourseSection
  │               │
  │               └── StudyPlanSubject ←── Subject
  ├── level (Int)
  ├── modality (Int)
  └── academicYear
```

**Relación faltante**: NO existe vínculo directo entre `Curso` y `AcademicCycle`. El `Curso` tiene `academicYear` como string libre (ej: "2026"), y el `AcademicCycle` tiene `level` (int compuesto) + `startDate`/`endDate` — no hay forma de saber a qué ciclo lectivo pertenece un curso.

**Relación faltante (Curso ↔ StudyPlan)**: StudyPlan se vincula a CourseSection (genérico), no a Curso (específico de Secundario). Para Secundario, `Curso` es la entidad concreta mientras que `CourseSection` es la entidad genérica que agrupa.

## Affected Areas

Si se implementa `CursoPorCiclo`:

- `api/prisma/schema_tenant.prisma` — Nueva tabla `CourseCycle` o `CursoPorCiclo`
- `packages/domain/src/` — Nueva entidad de dominio (en `secundario/` o `pedagogy/`)
- `api/src/application/` — Nuevos use cases
- `api/src/presentation/` — Nuevo controller (posiblemente en `nivel-secundario/`)
- `api/src/infrastructure/persistence/prisma/repositories/` — Nueva implementación de repositorio
- `web/src/niveles/secundario/cursos/` — Actualizar UI para mostrar/crear ciclos

## Approaches

### 1. Nueva tabla `CourseCycle` (CursoPorCiclo) con FK a Curso y AcademicCycle

Crear una tabla intermedia que relacione directamente `Curso` con `AcademicCycle`.

- **Pros**: Modelo explícito, trazable, permite metadatos propios (estado del curso en ese ciclo, docente asignado, etc.)
- **Cons**: Nueva tabla, migración, más queries joins
- **Effort**: Medium

### 2. Agregar `cycleId` directamente a Curso

Hacer que `Curso` tenga un FK opcional a `AcademicCycle`.

- **Pros**: Más simple, menos tablas
- **Cons**: Un Curso puede existir independientemente del ciclo (no es parte de su identidad), pierde flexibilidad para múltiples configuraciones por ciclo
- **Effort**: Low

### 3. Usar `Enrollment` como modelo a seguir: `CursoEnrollment` o similar

Siguiendo el patrón de Enrollment (que ya une Student + Cycle + level + grade + division), crear `CursoCycle` que una Curso + AcademicCycle + metadata.

- **Pros**: Consistente con el patrón existente (Enrollment)
- **Cons**: Añade complejidad si no se necesita metadata extra
- **Effort**: Medium

## Recommendation

**Approach 1** — Nueva tabla `CourseCycle` (CursoPorCiclo). Es el más alineado con el modelo de dominio existente y el patrón que ya usa Enrollment. Además:

1. Permite que un mismo `Curso` (ej: "3°A Naturales") exista en múltiples ciclos lectivos manteniendo su configuración base
2. Puede almacenar metadatos propios del cruce (docente asignado en ESE ciclo, cantidad de alumnos, estado)
3. Sigue el mismo patrón que `Enrollment` (que une `Student` + `AcademicCycle`) y `StudyPlanCourse` (que une `StudyPlan` + `CourseSection`)
4. El `academicYear` string en `Curso` actual se vuelve redundante (se puede deducir del ciclo asociado)

**Estructura propuesta**:

```prisma
model CourseCycle {
  id        String   @id @default(uuid())
  cursoId   String
  cycleId   String
  active    Boolean  @default(true)

  curso Curso         @relation(fields: [cursoId], references: [id], onDelete: Cascade)
  cycle AcademicCycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)

  // posibles metadatos:
  // teacherId String? (docente específico para ESE curso en ESE ciclo)
  // capacity  Int?

  @@unique([cursoId, cycleId])
  @@index([cursoId])
  @@index([cycleId])
  @@map("course_cycles")
}
```

## Risks

- **Migración de datos**: Los Cursos existentes tienen `academicYear` como string pero no tienen ciclo asignado. Se necesitará un script de migración para vincularlos a AcademicCycles existentes.
- **Impacto en consultas**: Todas las queries que usan `academicYear` en Curso deberán considerar el ciclo asociado (joins adicionales).
- **Consistencia de level**: Un `Curso` (Secundario, level=3) vinculado a un `AcademicCycle` de otro nivel sería inconsistente. Validar en dominio.
- **El Grado (Primario) tiene la misma necesidad**: Si se modela para Curso, probablemente `Grado` también necesite `GradoPorCiclo` — diseñar pensando en extensibilidad.

## Ready for Proposal

**Sí** — El modelo actual está claro, las entidades existen pero sin relación directa, y el patrón a seguir (Enrollment, StudyPlanCourse) ya está establecido en el proyecto. Se puede proceder a `sdd-propose` con el change name `curso-por-ciclo`.
