# Archive Report — reporting-errors-reclassification

**Archived:** 2026-08-04 · **Verdict:** PASS (0 CRITICAL, 0 WARNING, 1 SUGGESTION cosmética).
**Épico:** application-error-handling. **Cierra el follow-up #3a** (Change 2 de 2, consumidor de `infrastructure-error-model`).
**Nivel pedagógico:** N/A.

## What shipped

Reclasificó las 3 clases `bare-Error` de reporting (`BoletinError`/`ConstanciaError`/`AsistenciaReportingError`,
11 códigos) al modelo de error en capas, partiéndolas por semántica:

- **8 subclases `DomainError`** nuevas en `packages/domain/src/reportes/errors/` (NOT_FOUND + invariantes),
  con **códigos específicos preservados** (`AxccNotFoundError`, `ReporteStudentNotFoundError`,
  `ReporteCourseCycleNotFoundError`, `MateriaXCursoXCicloNotFoundError`, `StudentNotPrintableError`,
  `StudentNotEligibleError`, `BoletinLevelUnknownError`, `BatchAllFailedError`) + 8 entradas `DOMAIN_STATUS`.
- **`InstitutionNotFoundError`** (nueva `InfrastructureError`, code preservado, 500).
- **Reuso de Change 1**: `TemplateNotFoundError` (templates) y `TenantClientUnavailableError` (guards tenant).
- **Shared load-bearing**: rama `instanceof DomainError` en `unwrapResultOrThrow` + bound relajado a `httpStatus?: number`.
- **Borradas** las 3 clases viejas.

**Sin cambio de comportamiento** salvo UNA corrección de wire-`code`: los 3 guards tenant pasan de `INTERNAL_ERROR`
a `TENANT_CLIENT_UNAVAILABLE` (status 500 igual; el frontend no lee `code` en esos 500). Los otros 8 códigos y todos
los status preservados.

## Delivery — 4 slices stacked

`refactor/reporting-errors-shared` (Slice 0, aditivo) → `-asistencia` → `-boletin` → `-constancia`. 7 commits.

## Verification (independiente, verify PASS)

- RER-R1..R8 todos PASS. `domain build → api typecheck → api test (2219/2219) → api lint (solo 5 pre-existentes ajenos)`;
  `pnpm build` monorepo 3/3 verde.
- Grep guard: 0 refs a las 3 clases viejas fuera de `openspec/`.
- Clases base (`application-error`/`infrastructure-error`/`domain-error`) sin tocar.

## Canonical spec sync

Hecho en Slice 3 (commit `40eb68c`): `application-error-handling/spec.md` — entrada `reportes`/`asistencia-reporting`
marcada RECLASIFICADA/DONE con el inventario de clases; el consumer de `InfrastructureError` marcado cerrado.

## Follow-ups (épico error-handling)

- **#3b — cola de módulos**: `pedagogy`, `ingresante`, `institution`, `asignacion-curso`, `nivel-terciario`.
- **Deuda pre-existente** (ajena, sin ticket): `web#build` POSIX path; lint repo rojo (5 files); 4 integration `.db.test.ts`;
  `archive-legacy-grading-data.spec.ts` Windows path.

Con este archive, **#3a queda CERRADO**: `InfrastructureError` modelado (Change 1) + las 3 clases de reporting
reclasificadas (Change 2). El modelo de error en capas (`DomainError → ApplicationError → InfrastructureError`)
está completo para el área de reportes.
