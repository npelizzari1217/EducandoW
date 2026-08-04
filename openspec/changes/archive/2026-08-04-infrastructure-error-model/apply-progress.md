# Apply Progress — infrastructure-error-model

**Status:** COMPLETO — PR1 + PR2 (T1-T21, 21/21). Ramas: `feat/infrastructure-error-model` (PR1) desde
main `d4a5da8`; `feat/infrastructure-error-model-pilots` (PR2) stacked sobre PR1. 18 commits sobre main.

## PR1 — base + wiring (aditivo, rama `feat/infrastructure-error-model`)

| Hash | Commit |
|------|--------|
| `20ab5ad` | docs(sdd): plan infrastructure-error-model |
| `183cf8c` / `b8cd3fb` | test/feat(errors): InfrastructureError abstract base class |
| `ad336f4` / `503177b` | test/feat(errors): TenantClientUnavailableError + TemplateNotFoundError |
| `59cda1d` / `ebe3013` | test/feat(filter): map InfrastructureError to HTTP 500 with code |
| `8d5f94c` / `24d2fdf` | test/feat(http): preserve InfrastructureError identity in unwrapResultOrThrow |

Aditivo confirmado: `rg InfrastructureError api/src/application` fuera de `shared/errors/` → vacío.

## PR2 — 3 pilotos (rama `feat/infrastructure-error-model-pilots`)

| Hash | Commit |
|------|--------|
| `06f59cf` / `93de50b` | test/feat(materia-grupo-ciclo): update-grupo guard → err(TenantClientUnavailableError) |
| `a1e9362` / `7aa6d32` | test/feat(pedagogy): competency auto-create → Result, guard → err |
| `4662c38` / `38de45c` | test/feat(course-cycle): caller logs auto-create Result errors alongside .catch |
| `b4085d6` / `5dde2d6` | test/feat(attendance-type): template guard → err(TemplateNotFoundError) |
| `3b16161` | docs(tasks): mark PR2 tasks complete |

**T14 audit (piloto 2):** el design decía "5 return; + fall-through = 6"; el código real tenía 4 `return;`
explícitos + 1 implícito = 5 exit-paths no-guard. Auditado sobre el código real, todos → `return ok(undefined)`;
getter borrado; import `TenantPrismaClient` removido.

## Verificación (PR1 + PR2)

- `pnpm --filter api typecheck` → verde. `pnpm --filter api build` → verde.
- `pnpm --filter api test` → 2205/2206 (única falla pre-existente `archive-legacy-grading-data.spec.ts`, Windows
  path, ajena, no en diff).
- `pnpm --filter api lint` → los 8/16 archivos tocados limpios; el repo tiene 5 errores PRE-EXISTENTES ajenos
  (`subject-group-filter.db.test.ts`, `guardians.test.ts`, y `competency.use-cases.ts:310` `GradePeriodValuationUC`
  clase distinta untouched). `no-floating-promises` NO trippea en el `.then().catch()`.
- Scope boundary: solo base/wiring + 8 archivos piloto; reporting classes NO en producción; sin cambio de status
  (3 pilotos siguen 500); sin `DOMAIN_STATUS` edit; controllers `materia-grupo-ciclo.controller.ts:443` +
  `attendance-type.controller.ts:103` sin tocar.

Verify: VEREDICTO **PASS** (0 CRITICAL, 0 WARNING, 1 SUGGESTION no-bloqueante).
