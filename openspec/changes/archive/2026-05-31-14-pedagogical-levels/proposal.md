# Proposal: 14-pedagogical-levels

## Intent

Implementar los 4 bounded contexts pedagógicos (Inicial, Primario, Secundario, Terciario) con sus tablas de base de datos, dominio, casos de uso, controllers y páginas frontend.

## Problem

El DER define 28 tablas específicas por nivel pedagógico pero solo existen 19 tablas genéricas en `schema_tenant.prisma`. Los directorios de controllers y frontend para cada nivel están vacíos. El producto no puede funcionar sin la lógica pedagógica específica de cada nivel.

## Scope

### In (este change)
- Agregar 18 tablas faltantes al `schema_tenant.prisma`
- Domain entities, VOs, repository interfaces para los 4 niveles
- Use cases CRUD para cada nivel
- Controllers NestJS con RBAC
- Páginas frontend básicas (list + create + detail)

### Out (futuros changes)
- Mobile (Expo)
- Reportes PDF avanzados
- Correlatividades complejas (Terciario)
- Mesas de examen con actas (Secundario)

## Approach

Implementar nivel por nivel siguiendo el patrón establecido:
1. **Inicial** — Salas, informes evolutivos, áreas de desarrollo, planificaciones
2. **Primario** — Grados, calificaciones trimestrales
3. **Secundario** — Cursos con orientación, mesas de examen, régimen académico
4. **Terciario** — Carreras, inscripciones a materias, actas de examen, títulos

Cada nivel es independiente y puede implementarse en paralelo.

## Impact

- **Tablas**: 19 → 37 en schema_tenant.prisma
- **Controllers**: 4 nuevos módulos en `api/src/presentation/nivel-*/`
- **Use cases**: ~16 nuevos en `api/src/application/nivel-*/`
- **Domain**: entities y repos en `packages/domain/src/`
- **Frontend**: 4 páginas nuevas en `web/src/niveles/`
- **Specs**: 4 nuevas specs en openspec

## Rollback

Cada nivel se implementa como módulo independiente. Para rollback: revertir migration + eliminar controller + eliminar página frontend. Sin impacto cruzado entre niveles.
