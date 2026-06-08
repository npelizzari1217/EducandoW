# Proposal: Study Plan Safe Delete

## Intent

Hoy `DeleteStudyPlanUC` hace soft-delete del plan SIN verificar dependencias: borra aunque tenga cursos vinculados (`StudyPlanCourse`) o ciclos lectivos (`CourseCycle` con `studyPlanId`). Esto deja cursos y ciclos huérfanos apuntando a un plan inactivo, corrompiendo la integridad pedagógica. Además, `useApiDelete` traga el error (`catch { return false }`), por lo que el usuario nunca sabe si falló ni por qué. Necesitamos que la eliminación sea SEGURA: bloquearla cuando hay dependientes y comunicarlo con un modal premium claro.

**Éxito**: un plan con dependientes no se puede eliminar; el usuario ve un modal explicando qué bloquea y qué hacer; un plan sin dependientes se elimina normalmente.

## Scope

### In Scope
- Nuevo error de dominio `StudyPlanHasDependenciesError` (code `STUDY_PLAN_HAS_DEPENDENCIES`, payload `{ courseCount, courseCycleCount }`).
- Método de repositorio `getDependencies(planId): Promise<{ courseCount, courseCycleCount }>` (port + impl Prisma).
- `DeleteStudyPlanUC` retorna `Result<void, DomainError>` y verifica dependencias antes del soft-delete.
- Controller `@Delete('study-plans/:id')` mapea el error a HTTP 409 con envelope `{ error: { message, code, details } }`.
- Componente reutilizable `AlertModal` en `web/src/components/ui/alert-modal.tsx` (título, mensaje, único botón "Aceptar").
- `handleDeletePlan` en `study-plans.tsx` captura el 409 y abre el modal.

### Out of Scope
- Cambiar globalmente `useApiDelete` (el manejo del error queda contenido en `study-plans.tsx`).
- Hard-delete o cascada en DB; el plan sigue siendo soft-delete.
- Migración de datos; constraints a nivel Prisma.
- Reusar `AlertModal` en otras páginas (queda disponible, no se integra ahora).

## Approach

1. **Domain**: agregar `StudyPlanHasDependenciesError extends DomainError` en `packages/domain/src/pedagogy/errors/study-plan.errors.ts`. Rebuild `dist/`.
2. **Domain port**: agregar `getDependencies` a `StudyPlanRepository`.
3. **Infrastructure**: implementar `getDependencies` en `PrismaStudyPlanRepository` — cuenta `StudyPlanCourse` por `studyPlanId` y `CourseCycle` con `studyPlanId` y `deletedAt: null`.
4. **Application**: `DeleteStudyPlanUC.execute` → si plan no existe retorna `ok`; consulta `getDependencies`; si `courseCount > 0 || courseCycleCount > 0` retorna `err(new StudyPlanHasDependenciesError(...))`; si no, `softDelete` y `ok`.
5. **Presentation**: si `isErr`, lanzar `HttpException({ error: { message, code, details } }, 409)`.
6. **Frontend**: `AlertModal` + `handleDeletePlan` captura el 409, extrae `error.message`, abre el modal.

## Acceptance Criteria

- [ ] Eliminar plan con N cursos vinculados → bloqueado; mensaje menciona la cantidad exacta de curso(s).
- [ ] Eliminar plan con M ciclos lectivos (deletedAt null) → bloqueado; mensaje indica eliminar los ciclos primero.
- [ ] Plan con cursos Y ciclos → mensaje refleja ambos counts.
- [ ] Plan sin dependientes → soft-delete exitoso, HTTP 204.
- [ ] Plan inexistente → no falla (idempotente).
- [ ] Respuesta de bloqueo: HTTP 409 + `{ error: { message, code: 'STUDY_PLAN_HAS_DEPENDENCIES', details: { courseCount, courseCycleCount } } }`.
- [ ] Frontend abre `AlertModal` con el mensaje; botón "Aceptar" lo cierra; no recarga la lista.
- [ ] Tests (Vitest TDD): UC retorna err por cursos, err por ciclos, ok sin dependientes; repo cuenta solo ciclos no borrados.

## Risks

| Risk | Mitigation |
|------|------------|
| `getDependencies` con dos counts → posible N+1 | Una sola transacción / dos `count` baratos por índice FK |
| Olvidar rebuild de `dist/` del dominio tras nuevo error | Rebuild explícito en tasks antes de correr API |
| Contar ciclos ya soft-deleted da falsos positivos | Filtrar `deletedAt: null` en la query |
| Otros callers de `DeleteStudyPlanUC` esperan `void` | UC ahora retorna `Result`; revisar callers en apply |
