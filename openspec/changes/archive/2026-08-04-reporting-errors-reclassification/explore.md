# Exploration: reporting-errors-reclassification (épico follow-up #3a)

> Reclasificar `BoletinError` / `ConstanciaError` / `AsistenciaReportingError` (hoy `extends Error`)
> a la jerarquía correcta. Base `main` (limpio, #1 y #2 mergeados). FASE: exploración (read-only).

## Executive Summary

Las 3 clases mezclan **3 familias semánticas incompatibles** (NOT_FOUND, invariantes, infra) bajo una
sola clase `extends Error`, así que reclasificar NO es un rename 1:1 — hay que **partir cada clase por
semántica** y, para los guards de infra, **crear `InfrastructureError` (que NO existe todavía)**. La
decisión central es el **string del `code`**: preservar los códigos específicos actuales (`AXCC_NOT_FOUND`)
con subclases `DomainError` dedicadas, vs. reusar el patrón genérico ya existente en el repo
(`NotFoundError`/`CourseCycleNotFoundError`, code = `'NOT_FOUND'`) — esto último es DRY pero **cambia el
`code` en el wire = cambio de contrato de API**. Además, reclasificar a `DomainError` fuerza un fix técnico
obligatorio: `unwrapResultOrThrow` tiene bound estructural con `httpStatus`, que `DomainError` no tiene →
necesita una rama nueva `instanceof DomainError`, + entradas nuevas en `DOMAIN_STATUS` (o los códigos caen a
400 silenciosamente).

## 1. Definiciones actuales + inventario de códigos

Las 3 `extends Error` directo, shape `(message, code, httpStatus = 422)`, definidas inline:
- `BoletinError` — `generate-boletin.use-case.ts:37-46`
- `ConstanciaError` — `templates/constancia.template.ts:33-42`
- `AsistenciaReportingError` — `asistencia-reporting/asistencia-reporting.errors.ts:5-14` (archivo dedicado)

**11 códigos distintos, 19 call-sites (no-test):**

| Clase | Code | HTTP | Semántica |
|---|---|---|---|
| Boletin | AXCC_NOT_FOUND | 404 | NOT_FOUND |
| Boletin | STUDENT_NOT_PRINTABLE | 422 | invariante |
| Boletin | COURSE_CYCLE_NOT_FOUND | 404 | NOT_FOUND |
| Boletin | STUDENT_NOT_FOUND | 404 | NOT_FOUND |
| Boletin | BOLETIN_LEVEL_UNKNOWN | 422 | invariante (2 sites: execute + getBaseLevel) |
| Boletin | INTERNAL_ERROR | 500 | infra (tenantClient) |
| Boletin | BATCH_ALL_FAILED | 422 | **AMBIGUO** (aggregate) |
| Boletin | INTERNAL_ERROR | 500 | infra (batch tenantClient) |
| Constancia | INTERNAL_ERROR | 500 | infra |
| Constancia | AXCC_NOT_FOUND | 404 | NOT_FOUND |
| Constancia | STUDENT_NOT_FOUND | 404 | NOT_FOUND |
| Constancia | STUDENT_NOT_ELIGIBLE | 422 | invariante |
| Constancia | COURSE_CYCLE_NOT_FOUND | 404 | NOT_FOUND |
| Constancia | INSTITUTION_NOT_FOUND | 500 | **AMBIGUO** (data-integrity master DB) |
| Constancia | TEMPLATE_NOT_FOUND | 500 | infra |
| Asistencia | COURSE_CYCLE_NOT_FOUND | 404 | NOT_FOUND |
| Asistencia | MATERIA_X_CURSO_X_CICLO_NOT_FOUND | 404 | NOT_FOUND |
| Asistencia | TEMPLATE_NOT_FOUND | 500 | infra |
| Asistencia | INTERNAL_ERROR | 500 | infra (tenantClient) |

Nuance: el path "template faltante" de Boletin NO usa TEMPLATE_NOT_FOUND/500 — cae a BOLETIN_LEVEL_UNKNOWN/422
(inconsistencia pre-existente vs Constancia/Asistencia).

## 2. `InfrastructureError` — NO existe (confirmado)

`rg InfrastructureError` → 0 hits en código (solo docs openspec, "DEFERRED"). Es un gap **cross-cutting**: el
canónico (L256-260) tiene **3 otros sitios ajenos** esperándolo (`update-grupo.use-case.ts:43`,
`competency.use-cases.ts:258`, `generate-attendance-types-pdf.use-case.ts`). Modelarlo:
- **Home**: ni `packages/domain` (no es invariante de datos) ni claramente `application/`. Semánticamente es infra.
  Sin precedente de error base bajo `infrastructure/`. Candidatos: `api/src/application/shared/errors/` (co-ubicado
  con ApplicationError) o nuevo `api/src/infrastructure/shared/errors/`.
- **Filtro**: rama nueva `instanceof InfrastructureError` en `exception.filter.ts:94-104` (httpStatus fijo 500).
- **unwrapResultOrThrow**: si lleva `httpStatus=500` en la instancia, el fallback estructural funciona sin rama nueva;
  si no, hace falta rama `instanceof InfrastructureError` (como ApplicationError).

## 3. Contrato `DomainError` + `DOMAIN_STATUS`

`DomainError` (`packages/domain/.../domain-error.ts`) es fino: `(message, code)`, **sin `httpStatus`**. El status
sale de `DOMAIN_STATUS[code] ?? 400` en el filtro. Consecuencias load-bearing:
1. **`unwrapResultOrThrow` NO acepta `DomainError`** (su bound estructural requiere `httpStatus`). Reclasificar a
   DomainError requiere **rama nueva `instanceof DomainError`** en el helper (re-throw as-is, espejo de ApplicationError).
   Cambio compartido OBLIGATORIO.
2. **Ninguno de los 11 códigos tiene entrada en `DOMAIN_STATUS`** → caerían a 400 (regresión silenciosa: AXCC_NOT_FOUND
   404→400, BOLETIN_LEVEL_UNKNOWN 422→400). Cada código necesita entrada explícita.
3. **Precedente NOT_FOUND del repo = code GENÉRICO**. `NotFoundError extends DomainError` tiene code fijo `'NOT_FOUND'`;
   `CourseCycleNotFoundError` YA EXISTE (reusable para los COURSE_CYCLE_NOT_FOUND). `DOMAIN_STATUS` ya mapea `NOT_FOUND: 404`.
   Pero reusar cambia el wire code de `'AXCC_NOT_FOUND'` a `'NOT_FOUND'` — choca con los tests de controller que asertan
   el code específico (`reportes.controller.test.ts:68`).

## 4. Shape de reclasificación — opciones

Una clase por módulo abarca NOT_FOUND + invariante + infra → no puede tener un solo padre. Opciones:
- **(a) Partir cada clase en subclases por-semántica, per-módulo.** Pro: mínimo churn de call-sites, cada módulo dueño de
  su vocabulario, matchea la granularidad del épico (GrupoMateriaMismatchError). Con: duplica clases tipo StudentNotFoundError
  entre Boletin/Constancia.
- **(b) Colapsar en clases cross-módulo compartidas por semántica**, reusando la familia genérica (`NotFoundError` +
  nuevos hermanos). `CourseCycleNotFoundError` ya existe (reuso casi gratis). Pro: DRY, matchea convención del repo,
  cero entradas DOMAIN_STATUS nuevas para la familia genérica. Con: **cambia el wire `code`** (contrato de API).
- **(c) Una clase por módulo, padre dominante, outliers a mano.** RECHAZADA: ninguna clase tiene semántica dominante.

**Recomendación: híbrido — (a) para invariantes + guards de infra específicos; (b) para los NOT_FOUND puros donde ya
existe/es trivial una clase cross-módulo.** El tema del `code` (específico vs genérico) es ORTOGONAL y necesita decisión.

## 5. Blast radius

~15-16 archivos: 6 producción (3 defs de clase + 3 use-cases con call-sites) + 2 compartidos (unwrapResultOrThrow +
exception.filter) + 7 test files. Ninguno trivial (re-derivar asserts de instanceof/code/httpStatus).

## 6. Los 2 códigos ambiguos (solo opciones)

**`INSTITUTION_NOT_FOUND`** (Constancia, 500): dispara cuando institutionId existe pero master-DB findUnique → null.
- A: DomainError/404 (dangling FK = "not found"; **cambia status** 500→404).
- B: InfrastructureError/500 (data-integrity master-tenant; **preserva status**).
- Pregunta producto: ¿404 visible al cliente, o 500 alarma de integridad server-side?

**`BATCH_ALL_FAILED`** (Boletin, 422): todos los PDFs del batch fallaron.
- A: DomainError/422 (outcome agregado como invariante).
- B: categoría nueva / excepción documentada (no encaja limpio en "invariante intrínseca del dato"; sería el 1er
  agregado-outcome del repo).
- Pregunta producto: ¿modelar outcome agregado igual que invariante de entidad, o el repo necesita 4ta categoría?

## 7. Size / slicing

~15-16 archivos → no un solo PR. Slices stacked (espejo de #2):
- **Slice 0 (prerequisito)**: `InfrastructureError` base + entradas DOMAIN_STATUS + rama(s) unwrapResultOrThrow +
  rama filtro + tests. Solo shared files, ~150-250 líneas, aditivo (sin cambio de comportamiento hasta que un slice lo use).
- **Slice 1**: Boletin (~300-400, el más grande; puede necesitar decisión BATCH_ALL_FAILED).
- **Slice 2**: Constancia (~250-350; depende de INSTITUTION_NOT_FOUND).
- **Slice 3**: AsistenciaReporting (~200-300; el más limpio, sin ambiguos — podría ir primero como proof-of-pattern).

## 8. Sequencing

**`InfrastructureError` debería ser su propio change prerequisito** (no bundle en slice 1): es cross-cutting, desbloquea
3 sitios ajenos ya esperándolo, y matchea la convención del repo (forbidden-error-reclassification fue un prerequisito
standalone antes de que asistencia-reporting-result consumiera ApplicationError+ForbiddenError).

## Approach + Recommendation

Recomendación: `InfrastructureError` como prerequisito standalone (o slice 0), luego slices per-módulo, con **Option (a)
códigos específicos preservados** por default (menor riesgo, preserva contrato) salvo que el usuario acepte el cambio de
contrato de la familia genérica.

## Open Questions / Decisiones para el usuario

1. **Estrategia de `code`**: específicos preservados (subclases DomainError dedicadas) vs genéricos (reuso NotFoundError,
   code='NOT_FOUND', rompe códigos específicos). ← DECISIÓN CENTRAL.
2. **`InfrastructureError` home**: `application/shared/errors/` (sin dir nuevo) vs `infrastructure/shared/errors/` (más limpio, sin precedente).
3. **`InfrastructureError` shape**: httpStatus fijo 500 vs configurable como ApplicationError.
4. **`INSTITUTION_NOT_FOUND`**: DomainError/404 (cambia status) vs InfrastructureError/500 (preserva).
5. **`BATCH_ALL_FAILED`**: DomainError/422 vs categoría nueva.
6. **Inconsistencia template-guard de Boletin**: ¿normalizar (BOLETIN_LEVEL_UNKNOWN→TEMPLATE_NOT_FOUND para el path template) o dejar (behavior-preserving)?
7. **Sequencing**: `InfrastructureError` como change standalone separado (beneficia 3 sitios ajenos) vs slice 0 de este change.

## Riesgos

(1) bound estructural de unwrapResultOrThrow rompe con DomainError sin rama nueva; (2) DOMAIN_STATUS sin entrada → 400
silencioso; (3) reuso genérico cambia wire code (contrato); (4) InfrastructureError es gap cross-cutting, scopearlo solo
acá sub-sirve al resto; (5) ~15-16 archivos, slicing obligatorio.
