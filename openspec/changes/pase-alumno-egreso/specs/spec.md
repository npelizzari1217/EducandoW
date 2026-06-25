# Spec — pase-alumno-egreso

Schema: spec-driven  
RFC 2119 applies throughout this document.  
Scenarios use Given/When/Then format as required by `openspec/config.yaml`.  
**Nivel pedagógico afectado: ALL** — el pase es del alumno, agnóstico al nivel pedagógico (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO).

---

## Non-goals (explicit)

- El pase NO es una transferencia cross-tenant. No se mueve ni copia datos del alumno a otra institución.
- El schema **master** NO DEBE ser modificado en este change.
- "Quitar" conserva su semántica de hard DELETE de la inscripción; su significado no cambia.
- El alumno NO es eliminado ni desactivado al registrar el pase.
- No se filtra el alumno del listado al registrar el pase; permanece visible (tachado).

---

## S-1 — Domain model: Student.fecha_de_pase

### Requirement

La entidad `Student` del schema **tenant** MUST incluir el campo `fecha_de_pase` de tipo `TIMESTAMPTZ`, nullable.  
El campo vive en `Student`, NO en `AlumnosXCursoXCiclo` (inscripción). El pase es GLOBAL al alumno.  
Cuando `fecha_de_pase IS NOT NULL`, el alumno tiene un pase activo.  
Cuando `fecha_de_pase IS NULL`, el alumno no tiene pase (estado por defecto).

### Scenarios

**S-1-A: Campo existe en la tabla Student**  
Given el schema tenant Prisma  
When se inspecciona el modelo `Student`  
Then el campo `fecha_de_pase` MUST estar presente con tipo `DateTime?` (nullable TIMESTAMPTZ)  
And su valor por defecto MUST ser `null`.

**S-1-B: Pase activo vs inactivo**  
Given un alumno con `fecha_de_pase = '2026-06-01T00:00:00Z'`  
When cualquier capa del sistema evalúa si el alumno tiene pase activo  
Then la condición `fecha_de_pase IS NOT NULL` MUST ser la única fuente de verdad.

**S-1-C: Campo en el domain entity**  
Given el tipo de dominio `Student` (en `packages/domain`)  
When se inspecciona su definición TypeScript  
Then MUST incluir `fechaDePase: Date | null`  
(camelCase en dominio; snake_case `fecha_de_pase` en la tabla Prisma).

---

## S-2 — Use case: Registrar pase

### Requirement

MUST existir un use case `RegistrarPaseUseCase` (en `application`) que reciba un identificador de inscripción (`AlumnosXCursoXCiclo.id`, aquí llamado `rowId`) y una fecha de pase, resuelva el `studentId` correspondiente, y actualice `Student.fecha_de_pase` en el cliente **tenant**.

El use case MUST delegar la persistencia a un puerto de repositorio (`StudentRepository`) y MUST validar la entrada con Zod antes de ejecutar.

### Scenarios

**S-2-A: Pase registrado correctamente**  
Given un `rowId` de inscripción válido que referencia a un alumno existente  
And una `fecha` válida (ej. `'2026-06-01'`)  
When `RegistrarPaseUseCase.execute({ rowId, fecha })` se invoca  
Then el repositorio MUST llamar `updateFechaDePase(studentId, fecha)`  
And el campo `Student.fecha_de_pase` MUST quedar seteado a esa fecha  
And el use case MUST retornar el alumno actualizado (o un Result con el dato).

**S-2-B: rowId inexistente**  
Given un `rowId` que no existe en `AlumnosXCursoXCiclo`  
When `RegistrarPaseUseCase.execute({ rowId, fecha })` se invoca  
Then el use case MUST retornar un error de tipo `NotFound` (o equivalente del Result pattern)  
And NO MUST modificar ningún registro de Student.

**S-2-C: Alumno ya tiene pase activo (idempotencia)**  
Given un alumno con `fecha_de_pase` ya seteada  
And se registra un nuevo pase con una fecha diferente  
When `RegistrarPaseUseCase.execute` se invoca  
Then el campo `fecha_de_pase` MUST ser actualizado a la nueva fecha (el pase es sobrescribible)  
And NO MUST crearse un registro duplicado.

---

## S-3 — Validación de fecha (Zod)

### Requirement

La entrada del comando de pase MUST ser validada con un schema Zod antes de llegar al use case (en el controller) y también dentro del use case.  
La validación MUST cubrir: presencia de la fecha, formato de fecha válido, y rango permitido.  
La fecha MUST NOT ser posterior a la fecha actual (today en UTC). El backend MUST rechazar fechas futuras con HTTP 400.  
Solo se permiten fechas iguales o anteriores a hoy (past o today). No se admiten pases programados a futuro.

### Scenarios

**S-3-A: Fecha ausente → error de validación**  
Given un request sin campo `fecha` (o `fecha: null` / `fecha: undefined`)  
When el schema Zod valida la entrada  
Then MUST retornar un error de validación con mensaje que indique que `fecha` es requerida  
And el controller MUST responder HTTP 422 Unprocessable Entity.

**S-3-B: Fecha con formato inválido → error de validación**  
Given un request con `fecha: "no-es-fecha"`  
When el schema Zod valida la entrada  
Then MUST retornar un error de validación con mensaje que indique formato inválido  
And el controller MUST responder HTTP 422.

**S-3-C: Fecha ISO 8601 válida (pasado) → aceptada**  
Given un request con `fecha: "2025-03-15"`  
When el schema Zod valida la entrada  
Then MUST aceptarla sin error (fechas en el pasado están permitidas).

**S-3-D: Fecha futura → rechazada con HTTP 400, sin persistir**  
Given un request con `fecha: "2027-12-31"` (cualquier fecha posterior a today en UTC)  
When el schema Zod valida la entrada  
Then MUST retornar un error de validación que indique que la fecha no puede ser futura  
And el controller MUST responder HTTP 400 Bad Request  
And NO MUST persistirse ningún cambio en `Student.fecha_de_pase`.

**S-3-E: Fecha igual a hoy (UTC) → aceptada**  
Given un request con `fecha` igual a la fecha actual en UTC (ej. `"2026-06-25"`)  
When el schema Zod valida la entrada  
Then MUST aceptarla sin error (today está dentro del rango permitido).

**S-3-F: Fecha como datetime completo en el pasado → aceptada**  
Given un request con `fecha: "2026-06-01T00:00:00.000Z"` (datetime en el pasado)  
When el schema Zod valida la entrada  
Then MUST aceptarla; el sistema MUST almacenarla como TIMESTAMPTZ en UTC.

---

## S-4 — Use case: Revertir pase

### Requirement

MUST existir un mecanismo para revertir el pase, seteando `Student.fecha_de_pase = null`.  
El revert MAY ser parte del mismo `RegistrarPaseUseCase` (con `fecha: null`) o un use case separado `RevertirPaseUseCase`.  
El comportamiento MUST ser simétrico: tras el revert, el alumno queda como si nunca hubiera tenido pase.

### Scenarios

**S-4-A: Revertir pase activo → fecha_de_pase null**  
Given un alumno con `fecha_de_pase IS NOT NULL`  
When la operación de revert se invoca (con `rowId` del alumno)  
Then `Student.fecha_de_pase` MUST ser seteado a `null`  
And el alumno MUST ya NO considerarse con pase activo.

**S-4-B: Revertir en alumno sin pase → sin efecto, sin error**  
Given un alumno con `fecha_de_pase IS NULL`  
When la operación de revert se invoca  
Then la operación MUST completar sin error (idempotente)  
And `fecha_de_pase` MUST permanecer `null`.

**S-4-C: Tras revertir, "Quitar" vuelve a estar disponible**  
Given un alumno cuyo pase fue revertido (fecha_de_pase = null)  
When el listado se renderiza  
Then el botón "Quitar" MUST estar habilitado para ese alumno (ver S-5).

---

## S-5 — Guard: Eliminar inscripción rechazado cuando hay pase

### Requirement

Cuando un alumno tiene `fecha_de_pase IS NOT NULL`, la operación de eliminar su inscripción ("Quitar") MUST ser rechazada.  
El rechazo MUST ser doble: la UI deshabilita el botón Y el backend MUST rechazar el request si se intenta (defensa en profundidad).

### Scenarios

**S-5-A: DELETE rechazado en backend cuando hay pase**  
Given un alumno con `fecha_de_pase IS NOT NULL`  
When se recibe un DELETE request sobre su inscripción (endpoint "Quitar")  
Then el backend MUST retornar HTTP 409 Conflict  
And el mensaje de error MUST indicar que el alumno tiene un pase activo  
And la fila en `AlumnosXCursoXCiclo` MUST permanecer intacta.

**S-5-B: DELETE permitido cuando NO hay pase**  
Given un alumno con `fecha_de_pase IS NULL`  
When se recibe un DELETE request sobre su inscripción  
Then el backend MUST procesar el DELETE normalmente (comportamiento preexistente sin cambios).

**S-5-C: UI — botón "Quitar" deshabilitado con pase activo**  
Given un alumno con `fecha_de_pase IS NOT NULL` en el listado  
When se renderiza la fila del alumno  
Then el botón "Quitar" MUST tener el atributo `disabled`  
And SHOULD tener apariencia visual que indique deshabilitado (ej. color muted, no pointer cursor).

**S-5-D: UI — botón "Quitar" habilitado sin pase**  
Given un alumno con `fecha_de_pase IS NULL`  
When se renderiza la fila del alumno  
Then el botón "Quitar" MUST estar habilitado y operativo.

---

## S-6 — Query: Listado con fechaDePase y posición preservada

### Requirement

La query `findByCourseCycleEnriched` (o equivalente) que alimenta `AlumnosCursoCicloPanel` MUST retornar `fechaDePase` para cada alumno.  
El orden del listado MUST permanecer alfabético (sort preexistente); los alumnos con pase MUST mantener su posición relativa — NO se mueven al final.

### Scenarios

**S-6-A: Campo fechaDePase presente en cada ítem del listado**  
Given una query al repositorio para un `cursoCicloId`  
When el resultado se mapea a DTO  
Then cada ítem MUST incluir `fechaDePase: Date | null`  
And para alumnos sin pase, el valor MUST ser `null`.

**S-6-B: Campo fechaDePase con valor correcto para alumno con pase**  
Given un alumno con `fecha_de_pase = '2026-06-01T00:00:00Z'` inscripto en el cursoXciclo  
When la query retorna su fila  
Then `fechaDePase` MUST ser `new Date('2026-06-01T00:00:00Z')` (o su representación serializada equivalente).

**S-6-C: Posición en el listado inalterada**  
Given un listado con alumnos [A, B, C] ordenados alfabéticamente  
And el alumno B recibe un pase  
When el listado se vuelve a renderizar  
Then el orden MUST ser [A, B, C] (B tachado en su lugar)  
And B NOT MUST moverse al final ni a una sección separada.

**S-6-D: Tipo DTO incluye fechaDePase**  
Given el DTO de respuesta del endpoint de listado (TypeScript)  
When se inspecciona su definición  
Then MUST incluir `fechaDePase: string | null` (serializado como ISO 8601 string en JSON)  
And NOT MUST ser `undefined`.

---

## S-7 — Marca global: pase visible en todos los cursos/ciclos del alumno

### Requirement

Dado que `fecha_de_pase` vive en `Student` (no en la inscripción), el pase es GLOBAL.  
Un alumno con pase activo MUST aparecer tachado en TODOS los paneles `AlumnosCursoCicloPanel` donde esté inscripto, sin importar el curso, ciclo o nivel pedagógico.

### Scenarios

**S-7-A: Alumno tachado en curso/ciclo A cuando el pase fue registrado desde curso/ciclo B**  
Given el alumno X está inscripto en el cursoXcicloA y en el cursoXcicloB  
And el pase se registra desde la vista de cursoXcicloB  
When se accede a la vista de cursoXcicloA  
Then el alumno X MUST aparecer tachado en cursoXcicloA también  
And `fechaDePase` MUST mostrarse en la columna "Fecha de pase" de cursoXcicloA.

**S-7-B: Revertir en cualquier panel revierte la marca en todos**  
Given el alumno X tiene pase activo y aparece tachado en cursoXcicloA y cursoXcicloB  
When el pase se revierte desde la vista de cursoXcicloA  
Then el alumno X MUST dejar de aparecer tachado en AMBOS paneles  
And `fechaDePase` MUST ser `null` en la query de ambos paneles.

---

## S-8 — UI: Botón "Pase" y modal de fecha

### Requirement

Cada fila del panel `AlumnosCursoCicloPanel` MUST mostrar un botón **"Pase"** junto a los botones existentes ("Asignar materias", "Asignar competencias", "Quitar").  
Al hacer clic, MUST abrirse un modal que solicite la fecha del pase.  
Si el alumno ya tiene pase activo, el botón SHOULD cambiar su estado/label para indicarlo (ej. "Quitar pase") a fin de permitir el revert.

### Scenarios

**S-8-A: Botón "Pase" presente en cada fila**  
Given el panel `AlumnosCursoCicloPanel` renderiza  
When se inspecciona una fila de alumno sin pase  
Then MUST existir un botón con texto "Pase" (o label equivalente definida en design)  
And MUST estar habilitado y clickeable.

**S-8-B: Click en "Pase" abre modal con input de fecha**  
Given una fila de alumno sin pase  
When el usuario hace clic en el botón "Pase"  
Then MUST aparecer un modal  
And el modal MUST contener un input de tipo fecha (date picker o date input)  
And MUST contener botones de confirmación y cancelación.

**S-8-C: Confirmar modal con fecha válida → pase registrado**  
Given el modal está abierto con `fecha = '2026-06-01'`  
When el usuario confirma  
Then MUST invocarse la llamada al endpoint PATCH  
And al recibir respuesta exitosa (2xx), el modal MUST cerrarse  
And la fila MUST actualizarse sin recargar la página completa.

**S-8-D: Cancelar modal → sin cambios**  
Given el modal está abierto  
When el usuario cancela  
Then el modal MUST cerrarse  
And NO MUST realizarse ninguna llamada al endpoint  
And el estado del alumno MUST permanecer sin cambios.

**S-8-E: Error de validación client-side → mensaje en modal**  
Given el modal está abierto y la fecha está vacía  
When el usuario intenta confirmar  
Then el modal NOT MUST cerrarse  
And MUST mostrar un mensaje de error que indique que la fecha es requerida  
And NOT MUST realizarse ninguna llamada al endpoint.

**S-8-F: Alumno con pase activo — acceso al revert desde UI**  
Given una fila de alumno con pase activo (`fechaDePase IS NOT NULL`)  
When se renderiza la fila  
Then MUST existir un control visible que permita revertir el pase  
(MAY ser el mismo botón "Pase" en estado activo, MAY ser un botón "Quitar pase" separado — a definir en design)  
And dicho control MUST estar habilitado y operativo.

---

## S-9 — UI: Fila tachada y columnas "Pase" / "Fecha de pase"

### Requirement

Cuando un alumno tiene pase activo, su fila en el listado MUST ser renderizada con texto tachado (CSS `text-decoration: line-through`).  
El panel MUST mostrar dos columnas adicionales: **"Pase"** (indica si hay pase activo, ej. checkbox o ícono) y **"Fecha de pase"** (la fecha formateada).

### Scenarios

**S-9-A: Fila tachada para alumno con pase**  
Given un alumno con `fechaDePase IS NOT NULL` en el listado  
When su fila se renderiza  
Then el contenido de la fila MUST tener estilo `text-decoration: line-through` aplicado  
(SHOULD aplicarse al nombre y datos del alumno, no a los botones de acción).

**S-9-B: Fila normal para alumno sin pase**  
Given un alumno con `fechaDePase IS NULL` en el listado  
When su fila se renderiza  
Then la fila NOT MUST tener `text-decoration: line-through`.

**S-9-C: Columna "Pase" presente**  
Given el panel `AlumnosCursoCicloPanel` renderiza  
When se inspeccionan los encabezados de la tabla  
Then MUST existir una columna con header `"Pase"`.

**S-9-D: Columna "Fecha de pase" presente**  
Given el panel `AlumnosCursoCicloPanel` renderiza  
When se inspeccionan los encabezados de la tabla  
Then MUST existir una columna con header `"Fecha de pase"`.

**S-9-E: Celda "Fecha de pase" muestra fecha formateada**  
Given un alumno con `fechaDePase = '2026-06-01T00:00:00Z'`  
When se renderiza su celda "Fecha de pase"  
Then MUST mostrar la fecha en formato legible (ej. `01/07/2026` o `1 jul 2026` — formato exacto a definir en design)  
And NOT MUST mostrar el string ISO crudo ni `null`/`undefined`.

**S-9-F: Celda "Fecha de pase" vacía para alumno sin pase**  
Given un alumno con `fechaDePase IS NULL`  
When se renderiza su celda "Fecha de pase"  
Then MUST mostrar una celda vacía o un guion (`—`)  
And NOT MUST mostrar `null` o `undefined` como texto.

**S-9-G: Celda "Pase" indica estado**  
Given un alumno con pase activo  
When se renderiza la celda "Pase"  
Then MUST mostrar un indicador positivo (ej. ✓, ícono, o el texto "Sí")  
And para alumnos sin pase MUST mostrar ausencia del indicador (vacío o "No").

---

## S-10 — Migración Prisma (aditiva, solo tenant)

### Requirement

MUST existir una migración Prisma **aditiva** en el schema **tenant** que añada la columna `fecha_de_pase TIMESTAMPTZ NULL` a la tabla `Student`.  
La migración MUST ser generada con `prisma migrate dev` (nunca editada a mano).  
La migración MUST ser aplicable en una base de datos existente sin pérdida de datos.  
El schema **master** MUST NOT ser modificado.

### Scenarios

**S-10-A: Columna añadida como nullable**  
Given una base de datos tenant existente sin la columna  
When la migración se aplica  
Then la tabla `Student` MUST tener la columna `fecha_de_pase` con tipo `TIMESTAMPTZ` y `DEFAULT NULL`  
And todas las filas existentes MUST tener `fecha_de_pase = NULL` (sin error).

**S-10-B: Rollback factible**  
Given la migración ha sido aplicada  
When se necesita revertir el change  
Then `DROP COLUMN fecha_de_pase` MUST ser suficiente para deshacer la migración  
And no MUST perderse ningún dato preexistente.

**S-10-C: Schema master sin cambios**  
Given el change es aplicado  
When se inspecciona `api/prisma_master/`  
Then MUST NOT existir ninguna nueva migración en el schema master.

---

## S-11 — Endpoint HTTP (contrato mínimo)

### Requirement

MUST existir un endpoint PATCH que acepte el `rowId` de una inscripción (`AlumnosXCursoXCiclo`) y una fecha, resuelva el `studentId` internamente, y actualice `Student.fecha_de_pase`.  
El endpoint MUST estar protegido por autenticación (igual que los endpoints existentes del panel).  
La forma exacta de la ruta se define en design; la spec solo define el contrato de comportamiento.

### Scenarios

**S-11-A: PATCH exitoso → 200 con dato actualizado**  
Given un `rowId` válido y una `fecha` válida en el body  
When el endpoint PATCH es invocado  
Then MUST retornar HTTP 200  
And el body de respuesta MUST incluir al menos `studentId` y `fechaDePase` actualizados.

**S-11-B: Body inválido (ausente o formato incorrecto) → 422**  
Given un body sin `fecha` o con `fecha` de formato inválido (ej. `"no-es-fecha"`)  
When el endpoint PATCH es invocado  
Then MUST retornar HTTP 422 con detalle de los errores de validación Zod.

**S-11-E: Fecha futura en body → 400, sin persistir**  
Given un body con `fecha` de formato válido pero posterior a today en UTC (ej. `"2027-12-31"`)  
When el endpoint PATCH es invocado  
Then MUST retornar HTTP 400 Bad Request con mensaje que indique que la fecha no puede ser futura  
And `Student.fecha_de_pase` MUST permanecer sin cambios.

**S-11-C: rowId no encontrado → 404**  
Given un `rowId` que no existe en `AlumnosXCursoXCiclo`  
When el endpoint PATCH es invocado  
Then MUST retornar HTTP 404.

**S-11-D: PATCH para revertir → fecha null**  
Given un alumno con pase activo  
And el body tiene `fecha: null` (o el endpoint de revert recibe el rowId sin fecha)  
When el endpoint de revert es invocado  
Then MUST setear `Student.fecha_de_pase = null`  
And retornar HTTP 200 con `fechaDePase: null`.

---

## Traceability matrix

| Spec  | Requirement origin                                                                 |
|-------|------------------------------------------------------------------------------------|
| S-1   | Decision 2 (campo en Student, no en inscripción; pase GLOBAL)                      |
| S-2   | Scope: use-case registrar pase; Decision 4 (Clean/Hexagonal)                       |
| S-3   | Scope: validación Zod; decisión usuario (fecha futura MUST NOT, HTTP 400)          |
| S-4   | Instrucciones spec (pase reversible → fecha_de_pase null)                          |
| S-5   | Instrucciones spec ("Quitar" deshabilitado Y backend rechaza)                      |
| S-6   | Scope: findByCourseCycleEnriched; instrucciones spec (posición inalterada)         |
| S-7   | Decision 2 (pase GLOBAL); Decision 3 (nivel ALL)                                  |
| S-8   | Scope: UI botón Pase + modal fecha                                                 |
| S-9   | Scope: fila tachada, columnas "Pase" y "Fecha de pase"                            |
| S-10  | Scope: migración aditiva solo tenant; Decision 1 y 2                              |
| S-11  | Scope: endpoint PATCH; instrucciones spec (contrato HTTP mínimo)                  |
