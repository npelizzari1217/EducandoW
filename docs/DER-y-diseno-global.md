# EducandoW — DER y Diseño Global del Sistema

> **Principio**: Cada nivel pedagógico es un **bounded context independiente**.
> No comparten lógica de evaluación, no comparten estructuras de cursos/salas,
> y cada uno tiene sus propias reglas de promoción y acreditación.

---

## 0. ARQUITECTURA SaaS MULTI-TENANT

### 0.1 Modelo: Database-per-Tenant

Cada institución educativa tiene su **propia base de datos PostgreSQL**.
Un usuario pertenece a UNA institución. La institución es el primer filtro de TODO.

```
┌──────────────────────────────────────────────────────┐
│                 MASTER DATABASE                       │
│                 educandow_master                      │
│                                                       │
│  ┌──────────┐    ┌──────────────────────────────┐    │
│  │  users   │───<│        institutions           │    │
│  │id,email, │    │                              │    │
│  │password, │    │ id: UUID                      │    │
│  │name,role,│    │ name: STRING                  │    │
│  │instit.   │    │ address: STRING?              │    │
│  │   _id FK │    │ city: STRING?                 │    │
│  └──────────┘    │ postal_code: STRING?          │    │
│                  │ country: STRING?              │    │
│                  │ ministry_reg: STRING?   (1)   │    │
│                  │ cue: STRING? UNIQUE    (2)    │    │
│                  │ phone: STRING?                │    │
│                  │ website: STRING?              │    │
│                  │ contact_email: STRING?        │    │
│                  │                               │    │
│                  │ ── SMTP ──                    │    │
│                  │ smtp_host: STRING?            │    │
│                  │ smtp_user: STRING?            │    │
│                  │ smtp_pass: STRING? (enc) (3)  │    │
│                  │ smtp_encryption: STRING? (4)  │    │
│                  │ smtp_port: INT?               │    │
│                  │ ── Notificaciones ──          │    │
│                  │ send_email: BOOL       (5)    │    │
│                  │ send_messages: BOOL    (6)    │    │
│                  │                               │    │
│                  │ ── Branding ──                │    │
│                  │ logo_url: STRING?      (7)    │    │
│                  │ header_color: STRING?  (8)    │    │
│                  │ header_text_color: STRING?    │    │
│                  │ body_text_color: STRING?      │    │
│                  │                               │    │
│                  │ ── Config ──                  │    │
│                  │ active: BOOL           (9)    │    │
│                  │ socket_host: STRING?   (10)   │    │
│                  │ socket_port: INT?             │    │
│                  │                               │    │
│                  │ db_name: STRING        (11)   │    │
│                  │ created_at: TIMESTAMP         │    │
│                  │ updated_at: TIMESTAMP         │    │
│                  └──────────────────────────────┘    │
│                                                       │
│  (1) N° inscripción Ministerio de Educación           │
│  (2) Código Único Escolar (alfanumérico, único)       │
│  (3) Encriptado en reposo (AES-256)                   │
│  (4) "TLS" | "SSL" | "NONE"                          │
│  (5) Activa/desactiva envío de emails a nivel         │
│      institución (si está en OFF, no se envía nada)   │
│  (6) Activa/desactiva mensajería WebSocket a nivel    │
│      institución (si está en OFF, no hay socket)      │
│  (7) URL de la imagen (S3 / local storage)            │
│  (8) Hex color: "#1a56db"                             │
│  (9) Soft-delete: institución activa/inactiva          │
│  (10) Para notificaciones real-time (WebSocket)        │
│  (11) Nombre de la tenant DB: "educandow_1002"         │
│                                                       │
└──────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ TENANT DB    │ │ TENANT DB    │ │ TENANT DB    │
│educandow_1002│ │educandow_1003│ │educandow_1004│
│              │ │              │ │              │
│ students     │ │ students     │ │ students     │
│ teachers     │ │ teachers     │ │ teachers     │
│ subjects     │ │ subjects     │ │ subjects     │
│ courses      │ │ courses      │ │ courses      │
│ grades       │ │ grades       │ │ grades       │
│ attendance   │ │ attendance   │ │ attendance   │
│ ... (todo)   │ │ ... (todo)   │ │ ... (todo)   │
│              │ │              │ │              │
│ SIN columna  │ │ SIN columna  │ │ SIN columna  │
│ institutionId│ │ institutionId│ │ institutionId│
└──────────────┘ └──────────────┘ └──────────────┘
```

### 0.2 Flujo de conexión

```
1. LOGIN
   usuario: pepito@ciclanus.edu.ar
   password: ********
          │
          ▼
2. MASTER DB: valida credenciales
   ┌─────────────────────────────────┐
   │ SELECT * FROM users             │
   │ WHERE email = '...'            │
   │ JOIN institutions ON ...        │
   │ → user.institution_id = 1002    │
   │ → institution.db_name =         │
   │   "educandow_1002"             │
   └─────────────────────────────────┘
          │
          ▼
3. JWT PAYLOAD incluye:
   {
     sub: "user-uuid",
     role: "ADMIN",
     institutionId: "1002",
     dbName: "educandow_1002"
   }
          │
          ▼
4. CADA REQUEST:
   Middleware extrae dbName del JWT
   → PrismaService resuelve conexión a:
     postgresql://.../educandow_1002
   → TODAS las queries van contra el tenant DB
```

### 0.3 Reglas de arquitectura SaaS

| # | Regla | Descripción |
|---|---|---|
| **R1** | **Master DB solo auth** | La base `educandow_master` solo contiene `users`, `institutions` y `refresh_tokens`. NUNCA datos pedagógicos ni de personal. |
| **R2** | **Tenant DB = 1 institución** | Cada institución tiene su propia base: `educandow_{institutionId}`. Contiene TODOS sus datos (alumnos, docentes, materias, notas, etc). |
| **R3** | **Sin `institutionId` en tenant** | Las tablas dentro de un tenant DB NO necesitan columna `institutionId`. La base en sí misma es el filtro. |
| **R4** | **JWT transporta el tenant** | El token JWT incluye `dbName` (nombre de la base). El middleware de conexión lo usa para rutear al DB correcto. |
| **R5** | **Usuario = 1 institución** | Un usuario pertenece a UNA sola institución. Si necesita trabajar en otra, necesita otro usuario. |
| **R6** | **Usuario = N niveles** | Dentro de SU institución, un usuario puede operar en múltiples niveles pedagógicos (Inicial, Primario, etc). |
| **R7** | **PrismaService dinámico** | `PrismaService` no se conecta en el constructor. Se resuelve por request usando el `dbName` del JWT. Usa un `Map<dbName, PrismaClient>` como caché de conexiones. |
| **R8** | **Migrations por tenant** | Al crear una institución nueva, se crea su DB y se corren las migrations. Al actualizar el schema, se migran TODAS las tenant DBs. |
| **R9** | **Health check global** | El health check consulta la master DB. Los endpoints de tenant requieren JWT válido. |
| **R10** | **Registro de institución** | Crear una institución = crear DB + correr migrations + crear usuario admin inicial. |

### 0.4 Estructura de bases de datos

```
PostgreSQL Cluster
│
├── educandow_master          ← única, shared
│   ├── users
│   ├── institutions          ← tiene db_name, db_host
│   └── refresh_tokens
│
├── educandow_1002            ← tenant: "Colegio San Martín"
│   ├── students
│   ├── teachers
│   ├── enrollments
│   ├── subjects
│   ├── course_sections
│   ├── subject_assignments
│   ├── grades
│   ├── attendances
│   ├── salas                  ← Inicial
│   ├── informes_evolutivos
│   ├── areas_desarrollo
│   ├── planificaciones
│   ├── secuencias_didacticas
│   ├── grados                 ← Primario
│   ├── calificaciones_primario
│   ├── cursos                 ← Secundario
│   ├── calificaciones_secundario
│   ├── mesas_examen
│   ├── mesa_examen_inscripciones
│   ├── regimen_academico
│   ├── carreras               ← Terciario
│   ├── materias_carrera
│   ├── correlatividades
│   ├── inscripciones_materia
│   ├── actas_examen
│   ├── acta_examen_notas
│   └── titulos
│
├── educandow_1003            ← tenant: "Instituto Belgrano"
│   └── (mismas tablas)
│
└── educandow_1004            ← tenant: "Escuela Técnica N°5"
    └── (mismas tablas)
```

### 0.5 Configuración de institución en sesión

Los datos de `institutions` son **configuración global del sistema** para la sesión activa.
Al hacer login, el frontend carga la configuración completa de la institución y la mantiene
viva durante toda la sesión. Cada institución configura sus propias características.

```
LOGIN → JWT { ..., institutionId, dbName }
           │
           ▼
   GET /v1/institutions/me   ← endpoint nuevo
   (usa el institutionId del JWT)
           │
           ▼
   FRONTEND: InstitutionContext
   ┌─────────────────────────────┐
   │ name, logo_url              │ → Sidebar brand
   │ header_color, text_colors   │ → Tema de la UI
   │ send_email, smtp_*          │ → ¿Mostrar sección email?
   │ send_messages, socket_*     │ → ¿Iniciar WebSocket?
   │ active                      │ → ¿Institución bloqueada?
   │ levels[]                    │ → ¿Qué niveles mostrar?
   └─────────────────────────────┘
           │
           ▼
   Toda la UI se adapta a la institución:
   - Colores de cabecera y texto
   - Logo en sidebar y documentos
   - Menú filtrado por niveles activos
   - WebSocket solo si send_messages = true
```

| # | Regla | Descripción |
|---|---|---|
| **R11** | **Institución en sesión** | Al iniciar sesión, el frontend obtiene la configuración de la institución (`GET /v1/institutions/me`) y la almacena en un contexto global (`InstitutionContext`). |
| **R12** | **Tema dinámico** | Los colores (`header_color`, `header_text_color`, `body_text_color`) se aplican como CSS variables al montar la sesión. |
| **R13** | **Features condicionales** | `send_email = false` → oculta funcionalidad de email. `send_messages = false` → no inicia conexión WebSocket. |
| **R14** | **Niveles activos** | El menú de navegación solo muestra los niveles que la institución tiene habilitados (`levels[]`). |
| **R15** | **Bloqueo por inactividad** | Si `active = false`, la sesión se rechaza aunque las credenciales sean válidas. |

### 0.6 Impacto en el código actual

| Componente | Cambio requerido |
|---|---|
| `PrismaService` | Pasa de `extends PrismaClient` a un factory que resuelve cliente por tenant |
| `PrismaUserRepository` | Va a la master DB (siempre misma conexión) |
| `JwtAuthPort` | Agrega `institutionId` y `dbName` al payload |
| `AuthController /me` | Ya devuelve el JWT payload con institutionId |
| `app.module.ts` | Registrar middleware/interceptor de tenant |
| `schema.prisma` | Separar en dos: `schema_master.prisma` y `schema_tenant.prisma` |
| `docker-compose.yml` | Solo una instancia de PostgreSQL, múltiples DBs dentro |
| TODOS los repos | Quitar `institutionId` de las queries (el filtro lo da la DB) |
| TODAS las entidades | Quitar `institutionId` de las props (no necesario en tenant) |
| `InstitutionContext` (NUEVO) | Contexto React que carga config de institución al login. Expone colores, logo, features flags |
| `GET /v1/institutions/me` (NUEVO) | Endpoint que devuelve la config completa de la institución del JWT |

---

## 1. DER — Diagrama Entidad-Relación Completo

### 1.1 Tablas existentes (Kernel compartido)

```
┌──────────────┐     ┌─────────────────┐
│  Institution │────<│      User       │
│  (1)         │     │  (ADMIN/MANAGER/│
│              │     │   TEACHER)      │
└──────┬───────┘     └─────────────────┘
       │
       ├──< Student ──< Enrollment ────┐
       │    (1..N)       (N..1)        │
       │                               │
       ├──< Teacher ──< SubjectAssign  │
       │    (1..N)       (N..1)        │
       │                               │
       ├──< Subject ──< Grade ─────────┤
       │    (1..N)       (N..1)        │
       │                               │
       ├──< CourseSection ──< Attendance
       │    (1..N)            (N..1)
       │
       └── (NIVELES ESPECÍFICOS ABAJO)
```

### 1.2 Plan de Estudios — El corazón académico

Una institución puede tener **múltiples planes de estudio por nivel educativo** que conviven.
Cada plan puede estructurarse de dos formas, y ambos tipos coexisten en las mismas tablas.

#### Los dos tipos de estructura

```
TIPO A: JERÁRQUICO (Cursos → Materias)     TIPO B: PLANO (Materias directas)
─────────────────────────────────────       ───────────────────────────────
Plan: "Bachiller en Economía"               Plan: "Profesorado de Matemática"
 │                                            │
 ├── Curso: "1er Año"                         ├── Materia: Análisis I (año 1, 1C)
 │    ├── Matemática I                        ├── Materia: Álgebra I (año 1, 1C)
 │    ├── Lengua I                            ├── Materia: Geometría I (año 1, 2C)
 │    └── Cs. Naturales I                     ├── Materia: Análisis II (año 2, 1C)
 │                                            ├── Materia: Física I (año 2, 1C)
 ├── Curso: "2do Año"                         │
 │    ├── Matemática II                       │  (sin cursos, materias directas
 │    ├── Lengua II                            │   con año y cuatrimestre)
 │    └── Cs. Naturales II                    │
 │                                            │
 └── Curso: "3er Año"
      └── ...
```

#### Tablas

```
┌─────────────────────┐
│     StudyPlan       │  Plan de estudio
│─────────────────────│
│ id (UUID)           │
│ name                │  "Bachiller en Economía"
│ level               │  INICIAL|PRIMARIO|SECUNDARIO|TERCIARIO
│ structure_type      │  "HIERARCHICAL" | "FLAT"
│ academic_year       │  "2025" (año de vigencia)
│ resolution          │  STRING? (n° resolución ministerial)
│ active              │  BOOL
│ created_at          │
│ updated_at          │
└────────┬────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐
│  StudyPlanCourse    │  Curso dentro del plan (solo HIERARCHICAL)
│─────────────────────│
│ id (UUID)           │
│ study_plan_id FK    │
│ name                │  "1er Año", "2do Año"
│ grade               │  INT? (1..6 para primaria/secundaria)
│ order               │  INT (orden 1, 2, 3...)
└────────┬────────────┘
         │
         │ 1:N (nullable: si FLAT, course_id = NULL)
         ▼
┌─────────────────────┐
│  StudyPlanSubject   │  Materia del plan (corazón del sistema)
│─────────────────────│
│ id (UUID)           │
│ study_plan_id FK    │  ← a qué plan pertenece
│ course_id FK? NULL  │  ← NULL si es FLAT, FK si es HIERARCHICAL
│ subject_id FK       │  ← FK a tabla Subject (materia base)
│ year                │  INT (año dentro de la carrera: 1, 2, 3...)
│ term                │  "1C"|"2C"|"ANUAL" (cuatrimestre o anual)
│ hours_per_week      │  INT (carga horaria semanal)
│ total_hours         │  INT (carga horaria total)
│ regimen             │  "PROMOCIONAL"|"REGULAR"|"LIBRE"
│ order               │  INT (orden dentro del curso o plan)
│ created_at          │
└────────┬────────────┘
         │
         │ 1:N (una materia requiere otra aprobada)
         ▼
┌─────────────────────┐
│   Correlative       │  Correlatividad
│─────────────────────│
│ id (UUID)           │
│ subject_id FK       │  ← materia que TIENE la correlativa
│ required_id FK      │  ← materia que DEBE estar aprobada
│ requirement_type    │  "CURSADA"|"FINAL" (requiere cursada o final aprobado)
└─────────────────────┘
```

#### Ejemplos de datos

**Plan HIERARCHICAL — "Bachiller en Economía" (Secundario)**

```
StudyPlan: { id: 1, name: "Bachiller en Economía", level: "SECUNDARIO",
             structure_type: "HIERARCHICAL" }

StudyPlanCourse: { id: 10, study_plan_id: 1, name: "1er Año", order: 1 }
StudyPlanCourse: { id: 11, study_plan_id: 1, name: "2do Año", order: 2 }
StudyPlanCourse: { id: 12, study_plan_id: 1, name: "3er Año", order: 3 }

StudyPlanSubject:
  { study_plan_id: 1, course_id: 10, subject_id: MAT1, year: 1, term: "ANUAL" }
  { study_plan_id: 1, course_id: 10, subject_id: LEN1, year: 1, term: "ANUAL" }
  { study_plan_id: 1, course_id: 11, subject_id: MAT2, year: 2, term: "ANUAL" }
  ...
```

**Plan FLAT — "Profesorado de Matemática" (Terciario)**

```
StudyPlan: { id: 2, name: "Profesorado de Matemática", level: "TERCIARIO",
             structure_type: "FLAT" }

-- Sin cursos --

StudyPlanSubject:
  { study_plan_id: 2, course_id: NULL, subject_id: ANAL1, year: 1, term: "1C" }
  { study_plan_id: 2, course_id: NULL, subject_id: ALG1,   year: 1, term: "1C" }
  { study_plan_id: 2, course_id: NULL, subject_id: GEOM1,  year: 1, term: "2C" }
  { study_plan_id: 2, course_id: NULL, subject_id: ANAL2,  year: 2, term: "1C" }
  { study_plan_id: 2, course_id: NULL, subject_id: FIS1,   year: 2, term: "1C" }
  ...

Correlative:
  { subject_id: ANAL2, required_id: ANAL1, requirement_type: "CURSADA" }
  { subject_id: FIS1,  required_id: ANAL1, requirement_type: "FINAL" }
```

#### Reglas del Plan de Estudios

| # | Regla |
|---|---|
| **R16** | Un plan de estudio pertenece a UN nivel educativo y tiene UN tipo de estructura |
| **R17** | `structure_type = HIERARCHICAL` → las materias se agrupan en cursos. `course_id` es obligatorio |
| **R18** | `structure_type = FLAT` → las materias son independientes. `course_id` es NULL. Se ordenan por `year` + `term` |
| **R19** | Las materias base (`Subject`) se crean primero, luego se referencian desde `StudyPlanSubject` |
| **R20** | Una misma `Subject` puede aparecer en múltiples planes de estudio |
| **R21** | Las correlatividades se validan al momento de inscribir a un alumno en una materia |
| **R22** | Si `requirement_type = CURSADA`, alcanza con tener la cursada aprobada. Si es `FINAL`, necesita el final aprobado |

#### Impacto en el DER de niveles

Con este modelo unificado, las tablas específicas por nivel se simplifican:

| Nivel | Antes (diseño viejo) | Ahora (con StudyPlan) |
|---|---|---|
| **Inicial** | Sin plan de estudios (no aplica) | Sin cambios |
| **Primario** | `grados` + `calificaciones_primario` | `grados` referencia a `StudyPlan` |
| **Secundario** | `cursos` + `calificaciones_secundario` + `mesas_examen` + `regimen_academico` | `cursos` referencia a `StudyPlan`, `regimen_academico` se simplifica |
| **Terciario** | `carreras` + `materias_carrera` + `correlatividades` + `inscripciones_materia` + `actas_examen` + `titulos` | `carreras` → `StudyPlan`, `materias_carrera` → `StudyPlanSubject`, correlatividades ya existen |

### 1.3 Ciclo Lectivo — El eje temporal del sistema

Cada ciclo lectivo abarca un año académico con fechas de inicio y cierre.
Se divide en bimestres/cuatrimestres con fechas concretas.
Un ciclo puede contener **varios planes de estudio** que conviven,
y un plan puede estar presente en **varios ciclos** (relación N:M).

```
┌──────────────────────────────────────────────────────┐
│              Ciclo 2026 (SECUNDARIO)                  │
│  Inicio: 02/03/2026  —  Cierre: 15/12/2026           │
│                                                       │
│  ┌─────────────────────────────────────────────┐     │
│  │ 1er Bimestre: 02/03 → 02/05                │     │
│  │ 2do Bimestre: 05/05 → 04/07                │     │
│  │ 3er Bimestre: 28/07 → 26/09                │     │
│  │ 4to Bimestre: 29/09 → 15/12                │     │
│  └─────────────────────────────────────────────┘     │
│                                                       │
│  Planes de estudio vigentes:                          │
│  ├── "Plan 2026 Nuevo"  (HIERARCHICAL)               │
│  └── "Plan 2018"        (HIERARCHICAL)               │
│                                                       │
│  "Plan 2018" también estuvo en: 2023, 2024, 2025      │
└──────────────────────────────────────────────────────┘
```

#### Tablas

```
┌─────────────────────────┐
│   AcademicCycle         │  Ciclo lectivo
│─────────────────────────│
│ id (UUID)               │
│ name                    │  "2026"
│ level                   │  INICIAL|PRIMARIO|SECUNDARIO|TERCIARIO
│ start_date              │  DATE
│ end_date                │  DATE
│ active                  │  BOOL
│ created_at              │
│ updated_at              │
└────────┬────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────┐
│  AcademicCyclePeriod    │  Período concreto dentro del ciclo
│─────────────────────────│
│ id (UUID)               │
│ cycle_id FK             │
│ period_type_id FK       │  ← FK a GradingPeriodType (BIMESTRAL, CUATRIMESTRAL)
│ period_number           │  INT (1, 2, 3, 4)
│ start_date              │  DATE  ← fecha real de inicio
│ end_date                │  DATE  ← fecha real de cierre
│ @@unique([cycle_id, period_type_id, period_number])
└─────────────────────────┘

         ┌─────────────────────────┐
         │ AcademicCycleStudyPlan  │  JOIN N:M
         │─────────────────────────│
         │ id (UUID)               │
         │ cycle_id FK             │
         │ study_plan_id FK        │
         │ @@unique([cycle_id, study_plan_id])
         └─────────────────────────┘
                  │                    │
          ┌───────┘                    └───────┐
          ▼                                    ▼
   AcademicCycle                          StudyPlan
   (2023, 2024, 2025, 2026...)           ("Plan 2018", "Plan 2026 Nuevo")
```

#### Ejemplo de datos

```
AcademicCycle:
  { id: C1, name: "2025", level: "SECUNDARIO", start: 2025-03-01, end: 2025-12-15 }
  { id: C2, name: "2026", level: "SECUNDARIO", start: 2026-03-02, end: 2026-12-15 }

AcademicCyclePeriod:
  { cycle: C2, period_type: "BIMESTRAL", number: 1, start: 2026-03-02, end: 2026-05-02 }
  { cycle: C2, period_type: "BIMESTRAL", number: 2, start: 2026-05-05, end: 2026-07-04 }
  { cycle: C2, period_type: "BIMESTRAL", number: 3, start: 2026-07-28, end: 2026-09-26 }
  { cycle: C2, period_type: "BIMESTRAL", number: 4, start: 2026-09-29, end: 2026-12-15 }

AcademicCycleStudyPlan:
  { cycle: C2, study_plan: "Plan 2026 Nuevo" }
  { cycle: C2, study_plan: "Plan 2018" }
  { cycle: C1, study_plan: "Plan 2018" }    ← Plan 2018 ya estaba en 2025
```

#### Reglas del ciclo lectivo

| # | Regla |
|---|---|
| **R32** | Un ciclo lectivo pertenece a UN nivel educativo y tiene fechas de inicio y cierre. |
| **R33** | Los períodos del ciclo (bimestres, cuatrimestres) tienen fechas reales. Son configurables por institución. |
| **R34** | Relación N:M entre `AcademicCycle` y `StudyPlan`: un ciclo tiene varios planes, un plan está en varios ciclos. |
| **R35** | Al calificar a un alumno, se valida que la fecha esté dentro del período correspondiente del ciclo activo. |
| **R36** | Los ciclos son anuales. Un nuevo año = un nuevo ciclo. Los planes de estudio pueden trascender ciclos. |
| **R37** | Al consultar el boletín de un alumno, se filtra por `cycle_id` para obtener solo las notas de ese año. |
| **R38** | La inscripción de un alumno se vincula al `AcademicCycle`. Progresión: "1er Año" ciclo 2024 → "2do Año" ciclo 2025 → "3er Año" ciclo 2026. |
| **R39** | `Enrollment` debe tener FK a `academic_cycles`. Se agrega `cycle_id`. Unique: `[student_id, course_section_id, cycle_id]`. |

#### Progresión del alumno a través de ciclos

```
Student: "Juan Pérez"

Enrollment: { course: "1er Año", cycle: 2024 }
Enrollment: { course: "2do Año", cycle: 2025 }
Enrollment: { course: "3er Año", cycle: 2026 }   ← actual

GET /students/:id/history
→ [{ cycle: 2024, course: "1er Año" },
   { cycle: 2025, course: "2do Año" },
   { cycle: 2026, course: "3er Año" }]
```

#### Enrollment actualizado

```
Enrollment:
  id, student_id FK, course_section_id FK,
  cycle_id FK → AcademicCycle,    ← NUEVO
  level, grade, division,
  status (ACTIVE|INACTIVE|GRADUATED|TRANSFERRED),
  enrolled_at
  @@unique([student_id, course_section_id, cycle_id])
```

### 1.4 Sistema de Calificaciones — Escalas y Períodos por Nivel

Cada nivel pedagógico tiene su propia **escala de calificación** (valores permitidos)
y sus propios **períodos de evaluación** (bimestral, cuatrimestral, etc.).
Una materia puede configurar qué tipo de período usa.

#### Tablas

```
┌─────────────────────────┐
│     GradeScale          │  Escala de calificación (valores permitidos por nivel)
│─────────────────────────│
│ id (UUID)               │
│ level                   │  INICIAL|PRIMARIO|SECUNDARIO|TERCIARIO
│ value                   │  Valor: "1"..."10", "DESTACADO", "LOGRADO", "AUSENTE"
│ label                   │  Etiqueta: "Excelente", "Muy Bueno", "Insuficiente"
│ min_numeric             │  FLOAT? (rango numérico mínimo, ej: 9)
│ max_numeric             │  FLOAT? (rango numérico máximo, ej: 10)
│ is_approved             │  BOOL — ¿esta nota aprueba?
│ status_tag              │  APROBADO|DESAPROBADO|EN_PROCESO
│ order                   │  INT (orden de menor a mayor)
│ requires_recovery       │  BOOL (¿requiere recuperatorio?)
└─────────────────────────┘

┌─────────────────────────┐
│   GradingPeriodType     │  Tipos de período de evaluación
│─────────────────────────│
│ id (UUID)               │
│ level                   │  INICIAL|PRIMARIO|SECUNDARIO|TERCIARIO
│ code                    │  "BIMESTRAL"|"CUATRIMESTRAL"|"TRIMESTRAL"|
│                         │  "CURSADA"|"FINAL"|"FIRMA_TP"|"DICIEMBRE"|"FEBRERO"
│ label                   │  "1er Bimestre", "1er Cuatrimestre", "Examen Final"
│ periods_count           │  INT (cantidad de períodos: 4 bim, 2 cuat, 1 final)
│ order                   │  INT
└────────┬────────────────┘
         │
         │ 1:N (una materia elige su tipo de período)
         ▼
┌─────────────────────────┐
│  SubjectGradingConfig   │  Configuración de evaluación de una materia
│─────────────────────────│
│ id (UUID)               │
│ subject_id FK           │  ← materia base
│ period_type_id FK       │  ← tipo de período (bimestral, cuatrimestral, etc.)
│ grade_scale_level       │  ← nivel de la escala a usar (hereda del level de la materia)
└─────────────────────────┘

┌─────────────────────────┐
│    StudentGrade         │  Calificación concreta — SNAPSHOT INMUTABLE
│─────────────────────────│
│ id (UUID)               │
│ student_id FK           │
│ subject_id FK           │
│ cycle_id FK             │  ← NUEVO: a qué ciclo lectivo pertenece
│ period_type_id FK       │  ← qué tipo de período
│ period_number           │  INT (1, 2, 3, 4)
│                         │
│ ── SNAPSHOT de la escala (copiado al guardar) ──
│ grade_value             │  STRING — "8", "DESTACADO"
│ grade_label             │  STRING — "Muy Bueno (8)"
│ is_approved             │  BOOL — copiado al momento de calificar
│ status_tag              │  APROBADO|DESAPROBADO|EN_PROCESO
│ numeric_value           │  FLOAT? — para cálculos
│ qualitative_value       │  STRING?
│ evaluated_at            │  TIMESTAMP
│ evaluated_by            │  FK → User
│ notes                   │  TEXT?
│                         │
│ @@unique([student_id, subject_id, cycle_id, period_type_id, period_number])
└─────────────────────────┘

⚠️  IMPORTANTE: grade_value, grade_label, min_numeric, max_numeric,
    is_approved y status_tag se COPIAN de GradeScale al momento de
    guardar la calificación. NO son FK a GradeScale.
    Si mañana se modifica la escala, las notas ya emitidas NO cambian.
```

#### Ejemplos de escalas precargadas por nivel

**INICIAL** — Cualitativa (sin números)
```
GradeScale:
  { level: INICIAL, value: "DESTACADO",  label: "Destacado",    is_approved: true,  status_tag: "APROBADO" }
  { level: INICIAL, value: "LOGRADO",    label: "Logrado",      is_approved: true,  status_tag: "APROBADO" }
  { level: INICIAL, value: "EN_PROCESO", label: "En Proceso",   is_approved: false, status_tag: "EN_PROCESO" }
  { level: INICIAL, value: "NO_LOGRADO", label: "No Logrado",   is_approved: false, status_tag: "DESAPROBADO" }
```

**PRIMARIO** — Numérica 1 a 10
```
GradeScale:
  { level: PRIMARIO, value: "10", label: "Excelente (10)",    min: 10,  max: 10,  is_approved: true }
  { level: PRIMARIO, value: "9",  label: "Muy Bueno (9)",     min: 9,   max: 9,   is_approved: true }
  { level: PRIMARIO, value: "8",  label: "Muy Bueno (8)",     min: 8,   max: 8,   is_approved: true }
  { level: PRIMARIO, value: "7",  label: "Bueno (7)",         min: 7,   max: 7,   is_approved: true }
  { level: PRIMARIO, value: "6",  label: "Bueno (6)",         min: 6,   max: 6,   is_approved: true }
  { level: PRIMARIO, value: "5",  label: "Regular (5)",       min: 5,   max: 5,   is_approved: false }
  { level: PRIMARIO, value: "4",  label: "Regular (4)",       min: 4,   max: 4,   is_approved: false }
  { level: PRIMARIO, value: "3",  label: "Insuficiente (3)",  min: 3,   max: 3,   is_approved: false }
  { level: PRIMARIO, value: "2",  label: "Insuficiente (2)",  min: 2,   max: 2,   is_approved: false }
  { level: PRIMARIO, value: "1",  label: "Insuficiente (1)",  min: 1,   max: 1,   is_approved: false }
```

**SECUNDARIO** — Numérica 1 a 10 (igual que primario pero con otros períodos)
```
GradeScale: (misma escala 1-10 que Primario)

GradingPeriodType:
  { level: SECUNDARIO, code: "BIMESTRAL",     label: "Bimestral",     periods: 4 }
  { level: SECUNDARIO, code: "CUATRIMESTRAL", label: "Cuatrimestral", periods: 2 }
  { level: SECUNDARIO, code: "DICIEMBRE",     label: "Diciembre",     periods: 1 }
  { level: SECUNDARIO, code: "FEBRERO",       label: "Febrero",       periods: 1 }
```

**TERCIARIO** — Numérica + condiciones especiales
```
GradeScale:
  { level: TERCIARIO, value: "10", label: "Sobresaliente",  min: 10, max: 10, is_approved: true }
  ... (1 a 10 igual que arriba)
  { level: TERCIARIO, value: "AUSENTE", label: "Ausente", is_approved: false }

GradingPeriodType:
  { level: TERCIARIO, code: "CURSADA",  label: "Nota de Cursada",  periods: 1 }
  { level: TERCIARIO, code: "FINAL",    label: "Examen Final",     periods: 1 }
  { level: TERCIARIO, code: "FIRMA_TP", label: "Firma de TP",      periods: 1 }
```

#### Reglas de calificación

| # | Regla |
|---|---|
| **R23** | Cada nivel tiene su propia `GradeScale`. Los valores son precargados y administrables. |
| **R24** | Una materia elige su tipo de período (`SubjectGradingConfig`): bimestral, cuatrimestral, cursada, final, etc. |
| **R25** | `StudentGrade` registra la nota concreta, heredando `is_approved` y `status_tag` de la escala. |
| **R26** | El `status_tag` determina visualización: APROBADO (verde), DESAPROBADO (rojo), EN_PROCESO (amarillo). |
| **R27** | `is_approved = false` + `requires_recovery = true` → habilita instancia de recuperatorio. |
| **R28** | La evolución del alumno se ve consultando `StudentGrade` por `student_id` ordenado por `period_number`. |
| **R29** | Terciario tiene 3 instancias: CURSADA, FINAL y FIRMA_TP. Se aprueban por separado. |
| **R30** | **Snapshot inmutable**: Al guardar una calificación, se COPIAN `grade_value`, `grade_label`, `is_approved` y `status_tag` desde `GradeScale` al registro `StudentGrade`. Si la escala cambia después, las notas históricas no se alteran. |
| **R31** | `GradeScale` es un template editable por administradores. `StudentGrade` es el registro histórico inmodificable (salvo corrección explícita con auditoría). |

### 1.5 Nuevas tablas por nivel pedagógico

#### 🧒 NIVEL INICIAL (3 tablas nuevas)

```
┌──────────────┐
│    Sala      │  1 sala = 1 grupo de edad (3, 4, o 5 años)
│──────────────│
│ id (UUID)    │
│ name         │  "Sala Azul", "Sala Roja"
│ age_group    │  ENUM: 3 | 4 | 5
│ turno        │  "MAÑANA" | "TARDE"
│ capacity     │  INT (máximo de alumnos)
│ teacher_id   │  FK → Teacher
│ institution  │  FK → Institution
│ academic_year│  "2025"
│ active       │  BOOL
└──────┬───────┘
       │
       ├──< SalaEnrollment (alumno inscripto en sala)
       │    student_id, sala_id, academic_year
       │
       ├──< InformeEvolutivo
       │    │  student_id, sala_id, periodo ("1T","2T","3T")
       │    │  fecha, observaciones_generales
       │    │
       │    └──< AreaDesarrollo (1 informe tiene N áreas)
       │         area: "SOCIO_AFECTIVA"|"MOTRIZ"|"COGNITIVA"|
       │               "LENGUAJE"|"CREATIVA"
       │         observacion: TEXT
       │         valoracion: "DESTACADO"|"LOGRADO"|"EN_PROCESO"
       │
       └──< Planificacion
            sala_id, semana (INT 1..40)
            └──< SecuenciaDidactica
                 nombre, area, actividades (TEXT[]), recursos (TEXT[])
```

#### 📝 NIVEL PRIMARIO (2 tablas nuevas)

```
┌──────────────┐
│    Grado     │  Extiende CourseSection con especificidad de primaria
│──────────────│
│ id (UUID)    │
│ course_sec_id│  FK → CourseSection (relación 1:1)
│ grade        │  INT 1..6
│ division     │  "A"|"B"|"C"
│ teacher_id   │  FK → Teacher (maestro de grado)
│ academic_year│  "2025"
│ active       │  BOOL
└──────┬───────┘
       │
       └──< CalificacionPrimario (extiende Grade con reglas 1-10)
            │  student_id, grado_id, materia_id
            │  trimestre: "1T"|"2T"|"3T"
            │  nota: DECIMAL(2,1) 1.0 a 10.0
            │  concepto: "EXCELENTE"|"MUY_BUENO"|"BUENO"|"REGULAR"|"INSUFICIENTE"
            │  aprobado: BOOL (nota >= 6)

Asistencia: usa la tabla genérica Attendance con CourseSection
Boletín: se genera desde Grade + Attendance (Template Method ya implementado)
```

#### 📚 NIVEL SECUNDARIO (3 tablas nuevas)

```
┌──────────────┐
│    Curso     │  Extiende CourseSection con orientación
│──────────────│
│ id (UUID)    │
│ course_sec_id│  FK → CourseSection (1:1)
│ year         │  INT 1..6
│ division     │  "A"|"B"|"C"
│ orientacion  │  "NATURALES"|"SOCIALES"|"ECONOMIA"|"ARTE"|etc.
│ academic_year│  "2025"
│ active       │  BOOL
└──────┬───────┘
       │
       ├──< CalificacionSecundario
       │    │  student_id, curso_id, materia_id
       │    │  trimestre: "1T"|"2T"|"3T"
       │    │  nota: DECIMAL(2,1) 1.0 a 10.0
       │    │  condicion: "APROBADO"|"PREVIA"|"LIBRE"
       │    │  Diciembre: nota DEC, Febrero: nota FEB
       │
       ├──< MesaExamen
       │    │  materia_id, fecha, turno, presidente_id FK→Teacher
       │    │
       │    └──< MesaExamenInscripcion
       │         student_id, mesa_id, nota_final, condicion_final
       │
       └──< RegimenAcademico
            │  curso_id, materia_id
            │  promocion_directa: BOOL (nota >= 7)
            │  requiere_examen_final: BOOL
            │  nota_minima_aprobacion: DECIMAL (default 6)
```

#### 🎓 NIVEL TERCIARIO (5 tablas nuevas)

```
┌──────────────┐
│   Carrera    │
│──────────────│
│ id (UUID)    │
│ name         │  "Profesorado de Matemática"
│ titulo       │  "Profesor de Educación Secundaria en Matemática"
│ duracion     │  INT (cantidad de años/cuatrimestres)
│ resolucion   │  STRING (n° resolución ministerial)
│ institution  │  FK → Institution
│ active       │  BOOL
└──────┬───────┘
       │
       ├──< MateriaCarrera (Plan de estudios)
       │    │  carrera_id, materia_id (FK→Subject)
       │    │  anio: INT, cuatrimestre: "1C"|"2C"|"ANUAL"
       │    │  horas_catedra: INT
       │    │  regimen: "PROMOCIONAL"|"REGULAR"|"LIBRE"
       │    │
       │    └──< Correlatividad (materia requiere otra aprobada)
       │         materia_id, correlativa_id
       │         tipo: "CURSADA"|"FINAL" (requiere cursada aprobada o final aprobado)
       │
       ├──< InscripcionMateria
       │    │  student_id, materia_carrera_id, cuatrimestre, anio_academico
       │    │  estado: "INSCRIPTO"|"CURSANDO"|"REGULAR"|"APROBADO"|"LIBRE"
       │    │  nota_cursada, nota_final
       │    │
       │    └── Las validaciones de correlatividades son lógica de aplicación
       │
       ├──< ActaExamen
       │    │  materia_carrera_id, fecha, mesa_id
       │    │  presidente_id FK→Teacher, vocales: Teacher[]
       │    │  libro, folio
       │    │
       │    └──< ActaExamenNota
       │         student_id, nota, condicion: "APROBADO"|"DESAPROBADO"|"AUSENTE"
       │
       └──< Titulo
            student_id, carrera_id
            fecha_egreso: DATE
            fecha_emision: DATE
            estado: "EN_TRAMITE"|"EMITIDO"|"ENTREGADO"
            nro_registro: STRING
```

### 1.6 Resumen de tablas

| # | Tabla | Contexto | Estado |
|---|---|---|---|
| 1 | `users` | Auth | ✅ Existe |
| 2 | `refresh_tokens` | Auth | ✅ Existe |
| 3 | `institutions` | Institución | ✅ Existe |
| 4 | `students` | Personal | ✅ Existe |
| 5 | `teachers` | Personal | ✅ Existe |
| 6 | `enrollments` | Inscripción genérica | ✅ Existe |
| 7 | `subjects` | Pedagógico | ✅ Existe |
| 8 | `course_sections` | Pedagógico | ✅ Existe |
| 9 | `subject_assignments` | Pedagógico | ✅ Existe |
| 10 | `grades` | Pedagógico | ✅ Existe |
| 11 | `attendances` | Pedagógico | ✅ Existe |
| **12** | **`study_plans`** | **Plan de Estudios** | 🆕 |
| **13** | **`study_plan_courses`** | **Plan de Estudios** | 🆕 |
| **14** | **`study_plan_subjects`** | **Plan de Estudios** | 🆕 |
| **15** | **`correlatives`** | **Plan de Estudios** | 🆕 |
| **16** | **`academic_cycles`** | **Ciclo Lectivo** | 🆕 |
| **17** | **`academic_cycle_periods`** | **Ciclo Lectivo** | 🆕 |
| **18** | **`academic_cycle_study_plans`** | **Ciclo Lectivo** | 🆕 |
| **19** | **`grade_scales`** | **Calificaciones** | 🆕 |
| **20** | **`grading_period_types`** | **Calificaciones** | 🆕 |
| **21** | **`subject_grading_configs`** | **Calificaciones** | 🆕 |
| **22** | **`student_grades`** | **Calificaciones** | 🆕 |
| **23** | **`salas`** | **Inicial** | 🆕 |
| **24** | **`sala_enrollments`** | **Inicial** | 🆕 |
| **25** | **`informes_evolutivos`** | **Inicial** | 🆕 |
| **26** | **`areas_desarrollo`** | **Inicial** | 🆕 |
| **27** | **`planificaciones`** | **Inicial** | 🆕 |
| **28** | **`secuencias_didacticas`** | **Inicial** | 🆕 |
| **29** | **`grados`** | **Primario** | 🆕 |
| **30** | **`calificaciones_primario`** | **Primario** | 🆕 |
| **31** | **`cursos`** | **Secundario** | 🆕 |
| **32** | **`calificaciones_secundario`** | **Secundario** | 🆕 |
| **33** | **`mesas_examen`** | **Secundario** | 🆕 |
| **34** | **`mesa_examen_inscripciones`** | **Secundario** | 🆕 |
| **35** | **`regimen_academico`** | **Secundario** | 🆕 |
| **36** | **`inscripciones_materia`** | **Terciario** | 🆕 |
| **37** | **`actas_examen`** | **Terciario** | 🆕 |
| **38** | **`acta_examen_notas`** | **Terciario** | 🆕 |
| **39** | **`titulos`** | **Terciario** | 🆕 |

**Total: 11 existentes + 28 nuevas = 39 tablas**

> Nota: `carreras`, `materias_carrera` y `correlatividades` (Terciario) fueron reemplazadas
> por el modelo unificado `study_plans` + `study_plan_subjects` + `correlatives`.
> El mismo modelo sirve para Secundario y Primario cuando tengan planes de estudio.

### 1.7 Jerarquía completa — Padres e Hijos

```
MASTER DATABASE (educandow_master)
═══════════════════════════════════════════════════
institutions (RAÍZ)
 └── users (hijo 1:N)
      └── refresh_tokens (hijo 1:N)

═══════════════════════════════════════════════════
TENANT DATABASE (educandow_{id})
═══════════════════════════════════════════════════

── PERSONAS ──────────────────────────────────────
students (RAÍZ)
teachers (RAÍZ)

── MATERIAS Y CURSOS ─────────────────────────────
subjects (RAÍZ)
course_sections (RAÍZ)

── ASIGNACIONES (N:1 con múltiples padres) ──────
subject_assignments ← subjects + teachers + course_sections
enrollments         ← students + course_sections + academic_cycles
attendances         ← students + course_sections + academic_cycles
  │  statuses: PRESENT | ABSENT | LATE | EARLY_DEPARTURE | JUSTIFIED

── PLAN DE ESTUDIOS ──────────────────────────────
study_plans (RAÍZ)
 ├── study_plan_courses (hijo 1:N)
 │    └── study_plan_subjects (hijo opcional si HIERARCHICAL)
 ├── study_plan_subjects (hijo directo de study_plans + subjects)
 │    └── correlatives (hijo — autorreferencia: subject → required)
 └── academic_cycle_study_plans (N:M con academic_cycles)

── CICLO LECTIVO ─────────────────────────────────
academic_cycles (RAÍZ)
 ├── academic_cycle_periods (hijo 1:N)
 │    └── → grading_period_types (lookup, no FK restrictiva)
 ├── academic_cycle_study_plans (N:M con study_plans)
 └── → enrollments (el enrollment se ata al ciclo)

── CALIFICACIONES ────────────────────────────────
grade_scales (CATÁLOGO por nivel)
grading_period_types (CATÁLOGO por nivel)
subject_grading_configs ← subjects + grading_period_types
student_grades ← students + subjects + grading_period_types
                 ⚠️ SNAPSHOT de grade_scales (copia, no FK)

── TABLAS DE NIVEL (pendientes diseño detallado) ─

INICIAL:
  salas (RAÍZ o extiende course_sections)
   ├── sala_enrollments (N:M: students + salas)
   ├── informes_evolutivos ← students + salas
   │    └── areas_desarrollo (hijo 1:N)
   └── planificaciones ← salas
        └── secuencias_didacticas (hijo 1:N)

PRIMARIO:
  grados (extiende course_sections)
   └── calificaciones_primario (usa student_grades)

SECUNDARIO:
  cursos (extiende course_sections)
   ├── calificaciones_secundario (usa student_grades)
   ├── mesas_examen (RAÍZ)
   │    └── mesa_examen_inscripciones (N:M)
   └── regimen_academico ← cursos + subjects

TERCIARIO:
  inscripciones_materia ← students + study_plan_subjects
  actas_examen (RAÍZ)
   └── acta_examen_notas (hijo 1:N)
  titulos ← students + study_plans
```

| Tipo de relación | Tablas |
|---|---|
| **RAÍZ (independiente)** | institutions, students, teachers, subjects, course_sections, study_plans, academic_cycles |
| **CATÁLOGO (lookup)** | grade_scales, grading_period_types |
| **HIJO 1:N** | users, refresh_tokens, study_plan_courses, academic_cycle_periods, areas_desarrollo, secuencias_didacticas, acta_examen_notas |
| **HIJO N:1 (varios padres)** | enrollments, subject_assignments, student_grades, attendances, study_plan_subjects, correlatives, subject_grading_configs, informes_evolutivos, planificaciones, regimen_academico, inscripciones_materia, titulos |
| **JOIN N:M** | academic_cycle_study_plans, sala_enrollments, mesa_examen_inscripciones |
| **SNAPSHOT (copia)** | student_grades copia de grade_scales (no FK) |

### 1.8 Informe del alumno — Materias por curso + Asistencias por ciclo

```
INFORME ACADÉMICO — Alumno: Juan Pérez

═══════════════════════════════════════════════════════
CICLO 2022 — 1er Año
───────────────────────────────────────────────────────
Asistencias:   Presentes: 178   Tardes: 5   Ausentes: 12   Salidas ant.: 3

MATERIAS:
  Matemática 1    1B: 8 ✓   2B: 7 ✓   → PROMEDIO: 7.5  APROBADA
  Lengua 1        1B: 4 ✗   2B: 5 ✗   DIC: 6 ✓         APROBADA (previa)
  Geografía 1     1B: 3 ✗   2B: 4 ✗   FEB: 8 ✓         APROBADA (previa)
  ... (7 más)

═══════════════════════════════════════════════════════
CICLO 2023 — 2do Año
───────────────────────────────────────────────────────
Asistencias:   Presentes: 185   Tardes: 2   Ausentes: 8   Salidas ant.: 1

MATERIAS:
  Matemática 2    1B: 9 ✓   2B: 8 ✓   → APROBADA
  Lengua 2        1B: 7 ✓   2B: 8 ✓   → APROBADA
  ... (todas aprobadas)

═══════════════════════════════════════════════════════
CICLO 2025 — 4to Año
───────────────────────────────────────────────────────
Asistencias:   Presentes: 43   Ausentes: 67   → QUEDÓ LIBRE
Estado: INACTIVO por inasistencias
```

#### Consulta SQL que genera este informe

```sql
-- 1. Asistencias por ciclo
SELECT ac.name AS ciclo,
       COUNT(*) FILTER (WHERE a.status = 'PRESENT') AS presentes,
       COUNT(*) FILTER (WHERE a.status = 'ABSENT') AS ausentes,
       COUNT(*) FILTER (WHERE a.status = 'LATE') AS tardes,
       COUNT(*) FILTER (WHERE a.status = 'EARLY_DEPARTURE') AS salidas_anticipadas
FROM attendances a
JOIN academic_cycles ac ON a.cycle_id = ac.id
WHERE a.student_id = :studentId
GROUP BY ac.name
ORDER BY ac.name;

-- 2. Materias por curso (agrupadas por ciclo y curso)
SELECT ac.name AS ciclo,
       spc.name AS curso,
       s.name AS materia,
       pt.code AS periodo, sg.period_number,
       sg.grade_value AS nota,
       sg.is_approved AS aprobada,
       sg.status_tag,
       sg.evaluated_at AS fecha
FROM student_grades sg
JOIN academic_cycles ac ON sg.cycle_id = ac.id
JOIN subjects s ON sg.subject_id = s.id
JOIN grading_period_types pt ON sg.period_type_id = pt.id
JOIN study_plan_subjects sps ON sps.subject_id = sg.subject_id
LEFT JOIN study_plan_courses spc ON sps.course_id = spc.id
WHERE sg.student_id = :studentId
ORDER BY ac.name, spc.order, s.name, sg.evaluated_at;

-- 3. Estado de inscripción por ciclo
SELECT ac.name AS ciclo, e.status, cs.name AS curso
FROM enrollments e
JOIN academic_cycles ac ON e.cycle_id = ac.id
JOIN course_sections cs ON e.course_section_id = cs.id
WHERE e.student_id = :studentId
ORDER BY ac.name;
```

| # | Nueva regla |
|---|---|
| **R40** | `attendances` tiene `cycle_id` FK → AcademicCycle. Permite contar asistencias por ciclo. |
| **R41** | `AttendanceStatus` incluye `EARLY_DEPARTURE` (salida anticipada). |
| **R42** | Las materias se agrupan por curso usando `study_plan_subjects → study_plan_courses`. En planes FLAT (sin cursos), se agrupan por `year`. |

---

## 2. Diseño E → P → S por Nivel Pedagógico

### 2.1 NIVEL INICIAL — "Desarrollo integral del niño"

```
╔══════════════════════════════════════════════════════════╗
║                    ENTRADAS                               ║
╠══════════════════════════════════════════════════════════╣
║ • Datos del alumno (nombre, DNI, fecha nac, tutor)       ║
║ • Sala asignada (edad 3, 4 o 5)                          ║
║ • Observaciones del docente por área de desarrollo        ║
║ • Planificaciones semanales con secuencias didácticas     ║
║ • Registro de asistencia diaria                          ║
╚══════════════════════════════════════╦═══════════════════╝
                                       ║
                              ┌────────╨────────┐
                              │    PROCESOS      │
                              ├─────────────────┤
                              │ Validar edad     │
                              │ Asignar sala     │
                              │ Registrar        │
                              │ asistencia       │
                              │ Evaluar áreas    │
                              │ desarrollo       │
                              │ (cualitativa)    │
                              │ Generar informe   │
                              │ evolutivo        │
                              └────────┬────────┘
                                       ║
╔══════════════════════════════════════╩═══════════════════╗
║                    SALIDAS                                ║
╠══════════════════════════════════════════════════════════╣
║ • Listado de salas con alumnos                            ║
║ • Informe evolutivo por alumno/período                    ║
║   → Áreas: valoración cualitativa (Destacado/Logrado/EP)  ║
║ • Planificación semanal de la sala                        ║
║ • Registro de asistencia                                  ║
║ • NO hay notas numéricas, NO hay boletín tradicional      ║
╚══════════════════════════════════════════════════════════╝
```

### 2.2 NIVEL PRIMARIO — "Calificación numérica con concepto"

```
╔══════════════════════════════════════════════════════════╗
║                    ENTRADAS                               ║
╠══════════════════════════════════════════════════════════╣
║ • Inscripción a grado (1° a 6°)                           ║
║ • Notas por trimestre (1.00 a 10.00) por materia          ║
║ • Registro de asistencia diaria                           ║
║ • Datos del boletín (período, institución)                ║
╚══════════════════════════════════╦═══════════════════════╝
                                       ║
                              ┌────────╨────────┐
                              │    PROCESOS      │
                              ├─────────────────┤
                              │ Validar grado    │
                              │ Asignar materias │
                              │ Calcular         │
                              │ promedio         │
                              │ trimestral       │
                              │ Mapear nota a    │
                              │ concepto         │
                              │ (>=9 Excelente,  │
                              │  >=7 MB, >=6 B,  │
                              │  >=4 R, <4 I)   │
                              │ Determinar       │
                              │ aprobación       │
                              │ (nota >= 6)      │
                              │ Generar boletín  │
                              └────────┬────────┘
                                       ║
╔══════════════════════════════════════╩═══════════════════╗
║                    SALIDAS                                ║
╠══════════════════════════════════════════════════════════╣
║ • Lista de grados con alumnos y maestro                   ║
║ • Calificaciones por alumno/materia/trimestre             ║
║ • Boletín de calificaciones (Template Method)             ║
║   → Materias con notas 1T, 2T, 3T, Promedio, Concepto    ║
║ • Registro de asistencia                                  ║
║ • SI hay notas numéricas, SI hay boletín                  ║
║ • NO hay previas, NO hay régimen de promoción complejo    ║
╚══════════════════════════════════════════════════════════╝
```

### 2.3 NIVEL SECUNDARIO — "Régimen con previas y mesas"

```
╔══════════════════════════════════════════════════════════╗
║                    ENTRADAS                               ║
╠══════════════════════════════════════════════════════════╣
║ • Inscripción a curso (1° a 6° con orientación)          ║
║ • Notas trimestrales por materia (1.00 a 10.00)          ║
║ • Notas de diciembre y febrero (para previas)             ║
║ • Configuración de mesas de examen                        ║
║ • Inscripción a mesas de examen                           ║
║ • Régimen académico por materia                           ║
╚══════════════════════════════════════╦═══════════════════╝
                                       ║
                              ┌────────╨────────┐
                              │    PROCESOS      │
                              ├─────────────────┤
                              │ Validar curso    │
                              │ Calcular         │
                              │ promedio         │
                              │ trimestral       │
                              │ Determinar       │
                              │ condición:       │
                              │  >=7 PROMOCION   │
                              │  >=6 APROBADO    │
                              │  <6 PREVIA       │
                              │ Registrar notas  │
                              │ diciembre/febrero│
                              │ Gestionar mesas  │
                              │ de examen        │
                              │ Verificar régimen│
                              │ académico        │
                              └────────┬────────┘
                                       ║
╔══════════════════════════════════════╩═══════════════════╗
║                    SALIDAS                                ║
╠══════════════════════════════════════════════════════════╣
║ • Calificaciones con condición (APROBADO/PREVIA/LIBRE)    ║
║ • Boletín con notas + condición por materia               ║
║ • Actas de mesa de examen                                 ║
║ • Régimen académico por curso                             ║
║ • SI hay previas, SI hay mesas de examen                  ║
║ • NO hay correlatividades entre materias                  ║
╚══════════════════════════════════════════════════════════╝
```

### 2.4 NIVEL TERCIARIO — "Carreras con correlatividades"

```
╔══════════════════════════════════════════════════════════╗
║                    ENTRADAS                               ║
╠══════════════════════════════════════════════════════════╣
║ • Creación de carrera con plan de estudios                ║
║ • Materias con año, cuatrimestre, régimen, correlativas   ║
║ • Inscripción a materias (validando correlatividades)     ║
║ • Nota de cursada y nota final por materia                ║
║ • Actas de examen (libro, folio, mesa)                    ║
║ • Solicitud de título                                    ║
╚══════════════════════════════════════╦═══════════════════╝
                                       ║
                              ┌────────╨────────┐
                              │    PROCESOS      │
                              ├─────────────────┤
                              │ Validar plan     │
                              │ de estudios      │
                              │ Verificar        │
                              │ correlatividades │
                              │ (cursada y final)│
                              │ al inscribir     │
                              │ Determinar       │
                              │ condición final: │
                              │  >=7 PROMOCION   │
                              │  >=4 REGULAR     │
                              │  <4 LIBRE        │
                              │ Generar actas    │
                              │ de examen        │
                              │ Verificar        │
                              │ egreso (todas    │
                              │ las materias     │
                              │ aprobadas)       │
                              │ Emitir título    │
                              └────────┬────────┘
                                       ║
╔══════════════════════════════════════╩═══════════════════╗
║                    SALIDAS                                ║
╠══════════════════════════════════════════════════════════╣
║ • Plan de estudios de la carrera                          ║
║ • Estado académico del alumno (materias aprobadas/pend.)  ║
║ • Analítico parcial (Template Method)                     ║
║ • Actas de examen firmadas                                ║
║ • Título emitido (en trámite, emitido, entregado)         ║
║ • SI hay correlatividades, SI hay régimen promocional     ║
║ • SI hay títulos, SI hay actas formales                   ║
╚══════════════════════════════════════════════════════════╝
```

---

## 3. Bounded Contexts y Módulos

```
┌─────────────────────────────────────────────────────────┐
│                   SHARED KERNEL                          │
│  User, Institution, Student, Teacher, Enrollment,        │
│  Subject, CourseSection, Attendance, Grade (genérico)    │
│  AuthPort, EventBus, Result, ValueObjects                │
└─────────────────────────────────────────────────────────┘
         │          │          │          │
    ┌────┴───┐ ┌───┴────┐ ┌───┴────┐ ┌───┴────┐
    │INICIAL │ │PRIMARIO│ │SECUND. │ │TERCIAR.│
    ├────────┤ ├────────┤ ├────────┤ ├────────┤
    │Sala    │ │Grado   │ │Curso   │ │Carrera │
    │Informe │ │CalifP  │ │CalifS  │ │MateriaC│
    │Planif  │ │Boletin │ │MesaEx  │ │Correlat│
    │Secuencia│ │Asist. │ │Regimen │ │InscripM│
    │        │ │        │ │        │ │ActaEx  │
    │        │ │        │ │        │ │Titulo  │
    └────────┘ └────────┘ └────────┘ └────────┘

Rutas:
  /v1/inicial/salas         /v1/primario/grados
  /v1/inicial/informes      /v1/primario/calificaciones
  /v1/inicial/planificaciones /v1/primario/boletines
                             /v1/primario/asistencia

  /v1/secundario/cursos     /v1/terciario/carreras
  /v1/secundario/calificaciones /v1/terciario/calificaciones
  /v1/secundario/mesas      /v1/terciario/actas
  /v1/secundario/regimen    /v1/terciario/inscripciones
                             /v1/terciario/titulos
```

---

## 4. Reglas de negocio por nivel

| Regla | Inicial | Primario | Secundario | Terciario |
|---|---|---|---|---|
| **Evaluación** | Cualitativa | Numérica 1-10 + concepto | Numérica 1-10 + condición | Numérica + promocional |
| **Aprobación** | No aplica | Nota ≥ 6 | Nota ≥ 6 (aprobado), <6 (previa) | ≥7 promoción, ≥4 regular, <4 libre |
| **Períodos** | 3 informes | 3 trimestres | 3 trimestres + Dic + Feb | Cuatrimestral |
| **Promoción** | Automática por edad | Por promedio anual | Con previas y mesas | Por materia con correlativas |
| **Documento** | Informe evolutivo | Boletín de calificaciones | Boletín con previas | Analítico parcial |
| **Estructura** | Salas por edad (3/4/5) | Grados 1° a 6° | Cursos 1° a 6° + orientación | Carreras con plan de estudios |

---

## 5. Orden de implementación

| Paso | Nivel | Tablas | Complejidad | Depende de |
|---|---|---|---|---|
| 1 | **Inicial** | 6 tablas | Baja | Ninguno extra |
| 2 | **Primario** | 2 tablas | Baja | Ninguno extra |
| 3 | **Secundario** | 5 tablas | Media | Ninguno extra |
| 4 | **Terciario** | 7 tablas | Alta | Subject existente |
