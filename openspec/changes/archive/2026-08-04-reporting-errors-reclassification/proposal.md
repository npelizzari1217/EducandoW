# Proposal: reporting-errors-reclassification

> Follow-up #3a (Change 2, el que lo cierra). CONSUMER de `application-error-handling`.
> Consume `InfrastructureError` (modelado por `infrastructure-error-model`, ya en `main`).

## Nivel pedagógico afectado

**N/A.** Reclasificación transversal del modelo de error de reportes. **Sin cambio de comportamiento
observable**: cada código mantiene su HTTP status actual (404/422/500). Cambios de wire `code` solo donde
se indica explícitamente (los guards tenant, ver decisión).

## Intent

Partir las 3 clases `bare-Error` de reporting (`BoletinError` / `ConstanciaError` /
`AsistenciaReportingError`) en subclases de la jerarquía correcta, por semántica:
- **NOT_FOUND** + **invariantes** → `DomainError` (subclases dedicadas, **códigos específicos preservados**).
- **Infra guards** → `InfrastructureError` (reusa las clases de Change 1).

Cierra el modelo de error en capas para el área de reportes.

## Decisiones (de #3a, ya resueltas)

1. **Códigos específicos preservados** (Option a): subclases `DomainError` dedicadas por código
   (`AXCC_NOT_FOUND`, `STUDENT_NOT_FOUND`, etc.), NO reusar el genérico `NotFoundError` (que tiene code
   `'NOT_FOUND'`). Cada código nuevo necesita entrada en `DOMAIN_STATUS`.
2. **Status preservado en los ambiguos**: `INSTITUTION_NOT_FOUND` → `InfrastructureError`/500;
   `BATCH_ALL_FAILED` → `DomainError`/422.
3. **Infra guards** → `InfrastructureError` (Change 1). Template guards reusan `TemplateNotFoundError`.

## Decisiones nuevas (con mi recomendación — avanzo salvo que me pares)

4. **Guards tenant `INTERNAL_ERROR`** (Boletin ×2, Constancia ×1): **reusar `TenantClientUnavailableError`**
   de Change 1 (misma falla exacta — tenant Prisma client ausente). Cambia el wire `code` `INTERNAL_ERROR` →
   `TENANT_CLIENT_UNAVAILABLE` (status 500 preservado; el frontend no lee `code` en estos 500, verificado en #2).
   Alternativa: clase nueva conservando `INTERNAL_ERROR` — no recomendado (duplica una falla ya modelada).
5. **`INSTITUTION_NOT_FOUND`** → nueva subclase `InfrastructureError` dedicada conservando code
   `INSTITUTION_NOT_FOUND` (data-integrity master-DB, 500 preservado).
6. **Home de las subclases `DomainError`**: nuevo módulo `packages/domain/src/reportes/errors/` (matchea la
   convención `course-cycle/errors`, `pedagogy/errors`). Los use-cases de `api/application` las importan
   (dirección clean-arch correcta: application → domain).

## Reclasificación — mapping por código

| Código | HTTP | Clase actual | → Target | Tier |
|--------|------|--------------|----------|------|
| AXCC_NOT_FOUND | 404 | Boletin/Constancia | `AxccNotFoundError` (code preservado) | DomainError |
| STUDENT_NOT_FOUND | 404 | Boletin/Constancia | `ReporteStudentNotFoundError` | DomainError |
| COURSE_CYCLE_NOT_FOUND | 404 | ×3 | `ReporteCourseCycleNotFoundError` | DomainError |
| MATERIA_X_CURSO_X_CICLO_NOT_FOUND | 404 | Asistencia | `MateriaXCursoXCicloNotFoundError` | DomainError |
| STUDENT_NOT_PRINTABLE | 422 | Boletin | `StudentNotPrintableError` | DomainError |
| STUDENT_NOT_ELIGIBLE | 422 | Constancia | `StudentNotEligibleError` | DomainError |
| BOLETIN_LEVEL_UNKNOWN | 422 | Boletin | `BoletinLevelUnknownError` | DomainError |
| BATCH_ALL_FAILED | 422 | Boletin-batch | `BatchAllFailedError` | DomainError |
| TEMPLATE_NOT_FOUND | 500 | Constancia/Asistencia | **`TemplateNotFoundError` (reuso Change 1)** | InfrastructureError |
| INTERNAL_ERROR (tenant) | 500 | ×3 | **`TenantClientUnavailableError` (reuso Change 1)** | InfrastructureError |
| INSTITUTION_NOT_FOUND | 500 | Constancia | `InstitutionNotFoundError` (nueva, code preservado) | InfrastructureError |

(Nombres tentativos — se afinan en design. Los códigos son los que importan y se preservan salvo el tenant.)

## Scope

**IN:**
- Nuevas subclases `DomainError` en `packages/domain/src/reportes/errors/` (NOT_FOUND + invariantes + BATCH_ALL_FAILED), cada una con su code específico.
- Nueva subclase `InfrastructureError` `InstitutionNotFoundError` (`api/src/application/shared/errors/`).
- **Entradas `DOMAIN_STATUS`** para cada código DomainError nuevo (404/422) en `exception.filter.ts`.
- **Rama `instanceof DomainError`** en `unwrapResultOrThrow` (re-throw as-is) + relajar el bound estructural para admitir `DomainError` (sin `httpStatus`). Cambio compartido OBLIGATORIO (los controllers de reportes usan el helper desde #2).
- Reemplazar los 19 call-sites `err(new XError(code))` por `err(new <SubclaseNueva>(...))`.
- **Borrar** las 3 clases `BoletinError`/`ConstanciaError`/`AsistenciaReportingError`.
- Actualizar tests (re-derivar asserts instanceof/code/httpStatus).

**OUT:**
- `throw`→`Result` (ya hecho en #2 — todo es `err(...)` ya).
- Cambios de HTTP status (todos preservados; el único cambio es el wire `code` de los 3 guards tenant).
- La cola de módulos #3b.

## Approach

Reclasificación compilation-gated. La rama `DomainError` en `unwrapResultOrThrow` + las entradas
`DOMAIN_STATUS` van primero (shared, aditivas). Luego, por módulo, se crean las subclases y se reemplazan
los call-sites + tests. Gotcha: tocar `packages/domain` → rebuildear su `dist` antes de `tsc` (o queda falso-verde).

## Delivery — slices stacked (sobre `main`)

| Slice | Contenido |
|-------|-----------|
| 0 (shared) | rama `DomainError` en `unwrapResultOrThrow` + bound relax + `DOMAIN_STATUS` entries + `InstitutionNotFoundError` + tests. Aditivo. |
| 1 | AsistenciaReporting (más limpio, sin ambiguos) — proof-of-pattern |
| 2 | Boletin (+ boletin-batch, `BATCH_ALL_FAILED`) |
| 3 | Constancia (+ `INSTITUTION_NOT_FOUND`) + borrado de las clases viejas + canónico |

~15-16 archivos. `delivery_strategy: ask-on-risk`.

## Risks

- **`DOMAIN_STATUS` sin entrada → 400 silencioso**: cada código DomainError nuevo DEBE tener entrada, o regresa de 404/422 a 400. Cubrir con tests por código.
- **Bound de `unwrapResultOrThrow`**: relajarlo para admitir `DomainError` sin romper el fallback genérico (la rama `DomainError` re-throw debe ir antes del fallback que lee `httpStatus`).
- **Wire `code` de los guards tenant** cambia (`INTERNAL_ERROR`→`TENANT_CLIENT_UNAVAILABLE`) — status 500 igual, frontend no lo lee (verificado #2). Único cambio de contrato, explícito.
- **domain dist rebuild** antes de `tsc`.

## Next

`sdd-spec` + `sdd-design`.
