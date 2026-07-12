# Proposal: app-error-model

## Intent

La regla del proyecto prohíbe `throw` en `application/`: las fallas esperadas se modelan con `Result<T, E>` y se mapean a HTTP en el borde. Esta es la **fase fundacional** del épico error-handling: no migra todo, ESTABLECE el modelo replicable y lo prueba EN USO real.

Al cerrar quedan tres verdades: (1) existe una base `ApplicationError` con el contrato probado de `DomainError`; (2) el `AppExceptionFilter` la mapea a HTTP; (3) el piloto **users.use-cases.ts** cumple no-throw con la base consumida por errores reales de autorización. Los follow-ups replican el patrón mecánicamente.

Nivel pedagógico: **N/A** — auth/RBAC es ortogonal a los niveles (si el enum exige uno: ALL).

## Scope

En scope:
- `application/shared/errors/application-error.ts` (nuevo): `abstract class ApplicationError extends Error { constructor(message, code, httpStatus = 422) }`. Patrón BoletinError (httpStatus en la instancia).
- `exception.filter.ts`: rama `instanceof ApplicationError` (status=`httpStatus`, `message`, `code`) ANTES de `DomainError` y del fallback.
- `users.use-cases.ts` (9 throws) + sus controllers (`if(isErr) throw unwrapErr()`, idiom ya usado 23×).

Fuera de scope (deuda): guards de infra mal tipados; helper `unwrapOrThrow`; áreas de #111.

## Clasificación de los 9 throws (verificada)

**5 genéricos `throw new Error` → ApplicationError (403)**: líneas 211, 428, 437, 629 (jerarquía de roles insuficiente) y 420 (cruce de institución). TODOS son autorización basada en el CONTEXTO DEL LLAMANTE (`creatorRoles`, `creatorInstitutionId`) — concern de orquestación de application, no invariante intrínseco (por eso van a ApplicationError, simétrico a por qué MGC-R4 fue DomainError).

**4 domain → `return err(...)`**: 205 y 446 (`EmailAlreadyExistsError`), 241 y 492 (`ValidationError` vía `validateLevelsSubset`).

## Clases ApplicationError (recomendación: 2, no 5)

Agrupar por SEMÁNTICA de falla, no por call-site (YAGNI; 4 de los 5 son la misma regla de jerarquía):
- `InsufficientRoleHierarchyError` — code `INSUFFICIENT_ROLE_HIERARCHY`, **403**. Call sites 211/428/437/629. Constructor recibe el mensaje específico, fija code+status.
- `CrossInstitutionForbiddenError` — code `CROSS_INSTITUTION_FORBIDDEN`, **403**. Call site 420.

httpStatus **403** (no el default 422): son denegaciones de autorización (request entendido, caller sin permiso) — semántica HTTP Forbidden.

## Corrección de comportamiento (importante)

Hoy esos 5 genéricos caen en el branch `instanceof Error` del filter, que NO cambia el status → responden **HTTP 500**. Una denegación de autorización devolviendo 500 es un bug. Migrar a ApplicationError los lleva a **403**: NO es parity, es corrección deliberada. Riesgo: cualquier test que asuma el 500 actual debe actualizarse.

## Test strategy (sin romper auth)

TDD estricto, `pnpm test`, coverage ≥ 80%. NO se toca login/token (vive en el módulo auth; esto es CRUD de usuarios).
- Base: unit sobre subclase concreta (message/code/httpStatus).
- Filter: stub ApplicationError(403) → 403+code+message, rama antes de DomainError/fallback.
- Por use-case: caller sin jerarquía / cruce de institución → `isErr()` + `unwrapErr() instanceof X` + code; ROOT bypass y paths autorizados siguen OK (create/update/delete legítimos).
- Regresión correctiva: endpoints que antes daban 500 ahora 403.

## Estimación

~200-300 líneas → **un PR** (bajo 400, sin `size:exception`, sin chained). Rollback aditivo.

## Follow-ups

**materia-grupo-ciclo** (17, domain-wrap + nuevo DomainError MGC-R4); reportes+reporting+attendance-type-pdf (post-#111); asistencia (41); course-cycle (17); attendance-type (5, tipos mentirosos); cola larga; helper `unwrapOrThrow`; 2 guards de infra.
