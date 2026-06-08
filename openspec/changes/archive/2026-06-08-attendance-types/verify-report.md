# Verify Report: Tipos de Asistencia (attendance-types)

**Fecha:** 2026-06-08  
**Veredicto:** PASS WITH WARNINGS  
**CRITICAL:** 0 | **WARNING:** 3 | **SUGGESTION:** 5

---

## Gate Results

| Gate | Result | Detail |
|---|---|---|
| `pnpm --filter @educandow/domain build` | PASS | 0 TS errors |
| `pnpm --filter @educandow/domain test` | PASS | 63 files, 747 tests |
| `pnpm --filter api typecheck` | PASS | 0 TS errors |
| `pnpm --filter api lint` | PASS | 0 ESLint errors |
| `pnpm --filter api test` | PASS* | 469 passed; 6 pre-existing failures |
| `pnpm --filter web lint` | PASS | 0 errors |
| `pnpm --filter web test` | PASS | 13 files, 119 tests |

*Pre-existing failures (NOT regressions): `postgres-admin.service.test.ts` ×6 + `ensure-institution-levels.test.ts` (file-level import error). Both were present before this change.

**Regressions introducidas: NINGUNA.**

---

## Spec Coverage

**14/14 REQ implementados. ~20/27 escenarios cubiertos por tests automatizados.**

| Escenario | Test | Archivo |
|---|---|---|
| 1.1 code > 4 chars | ✅ | domain: attendance-type.test.ts; api: dto-validation.test.ts |
| 1.2 absenceValue negativo | ✅ | domain: attendance-type.test.ts; api: dto-validation.test.ts |
| 1.3 level = 9 rechazado | ✅ | domain: attendance-type.test.ts; api: dto-validation.test.ts |
| 2.1 duplicate (level, code) → 409 | ✅ | api: attendance-type.use-cases.test.ts + controller.test.ts |
| 2.2 mismo code distinto nivel → ok | ⚠️ | No test positivo explícito |
| 3.1 crear tipo custom → 201 | ✅ | api: attendance-type.use-cases.test.ts + controller.test.ts |
| 3.2 sin auth → 401 | ⚠️ | No test para este controller (solo unit, no supertest) |
| 4.1 editar tipo custom → 200 | ✅ | api: attendance-type.use-cases.test.ts + controller.test.ts |
| 4.2 code en PATCH ignorado | ✅ | api: dto-validation.test.ts |
| 5.1 editar isSystem → 409 | ✅ | api: attendance-type.use-cases.test.ts + controller.test.ts |
| 5.2 editar isSystem (módulo) → 409 | ✅ | mismo code path que 5.1 |
| 6.1 borrar tipo custom → 204 | ✅ | api: attendance-type.use-cases.test.ts + controller.test.ts |
| 7.1 borrar isSystem → 409 | ✅ | api: attendance-type.use-cases.test.ts + controller.test.ts |
| 8.1 listar todos | ✅ | api: controller.test.ts |
| 8.2 filtrar por nivel | ✅ | api: controller.test.ts |
| 8.3 filtrar por activo | ✅ | api: controller.test.ts |
| 8.4 filtrar nivel + activo combinados | ⚠️ | No test combinado explícito |
| 9.1 4 codes exactos por nivel | ✅ | api: ensure-attendance-types.use-case.test.ts (valores exactos) |
| 9.2 cubre todos los niveles, no ADMINISTRACION | ✅ | api: ensure-attendance-types.use-case.test.ts |
| 10.1 crear institución dispara cascada | ✅ | api: create-institution-cascade.test.ts |
| 10.2 sin niveles no genera tipos | ✅ | api: create-institution-cascade.test.ts |
| 11.1 agregar nivel dispara cascada | ✅ | api: update-institution-cascade.test.ts |
| 11.2 update sin cambio de nivel no duplica | ✅ | api: update-institution-cascade.test.ts |
| 11.3 provisión repetida = idempotente | ✅ | api: ensure-attendance-types.use-case.test.ts |
| 12.1-12.5 mapeo HTTP | ✅ | api: controller.test.ts |
| 13.1 ROOT full access | ✅ | código: @Roles('ROOT', ...) en controller |
| 13.2 módulo READ → lista | ⚠️ | No test para attendance-types |
| 13.3 sin permisos → 403 | ⚠️ | No test para este controller |
| 13.4 módulo en seed | ⚠️ | Verificado en código (seed.ts), no test automatizado |
| 14.1 menú en sidebar | ⚠️ | Verificado en código, no test automatizado |
| 14.2 isSystem rows read-only | ✅ | web: attendance-types.test.tsx |

---

## Critical Logic Checks

| Check | Resultado | Evidencia |
|---|---|---|
| System codes (ensure UC) | ✅ PASS | `ensure-attendance-types-for-level.use-case.ts:6-11` — SAB/DOM/P/X con valores exactos del spec |
| System codes (seed.ts) | ⚠️ WARNING | `seed.ts:317` — X.description = 'Día inexistente' ≠ spec 'Día no utilizado' |
| isSystem protection | ✅ PASS | `attendance-type.ts:90-94`; Update+Delete UCs retornan `SystemAttendanceTypeError`; mapeado a 409 |
| Cascade idempotente | ✅ PASS | upsert con `update:{}` (no-op); probado con call-count en ensure test |
| Cross-schema | ✅ PASS | EnsureUC usa `getTenantClient(dbName)`; CRUD repo usa `TenantContext.getClient()` |
| code ≤ 4 chars | ✅ PASS | VO `AttendanceTypeCode` + DTO Zod `.max(4)` |
| @@unique([level, code]) | ✅ PASS | schema.prisma:499 + migration.sql:30 |
| Update no cambia code/level | ✅ PASS | UpdateSchema solo expone description/absenceValue/active/assignable; strips lo demás |
| Migración reemplazo limpio | ✅ PASS | DROP FK → DROP TABLE attendance_statuses → CREATE attendance_types → indexes → ADD FK; sin backfill |
| HTTP mapping 409/404 | ✅ PASS | exception.filter.ts:16-18: CODE_DUPLICATE:409, SYSTEM_PROTECTED:409, NOT_FOUND:404 |
| Permisos | ✅ PASS | seed.ts módulo ATTENDANCE_TYPES; r-root/r-admin/r-director asignados; @Roles en controller |
| Front isSystem read-only | ✅ PASS | attendance-types.tsx:387; testado en attendance-types.test.tsx |

---

## WARNING 1 — X description inconsistente entre seed y ensure use case

- **Archivo:** `api/prisma/seed.ts:317`
- **Encontrado:** `description: 'Día inexistente'`
- **Esperado (spec REQ-9):** `'Día no utilizado'`
- **Contexto:** `ensure-attendance-types-for-level.use-case.ts` usa el valor correcto (`'Día no utilizado'`). El design original decía 'Día inexistente' pero la spec aprobada lo cambió a 'Día no utilizado'. El seed siguió el design, el use case siguió la spec.
- **Impacto:** Instituciones creadas vía seed tienen X = "Día inexistente". Instituciones creadas via API tienen X = "Día no utilizado". Inconsistencia de datos entre entornos.
- **Fix:** Cambiar `seed.ts:317` de `'Día inexistente'` a `'Día no utilizado'`

## WARNING 2 — API response usa snake_case en vez del camelCase del spec

- **Archivo:** `api/src/presentation/attendance-type/attendance-type.controller.ts:25,28`
- **Encontrado:** `absence_value`, `is_system`
- **Spec (Escenario 3.1):** `absenceValue`, `isSystem`
- **Contexto:** El proyecto usa snake_case en todas las respuestas HTTP (ver institution.controller.ts). Es convención establecida, no un bug. La spec usó ejemplos camelCase que no reflejan la convención real.
- **Impacto:** Documentación de API (spec) no coincide con la respuesta real. Confunde a nuevos consumidores de la API.

## WARNING 3 — Sin test de autenticación/autorización para este controller

- **Tarea:** T3.2.1 requería tests supertest incluyendo "POST sin auth → 401" (Escenario 3.2) y "GET sin permiso → 403" (Escenario 13.3)
- **Implementado:** Unit tests con `Object.create(AttendanceTypeController.prototype)` — no ejercitan los guards
- **Impacto:** Escenarios 3.2 y 13.3 no cubiertos para este controller. Los guards funcionan (compartidos y probados en otros lugares), pero no hay test de regresión específico.

---

## SUGGESTIONs (5)

1. **S1** — Escenario 2.2 (mismo code en distinto nivel → éxito) sin test positivo
2. **S2** — Escenario 8.4 (filtro combinado level+active) sin test explícito en controller
3. **S3** — Campo `isPresent` en schema y código no está en spec REQ-1 (campo extra del design para la futura grilla diaria — inofensivo)
4. **S4** — Test front isSystem read-only usa `toBeLessThanOrEqual(1)` que pasaría con 0 botones; el test complementario (S5 custom rows) lo rescata, pero la assertion individual es débil
5. **S5** — Escenarios 13.2, 13.4, 14.1 verificados solo por inspección de código, sin test automatizado

---

## Alcance (Scope)

`git diff --stat 50fb5fc~1 HEAD` muestra **45 archivos, +4447/-46 líneas**. Todos los archivos pertenecen al dominio attendance-type o son archivos de configuración/wiring directamente relacionados. **Scope limpio — sin cambios fuera del alcance.**

---

## Ready for Archive

**SÍ**, con la observación de W1 (X description en seed) que debería corregirse antes o después del archive.
