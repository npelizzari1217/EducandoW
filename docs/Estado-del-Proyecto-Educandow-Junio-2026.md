# Estado del Proyecto EducandoW — Junio 2026

> **Stack**: TypeScript 5.4 · NestJS v10 + SWC · React 19 + Vite 6 · Prisma v5 + PostgreSQL · pnpm + Turborepo v2  
> **Arquitectura**: Clean Architecture + Database-per-Tenant + JWT · **Tests**: 785/785 ✅

---

## 1. Objetivos Globales

EducandoW es un **SaaS multi-tenant de gestión educativa** para instituciones argentinas. Permite a cada escuela operar en su propia base de datos aislada, con branding personalizado, perfiles de permisos configurables, y módulos pedagógicos específicos para cada nivel educativo.

| Objetivo | Estado |
|----------|:---:|
| **SaaS multi-tenant** con database-per-tenant | ✅ |
| **25 campos institucionales** completos (identidad + SMTP + branding + notificaciones) | ✅ |
| **Creación atómica de tenant** (master record → DB → migrations → admin) con rollback | ✅ |
| **RBAC granular** con módulos × 5 acciones (READ, CREATE, UPDATE, DELETE, PRINT) | ✅ |
| **Perfiles de permisos** como templates (Admin Completo, Docente Básico) | ✅ |
| **4 niveles pedagógicos** como bounded contexts independientes | ✅ |
| **Frontend multi-tenant** con CSS theme por institución y sidebar filtrada por niveles | ✅ |
| **Autenticación JWT** con refresh tokens, login multi-institución | ✅ |
| **Seed automático** de datos maestros (módulos, roles, perfiles) | ✅ |

---

## 2. Diagrama Entidad-Relación

### 2.1 Base Master — Gestión institucional, RBAC, Auth

```
┌───────────────────────────────────────────────────────┐
│                   MASTER DATABASE                      │
│                   educandow_master                     │
│                                                        │
│  ┌──────────────┐       ┌─────────────────────────┐   │
│  │ Institution  │──<    │ InstitutionLevel        │   │
│  │ (25 campos)  │       │ level, modality, active │   │
│  │ id, name,    │       └─────────────────────────┘   │
│  │ cue UK,      │                                      │
│  │ db_name UK,  │──< ┌──────────┐                     │
│  │ SMTP config, │    │   User   │                     │
│  │ branding,    │    │ email UK │──< RefreshToken     │
│  │ active,      │    │ password │──< UserRole         │
│  │ notif flags  │    │ profileId│──< UserModule       │
│  └──────────────┘    └──────────┘                     │
│                              │                         │
│  ┌──────────┐    ┌──────────┴──────┐                  │
│  │  Module  │──< │   RoleModule    │                  │
│  │ code UK  │    │   actions[]     │                  │
│  └──────────┘    └─────────────────┘                  │
│                                                        │
│  ┌──────────┐    ┌──────────────────────┐             │
│  │  Profile │──< │ ProfileModulePerm.   │             │
│  │ name     │    │ canR,canC,canE,canD, │             │
│  └──────────┘    │ canP (booleans)      │             │
│                  └──────────────────────┘             │
└───────────────────────────────────────────────────────┘
```

**Reglas multi-tenant**:
- R1: Master DB solo contiene `institutions`, `users`, `profiles`, `modules`, `roles`, `refresh_tokens`
- R2: Cada tenant tiene su propia DB `educandow_{id}` con todos los datos pedagógicos
- R3: Las tablas tenant NO tienen `institutionId` — el aislamiento es por base de datos
- R4: JWT transporta `dbName` para routing de conexión
- R5: Un usuario pertenece a UNA institución

### 2.2 Base Tenant — Datos pedagógicos por institución

```
┌──────────────────────────────────────────────────────────────┐
│               TENANT DATABASE — educandow_{id}               │
│                                                              │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────────┐  │
│  │ Student  │──< │ Guardian      │    │ StudentGuardian  │  │
│  │ 25 cam-  │    │ name, phone,  │    │ relationship     │  │
│  │ pos DNI  │    │ email         │    └──────────────────┘  │
│  └──────────┘    └───────────────┘                           │
│       │                                                      │
│       ├──< Enrollment (ciclo, curso, student)                │
│       ├──< Nota (evaluación, valor, escala)                  │
│       ├──< Attendance (fecha, presente, justificado)         │
│       └──< NotaTrimestral (periodo, promedio)                │
│                                                              │
│  ┌──────────────┐    ┌───────────────────┐                  │
│  │ AcademicCycle│    │   CourseSection   │                  │
│  │ year, start  │    │   name, capacity  │                  │
│  └──────────────┘    └───────────────────┘                  │
│                              │                               │
│  ┌──────────┐    ┌──────────┴──────┐    ┌──────────────┐   │
│  │ Teacher  │──< │ SubjectAssig.   │──< │ Evaluacion   │   │
│  │ name, DNI│    │ teacher,curso,  │    │ tipo, fecha  │   │
│  └──────────┘    │ materia         │    └──────────────┘   │
│                  └─────────────────┘                        │
│                                                              │
│  ┌──────────────┐    ┌───────────────────┐                  │
│  │ StudyPlan    │──< │ StudyPlanCourse   │──< Subject      │
│  │ name, nivel  │    │ year, hours       │                  │
│  └──────────────┘    └───────────────────┘                  │
│                                                              │
│  NIVELES PEDAGÓGICOS (bounded contexts independientes):     │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Inicial    │ │ Primario │ │ Secund.  │ │ Terciario  │  │
│  │ Salas      │ │ Grados   │ │ Cursos   │ │ Carreras   │  │
│  │ Inf.Evol.  │ │ Calif.   │ │ M.Examen │ │ Inscrip.   │  │
│  │ Planific.  │ │          │ │ R.Acad.  │ │ Actas      │  │
│  └────────────┘ └──────────┘ └──────────┘ │ Títulos    │  │
│                                            └────────────┘  │
│  ┌──────────────┐    ┌───────────────┐                     │
│  │ GradeScale   │──< │ ScaleValue    │                     │
│  │ name, tipo   │    │ value, label  │                     │
│  └──────────────┘    └───────────────┘                     │
│                                                              │
│  ┌────────────────┐    ┌───────────────┐                   │
│  │ PeriodoEvaluac │──< │ NotaTrimestral│                   │
│  │ name, orden    │    └───────────────┘                   │
│  └────────────────┘                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Diagrama de Flujo de Datos

### 3.1 Creación de Institución (4-step atómico)

```
POST /v1/institutions  { name, cue, levels[], admin_email, ...25 campos }
        │
        ▼
  ┌──────────────────────────┐
  │ CreateInstitutionUseCase │
  └──────────────────────────┘
        │
        ├─[1] Validar Cue (≤20 chars, único) ────────────────► educandow_master
        ├─[2] repo.save(institution) ─────────────────────────► educandow_master.institutions
        ├─[3] CREATE DATABASE educandow_{id} ─────────────────► PostgreSQL
        ├─[4] prisma migrate deploy (schema_tenant) ──────────► educandow_{id}
        ├─[5] Create admin user (bcrypt + insert) ────────────► educandow_master.users
        │
        └─► 201 { id, name, db_name, admin: { email, password } }

        ⚠️ FALLO EN CUALQUIER PASO → ROLLBACK:
           DROP DATABASE + DELETE institution + DELETE admin user → 500
```

### 3.2 Login + Tenant Routing

```
POST /v1/auth/login  { email, password }
        │
        ▼
  ┌───────────────┐    bcrypt.compare    ┌──────────────┐
  │ AuthService   │ ───────────────────► │ master.users │
  └───────────────┘                      └──────────────┘
        │
        │ Verifica: active === true, dbName presente
        │
        ▼
  ┌─────────────────────────────────────┐
  │ JWT { sub, email, role,             │
  │       institutionId, dbName,        │
  │       levels[], modules[] }         │
  └─────────────────────────────────────┘
        │
        ▼
  ┌──────────────────┐
  │ TenantMiddleware │
  │  extrae dbName   │──► PrismaService.getClient(dbName)
  │  verifica active │──► TenantContext.run(client)
  └──────────────────┘
        │
        ▼
  Repository lee PrismaClient de TenantContext → query a educandow_{id}
```

### 3.3 Frontend: Login → Theme → Sidebar

```
┌──────────┐   JWT    ┌──────────────┐   GET /v1/institutions/me   ┌──────────────┐
│  LOGIN   │ ───────► │ AuthContext  │ ──────────────────────────► │ Institution  │
│  page    │          │ user, token  │     (25 campos + branding)   │   Context    │
└──────────┘          └──────────────┘                              └──────┬───────┘
                                                                          │
                                                    ┌─────────────────────┼─────────────────────┐
                                                    ▼                     ▼                     ▼
                                             ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
                                             │   Sidebar    │    │    Theme     │    │  Dashboard      │
                                             │ filtra por:  │    │ :root CSS    │    │  Layout         │
                                             │ user.levels  │    │ --header-color│   │ data-theme-     │
                                             │ user.modules │    │ --body-bg    │    │ institution     │
                                             │ featureFlags │    │ --body-text  │    │                 │
                                             └──────────────┘    └──────────────┘    └──────────────────┘
```

---

## 4. Resumen de Decisiones Técnicas

### 4.1 Arquitectura

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| **Patrón general** | Clean Architecture (domain → application → infrastructure → presentation) | Independencia del framework, testeabilidad, dominio puro sin dependencias |
| **Multi-tenancy** | Database-per-tenant | Aislamiento total de datos, escalado horizontal, sin filtros `institutionId` en queries |
| **PrismaService** | Factory con `Map<dbName, PrismaClient>` + lazy init | Cada tenant tiene su propio pool de conexiones, se limpian clientes inactivos |
| **JWT payload** | `dbName` + `institutionId` + `levels[]` + `modules[]` | El frontend y middleware resuelven tenant sin consultas extra a master DB |
| **TenantMiddleware** | `AsyncLocalStorage` (TenantContext) | Inyecta PrismaClient por request sin pasarlo como parámetro en cada método |
| **Creación de tenant** | 4-step atómico inline en CreateInstitutionUseCase | Simple, compensación inmediata con try/catch, sin event-driven innecesario |
| **Creación de DB** | Raw SQL via `pg` driver contra DB `postgres` | Prisma no puede conectarse a una DB que no existe |
| **Migraciones tenant** | `prisma migrate deploy` via child_process | Idempotente, oficial, maneja locking |

### 4.2 Dominio

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| **Niveles educativos** | Bounded contexts independientes | Inicial, Primario, Secundario y Terciario tienen reglas de evaluación distintas, no comparten lógica |
| **Códigos compuestos** | `level × 10 + modality` (ej: 10=Inicial Común, 32=Secundario Bilingüismo) | Consultas por rango (`BETWEEN 20 AND 29` = todo Primario), filtrado eficiente |
| **Value Objects** | Inmutables, self-validating (Cue, HexColor, SmtpConfig, Level, etc.) | Validación en construcción, no en DTOs. Tipos fuertes que expresan reglas de negocio |
| **Soft-delete** | Campo `active: boolean` + `deletedAt: DateTime?` | Sin pérdida de datos, bloqueo de sesiones activas, auditoría |
| **CUÉ único** | Validación cross-tenant vía master DB (todas las instituciones comparten tabla) | CUÉ es único a nivel nacional — la master DB lo garantiza naturalmente |

### 4.3 Seguridad

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| **Auth** | JWT + refresh token rotativo | Stateless, escalable, refresh token permite revocación |
| **RBAC** | Roles + UserModule (override por usuario) | Flexibilidad: un docente puede tener permisos base del rol "Docente" + módulos extra |
| **Contraseña SMTP** | AES-256-CBC con `ENCRYPTION_KEY` de 32 bytes | Bootstrap gate: si falta la key, la app NO arranca. Almacenamiento seguro en DB |
| **Perfiles de permisos** | Template de booleanos → conversión a `String[] actions` al asignar | Separation of concerns: el perfil define capacidades; el usuario recibe acciones concretas |

### 4.4 Frontend

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| **Estado global** | React Context (sin Redux/Zustand) | Suficiente para el patrón actual: AuthContext + InstitutionContext |
| **Tema multi-tenant** | CSS custom properties en `:root` via `useEffect` | Nativo del browser, zero dependencias, las 6 variables se setean una vez al cargar `/me` |
| **Sidebar** | Filtrado por `user.levels[]` (JWT), no por `config.levels` (institución) | Un usuario ve solo los niveles que tiene asignados, no todos los de la institución |
| **Formulario institución** | Role-gated: ROOT ve 25 campos (SMTP, branding, active), ADMIN solo identidad | Principio de mínimo privilegio en UI |
| **API client** | Axios con interceptors: JWT en header, refresh automático en 401, redirect a login | Centralizado, sin repetir lógica de auth en cada componente |

### 4.5 Testing

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| **Test runner** | Vitest v1.6.1 (domain, api, web) | Un solo runner para todo el monorepo, rápido, compatible con Vite |
| **TDD** | Strict — tests primero, luego implementación | Obligatorio según `openspec/config.yaml`, previene regresiones |
| **Integration tests** | NestJS TestingModule + test DB | Endpoints completos con contexto real de BD, sin mocks de Prisma |
| **Coverage threshold** | 80% | Configurado en `openspec/config.yaml` |

---

## 5. Módulos Implementados

### 5.1 Core — Sistema

| Módulo | Tablas | Endpoints | Estado |
|--------|--------|-----------|:---:|
| **Auth** | users, refresh_tokens | register, login, me, refresh, logout | ✅ |
| **Instituciones** | institutions (25 campos), institution_levels | CRUD + /me + ?active + logo upload | ✅ |
| **Roles** | roles, role_modules, user_roles | gestión de roles con acciones por módulo | ✅ |
| **Módulos** | modules, module_actions | 12 módulos del sistema con acciones | ✅ |
| **Usuarios** | users, user_modules | CRUD + asignación de roles/módulos/niveles | ✅ |
| **Perfiles** | profiles, profile_module_permissions | CRUD + matriz de permisos + asignación a usuario | ✅ |
| **Seed** | — | Admin Completo + Docente Básico + módulos + roles | ✅ |

### 5.2 Pedagógicos — Niveles

| Nivel | Entidades | Funcionalidades | Estado |
|-------|-----------|-----------------|:---:|
| **Inicial** | Salas, Informes Evolutivos, Planificaciones | CRUD completo, reportes | ✅ |
| **Primario** | Grados, Calificaciones | CRUD, escala de notas, adjetivación | ✅ |
| **Secundario** | Cursos, Mesas de Examen, Régimen Académico | CRUD, inscripciones, actas | ✅ |
| **Terciario** | Carreras, Inscripciones, Actas de Examen, Títulos | CRUD, estados, notas | ✅ |

### 5.3 Transversales

| Módulo | Funcionalidades | Estado |
|--------|----------------|:---:|
| **Alumnos** | CRUD 25 campos + tutores + búsqueda | ✅ |
| **Docentes** | CRUD + asignación a materias/cursos | ✅ |
| **Planes de Estudio** | CRUD + cursos + asignaturas | ✅ |
| **Inscripciones** | Matrícula en ciclos lectivos y cursos | ✅ |
| **Calificaciones** | Evaluaciones, notas, escalas, notas trimestrales | ✅ |
| **Asistencia** | Registro diario, justificaciones | ✅ |
| **Legajos** | Vista e impresión de legajo del alumno | ✅ |

---

## 6. Stack Técnico

```
┌─────────────────────────────────────────────────────────┐
│                   EDUCANDOW MONOREPO                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │   API    │  │   WEB    │  │  MOBILE  │              │
│  │ NestJS   │  │ React 19 │  │ Expo 52  │              │
│  │ v10+SWC  │  │ Vite 6   │  │(phantom) │              │
│  └────┬─────┘  └────┬─────┘  └──────────┘              │
│       │             │                                    │
│  ┌────┴─────────────┴────┐                              │
│  │   packages/domain     │  TypeScript puro, zero deps  │
│  │   Entidades, VOs,     │  Value Objects inmutables    │
│  │   Repos (interfaces)  │  Result pattern              │
│  └───────────────────────┘                              │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  PostgreSQL  │  Prisma v5  │  pnpm  │  Turborepo  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

| Capa | Tecnología | Versión |
|------|-----------|---------|
| API Framework | NestJS + SWC builder | v10 |
| ORM | Prisma | v5 |
| Database | PostgreSQL (Docker) | latest |
| Web Framework | React | v19 |
| Bundler | Vite | v6 |
| Router | React Router | v7 |
| Mobile | Expo SDK | v52 |
| Testing | Vitest | v1.6.1 |
| Language | TypeScript (strict) | v5.4 |
| Package Manager | pnpm | v9.0.0 |
| Monorepo | Turborepo | v2 |
| Node | — | ≥20.x |

---

## 7. Configuración de Entorno

| Variable | Descripción | Requerida |
|----------|-------------|:---:|
| `MASTER_DATABASE_URL` | Conexión a `educandow_master` | ✅ |
| `ENCRYPTION_KEY` | 32 bytes exactos para AES-256 (smtp_pass) | ✅ |
| `JWT_SECRET` | Clave para firmar tokens | ✅ |
| `JWT_REFRESH_SECRET` | Clave para refresh tokens | ✅ |
| `PORT` | Puerto HTTP (default: 3000) | ❌ |

---

## 8. Documentación del Proyecto

```
docs/
├── Estado-del-Proyecto-Educandow-Junio-2026.md  ← este documento
├── DER-y-diseno-global.md                       ← diseño completo con 15 reglas multi-tenant
├── diagrama-er.md                                ← DER en Mermaid (master + tenant)
├── arquitectura-frontend-global.md               ← estructura React, flujo de datos, sidebar
├── front-rules.md                                ← convenciones de frontend
├── gap-analysis-der.md                           ← análisis de gaps vs diseño
├── plan-rbac-evaluacion.md                       ← plan de RBAC y evaluación
└── modulos/                                      ← specs por módulo (00 a 13)
```

---

## 9. Comandos Rápidos

```bash
pnpm install          # Instalar dependencias
pnpm build            # Buildear todo (api + web + domain)
pnpm test             # Correr todos los tests (785)
pnpm dev              # Levantar API + web en modo desarrollo

# Deploy
tar -czf educandow-api-vps.tar.gz api/dist/ api/prisma/ api/package.json deploy/ ...
# → Subir a Hostinger VPS
# En el VPS: pnpm install --prod && npx prisma migrate deploy && node api/dist/main.js
```

---

**Última actualización**: 1 de junio de 2026  
**Tests**: 785/785 ✅ · **Build**: limpio ✅ · **SDD cycles activos**: 0 (todos archivados)
