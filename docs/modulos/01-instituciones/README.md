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

## Tareas atómicas

| # | Tarea | Agente | Estado |
|---|---|---|---|
| 1 | Actualizar schema Prisma con los 25 campos | sdd-apply | 🔲 |
| 2 | Crear endpoint `GET /v1/institutions/me` | sdd-apply | 🔲 |
| 3 | Crear `InstitutionContext` en frontend | sdd-apply | 🔲 |
| 4 | Implementar tema dinámico (colores desde institución) | sdd-apply | 🔲 |
| 5 | Tests del módulo | sdd-apply | 🔲 |

## Contratos de API

```
GET    /v1/institutions       → lista (admin)
POST   /v1/institutions       → crea institución + tenant DB
GET    /v1/institutions/me    → config de la institución del JWT
GET    /v1/institutions/:id   → detalle
DELETE /v1/institutions/:id   → soft-delete (active=false)
```
