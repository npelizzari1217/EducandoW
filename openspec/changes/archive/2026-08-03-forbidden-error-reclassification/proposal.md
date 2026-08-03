# Proposal: forbidden-error-reclassification

> Follow-up #1 del épico error-handling. CONSUMER de `application-error-handling`.

## Nivel pedagógico afectado

**N/A.** Cambio transversal de infraestructura de errores. No altera comportamiento
pedagógico ni contratos de negocio: `ForbiddenError` ya devuelve HTTP 403 hoy y lo
seguirá devolviendo. Sin cambio observable para el usuario final.

## Intent

Reclasificar `ForbiddenError` de `DomainError` → `ApplicationError`, saldando la deuda
transversal diferida explícitamente como "Opción A" durante `asistencia-result-migration`.
`ForbiddenError` modela una falla de **autorización caller-context** (AuthZ), que
conceptualmente pertenece a la capa de aplicación, no al dominio. Hoy vive en
`packages/domain` sólo por inercia histórica.

## Motivation

- **Coherencia del modelo de error en capas** (DomainError → ApplicationError → Infra):
  una falla de autorización no es una invariante de dominio intrínseca; es contexto del
  llamador. Dejarla como `DomainError` contamina la capa de dominio con una preocupación
  de aplicación.
- **Precedente probado**: `attendance-type-result-migration` ya hizo exactamente este
  move (DomainError→ApplicationError) para `AttendanceTypeLevelOutOfScopeError`. Este
  change generaliza el patrón al símbolo de más tráfico del épico.
- **Desbloqueo de consistencia futura**: al reclasificar antes de migrar
  asistencia-reporting y la cola de módulos (follow-ups #2 y #3), esos módulos ya
  encuentran `ForbiddenError` como `ApplicationError` — no hay doble reclasificación.

## Decisiones (resueltas con el usuario)

1. **Entrega: Option A — un PR atómico.** La clase se mueve y los 17 imports se actualizan
   en el mismo commit verde. Descartado Option B (chained por módulo): mismo tipo de cambio
   que el precedente attendance-type (single PR), está bajo 400 líneas, `tsc` gatea todo, y
   B exigiría un shim de re-export temporal (al borrar la clase de domain rompen todos los
   imports a la vez) — más ceremonia, no menos.
2. **Ubicación: archivo propio** `api/src/application/shared/errors/forbidden-error.ts`
   (no dentro de `authorization-errors.ts`: distinta forma de constructor, símbolo de alto
   tráfico). Sin barrel (convención del repo, YAGNI).
3. **`asignacion-curso`: sólo reclasificación.** Se cambia import + (queda `throw` literal,
   `Promise<T>`, sin `Result`). Result-wrap de ese módulo es otro follow-up fuera de scope.
4. **Test legacy** `api/test/unit/patch-student.use-case.test.ts`: se deja donde está,
   sólo se actualiza el import. No se consolida acá (fuera de scope).
5. **`DOMAIN_STATUS['FORBIDDEN']`**: se **borra** la entrada (dead-code tras el move; el
   branch `ApplicationError` del filtro dispara primero). Igual que el precedente.

## Scope

**IN:**
- Crear `api/src/application/shared/errors/forbidden-error.ts` — `extends ApplicationError`,
  `constructor(message = 'Forbidden') { super(message, 'FORBIDDEN', 403); }`.
- Borrar `packages/domain/src/shared/errors/forbidden-error.ts` + remover export en
  `packages/domain/src/index.ts:7`.
- Actualizar imports en 17 archivos de producción (8 módulos) + 16 test files (split-import).
- **Widening explícito de firma** en los 7 métodos (3 archivos) que tipan el canal como
  `DomainError` genérico: `nota-cursada-terciario.use-cases.ts` (Create/Update/Confirmar),
  `docente-materia.use-cases.ts` (Assign/List/Unassign), `student.use-cases.ts`
  (`PatchStudentUseCase.execute`) → `Result<T, DomainError | ForbiddenError>`.
- Borrar la entrada `FORBIDDEN: 403` de `DOMAIN_STATUS` en `exception.filter.ts`.
- Test de clasificación nuevo: `ForbiddenError instanceof ApplicationError`, code `FORBIDDEN`,
  `httpStatus === 403` (mirror de `authorization-errors.test.ts`).

**OUT:**
- Migración a `Result` de `asistencia-reporting` (follow-up #2), `asignacion-curso`, o
  cualquier módulo que aún tire `throw` literal. Este change **no** cambia `throw`→`Result`;
  sólo reclasifica la clase.
- Consolidación/movimiento del test legacy.
- Cualquier cambio de comportamiento HTTP (el 403 se preserva idéntico).

## Approach

Move atómico compilation-gated (patrón del precedente attendance-type):
1. Crear la clase nueva en `api/application/shared/errors/`.
2. Split-import en cada consumidor: sacar `ForbiddenError` del bloque `@educandow/domain`,
   agregar import del path local nuevo.
3. Widening de las 7 firmas genéricas.
4. Borrar clase domain + export barrel + entrada `DOMAIN_STATUS`.
5. Todo en un commit verde (`tsc --noEmit` + `pnpm test`). Nada de shims.

## Risks

- **Compile (principal):** 7 firmas necesitan widening explícito. Mitigación: `tsc --noEmit`
  gatea — un widening olvidado = build rojo, no bug silencioso. Los 3 archivos son el foco de review.
- **HTTP status regression:** descartado — verificado que el filtro rankea `ApplicationError`
  antes que `DomainError`; con `403` explícito el status se preserva. Test de clasificación lo blinda.
- **Import direction (clean-arch):** descartado — cero throw-sites en `packages/domain`.

## Applicability al épico

CONSUMER de `application-error-handling`. Salda deuda transversal. Prepara terreno para
follow-ups #2 (asistencia-reporting, ya desbloqueado por PR #111 mergeado) y #3 (cola de módulos).

## Next

`sdd-spec` + `sdd-design` (delta spec con Given/When/Then + RFC 2119; design en Clean Arch).
