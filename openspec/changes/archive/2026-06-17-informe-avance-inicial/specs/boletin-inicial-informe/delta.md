# Delta Spec: Boletín de Nivel Inicial — Wire-up a InformeEvolutivo

> Fase: sdd-spec · Change: informe-avance-inicial · Store: hybrid · 2026-06-17
> Enfoque: Approach A (wire-up, sin migración de schema)
> Nivel afectado: INICIAL únicamente

---

## 1. Contexto del delta

### Estado ANTES

El boletín de Nivel Inicial cae al path legacy `buildMaterias → NotaTrimestral / SubjectAssignment`. Ese path es numérico e inválido para Inicial: el boletín se genera vacío o con datos incorrectos. Es un bug en producción.

### Estado DESPUÉS (lo que este spec exige)

Para alumnos de Nivel Inicial, el boletín lee `InformeEvolutivo` (entidad ya existente). `NotaTrimestral` / `SubjectAssignment` ya no se tocan en este path. Los demás niveles son inalterados.

### Entidades existentes relevantes (sin cambio de schema)

```
InformeEvolutivo
  studentId       String
  salaId          String
  periodo         String   // "1T" | "2T" | "3T"
  fecha           DateTime
  observacionesGenerales  String?
  areas           AreaDesarrollo[]

AreaDesarrollo
  area            String            // free-string hoy; enum diferido (P1)
  observacion     String            // narrativa
  valoracion      String            // "DESTACADO"|"LOGRADO"|"EN_PROCESO"|"NO_LOGRADO"
```

### Determinación de Nivel Inicial

Un alumno es de Nivel Inicial cuando `Math.floor(enrollment.student.level / 10) === 1`.

---

## 2. Requisitos (RFC 2119)

### REQ-BOL-I-01 — Fuente de datos para Inicial

Para un alumno de Nivel Inicial, `GenerateBoletinUseCase` MUST obtener los datos de áreas exclusivamente desde `InformeEvolutivo`. El use-case MUST NOT leer `NotaTrimestral` ni `SubjectAssignment` en este path.

### REQ-BOL-I-02 — Campos por área en el DTO de salida

El DTO de salida del boletín de Inicial MUST contener, por cada `AreaDesarrollo` del informe encontrado:

- `area` — nombre del área (string)
- `observacion` — narrativa descriptiva (string)
- `valoracion` — nivel de logro (string; uno de los cuatro valores de la entidad)

### REQ-BOL-I-03 — observacionesGenerales en el DTO de salida

Cuando el `InformeEvolutivo` tenga `observacionesGenerales`, el DTO de salida MUST incluirlo. Cuando esté ausente, el campo MUST ser `undefined` o `null` (no string vacío ni error).

### REQ-BOL-I-04 — Ausencia de campos inválidos para Inicial

El boletín de Inicial MUST NOT incluir nota numérica, columna "Docente", ni lógica de aprobado/reprobado en ninguna capa (DTO, template, HTML de salida).

### REQ-BOL-I-05 — Generación sin excepción cuando no hay informe

Si no existe un `InformeEvolutivo` para el alumno y período solicitados, `GenerateBoletinUseCase` MUST retornar un boletín válido con lista de áreas vacía y `observacionesGenerales` ausente. El use-case MUST NOT lanzar una excepción. El endpoint HTTP MUST retornar 2xx.

### REQ-BOL-I-06 — No regresión en otros niveles

Los boletines de Primario, Secundario y Terciario MUST NOT verse afectados por este cambio. Los tipos de salida compartidos extendidos con campos opcionales MUST ser compatibles hacia atrás: los path existentes de otros niveles MUST ignorar los nuevos campos sin error de compilación ni runtime.

### REQ-BOL-I-07 — Sin cambio de schema Prisma

Este change MUST NOT incluir migraciones Prisma. El modelo `InformeEvolutivo` y `AreaDesarrollo` se usan tal como están en el schema tenant actual.

### REQ-BOL-I-08 — Extensión aditiva de tipos de salida

`MateriaBoletin` MUST ser extendido con `observacion?: string`. `DatosBoletin` MUST ser extendido con `observacionesGenerales?: string`. Ambos campos son opcionales para preservar compatibilidad con los path de otros niveles.

### REQ-BOL-I-09 — InformeRepository como dependencia inyectable

`GenerateBoletinUseCase` MUST aceptar `InformeRepository` como parámetro opcional en su constructor, siguiendo el patrón de repos opcionales ya establecido en el use-case. Las instanciaciones existentes sin `InformeRepository` MUST continuar funcionando sin modificación.

### REQ-BOL-I-10 — Campo periodo en el boletín de Inicial

El campo `periodo` en el output del boletín de Inicial MUST mostrar el trimestre del informe (ej. `"1T"`, `"2T"`, `"3T"`). MUST NOT mostrar el año académico en su lugar (bug actual).

### REQ-BOL-I-11 — Template boletin-inicial.hbs

El template `boletin-inicial.hbs` MUST ser reescrito para renderizar:

- `observacionesGenerales` (cuando presente)
- Por cada área: nombre (`area`), narrativa (`observacion`), valoración (`valoracion`)

El template MUST NOT renderizar la columna "Docente" (el campo `Sala.teacherId` fue removido en S3b-1).

### REQ-BOL-I-12 — Cobertura de tests (Strict TDD)

MUST existir tests unitarios para los 4 use-cases de `InformeEvolutivo` (hoy ausentes). MUST existir un test de integración/unit del boletín Inicial que aserte: (a) `InformeRepository` es invocado, (b) `NotaTrimestral`/`SubjectAssignment` NO es invocado para level 1. Cobertura global MUST NOT bajar del 80 %.

### REQ-BOL-I-13 — Batch hereda el fix sin arm propio

`GenerateBoletinBatchUseCase` delega en `GenerateBoletinUseCase.execute()`. Este cambio MUST NOT requerir un arm adicional en el batch. El batch MUST heredar el fix automáticamente por delegación.

---

## 3. Ítems DESIGN-OWNED (resueltos en sdd-design, no en este spec)

Los siguientes puntos son deliberadamente ambiguos en este spec porque su resolución requiere una decisión de diseño con tradeoffs técnicos:

| ID | Decisión pendiente |
|----|--------------------|
| D1 | **Selección de período**: ¿el boletín renderiza UN trimestre (el solicitado) o agrega los TRES informes del año? |
| D2 | **Mapeo enrollment → salaId/periodo**: ¿cómo se construye el filtro para el lookup en `InformeRepository.findAll`? ¿De dónde sale `salaId`? |

El spec exige el **comportamiento observable** (REQ-BOL-I-01 al 13); el HOW del mapeo queda en design.

---

## 4. Escenarios de aceptación

### Escenario 1 — Inicial con informe existente

```
Given  un alumno de Nivel Inicial (level tal que Math.floor(level/10) === 1)
  And  existe un InformeEvolutivo con 3 AreaDesarrollo y observacionesGenerales para ese alumno y período
When   se ejecuta GenerateBoletinUseCase para ese alumno y período
Then   el DTO de salida contiene exactamente 3 ítems en la lista de áreas
  And  cada ítem contiene los campos: area (string), observacion (string), valoracion (string)
  And  el DTO contiene observacionesGenerales con el valor del informe
  And  ningún ítem contiene nota numérica ni campo "docente"
  And  el campo periodo del DTO es el trimestre (ej. "2T"), no el año académico
```

### Escenario 2 — Inicial sin informe (estado vacío, sin crash)

```
Given  un alumno de Nivel Inicial
  And  NO existe InformeEvolutivo para ese alumno y período solicitado
When   se ejecuta GenerateBoletinUseCase para ese alumno y período
Then   el use-case retorna un boletín con lista de áreas vacía []
  And  observacionesGenerales es undefined o null (no string vacío)
  And  NO se lanza excepción
  And  el endpoint HTTP responde 2xx
```

### Escenario 3 — Inicial no toca NotaTrimestral

```
Given  un alumno de Nivel Inicial
  And  existen NotaTrimestral registradas en BD para ese alumno (legacy)
  And  también existe un InformeEvolutivo para ese alumno y período
When   se ejecuta GenerateBoletinUseCase para ese alumno y período
Then   InformeRepository.findAll (o equivalente) ES invocado
  And  el repositorio/query de NotaTrimestral / SubjectAssignment NO es invocado en este path
```

### Escenario 4 — No regresión Primario

```
Given  un alumno de Nivel Primario (Math.floor(level/10) === 2)
  And  existen SubjectAssignment y NotaTrimestral para ese alumno (path legacy válido)
When   se ejecuta GenerateBoletinUseCase para ese alumno
Then   el boletín se genera con los mismos datos que antes de este change
  And  los campos observacion y observacionesGenerales son undefined en el DTO de salida
  And  InformeRepository NO es invocado
```

### Escenario 5 — Template renderiza correctamente

```
Given  un DatosBoletin con:
         periodo: "2T"
         observacionesGenerales: "El grupo mostró buena integración."
         materias: [{ area: "COGNITIVA", observacion: "Avanzó en reconocimiento...", valoracion: "LOGRADO" }]
When   se renderiza boletin-inicial.hbs con esos datos
Then   el HTML resultante contiene el texto de observacionesGenerales
  And  por el área "COGNITIVA" contiene: nombre, texto de observacion, texto "LOGRADO"
  And  el HTML NO contiene la columna "Docente"
  And  el HTML muestra "2T" como período (no el año)
```

### Escenario 6 — Compilación TypeScript sin errores

```
Given  código existente de generación de boletines para Primario/Secundario/Terciario
         que construye MateriaBoletin sin los campos observacion u observacionesGenerales
When   se ejecuta tsc --noEmit
Then   no hay errores de compilación TypeScript
```

### Escenario 7 — Batch hereda fix sin arm propio

```
Given  GenerateBoletinBatchUseCase configurado con el mismo GenerateBoletinUseCase corregido
  And  un alumno de Nivel Inicial en el batch con InformeEvolutivo disponible
When   se ejecuta el batch
Then   el boletín de ese alumno renderiza los datos del InformeEvolutivo
  And  NO hay arm ni branch adicional en GenerateBoletinBatchUseCase para Inicial
```

---

## 5. Scope explícito de este spec

### IN scope

- `GenerateBoletinUseCase` — dispatch Inicial + `buildMateriasInicial` + inyección opcional de `InformeRepository`
- `MateriaBoletin` / `DatosBoletin` — extensión aditiva con campos opcionales
- `boletin-inicial.hbs` — reescritura completa del template
- Tests unitarios de los 4 use-cases de `InformeEvolutivo`
- Test de no-regresión del path Primario/Secundario/Terciario
- Corrección del campo `periodo` en el output de Inicial

### OUT scope (deferred)

- P1 — Enum/VO de Área (área como free-string es aceptable para este MVP)
- P2 — Authz self-service de docente (SalaXDocente); admin-only es suficiente para el MVP
- P3 — VO de valoración
- P4 — Alineación con `GradingPeriodDate` / deprecación formal de `periodo`
- P5 — Estado "No evaluado" distinguible de "sin informe"
- P6 — Workflow borrador → publicado
- Drop de `NotaTrimestral` (frozen-legacy: solo deja de leerse en el path Inicial)

---

## 6. Dependencias

| Dependencia | Estado |
|-------------|--------|
| `InformeEvolutivo` (entidad + repo + use-cases + controller + módulo) | Existente — no cambia |
| `AreaDesarrollo` (entidad) | Existente — no cambia |
| Schema Prisma tenant (`InformeEvolutivo`) | Existente — no cambia |
| `GenerateBoletinUseCase` | Modificado (IN scope) |
| `boletin-inicial.hbs` | Reescrito (IN scope) |
| `NotaTrimestral` / `SubjectAssignment` | Sin cambio — solo se deja de leer en path Inicial |
