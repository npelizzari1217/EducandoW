# Delta Spec — reporting-errors-reclassification

> CONSUMER de `application-error-handling` (usa `DomainError`, `InfrastructureError`, `DOMAIN_STATUS`,
> `unwrapResultOrThrow`). Nivel N/A. Reclasifica los 11 códigos de reporting al modelo en capas.
> Sin cambio de comportamiento observable salvo UNA corrección de wire-`code` (guards tenant, RER-R3).

## ADDED Requirements

### Requirement: RER-R1 — Reclasificación por tier

Cada uno de los 11 códigos de reporting MUST reclasificarse a una subclase concreta del tier correcto,
preservando su `code` actual, EXCEPTO los guards tenant (RER-R3):

| Códigos | Tier target | Home |
|---|---|---|
| `AXCC_NOT_FOUND`, `STUDENT_NOT_FOUND`, `COURSE_CYCLE_NOT_FOUND`, `MATERIA_X_CURSO_X_CICLO_NOT_FOUND`, `STUDENT_NOT_PRINTABLE`, `STUDENT_NOT_ELIGIBLE`, `BOLETIN_LEVEL_UNKNOWN`, `BATCH_ALL_FAILED` | `DomainError` (subclase nueva por código) | `packages/domain/src/reportes/errors/` |
| `TEMPLATE_NOT_FOUND` | `InfrastructureError` — **reusa `TemplateNotFoundError`** (Change 1) | existente |
| tenant `INTERNAL_ERROR` (×3) | `InfrastructureError` — **reusa `TenantClientUnavailableError`** (Change 1) | existente |
| `INSTITUTION_NOT_FOUND` | `InfrastructureError` (subclase nueva, code preservado) | `api/src/application/shared/errors/` |

#### Scenario: código NOT_FOUND → subclase DomainError dedicada

- GIVEN un use-case que antes retornaba `err(new BoletinError('...', 'AXCC_NOT_FOUND', 404))`
- WHEN falla tras la reclasificación
- THEN MUST retornar `err(new AxccNotFoundError(...))`, un `instanceof DomainError`, con `code === 'AXCC_NOT_FOUND'`

#### Scenario: TEMPLATE_NOT_FOUND reusa la clase infra de Change 1

- GIVEN un use-case que antes tiraba un error bare `TEMPLATE_NOT_FOUND`
- WHEN falla tras la reclasificación
- THEN MUST retornar `err(new TemplateNotFoundError(...))`, NO una clase reportes-local nueva

### Requirement: RER-R2 — HTTP status preservado vía DOMAIN_STATUS

Cada código reclasificado MUST resolver al MISMO status que antes (NOT_FOUND→404, invariantes→422). Para
cada código `DomainError` nuevo MUST existir una entrada explícita en `DOMAIN_STATUS`; un código sin entrada
(cae al default 400 del filtro) es una REGRESIÓN y MUST prevenirse con un test.

#### Scenario: entrada DOMAIN_STATUS faltante cazada por test

- GIVEN una subclase `DomainError` nueva con código `X`
- WHEN un test construye una instancia y la pasa por `AppExceptionFilter`
- THEN el status MUST ser el documentado del código (404 o 422), NUNCA 400

### Requirement: RER-R3 — El wire-code tenant es el único cambio de contrato

Los 3 guards tenant `INTERNAL_ERROR` (Boletin ×2, Constancia ×1) MUST cambiar su wire `code` de
`INTERNAL_ERROR` a `TENANT_CLIENT_UNAVAILABLE`, con status 500 sin cambio. Este MUST ser el ÚNICO cambio de
wire-`code` de toda la reclasificación; los otros 8 códigos mantienen su string exacto.

#### Scenario: guard tenant emite el nuevo code al mismo status

- GIVEN el tenant Prisma client no disponible en un request de Boletin/Constancia/AsistenciaReporting
- WHEN el request llega a `AppExceptionFilter`
- THEN el status MUST ser `500` y `error.code` MUST ser `'TENANT_CLIENT_UNAVAILABLE'`

### Requirement: RER-R4 — unwrapResultOrThrow admite DomainError

`unwrapResultOrThrow` MUST ganar una rama dedicada `instanceof DomainError`, evaluada después de las ramas
`ApplicationError` e `InfrastructureError` y antes del fallback genérico, que re-throwea la instancia
`DomainError` as-is (identity-preserving) para que aplique el mapeo `DOMAIN_STATUS` de `AppExceptionFilter`.
El bound de tipo genérico del helper MUST relajarse para admitir `DomainError` (que no tiene `httpStatus`)
SIN romper el fallback genérico `HttpException` (que sigue leyendo `error.httpStatus` para errores que no son
`DomainError | ApplicationError | InfrastructureError`). `tsc` MUST pasar.

#### Scenario: DomainError re-thrown as-is, no wrapped

- GIVEN un `Result` cuyo `unwrapErr()` retorna un `instanceof DomainError`
- WHEN se llama `unwrapResultOrThrow`
- THEN MUST `throw` esa instancia `DomainError` exacta (no un `HttpException` sintetizado)
- AND `AppExceptionFilter` MUST mapear vía `DOMAIN_STATUS[error.code]`, no el fallback untyped

#### Scenario: el fallback genérico sigue aplicando a bare errors no-DomainError

- GIVEN un `Result` cuyo `unwrapErr()` lleva `httpStatus`/`code`/`message` pero NO es `instanceof DomainError | ApplicationError | InfrastructureError`
- WHEN se llama `unwrapResultOrThrow`
- THEN MUST caer al wrap genérico `HttpException` existente, sin cambio; `tsc` sin errores para callers con `Result<T, DomainError | ...>`

### Requirement: RER-R5 — Clases bare-Error viejas borradas

`BoletinError`, `ConstanciaError` y `AsistenciaReportingError` MUST NOT existir tras el change; todo call-site
construye la subclase nueva correspondiente.

#### Scenario: no quedan referencias a las clases viejas

- GIVEN el diff completo del change (todos los slices)
- WHEN se busca `BoletinError`, `ConstanciaError`, `AsistenciaReportingError`
- THEN ningún archivo de producción o test MUST referenciarlas

### Requirement: RER-R6 — Sin cambio de comportamiento más allá del code tenant

Aparte del wire-code tenant (RER-R3), el change MUST NOT alterar HTTP status, forma del body
(`{ error: { status, code, message } }`), ni control flow para ninguno de los 11 códigos.

#### Scenario: forma de respuesta sin cambio para un NOT_FOUND reclasificado

- GIVEN un request que antes retornaba `404` con `{ error: { status: 404, code: 'AXCC_NOT_FOUND', message } }`
- WHEN ocurre la misma falla tras la reclasificación
- THEN la respuesta MUST tener forma y valores idénticos, salvo la identidad `instanceof` de la clase

### Requirement: RER-R7 — Scope boundary

El change MUST NOT convertir ningún `throw`→`Result` (ya hecho por follow-ups previos), MUST NOT tocar la
cola de módulos (#3b), y MUST NOT modificar las definiciones de las clases base `ApplicationError` o
`InfrastructureError`.

#### Scenario: clases base sin tocar

- GIVEN el diff completo del change
- WHEN se inspecciona `application-error.ts` e `infrastructure-error.ts`
- THEN ninguno MUST aparecer en el diff

### Requirement: RER-R8 — Cobertura de test por código reclasificado

Cada uno de los 11 códigos reclasificados MUST tener un test asertando: el `instanceof` del tier de la clase
nueva, el `code` preservado (o, para los guards tenant, actualizado), y el HTTP status correcto. La rama nueva
`DomainError` de `unwrapResultOrThrow` MUST estar cubierta por un test dedicado.

#### Scenario: cada código tiene test instanceof + code + status

- GIVEN cualquiera de los 11 códigos reclasificados
- WHEN corre su suite de test
- THEN MUST haber aserción de `instanceof <TierEsperado>`, `code === '<esperado>'`, y `status === <esperado>`
