# Proposal: tipos-asistencia-nivel-e-impresion

## Intent

Hoy la pantalla "Tipos de asistencia" muestra los 4 niveles hardcodeados y filtra client-side, sin relación con el usuario ni con la institución activa. Cualquiera ve y puede operar sobre niveles que no le corresponden, y el backend NO scopea el listado. Queremos que la vista se ajuste al scope de niveles del usuario y que ese mismo scope se respete al imprimir. Éxito = un docente de un solo nivel ve, crea e imprime SOLO su nivel; ROOT/ADMIN ven todos los de la institución activa; y el backend rechaza (403) todo intento fuera de scope, sin confiar en el front.

## Scope

### In-scope
1. **Level-scoping (backend-first)**: `ListAttendanceTypesUseCase` y el alta pasan a recibir el usuario y aplicar `resolveAccessScope(user)`. No-root/no-admin: listar/crear fuera de sus niveles base → 403. Colapsar modalidad a nivel base (1-4). Scope por institución activa.
2. **Selector en el front**: reemplazar `LEVEL_OPTIONS` hardcodeado por niveles derivados del usuario (idiom de `gestion-grupos.tsx:111-115`). Con 1 solo nivel base: selector VISIBLE pero DESHABILITADO, fijado; listado filtrado y form de alta pre-seteado y bloqueado. Con >1: solo sus niveles. ROOT/ADMIN: todos.
3. **Impresión (nueva)**: endpoint que devuelve PDF (`application/pdf`) de los tipos de asistencia respetando EXACTAMENTE el mismo filtro de nivel/scope, detrás de un port en application + impl Puppeteer/Handlebars + template `.hbs` nuevo. Front descarga el blob (patrón `asistencia-mensual.tsx`).

### Out-of-scope
- No tocar asistencia-mensual (solo reusamos el `PdfGeneratorService`).
- No cross-check contra `InstitutionLevel.active` salvo que sea trivial.
- No cambiar el modelo `UserLevel` ni agregar flag active.
- No agregar `institutionId` a `AttendanceType` (ya es tenant-scoped por DB).

## Approach y capas impactadas

- **Domain**: reusar `resolveAccessScope` (`packages/domain/src/auth/access-scope.ts`); definir el contrato de datos para el PDF de tipos.
- **Application**: `attendance-type.use-cases.ts` (list + create reciben `AuthenticatedUser`, aplican scope, tiran 403); nuevo use-case de impresión; nuevo port de PDF.
- **Infrastructure**: `prisma-attendance-type.repository.ts` (filtro por niveles); impl del port reusando `pdf-generator.service.ts` + template nuevo.
- **Presentation**: `attendance-type.controller.ts` (inyectar `@CurrentUser()`, GET scopeado, nuevo endpoint print blob).
- **Web**: `attendance-types.tsx` (selector derivado + disabled con 1 nivel, form bloqueado, botón imprimir con descarga de blob).

## Seguridad

Backend-first: la AuthZ vive en los use-cases de application usando el scope de dominio; el front solo mejora UX. Nunca confiar en el filtro del cliente.

**Niveles pedagógicos afectados**: todos (1-4).
**TDD estricto**: `pnpm test`, coverage ≥ 80%.
