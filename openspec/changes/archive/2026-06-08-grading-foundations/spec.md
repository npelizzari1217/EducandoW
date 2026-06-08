# Spec — grading-foundations (Fase 1 del épico de calificación)

> **Delta spec**: describe qué DEBE SER VERDADERO después de aplicar el cambio.
> No describe implementación. Las fases 2-5 dependen de esta fundación.

---

## Propósito

Reemplazar la configuración de calificación fragmentada y hardcodeada por dos pilares configurables por institución en la tenant DB:

- **(A) Escalas de notas** por institución + nivel + modalidad, con valores alfanuméricos libres y estado interno fijo del sistema.
- **(B) Períodos de calificación** como plantillas por nivel + modalidad, con fechas concretas ancadas a un ciclo lectivo.

Ambos pilares son requisito previo de las fases 2-5 del épico de calificación.

---

## Límite de alcance

### Dentro

- Modelo de datos (tenant DB): entidades `GradeScale`, `GradeScaleValue` (rediseño), `GradingPeriodTemplate`, `GradingPeriodDate`.
- CRUD completo de escalas y valores, dominio con invariantes, repos, use cases, controllers, DTOs.
- CRUD completo de plantillas de períodos y fechas de período por ciclo lectivo.
- Permiso `GRADING_CONFIG` en seed; control de acceso ROOT vs. no-ROOT.
- Front: dos pantallas de gestión siguiendo el patrón de Instituciones + selector de institución para ROOT.
- Tests (strict TDD).

### Fuera (fases posteriores)

- Competencias en jerarquía (Fase 2).
- Instanciación plan→ciclo (Fase 3).
- Libreta / boletín de alumnos (Fase 4).
- Carga de notas de alumnos (Fase 5).
- Eliminación funcional de los campos de período obsoletos en `AcademicCycle` / `CourseCycle` / `MateriaCarrera` / `CompetencyValuation` (se decide en la fase que los reemplace funcionalmente).
- Migración de datos existentes (volumen despreciable; se hace migración de reemplazo limpio).

---

## Modelo conceptual post-cambio

```
GradeScale
  id, name, level, modality, active
  @@unique([institutionId, level, modality, name])
  → values: GradeScaleValue[]

GradeScaleValue
  id, scaleId, code (alfanumérico libre), label, internalStatus (enum), sortOrder, active
  internalStatus: APROBADO | NO_APROBADO | EN_PROCESO | LIBRE
  @@unique([scaleId, code])
  (elimina: isApproved bool, minValue, maxValue, isConceptual, numericValue)

GradingPeriodTemplate
  id, institutionId, level, modality, name, sortOrder, active
  @@unique([institutionId, level, modality, name])
  → dates: GradingPeriodDate[]

GradingPeriodDate
  id, templateId, cycleId (→ AcademicCycle.uuid), startDate, endDate
  @@unique([templateId, cycleId])
  (las fechas deben estar dentro del rango del AcademicCycle referenciado)
```

Los campos obsoletos `AcademicCycle.firstBim..fourthBim`, `CourseCycle.*Bim*`, `activeGradingPeriod`, `MateriaCarrera.periodActive`, `CompetencyValuation.periodActive` y las strings `1T/2T/3T` / `1C/2C/ANUAL` se declaran OBSOLETOS en esta fase pero NO se eliminan hasta la fase que los reemplace funcionalmente.

---

## Requisitos y escenarios

### REQ-1 — Ciclo de vida de escalas

Una escala identifica un conjunto de valores para calificar en un nivel+modalidad de una institución.
El nombre de la escala DEBE ser único por `(institutionId, level, modality)`.
Una escala con valores asociados activos NO PUEDE ser eliminada físicamente; se inactiva (soft delete).

#### Escenario 1.1 — Crear escala válida

- **Dado** un usuario con acceso `GRADING_CONFIG` sobre la institución A
- **Cuando** crea una escala con `name="Cualitativa"`, `level=PRIMARIO`, `modality=COMUN` para la institución A
- **Entonces** la escala se persiste con `active=true` y el sistema retorna `201 Created`

#### Escenario 1.2 — Nombre duplicado por (institución, nivel, modalidad)

- **Dado** que ya existe una escala `"Cualitativa"` para `(instituciónA, PRIMARIO, COMUN)`
- **Cuando** se intenta crear otra escala con los mismos `(institutionId, level, modality, name)`
- **Entonces** el sistema retorna `409 Conflict` con mensaje que identifica la colisión

#### Escenario 1.3 — Editar nombre de escala existente

- **Dado** una escala existente `"Cualitativa"` para `(instituciónA, PRIMARIO, COMUN)`
- **Cuando** se actualiza su nombre a `"Cualitativa Primaria"` (único en ese contexto)
- **Entonces** la escala se actualiza y el sistema retorna `200 OK`

#### Escenario 1.4 — Eliminar escala sin valores activos

- **Dado** una escala sin `GradeScaleValue` activos
- **Cuando** se solicita borrarla
- **Entonces** la escala se marca como `deletedAt != null` y retorna `200 OK`

#### Escenario 1.5 — Eliminar escala con valores activos

- **Dado** una escala con al menos un `GradeScaleValue` activo
- **Cuando** se solicita borrarla
- **Entonces** el sistema retorna `409 Conflict` indicando que tiene valores asociados

---

### REQ-2 — Ciclo de vida de valores de escala

Cada valor pertenece a exactamente una escala.
El campo `code` es alfanumérico libre y DEBE ser único dentro de la escala.
El campo `internalStatus` DEBE ser uno de los cuatro valores del enum fijo del sistema: `APROBADO`, `NO_APROBADO`, `EN_PROCESO`, `LIBRE`.
El campo `sortOrder` (entero ≥ 0) determina el orden de presentación.

#### Escenario 2.1 — Crear valor válido

- **Dado** una escala existente `"Cualitativa"`
- **Cuando** se crea un valor con `code="MB"`, `label="Muy Bueno"`, `internalStatus="APROBADO"`, `sortOrder=1`
- **Entonces** el valor se persiste vinculado a la escala y el sistema retorna `201 Created`

#### Escenario 2.2 — Estado interno fuera del enum

- **Dado** una escala existente
- **Cuando** se intenta crear un valor con `internalStatus="EXCELENTE"` (no pertenece al enum)
- **Entonces** el sistema retorna `422 Unprocessable Entity` con indicación del campo inválido

#### Escenario 2.3 — Código duplicado dentro de la escala

- **Dado** que ya existe un valor con `code="MB"` en la escala `"Cualitativa"`
- **Cuando** se intenta crear otro valor con `code="MB"` en la misma escala
- **Entonces** el sistema retorna `409 Conflict`

#### Escenario 2.4 — Código alfanumérico libre (letras y números)

- **Dado** una escala existente
- **Cuando** se crea un valor con `code="10"` y otro con `code="A+"` y otro con `code="Logrado"`
- **Entonces** todos son aceptados (no hay restricción de formato más allá de ser no-vacío)

#### Escenario 2.5 — Editar estado interno de un valor

- **Dado** un valor con `internalStatus="EN_PROCESO"`
- **Cuando** se actualiza a `internalStatus="NO_APROBADO"`
- **Entonces** el valor se actualiza y el sistema retorna `200 OK`

#### Escenario 2.6 — Borrar valor de escala

- **Dado** un valor existente
- **Cuando** se solicita borrarlo
- **Entonces** el valor se elimina (soft delete) y retorna `200 OK`

---

### REQ-3 — Consulta y filtrado de escalas

Las escalas son visibles para cualquier usuario con acceso `GRADING_CONFIG` sobre la institución.
Se PUEDE filtrar por `level` y/o `modality`.
La respuesta incluye los valores asociados ordenados por `sortOrder`.

#### Escenario 3.1 — Listar todas las escalas de una institución

- **Dado** un usuario con acceso `GRADING_CONFIG` sobre institución A (3 escalas)
- **Cuando** consulta `GET /grading/scales`
- **Entonces** retorna las 3 escalas activas con sus valores ordenados por `sortOrder`

#### Escenario 3.2 — Filtrar escalas por nivel y modalidad

- **Dado** escalas para `(PRIMARIO, COMUN)` y `(SECUNDARIO, COMUN)` en institución A
- **Cuando** consulta `GET /grading/scales?level=PRIMARIO&modality=COMUN`
- **Entonces** retorna únicamente las escalas de `(PRIMARIO, COMUN)`

#### Escenario 3.3 — Escala no encontrada

- **Dado** un UUID inexistente
- **Cuando** se consulta `GET /grading/scales/:id`
- **Entonces** el sistema retorna `404 Not Found`

---

### REQ-4 — Ciclo de vida de plantillas de períodos

Una plantilla define los períodos de calificación para un nivel+modalidad en una institución.
El nombre de la plantilla DEBE ser único por `(institutionId, level, modality)`.
Cada ítem de la plantilla tiene `name` (ej. `"1° Trimestre"`) y `sortOrder` (entero ≥ 1, sin duplicados dentro de la plantilla).
Una plantilla con fechas de período asociadas en ciclos activos NO PUEDE ser eliminada físicamente.

#### Escenario 4.1 — Crear plantilla con 3 ítems ordenados

- **Dado** un usuario con acceso `GRADING_CONFIG` sobre institución A
- **Cuando** crea una plantilla `"Trimestral Primaria"` para `(PRIMARIO, COMUN)` con ítems `["1° Trimestre" (1), "2° Trimestre" (2), "3° Trimestre" (3)]`
- **Entonces** la plantilla y sus 3 ítems se persisten y el sistema retorna `201 Created`

#### Escenario 4.2 — Nombre de plantilla duplicado

- **Dado** que ya existe la plantilla `"Trimestral Primaria"` para `(instituciónA, PRIMARIO, COMUN)`
- **Cuando** se intenta crear otra con el mismo nombre en el mismo contexto
- **Entonces** el sistema retorna `409 Conflict`

#### Escenario 4.3 — sortOrder con duplicados en la plantilla

- **Dado** una plantilla nueva
- **Cuando** se envían ítems con `sortOrder` repetido (ej. dos ítems con `sortOrder=1`)
- **Entonces** el sistema retorna `422 Unprocessable Entity`

#### Escenario 4.4 — Editar nombre de ítem de plantilla

- **Dado** una plantilla con ítem `"1° Trimestre"`
- **Cuando** se actualiza a `"Primer Trimestre"`
- **Entonces** el ítem se actualiza y retorna `200 OK`

#### Escenario 4.5 — Borrar plantilla sin fechas asociadas

- **Dado** una plantilla sin `GradingPeriodDate` asociadas
- **Cuando** se solicita borrarla
- **Entonces** se elimina (soft delete) con sus ítems y retorna `200 OK`

---

### REQ-5 — Fechas de período por ciclo lectivo

Las fechas concretas de cada ítem de una plantilla se cargan por ciclo lectivo (`AcademicCycle`).
Cada `GradingPeriodDate` vincula un ítem de plantilla con un ciclo específico y establece `startDate`/`endDate`.
Un ítem de plantilla PUEDE tener exactamente una entrada de fechas por ciclo (unicidad `[templateItemId, cycleId]`).
Ciclos distintos son independientes entre sí para la misma plantilla.

#### Escenario 5.1 — Cargar fechas de todos los ítems de una plantilla para un ciclo

- **Dado** una plantilla `"Trimestral Primaria"` con 3 ítems y el ciclo `"2025"`
- **Cuando** se envían las 3 entradas de fecha dentro del rango del ciclo
- **Entonces** las 3 `GradingPeriodDate` se persisten asociadas al ciclo `"2025"` y retorna `201 Created`

#### Escenario 5.2 — Editar fechas de un período para un ciclo existente

- **Dado** que el ítem `"1° Trimestre"` ya tiene fechas para el ciclo `"2025"`
- **Cuando** se actualiza su `endDate`
- **Entonces** la fecha se actualiza y retorna `200 OK`

#### Escenario 5.3 — Fechas de ciclo 2026 son independientes de ciclo 2025

- **Dado** que la plantilla tiene fechas cargadas para el ciclo `"2025"`
- **Cuando** se cargan fechas para el ciclo `"2026"` (distintos `startDate`/`endDate`)
- **Entonces** ambos conjuntos de fechas coexisten sin conflicto

---

### REQ-6 — Validaciones de integridad de fechas

Las fechas de período DEBEN respetar el rango del ciclo lectivo que las contiene.
Los períodos dentro de un mismo ciclo NO DEBEN solaparse entre sí.
El `startDate` de un período DEBE ser anterior a su `endDate`.

#### Escenario 6.1 — Fechas fuera del rango del ciclo lectivo

- **Dado** un ciclo `"2025"` con rango `2025-03-01..2025-12-15`
- **Cuando** se intenta guardar un período con `endDate=2026-01-10`
- **Entonces** el sistema retorna `422 Unprocessable Entity` indicando que la fecha supera el fin del ciclo

#### Escenario 6.2 — Solapamiento de fechas entre dos períodos del mismo ciclo

- **Dado** que el `"1° Trimestre"` del ciclo `"2025"` termina el `2025-06-30`
- **Cuando** se intenta guardar el `"2° Trimestre"` con `startDate=2025-06-15` (solapamiento)
- **Entonces** el sistema retorna `422 Unprocessable Entity` indicando el solapamiento

#### Escenario 6.3 — startDate posterior a endDate

- **Dado** cualquier período
- **Cuando** se envía `startDate=2025-08-01` y `endDate=2025-07-01`
- **Entonces** el sistema retorna `422 Unprocessable Entity`

---

### REQ-7 — Control de acceso — módulo GRADING_CONFIG

El módulo `GRADING_CONFIG` DEBE existir en el seed del sistema.
El acceso a cualquier endpoint de escalas y períodos REQUIERE rol ROOT o que el usuario tenga el módulo `GRADING_CONFIG` asignado (por rol o directamente).
Usuarios ROOT pueden operar sobre CUALQUIER institución usando el parámetro `?institutionId`.
Usuarios no-ROOT operan únicamente sobre su propia institución; el parámetro `?institutionId` es ignorado (o rechazado si apunta a otra institución).

#### Escenario 7.1 — ROOT accede a cualquier institución

- **Dado** un usuario ROOT
- **Cuando** consulta `GET /grading/scales?institutionId=inst-B`
- **Entonces** retorna las escalas de la institución B correctamente

#### Escenario 7.2 — Usuario con GRADING_CONFIG accede a su institución

- **Dado** un usuario DIRECTOR de institución A con módulo `GRADING_CONFIG`
- **Cuando** consulta `GET /grading/scales`
- **Entonces** retorna las escalas de institución A

#### Escenario 7.3 — Usuario sin GRADING_CONFIG es rechazado

- **Dado** un usuario DIRECTOR de institución A SIN módulo `GRADING_CONFIG`
- **Cuando** intenta `GET /grading/scales`
- **Entonces** el sistema retorna `403 Forbidden`

#### Escenario 7.4 — No-ROOT no puede operar sobre otra institución

- **Dado** un usuario DIRECTOR de institución A con módulo `GRADING_CONFIG`
- **Cuando** intenta `GET /grading/scales?institutionId=inst-B`
- **Entonces** el sistema retorna `403 Forbidden` (no puede ver datos de otra institución)

---

### REQ-8 — Mapeo HTTP consistente

Los endpoints de escalas y períodos DEBEN seguir las convenciones HTTP ya establecidas en el resto del sistema.

| Situación | Código esperado |
|---|---|
| Recurso creado | `201 Created` |
| Operación exitosa sin retorno de cuerpo | `204 No Content` |
| Recurso encontrado / actualizado | `200 OK` |
| Recurso no encontrado | `404 Not Found` |
| Nombre o código duplicado | `409 Conflict` |
| Payload inválido (enum, fechas, orden) | `422 Unprocessable Entity` |
| Sin autenticación | `401 Unauthorized` |
| Sin permisos | `403 Forbidden` |

#### Escenario 8.1 — Duplicado retorna 409

- **Dado** una escala con `name="Numérica"` para `(instituciónA, PRIMARIO, COMUN)`
- **Cuando** se intenta crear otra escala con el mismo nombre y contexto
- **Entonces** el sistema retorna `409 Conflict`

#### Escenario 8.2 — ID inexistente retorna 404

- **Dado** un UUID que no existe en la base de datos del tenant
- **Cuando** se consulta `GET /grading/scales/:uuid`
- **Entonces** el sistema retorna `404 Not Found`

#### Escenario 8.3 — Payload con campo requerido ausente retorna 422

- **Dado** una petición de creación de `GradeScaleValue` sin el campo `code`
- **Cuando** se envía el request
- **Entonces** el sistema retorna `422 Unprocessable Entity` indicando el campo faltante

---

## Invariantes de dominio (resumen)

1. `GradeScale.name` único por `(institutionId, level, modality)`.
2. `GradeScaleValue.code` alfanumérico no-vacío, único por escala.
3. `GradeScaleValue.internalStatus` ∈ `{APROBADO, NO_APROBADO, EN_PROCESO, LIBRE}` (enum fijo del sistema, no configurable por la institución).
4. `GradingPeriodTemplate.name` único por `(institutionId, level, modality)`.
5. `GradingPeriodTemplate` ítems: `sortOrder` únicos dentro de la plantilla, enteros ≥ 1.
6. `GradingPeriodDate`: un ítem de plantilla tiene máximo una entrada de fechas por ciclo.
7. Fechas de período: `startDate < endDate`; ambas dentro del rango del `AcademicCycle` referenciado; sin solapamiento entre períodos del mismo ciclo y plantilla.

---

## Relaciones con el modelo existente

- `Nota` referencia `GradeScaleValue` → la relación se preserva; el campo `isApproved` es reemplazado por `internalStatus`.
- `AcademicCycle.firstBim..fourthBim`, `CourseCycle.*Bim*`, `activeGradingPeriod`, `MateriaCarrera.periodActive`, `CompetencyValuation.periodActive`: QUEDAN EN SCHEMA pero se marcan como obsoletos. No se eliminan en esta fase.
- El front existente que lee esos campos obsoletos NO se modifica en esta fase.
