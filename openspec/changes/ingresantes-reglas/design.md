# Design: Ingresantes — Reglas de Estado, Nivel y Ciclo Obligatorio

## Technical Approach

Endurecer cuatro puntos sin reescribir el flujo: (1) máquina de estados en el dominio, (2) `level`+`cycleId` obligatorios y coherentes por rol, (3) cleanup destructivo multi-tenant (D1) como paso manual de deploy, (4) promote atómico reusando `$transaction` + rebind de `TenantContext`. Se respeta Clean Architecture y el patrón Result existente.

## Architecture Decisions

### Decision: Mapa de transiciones en el VO `IngresanteStatus`
**Choice**: El mapa `TRANSITIONS` y `canTransitionTo(next)` viven en el VO; la entidad expone `transitionTo(next): Result<void, ValidationError>` que delega en el VO y muta sólo si es válido. `markIngreso()` pasa a validar precondición ACEPTADO vía el mismo camino.
**Alternatives**: Mapa en la entidad, o en el use-case. **Rationale**: El VO ya encapsula el valor de estado; la regla de adyacencia es invariante de estado, no de orquestación. `reconstruct()` NO valida (D2: no retroactivo). Terminales = lista vacía → inmutables por construcción.

Transiciones: `INSCRIPTO→[PAGO_MATRICULA, NO_INGRESARA]`, `PAGO_MATRICULA→[ACEPTADO, NO_INGRESARA]`, `ACEPTADO→[INGRESO, NO_INGRESARA]`, `INGRESO→[]`, `NO_INGRESARA→[]`. `UpdateIngresanteStatusUseCase` reemplaza `setStatus()` por `transitionTo()` y devuelve `err` si es inválida; mantiene el guard que veta INGRESO por la vía pública (sólo promote lo asigna).

### Decision: Nivel resuelto por rol en presentación, validado en backend
**Choice**: El controller resuelve `resolveAccessScope(user)`. Si `allLevels` (ROOT/ADMIN) acepta `level` del body; si no, **sobreescribe** `level` con `user.userLevels[0].level` (input ignorado). `cycleId` obligatorio. `CreateIngresanteUseCase` valida coherencia nivel↔ciclo cargando el ciclo (`AcademicCycleRepository.findByUuid`) y comparando `cycle.level === level`.
**Alternatives**: Confiar en el `level` del cliente. **Rationale**: El backend es la fuente de verdad; el modelo de 3 puertas ya vive en `resolveAccessScope`. La UI filtra para UX, el backend valida para integridad.

### Decision: D1 como script `tsx` multi-tenant, NO migración SQL
**Choice**: `api/scripts/cleanup-ingresantes-sin-ciclo.ts` (patrón `backfill-*.ts`): itera instituciones activas desde el `pg` Pool master, abre `TenantPrismaClient` por tenant y ejecuta `tenant.ingresante.deleteMany({ where: { cycleId: null } })`. Idempotente (2da corrida borra 0), con `DELETE_THRESHOLD` env de seguridad. La migración Prisma que vuelve `cycle_id NOT NULL` corre DESPUÉS, vía `migrate-all-tenants`.
**Alternatives**: Migración SQL única. **Rationale**: Cada tenant tiene su propia DB; una migración Prisma apunta a UN schema y no itera tenants. El proyecto ya resuelve esto con scripts `tsx` + `migrate-all-tenants`. Es paso MANUAL de deploy (los backfills no corren solos) — backup previo en prod (DESTRUCTIVO).

### Decision: Promote atómico vía `TenantTransactionRunner` + rebind de contexto
**Choice**: Nuevo port `TenantTransactionRunner` (application) implementado en infra: hace `client.$transaction(tx => TenantContext.run({ ...store, prismaClient: tx }, work))`. `PromoteIngresanteUseCase` lo inyecta y corre los pasos existentes (CreateStudent → CreateEnrollment → markIngreso+save) dentro del callback. Cada `err` se **lanza** dentro del callback → Prisma hace rollback; afuera se captura y se mapea a `Result`.
**Alternatives**: (a) Refactor de cada repo para recibir `tx` explícito — invasivo. (b) Inyectar `PrismaService` directo en el UC (el proyecto ya lo hace en `profiles.use-cases`) — viola capas. **Rationale**: Como todos los repos leen `TenantContext.getClient()` (AsyncLocalStorage), rebindear el store a `tx` hace que `CreateStudentUseCase`/`CreateEnrollmentUseCase` usen la tx **sin cambios**. El port mantiene el UC infra-agnóstico.
**Rollback points**: student creado, enrollment creado, ingresante marcado — los tres en una sola tx; cualquier fallo revierte todo, sin Student huérfano.

## Data Flow (promote)

    Controller.promote
        └─→ TenantTransactionRunner.run(tx → rebind TenantContext)
                ├─ CreateStudentUseCase   (repo usa tx)
                ├─ CreateEnrollmentUseCase (repo usa tx)
                └─ ingresante.transitionTo(INGRESO) + repo.save (tx)
        err interno ⇒ throw ⇒ ROLLBACK ⇒ Result.err afuera

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/domain/src/ingresante/value-objects/ingresante-status.ts` | Modify | Mapa `TRANSITIONS` + `canTransitionTo()` |
| `packages/domain/src/ingresante/entities/ingresante.ts` | Modify | `transitionTo(): Result`; `cycleId` requerido; `markIngreso` valida ACEPTADO; quitar `setStatus` |
| `api/src/application/ingresante/use-cases/ingresante.use-cases.ts` | Modify | UpdateStatus usa `transitionTo`; Create valida nivel↔ciclo; Promote usa runner |
| `api/src/application/shared/tenant-transaction-runner.ts` | Create | Port `TenantTransactionRunner` |
| `api/src/infrastructure/persistence/prisma/tenant-transaction-runner.ts` | Create | Impl con `$transaction` + `TenantContext.run` rebind |
| `api/src/presentation/ingresante/dto/create-ingresante.dto.ts` | Modify | `cycleId` requerido |
| `api/src/presentation/ingresante/ingresante.controller.ts` | Modify | Resolver nivel por `resolveAccessScope`; bloquear no-ROOT/ADMIN |
| `api/src/presentation/ingresante/ingresante.module.ts` | Modify | Wire runner en Promote |
| `api/scripts/cleanup-ingresantes-sin-ciclo.ts` | Create | Cleanup destructivo multi-tenant idempotente |
| `web/src/pages/dashboard/ingresantes.tsx` | Modify | Dropdown nivel (ROOT/ADMIN) o bloqueado; ciclo filtrado por `?level=` |

## Interfaces

```ts
// VO
canTransitionTo(next: IngresanteStatus): boolean;
// Entity
transitionTo(next: IngresanteStatus): Result<void, ValidationError>;
// Port
interface TenantTransactionRunner { run<T>(work: () => Promise<T>): Promise<T>; }
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (domain) | Cada transición válida/inválida; terminales inmutables; NO_INGRESARA desde no-terminal; `reconstruct` no valida (D2) | Vitest, tabla de casos |
| Unit (app) | UpdateStatus rechaza saltos/retrocesos; Create rechaza nivel↔ciclo incoherente | Vitest + repos fake |
| Integration | Promote: rollback si Enrollment falla (no queda Student); éxito → INGRESO | Vitest + tx real/fake |
| Script | cleanup idempotente; threshold aborta | Test del helper |

## Migration / Rollout

Orden de deploy (manual): 1) backup prod → 2) `npx tsx scripts/cleanup-ingresantes-sin-ciclo.ts` → 3) migración tenant `cycle_id NOT NULL` vía `migrate-all-tenants` → 4) deploy código. Rollback: revertir código por git; el cleanup es irreversible (de ahí el backup).

## Open Questions

- [ ] (Cerrada) Error de transición: se reusa `ValidationError` → HTTP 400 `{ error: { message } }`, mensaje `Transición inválida: no se puede pasar de {current} a {next}`. Sin tipo de error nuevo.
- [ ] (Cerrada) Coherencia nivel↔ciclo se valida en UI (UX) **y** backend (integridad); el backend es el gate autoritativo.
