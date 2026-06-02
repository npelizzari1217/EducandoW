# Proposal: DER Phase 1 — Documentación RBAC + Niveles Educativos

## Intent

El gap-analysis-der.md reporta 4 tablas de Módulo 1 como "❌ No existe" y `niveles_educativos` (#10) como faltante. La exploración reveló que AMBAS funcionalidades YA están implementadas con paradigmas distintos al DER. Este cambio alinea la documentación con la realidad sin modificar código.

## Scope

### In Scope
- Actualizar `docs/gap-analysis-der.md`: corregir estado de tablas #2 (roles), #3 (usuarios_roles), #7 (permisos), #8 (roles_permisos), #10 (niveles_educativos)
- Actualizar `docs/plan-rbac-evaluacion.md`: documentar que el RBAC real usa `RoleModule` + `actions[]`, no `Permission` + `RolePermission`
- Verificar `docs/diagrama-er.md`: ya refleja la implementación real — solo anotar si faltan referencias al composite encoding de niveles

### Out of Scope
- Crear tablas `permisos`, `roles_permisos`, `niveles_educativos`
- Cualquier cambio de código (modelos Prisma, guards, seed, migraciones)
- Cambios en `openspec/specs/` — esto es documentación, no specs

## Capabilities

### New Capabilities
None — documentation-only change.

### Modified Capabilities
None — no spec-level behavior changes. This is a documentation alignment.

## Approach

**RBAC**: El sistema ya implementa `Role` → `UserRole` (M:N) + `RoleModule` con `actions: String[]` + `UserModule` (overrides). Esto es funcionalmente superior al DER (permisos agrupados por módulo, no planos). La documentación se actualiza para reflejar este paradigma.

**Niveles educativos**: Los niveles son conceptos fijos de dominio (`EducationalLevelCode` enum: 1-4 + composite formula `level*10+modality`). El `gap-analysis-der.md` debe documentar que no se necesita tabla — es un caso de Clean Architecture donde constantes de dominio reemplazan catálogos DB.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `docs/gap-analysis-der.md` | Modified | Actualizar filas #1-#8 y #10; actualizar resumen ejecutivo |
| `docs/plan-rbac-evaluacion.md` | Modified | Agregar nota: implementación real usa module-based RBAC |
| `docs/diagrama-er.md` | Verify | Ya alineado — verificar composite encoding documentado |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Gap analysis queda inconsistente con otras filas aún sin explorar | Low | Solo se tocan módulos 1 y 2 verificados por exploration.md |
| Alguien asume que crear tabla `roles` sigue pendiente | Low | El gap analysis actualizado documenta explícitamente la equivalencia funcional |

## Rollback Plan

Revertir commits de documentación (`git revert`). Los archivos son markdown sin dependencias — sin impacto en el sistema.

## Dependencies

- Exploration completada: `sdd/explore/der-phase-1-rbac-niveles/exploration.md`
- Stakeholder decisions aprobadas (ver exploration.md §Ready for Proposal)

## Success Criteria

- [ ] `gap-analysis-der.md` refleja que tablas #2, #3, #7, #8 están cubiertas (aunque con paradigma distinto)
- [ ] `gap-analysis-der.md` documenta que #10 (`niveles_educativos`) no requiere tabla — se usa enum + composite encoding
- [ ] `plan-rbac-evaluacion.md` incluye nota sobre implementación real module-based
- [ ] Resumen ejecutivo del gap analysis muestra % cubierto actualizado para Módulo 1
