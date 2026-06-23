# Proposal: RolCurso — Roles Extendidos

**Level**: ALL (la asignación a CursoXCiclo es transversal: Inicial / Primario / Secundario / Terciario)

## Intent

El form "Asignar Docente" (CursosXCiclo) sólo ofrece dos roles funcionales: `PRECEPTOR` y `TITULAR`. La operatoria escolar real necesita cuatro más para describir quién interviene en un curso. Se agregan **Secretario, Director, EOE (Equipo de Orientación Escolar) y Docente Auxiliar** al enum `RolCurso`. Éxito = el dropdown ofrece seis roles, se persisten correctamente y la validación queda sincronizada de punta a punta sin tocar la lógica de negocio existente.

## Scope

### In Scope
- Agregar 4 valores al enum de dominio `RolCurso` (single source of truth)
- Agregar los mismos 4 valores al enum Prisma `RolCurso` (schema tenant) + migración `ALTER TYPE ... ADD VALUE`
- Actualizar el union type del front (`web/src/types/materia-grupo.ts`)
- Actualizar `<select>` y el tipo de `formRol` en `materia-grupos.tsx`

### Out of Scope
- DTO/Zod de la API: `z.nativeEnum(RolCurso)` se actualiza solo desde el dominio — sin cambios
- Lógica de unicidad de TITULAR (regla ACC-S5) — se mantiene tal cual
- Reglas de singleton para los nuevos roles — NO se introducen (ver Approach)
- Refactor del solapamiento conceptual con `UserRole` — tradeoff aceptado, no se aborda acá

## Capabilities

### Modified Capabilities
`asignacion-curso` (asignación de docentes a CursoXCiclo): amplía el conjunto de roles funcionales válidos. La capacidad de asignar/quitar y la unicidad de TITULAR no cambian.

## Approach

1. **Naming**: claves `SECRETARIO`, `DIRECTOR`, `EOE`, `DOCENTE_AUXILIAR` — UPPER_SNAKE_CASE, consistente con `PRECEPTOR`/`TITULAR` y con el estilo de enums Prisma. `EOE` se deja como sigla (es el nombre institucional reconocido). Domain enum manda; Prisma, Zod y front derivan.
2. **Unicidad**: los 4 nuevos roles se modelan **sin restricción singleton** — se permiten múltiples por CursoXCiclo, igual que PRECEPTOR. Sólo TITULAR conserva la regla "uno por curso" en `assign-docente-to-curso.use-case.ts`. (Asunción explícita para revisión en spec/design.)
3. **Migración**: no destructiva, `ALTER TYPE "RolCurso" ADD VALUE`. Debe desplegarse a **todas** las DBs tenant. No requiere backfill ni borra datos.
4. **Drill-down por capa**: dominio → schema/migración → front. La API queda sincronizada automáticamente.

## Accepted Tradeoff

`DIRECTOR` y `SECRETARIO` ya existen como `UserRole` a nivel institución. Usarlos también como rol funcional de curso **conflaciona dos conceptos** (identidad institucional vs. función en un curso). El usuario aceptó explícitamente esta superposición. Se registra como tradeoff conocido, no como bloqueante; la semántica de cada uno depende del contexto (UserRole = quién sos en la institución, RolCurso = qué hacés en ese curso).

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migración de enum no aplicada en algún tenant → INSERT falla | Media | `prisma migrate deploy` a cada tenant; verificar en todos antes de habilitar el front |
| Confusión semántica DIRECTOR/SECRETARIO con UserRole | Media | Tradeoff aceptado; documentar en spec que son conceptos distintos |
| Nuevos roles esperaban singleton y no se aplicó | Baja | Asunción declarada arriba — confirmar en fase spec |

## Success Criteria

- [ ] `RolCurso` (dominio y Prisma) contiene los 6 valores
- [ ] Migración tenant aplicada en todos los tenants sin pérdida de datos
- [ ] El dropdown "Asignar Docente" ofrece los 6 roles y persiste cada uno
- [ ] `pnpm build` y `pnpm test` en verde
