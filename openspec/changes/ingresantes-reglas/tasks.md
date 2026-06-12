# Tasks: Ingresantes — Reglas de Estado, Nivel y Ciclo Obligatorio

> Source-of-truth: `decisions.md` (prevails), `specs/01-state-machine.md`,
> `specs/02-required-fields.md`, `specs/03-promote-transactional.md`, `design.md`.
> TDD estricto: test RED antes de cada implementación. `pnpm test` debe pasar en verde
> después de cada tarea.

---

## Group A — Domain: Máquina de estados (sequential A-1 → A-2 → A-3 → A-4)

### A-1 [x] Tests: `IngresanteStatus` transition behavior
- **File**: `packages/domain/src/ingresante/__tests__/value-objects/ingresante-status.test.ts`
- **New tests** (fallan porque los métodos no existen aún):
  - `canTransitionTo`: verdadero para cada arista del mapa (INSCRIPTO→PAGO_MATRICULA,
    INSCRIPTO→NO_INGRESARA, PAGO_MATRICULA→ACEPTADO, PAGO_MATRICULA→NO_INGRESARA,
    ACEPTADO→NO_INGRESARA, ACEPTADO→INGRESO)
  - `canTransitionTo`: falso para saltos (INSCRIPTO→ACEPTADO), retrocesos
    (PAGO_MATRICULA→INSCRIPTO) y cualquier arista desde terminal
  - `isTerminal()`: verdadero para INGRESO y NO_INGRESARA; falso para los tres restantes
  - `canTransitionTo` desde terminal siempre falso, sin importar el destino
- **Spec**: SC-SM-01..10 (capa dominio)

### A-2 [x] Impl: `TRANSITIONS` map + `canTransitionTo()` + `isTerminal()`
- **File**: `packages/domain/src/ingresante/value-objects/ingresante-status.ts`
- Mapa estático `TRANSITIONS: Record<IngresanteStatusValue, IngresanteStatusValue[]>`:
  `INSCRIPTO→[PAGO_MATRICULA, NO_INGRESARA]`, `PAGO_MATRICULA→[ACEPTADO, NO_INGRESARA]`,
  `ACEPTADO→[INGRESO, NO_INGRESARA]`, `INGRESO→[]`, `NO_INGRESARA→[]`
- `canTransitionTo(next: IngresanteStatus): boolean` — consulta el mapa
- `isTerminal(): boolean` — `TRANSITIONS[this.value].length === 0`
- `reconstruct()` NO cambia (D2: no retroactivo)
- **Depends on**: A-1

### A-3 [x] Tests: `Ingresante.transitionTo()` + `markIngreso()` precondición
- **File**: `packages/domain/src/ingresante/__tests__/entities/ingresante.test.ts`
- **Eliminar** los 4 tests de `setStatus()` existentes (el método va a desaparecer);
  reemplazarlos con equivalentes que usen `transitionTo()`
- **Nuevos tests** (fallan):
  - `transitionTo` retorna `ok(void)` en transición válida y muta el estado
  - `transitionTo` retorna `err(ValidationError)` en salto, retroceso, y desde terminal;
    el estado no muta
  - `markIngreso()` retorna `ok(void)` cuando el estado es ACEPTADO
  - `markIngreso()` retorna `err(ValidationError)` cuando el estado es INSCRIPTO,
    PAGO_MATRICULA, INGRESO, NO_INGRESARA
  - `reconstruct()` acepta cualquier estado sin validar (SC-SM-10 / D2)
- **Depends on**: A-2

### A-4 [x] Impl: `transitionTo()`, `markIngreso()` con precondición, quitar `setStatus()`; `cycleId` requerido en `CreateInput`
- **File**: `packages/domain/src/ingresante/entities/ingresante.ts`
- `transitionTo(next: IngresanteStatus): Result<void, ValidationError>` — delega en
  `this.props.status.canTransitionTo(next)`; si ok muta; mensaje de error:
  `Transición inválida: no se puede pasar de {current} a {next}`
- `markIngreso(): Result<void, ValidationError>` — llama `transitionTo(INGRESO)`;
  retorna el Result (no mutea si err)
- Eliminar `setStatus()` (breaking — cubierto por los tests de A-3)
- `cycleId: Id` (no-opcional) en `type CreateInput`; `IngresanteProps.cycleId` sigue
  siendo `Id | undefined` (para reconstruct D2)
- **Depends on**: A-3

---

## Group B — Application: Enforcement en use-cases (B-1/B-2 dependen de A-4; B-3/B-4 paralelos con B-1)

### B-1 [x] Tests: transiciones en `UpdateIngresanteStatusUseCase`
- **File**: `api/src/application/ingresante/use-cases/__tests__/ingresante.use-cases.test.ts`
- **Actualizar** el test `"updates to ACEPTADO"` — el mock devuelve INSCRIPTO y el target
  es ACEPTADO (salto inválido): cambiar el mock a `makeIngresante('PAGO_MATRICULA')` para
  que ACEPTADO sea una transición válida (el test sigue pasando)
- **Nuevos tests** (fallan):
  - INSCRIPTO→ACEPTADO (salto) → `err(ValidationError)`, mensaje contiene ambos estados
  - PAGO_MATRICULA→INSCRIPTO (retroceso) → `err(ValidationError)`
  - INGRESO→cualquier estado (terminal) → `err(ValidationError)`
  - NO_INGRESARA→cualquier estado (terminal) → `err(ValidationError)`
  - SC-SM-09: ACEPTADO→INGRESO vía status-update → rechazado por el guard explícito
    (previo al transitionTo)
  - SC-SM-10: ACEPTADO→NO_INGRESARA desde legacy (reconstruct) → `ok` (D2, no retroactivo)
- **Depends on**: A-4

### B-2 [x] Impl: `UpdateIngresanteStatusUseCase` usa `transitionTo()`
- **File**: `api/src/application/ingresante/use-cases/ingresante.use-cases.ts`
- Reemplazar `ingresante.setStatus(statusResult.unwrap())` con:
  ```
  const transition = ingresante.transitionTo(statusResult.unwrap());
  if (transition.isErr()) return err(transition.unwrapErr());
  ```
- Mantener el guard explícito `if status === INGRESO → err` ANTES del transitionTo
  (INGRESO sólo llega por promote; el guard es la segunda defensa)
- **Depends on**: B-1

### B-3 [x] Tests: `CreateIngresanteUseCase` campos requeridos
- **File**: `api/src/application/ingresante/use-cases/__tests__/ingresante.use-cases.test.ts`
- **Nuevos tests** (fallan):
  - SC-CYC-01: sin cycleId → `err(ValidationError)`
  - SC-CYC-05: cycleId pertenece a nivel SECUNDARIO pero level=PRIMARIO → `err(ValidationError)`
  - Ciclo no encontrado (repo.findByUuid → null) → `err(ValidationError)`
  - SC-LVL-05: sin level → error (ya lanzaba; verificar que sigue siendo ValidationError con
    contexto adecuado)
- Mock de `AcademicCycleRepository.findByUuid` en los helpers del test
- **Parallel with**: B-1

### B-4 [x] Impl: `CreateIngresanteUseCase` requiere cycleId + valida nivel↔ciclo
- **File**: `api/src/application/ingresante/use-cases/ingresante.use-cases.ts`
- `cycleId` pasa a ser `string` (no `string | undefined`) en `CreateIngresanteInput`
- Inyectar `AcademicCycleRepository` en el constructor
- Antes de `Ingresante.create()`: `const cycle = await this.cycleRepo.findByUuid(input.cycleId)`
  — si null → err; comparar `cycle.level.toString() === level.toString()` (o codigo numerico
  según cómo exponga el nivel el `AcademicCycle` — verificar en apply)
- **Depends on**: B-3

---

## Group C — Presentación: DTO + Controller + Module (C-1 paralela; C-2 → C-3 secuencial)

### C-1 [x] DTO: `cycleId` requerido en `CreateIngresanteSchema`
- **File**: `api/src/presentation/ingresante/dto/create-ingresante.dto.ts`
- `cycleId: z.string().uuid('cycleId debe ser un UUID válido')` (quitar `.optional()`)
- **Parallel with**: B-3, B-4

### C-2 [x] Controller: resolución de nivel por rol con `resolveAccessScope`
- **File**: `api/src/presentation/ingresante/ingresante.controller.ts`
- En `create()`: importar `resolveAccessScope` de `@educandow/domain`; obtener `user` del
  request (ya disponible vía `AuthGuard` — verificar decorador en apply)
- `const scope = resolveAccessScope(user)`
- Si `scope.allLevels` (ROOT/ADMIN): usar `body.level` tal cual
- Si `!scope.allLevels`: derivar el nivel desde `scope.compositeLevels[0]` usando `Level`
  y convertir a string; sobreescribir `body.level` antes de pasarlo al UC
- Si `scope.compositeLevels` está vacío → BadRequestException
- **Depends on**: C-1

### C-3 [x] Module: wire `AcademicCycleRepository` en `CreateIngresanteUseCase` + `TenantTransactionRunner` en `PromoteIngresanteUseCase`
- **File**: `api/src/presentation/ingresante/ingresante.module.ts`
- Agregar `'AcademicCycleRepository'` al `inject[]` del factory de `CreateIngresanteUseCase`
  (ya exportado por `PedagogyModule` — verificar token exacto en apply)
- Agregar provider `PrismaTenantTransactionRunner` (o su token de inyección)
- Agregar `TenantTransactionRunner` al `inject[]` del factory de `PromoteIngresanteUseCase`
- **Depends on**: B-4, D-3

---

## Group D — Promote transaccional: `TenantTransactionRunner` (D-1/D-2/D-3 paralelos con A/B/C; D-4 depende de A-4 + D-3)

### D-1 [x] Tests: rollback en `PromoteIngresanteUseCase`
- **File**: `api/src/application/ingresante/use-cases/__tests__/ingresante.use-cases.test.ts`
- Mock de `TenantTransactionRunner`: implementación passthrough
  (`run: (work) => work()`) para los tests de happy-path; para tests de rollback,
  hacer que la excepción interna se propague (comportamiento natural del passthrough)
- **Nuevos tests** (fallan antes de D-4):
  - SC-PRM-02: `CreateStudentUseCase.execute` lanza → `runner.run` propaga →
    `repo.save` no llamado, ingresante sigue ACEPTADO
  - SC-PRM-03: CreateStudent ok, `CreateEnrollmentUseCase.execute` lanza →
    `repo.save` no llamado, ingresante sigue ACEPTADO, resultado err
- **Actualizar** test existente `"surfaces err when CreateEnrollmentUseCase fails"` —
  con la nueva implementación el runner propaga el error; ajustar aserciones si cambia
  la forma de captura
- **Parallel with**: B-1, B-3

### D-2 [x] Port: `TenantTransactionRunner`
- **File**: `api/src/application/shared/ports/tenant-transaction-runner.ts`
  (si la convención del proyecto prefiere `ports/`, usar esa carpeta; sino,
  `api/src/application/shared/tenant-transaction-runner.ts` como indica el design)
- Interface:
  ```ts
  export interface TenantTransactionRunner {
    run<T>(work: () => Promise<T>): Promise<T>;
  }
  ```
- **Parallel with**: A-1, B-1

### D-3 [x] Infra: `PrismaTenantTransactionRunner`
- **File**: `api/src/infrastructure/persistence/prisma/tenant-transaction-runner.ts`
- Implementa el port con `client.$transaction(async (tx) => TenantContext.run({ ...store, prismaClient: tx as TenantPrismaClient }, work))`
- Obtiene el `store` actual via `tenantAls.getStore()`; lo rebindea con `prismaClient: tx`
- Requiere cast de `Prisma.TransactionClient` a `TenantPrismaClient` (safe: repos sólo usan
  model delegates, no `$transaction`)
- **Depends on**: D-2

### D-4 [x] Impl: `PromoteIngresanteUseCase` usa `TenantTransactionRunner`; `markIngreso()` maneja Result
- **File**: `api/src/application/ingresante/use-cases/ingresante.use-cases.ts`
- Inyectar `runner: TenantTransactionRunner` en el constructor
- Envolver los pasos (createStudent, createEnrollment, markIngreso + save) dentro de
  `await this.runner.run(async () => { ... })`
- Dentro del callback: si cualquier resultado es err, **lanzar** `result.unwrapErr()` →
  Prisma hace rollback
- `ingresante.markIngreso()` ahora retorna Result → tratar como los demás: if err, throw
- Fuera del `runner.run()`: capturar excepciones con `try/catch` → `return err(e as ValidationError)`
- **Depends on**: A-4, D-1, D-3

---

## Group E — D1 Cleanup Script + Migración (paralelo con todos los demás grupos)

### E-1 [x] Script: `cleanup-ingresantes-sin-ciclo.ts`
- **File**: `api/scripts/cleanup-ingresantes-sin-ciclo.ts`
- Patrón: `backfill-docente-x-ciclo.ts` (pg Pool master → iterate institutions → TenantPrismaClient)
- Por tenant: `tenant.ingresante.deleteMany({ where: { cycleId: null } })`
- Exportar helper `countNullCycleIngresantes(tenant: TenantPrismaClient): Promise<number>`
  para testabilidad
- `DELETE_THRESHOLD` env var (default 100): si count supera el umbral → abortar ese tenant,
  loguear warning, continuar con el siguiente
- Idempotente: 2da ejecución → count 0, sin errores
- Leer `.env` de `api/`; loguear resumen al final (total borrados, tenants omitidos por umbral)
- **Deploy note**: PASO MANUAL — ejecutar antes de E-3 (migración); backup previo en prod

### E-2 [x] Tests del script
- **File**: `api/scripts/__tests__/cleanup-ingresantes-sin-ciclo.test.ts` (o carpeta análoga)
- Tests del helper exportado `countNullCycleIngresantes`:
  - Devuelve 0 cuando no hay registros con cycleId null
  - Devuelve el count correcto cuando hay registros
  - `deleteMany` llamado con `{ where: { cycleId: null } }` (SC-CYC-06)
  - Idempotencia: llamar dos veces con tenant mock sin null records → `deleteMany` con count 0
- **Depends on**: E-1

### E-3 [x] Migración Prisma tenant: `cycle_id NOT NULL`
- **File**: nueva migración en `api/prisma_tenant/migrations/<timestamp>_ingresante_cycle_id_not_null/`
- SQL: `ALTER TABLE ingresantes ALTER COLUMN cycle_id SET NOT NULL;`
- Actualizar el schema Prisma `prisma_tenant/schema.prisma`: `cycleId String` (quitar `?`)
- Correr `pnpm --filter api prisma:generate` después de aplicar
- **Deploy order** (MANUAL, documentado en design):
  1. backup prod
  2. `npx tsx scripts/cleanup-ingresantes-sin-ciclo.ts`
  3. `pnpm --filter api prisma:migrate:tenant:deploy` (o `migrate-all-tenants`)
  4. deploy código (PR-1 + PR-2)
- **Depends on**: E-1 (lógicamente: script debe correr antes en prod)

---

## Group F — Frontend (paralelo con backend; deploy después de PR-2)

### F-1 Nivel por rol en `IngresantesPage`
- **File**: `web/src/pages/dashboard/ingresantes.tsx`
- Determinar `isAllLevels`: `roles.includes('ROOT') || roles.includes('ADMIN')`
- ROOT/ADMIN → `<select>` con `LEVEL_CATALOG.filter(l => l.pedagogical)` (ya existe; hacerlo required)
- Resto → `<input disabled>` mostrando el nivel del usuario; auto-set `form.level` en mount via
  `useEffect([user])` con el nivel derivado de `user.levels?.[0]` (convertir a string de nivel)
- Agregar `required` visual en la label

### F-2 Ciclo filtrado por nivel resuelto + requerido
- **File**: `web/src/pages/dashboard/ingresantes.tsx`
- Cambiar el fetch de ciclos a `/academic-cycles?level=<form.level>&limit=100` cuando
  `form.level` está seteado; refetch en `useEffect([form.level])`
- Cambiar placeholder del select: "Seleccioná un ciclo lectivo (requerido)"
- **Depends on**: F-1

### F-3 `handleCreate`: validar cycleId requerido
- **File**: `web/src/pages/dashboard/ingresantes.tsx`
- Agregar `|| !form.cycleId` a la validación early-return
- Mensaje: "Nombre, apellido, DNI, nivel y ciclo lectivo son requeridos"
- **Depends on**: F-1, F-2

---

## Dependency graph (topológico)

```
A-1 → A-2 → A-3 → A-4 ──┬──→ B-1 → B-2 ──────────────────────────┐
                           │                                          │
                           └──→ B-3 → B-4 → C-1 → C-2 → C-3 ────────┤
                                                                       │
D-2 → D-3 ───────────────────────────────→ D-4 (+ A-4) → C-3 ────────┘
D-1 ─── (paralelo con A, B)
E-1 → E-2    (paralelo track)
E-3          (depends E-1 lógicamente en deploy)
F-1 → F-2 → F-3   (paralelo track, deploy último)
```

---

## Review Workload Forecast

| Group | Files changed | Est. lines |
|-------|--------------|-----------|
| A (domain) | 2 | ~175 |
| B (use-cases) | 2 | ~180 |
| C (DTO/ctrl/module) | 3 | ~50 |
| D (promote tx) | 3 new + 1 mod | ~125 |
| E (script + migration) | 2 new + 1 schema | ~155 |
| F (frontend) | 1 | ~60 |
| **Total** | **~14 files** | **~745 lines** |

**Chained PRs recommended: Yes**
**400-line budget risk: High** (745 estimadas ≈ 1.86×)
**Decision needed before apply: Yes**

### PR slicing sugerido

| PR | Groups | Est. lines | Descripción |
|----|--------|-----------|-------------|
| PR-1 | A-1..A-4 + B-1 + B-2 | ~280 | Domain state machine + UpdateStatus |
| PR-2 | B-3 + B-4 + C-1..C-3 + D-1..D-4 | ~310 | Required fields + Promote tx (backend completo) |
| PR-3 | E-1 + E-2 + E-3 | ~155 | D1 cleanup script + migración (paso deploy manual) |
| PR-4 | F-1 + F-2 + F-3 | ~60 | Frontend |

PR-3 puede mergearse/ejecutarse antes que PR-1/PR-2 pero debe RAN (script manual) antes de
la migración. PR-4 requiere PR-2 desplegado (el backend rechaza cycleId faltante).
