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
│                  │ sends_email: BOOL             │    │
│                  │                               │    │
│                  │ ── Branding ──                │    │
│                  │ logo_url: STRING?      (5)    │    │
│                  │ header_color: STRING?  (6)    │    │
│                  │ header_text_color: STRING?    │    │
│                  │ body_text_color: STRING?      │    │
│                  │                               │    │
│                  │ ── Config ──                  │    │
│                  │ active: BOOL           (7)    │    │
│                  │ socket_host: STRING?   (8)    │    │
│                  │ socket_port: INT?             │    │
│                  │                               │    │
│                  │ db_name: STRING        (9)    │    │
│                  │ created_at: TIMESTAMP         │    │
│                  │ updated_at: TIMESTAMP         │    │
│                  └──────────────────────────────┘    │
│                                                       │
│  (1) N° inscripción Ministerio de Educación           │
│  (2) Código Único Escolar (alfanumérico, único)       │
│  (3) Encriptado en reposo (bcrypt o AES)             │
│  (4) "TLS" | "SSL" | "NONE"                          │
│  (5) URL de la imagen (S3 / local storage)           │
│  (6) Hex color: "#1a56db"                            │
│  (7) Soft-delete: institución activa/inactiva         │
│  (8) Para notificaciones real-time (WebSocket)        │
│  (9) Nombre de la tenant DB: "educandow_1002"        │
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

### 0.5 Impacto en el código actual

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

### 1.2 Nuevas tablas por nivel pedagógico

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

### 1.3 Resumen de tablas

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
| **12** | **`salas`** | **Inicial** | 🆕 |
| **13** | **`sala_enrollments`** | **Inicial** | 🆕 |
| **14** | **`informes_evolutivos`** | **Inicial** | 🆕 |
| **15** | **`areas_desarrollo`** | **Inicial** | 🆕 |
| **16** | **`planificaciones`** | **Inicial** | 🆕 |
| **17** | **`secuencias_didacticas`** | **Inicial** | 🆕 |
| **18** | **`grados`** | **Primario** | 🆕 |
| **19** | **`calificaciones_primario`** | **Primario** | 🆕 |
| **20** | **`cursos`** | **Secundario** | 🆕 |
| **21** | **`calificaciones_secundario`** | **Secundario** | 🆕 |
| **22** | **`mesas_examen`** | **Secundario** | 🆕 |
| **23** | **`mesa_examen_inscripciones`** | **Secundario** | 🆕 |
| **24** | **`regimen_academico`** | **Secundario** | 🆕 |
| **25** | **`carreras`** | **Terciario** | 🆕 |
| **26** | **`materias_carrera`** | **Terciario** | 🆕 |
| **27** | **`correlatividades`** | **Terciario** | 🆕 |
| **28** | **`inscripciones_materia`** | **Terciario** | 🆕 |
| **29** | **`actas_examen`** | **Terciario** | 🆕 |
| **30** | **`acta_examen_notas`** | **Terciario** | 🆕 |
| **31** | **`titulos`** | **Terciario** | 🆕 |

**Total: 11 existentes + 20 nuevas = 31 tablas**

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
