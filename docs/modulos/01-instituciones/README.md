# Módulo 01 — Instituciones

> **Orquestador del módulo**: Configuración institucional, multi-tenant, branding, sesión.
> **Depende de**: Auth (00). **Usado por**: Todos los módulos (es la raíz del sistema).

## Contexto

- **Tablas propias**: `institutions` (25 campos en **master DB**: `educandow_master`)
- **Base de datos**: Master DB — la ÚNICA tabla en master junto con `users` y `refresh_tokens`
- **Reglas que aplican**: R1-R10 (multi-tenant) + R11-R15 (sesión y branding)
- **Responsabilidad**: Crear una institución = crear su tenant DB + migrations + admin inicial

## Modelo de datos completo

```
institutions (educandow_master)
═══════════════════════════════════════════════════════
IDENTIFICACIÓN                  CONTACTO
├ name                          ├ phone
├ address                       ├ website
├ city                          ├ contact_email
├ postal_code                   │
├ country                       ├── SMTP ──
├ ministry_reg (1)              │   ├ smtp_host
├ cue (2) UNIQUE                │   ├ smtp_user
│                               │   ├ smtp_pass 🔐 (3)
│                               │   ├ smtp_encryption (4)
│                               │   └ smtp_port

BRANDING                        NOTIFICACIONES
├ logo_url (7)                  ├ send_email (5)
├ header_color (8)              ├ send_messages (6)
├ header_text_color             │
├ body_text_color               │

CONFIG                          TENANT
├ active (9) soft-delete        ├ db_name (11)
├ socket_host (10)              ├ created_at
├ socket_port                   └ updated_at
│
└── levels[] (12)

(1) N° inscripción Ministerio de Educación (alfanumérico)
(2) CUE — Código Único Escolar, único a nivel nacional
(3) smtp_pass encriptado AES-256 en reposo
(4) "TLS" | "SSL" | "NONE"
(5) ON/OFF global para envío de emails de la institución
(6) ON/OFF global para mensajería WebSocket de la institución
(7) URL del logo (S3 / almacenamiento local)
(8) Hex color: "#1a56db"
(9) Si active=false, la sesión se rechaza
(10) WebSocket server para notificaciones real-time
(11) Nombre de la tenant DB: "educandow_{id}"
(12) Array de niveles activos: ["INICIAL","PRIMARIO","SECUNDARIO","TERCIARIO"]
```

## Reglas del módulo

### R1-R10: Arquitectura Multi-Tenant

| # | Regla | Impacto en este módulo |
|---|---|---|
| R1 | Master DB solo auth + institutions | `institutions` es una de las 3 tablas en master |
| R2 | Tenant DB = 1 institución | Cada institución tiene su DB: `educandow_{id}` |
| R3 | Sin institutionId en tenant | Las tablas tenant no necesitan este campo |
| R4 | JWT transporta el tenant | El JWT incluye `dbName` para rutear conexiones |
| R7 | PrismaService dinámico | Factory que resuelve cliente por `dbName` |
| R8 | Migrations por tenant | Nueva institución → nueva DB + migrations |
| R9 | Health check → master DB | Sin JWT, solo health. Con JWT, tenant routing |
| **R10** | **Registro de institución** | `POST /institutions` = crear DB + migrations + admin |

### R11-R15: Sesión y Branding

| # | Regla | Impacto en este módulo |
|---|---|---|
| R11 | Institución en sesión | `GET /institutions/me` carga config en frontend |
| R12 | Tema dinámico | CSS vars desde `header_color`, `text_color` |
| R13 | Features condicionales | `send_email`/`send_messages` activan/desactivan features |
| R14 | Niveles activos | Menú filtra por `levels[]` de la institución |
| R15 | Bloqueo por inactividad | `active=false` → rechazar sesión |

## Pipeline SDD completo

| Fase | Sub-agente | Qué hace | Estado |
|---|---|---|---|
| 1. EXPLORE | `sdd-explore` | Relevar código actual (institutions controller, Prisma schema), detectar gaps vs diseño | 🔲 |
| 2. PROPOSE | `sdd-propose` | Crear propuesta: "Migrar Institution a 25 campos con multi-tenant y branding" | 🔲 |
| 3. SPEC | `sdd-spec` | Escribir Given/When/Then para cada regla R1-R15 | 🔲 |
| 4. DESIGN | `sdd-design` | Diseñar: schema Prisma master, entidad domain, InstitutionContext, middleware tenant | 🔲 |
| 5. TASKS | `sdd-tasks` | Descomponer en tareas atómicas (ver abajo) | 🔲 |
| 6. APPLY-PLAN | `sdd-apply-plan` | Analizar impacto en código existente, orden de implementación | 🔲 |
| 7. APPLY | `sdd-apply` | Implementar cada tarea (múltiples delegaciones) | 🔲 |
| 8. VERIFY | `sdd-verify` | Correr tests, verificar cobertura ≥80%, probar endpoints | 🔲 |
| 9. ARCHIVE | `sdd-archive` | Sincronizar specs, cerrar cambio, actualizar estado | 🔲 |

## Tareas atómicas (salida de la fase TASKS)

| # | Tarea | Capa | Archivos esperados |
|---|---|---|---|
| 1 | Separar schema Prisma: `schema_master.prisma` (institutions + users) y `schema_tenant.prisma` (resto) | infra | 2 archivos .prisma |
| 2 | Actualizar entidad `Institution` en domain con los 25 campos + `Level[]` | domain | `institution.ts` |
| 3 | Crear `PrismaInstitutionRepository` para master DB | infra | `prisma-institution.repository.ts` |
| 4 | Crear `GET /v1/institutions/me` — devuelve config completa desde JWT | presentation | controller + DTO |
| 5 | Actualizar `POST /v1/institutions` — crear tenant DB + migrations (R10) | application | use case |
| 6 | Crear `InstitutionContext` en React — carga config al login, expone colores/logo/flags | frontend | context + provider |
| 7 | Implementar tema dinámico — CSS variables desde `InstitutionContext` | frontend | hook + CSS |
| 8 | Actualizar sidebar — filtrar niveles por `levels[]`, ocultar features por flags | frontend | sidebar.tsx |
| 9 | Tests unitarios de entidad Institution | test | 1 archivo |
| 10 | Tests e2e: crear institución, GET /me, bloqueo por active=false | test | 1 archivo |

## Contratos de API

```
GET    /v1/institutions            → lista (admin)
POST   /v1/institutions            → crea institución + tenant DB + admin user (R10)
GET    /v1/institutions/me         → config de la institución del JWT (R11)
GET    /v1/institutions/:id        → detalle
GET    /v1/institutions/:id/levels → niveles activos con año académico (R14)
DELETE /v1/institutions/:id        → soft-delete (active=false)
```

## Dependencias entre módulos

```
Auth (00) ──→ Institutions (01) ──→ Plan de Estudios (02)
                      │
                      └──→ Todos los módulos usan la config de institución
```
