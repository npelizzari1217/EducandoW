# Módulo 01 — Instituciones

> **Orquestador del módulo**: Configuración institucional, branding, multi-tenant.
> **Depende de**: Auth (00). **Usado por**: Todos los módulos.

## Contexto

- **Tablas propias**: `institutions` (25 campos en master DB)
- **Reglas que aplican**: R11-R15
- **Base de datos**: Master DB (`educandow_master`)

## Modelo de datos reducido

```
institutions:
  id, name, address, city, postal_code, country,
  ministry_reg, cue (UNIQUE), phone, website, contact_email,
  smtp_host, smtp_user, smtp_pass (enc), smtp_encryption, smtp_port,
  send_email, send_messages,
  logo_url, header_color, header_text_color, body_text_color,
  active, socket_host, socket_port,
  db_name, created_at, updated_at
```

## Pipeline SDD completo

| Fase | Sub-agente | Estado |
|---|---|---|
| 1. EXPLORE | `sdd-explore` | 🔲 |
| 2. PROPOSE | `sdd-propose` | 🔲 |
| 3. SPEC | `sdd-spec` | 🔲 |
| 4. DESIGN | `sdd-design` | 🔲 |
| 5. TASKS | `sdd-tasks` | 🔲 |
| 6. APPLY-PLAN | `sdd-apply-plan` | 🔲 |
| 7. APPLY | `sdd-apply` (múltiples delegaciones) | 🔲 |
| 8. VERIFY | `sdd-verify` | 🔲 |
| 9. ARCHIVE | `sdd-archive` | 🔲 |

## Tareas atómicas (salida de TASKS)

| # | Tarea | Tipo |
|---|---|---|
| 1 | Actualizar schema Prisma master DB con 25 campos | infra |
| 2 | Actualizar entidad Institution en domain | domain |
| 3 | Crear endpoint `GET /v1/institutions/me` | presentation |
| 4 | Crear `InstitutionContext` en frontend (React context) | frontend |
| 5 | Implementar tema dinámico (CSS vars desde institución) | frontend |
| 6 | Tests unitarios + e2e | test |

## Contratos de API

```
GET    /v1/institutions       → lista (admin)
POST   /v1/institutions       → crea institución + tenant DB
GET    /v1/institutions/me    → config de la institución del JWT
GET    /v1/institutions/:id   → detalle
DELETE /v1/institutions/:id   → soft-delete (active=false)
```
