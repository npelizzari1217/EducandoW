# Módulo 00 — Auth

> **Orquestador del módulo**: Autenticación, JWT, RBAC, refresh tokens.
> **Depende de**: Ninguno. **Usado por**: Todos los módulos.

## Estado: ✅ IMPLEMENTADO

Ya está codificado. Ver `api/src/presentation/auth/` y `api/src/application/auth/`.

## Tareas pendientes

| # | Tarea | Agente |
|---|---|---|
| 1 | Migrar a multi-tenant (auth contra master DB) | sdd-apply |
| 2 | Agregar `institutionId` y `dbName` al JWT | sdd-apply |

## Endpoints actuales

```
POST /v1/auth/register  [ADMIN]
POST /v1/auth/login
POST /v1/auth/refresh
POST /v1/auth/logout
GET  /v1/auth/me
```
