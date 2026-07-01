# Spec (delta) — Fase de bimestre + Cierre mensual de asistencia

- **Change name:** `fase-bimestre-cierre-asistencia`
- **Store:** hybrid (engram `sdd/fase-bimestre-cierre-asistencia/spec` + este archivo)
- **Basado en:** `openspec/changes/fase-bimestre-cierre-asistencia/proposal.md`
- **Convención:** Given/When/Then + RFC 2119 (MUST/SHALL/SHOULD/MAY). Cada AC es verificable de forma aislada.
- **Rank hierarchy (referencia):** ROOT=99, ADMIN=60, DIRECTOR=50, SECRETARIO=40, PRECEPTOR=30, TEACHER=20. "Secretario+" = rank >= 40 (SECRETARIO, DIRECTOR, ADMIN, ROOT).

Este documento describe QUÉ debe ser verdad después de aplicar el cambio. No prescribe implementación (eso vive en sdd-design).

---

## Capacidad A — Fase de calificación por curso (bimestre)

**Nivel pedagógico:** PRIMARIO + SECUNDARIO. INICIAL y TERCIARIO quedan fuera de esta capacidad (no ven controles, no se gatea su calificación por esta vía).

### Requisitos normativos

- El sistema MUST exponer un estado `gradingPhase` por `CourseCycle` (tenant) con valores `NULL | BIM_1 | BIM_2 | BIM_3 | BIM_4 | CIERRE`.
- El sistema MUST garantizar que solo una fase esté activa por curso en un momento dado (no hay estado compuesto).
- El sistema MUST permitir activar cualquier fase (`BIM_1..BIM_4`, `CIERRE`) exclusivamente a usuarios con rank >= 40 (Secretario+).
- El sistema MUST rechazar la activación de fase para roles con rank < 40 (PRECEPTOR, TEACHER), tanto en backend como ocultando el control en front.
- El sistema MUST restringir la visibilidad y el efecto del control de fase a cursos de nivel PRIMARIO o SECUNDARIO. Para niveles INICIAL y TERCIARIO, el control MUST NOT estar disponible y ningún guard de fase MUST aplicarse.
- El sistema MUST permitir revertir `CIERRE` hacia cualquier `BIM_n` (transición reversible), exclusivamente para Secretario+.
- El sistema MUST gatear ÚNICAMENTE la calificación (`SubjectPeriodGrade` y `SubjectFinalGrade`). El sistema MUST NOT usar `gradingPhase` para gatear ningún aspecto de asistencia.
- Cuando `gradingPhase = NULL`, el sistema MUST rechazar toda operación de calificación de `SubjectPeriodGrade` para cualquier bimestre (cutover duro).
- Cuando `gradingPhase = BIM_n`, el sistema MUST permitir calificar `SubjectPeriodGrade` SOLO para el período `n`, y MUST rechazar la calificación de cualquier otro período (anteriores y futuros), y MUST rechazar la edición de `SubjectFinalGrade`.
- Cuando `gradingPhase = CIERRE`, el sistema MUST rechazar toda calificación de `SubjectPeriodGrade` (cualquier bimestre) y MUST permitir ÚNICAMENTE la edición de `SubjectFinalGrade` (tipos FINAL, DICIEMBRE, MARZO, DEFINITIVA).
- El sistema MUST aplicar el guard de fase en backend (use-case), independientemente de si el front deshabilita o no los controles de UI.
- El sistema MUST NOT usar el campo legacy `CourseCycle.activeGradingPeriod` (Int 1-4, deprecated) para ningún guard nuevo de esta capacidad.

### Escenarios de aceptación

**AC-A-1 — Activar fase: permitido a Secretario+**
- Given un `CourseCycle` de nivel SECUNDARIO con `gradingPhase = NULL`, y un usuario con rol SECRETARIO (rank 40)
- When el usuario activa la fase `BIM_1`
- Then el sistema SHALL persistir `gradingPhase = BIM_1` para ese curso y SHALL responder éxito.

**AC-A-2 — Activar fase: rechazado a rol menor (PRECEPTOR)**
- Given un `CourseCycle` de nivel PRIMARIO con `gradingPhase = NULL`, y un usuario con rol PRECEPTOR (rank 30)
- When el usuario intenta activar la fase `BIM_1` (vía backend, aunque el botón esté oculto en front)
- Then el sistema SHALL rechazar la operación con un error de autorización y SHALL NOT modificar `gradingPhase`.

**AC-A-3 — Activar fase: rechazado a rol menor (TEACHER)**
- Given un `CourseCycle` de nivel SECUNDARIO con `gradingPhase = BIM_2`, y un usuario con rol TEACHER (rank 20)
- When el usuario intenta activar `CIERRE`
- Then el sistema SHALL rechazar la operación con un error de autorización y SHALL NOT modificar `gradingPhase`.

**AC-A-4 — Nivel sin acceso: INICIAL**
- Given un `CourseCycle` de nivel INICIAL, y un usuario con rol SECRETARIO (rank 40)
- When el usuario intenta activar cualquier fase sobre ese curso
- Then el sistema SHALL rechazar la operación (o el control SHALL NOT estar disponible) porque la Capacidad A no aplica a nivel INICIAL.

**AC-A-5 — Nivel sin acceso: TERCIARIO**
- Given un `CourseCycle` de nivel TERCIARIO, y un usuario con rol DIRECTOR (rank 50)
- When el usuario intenta activar cualquier fase sobre ese curso
- Then el sistema SHALL rechazar la operación (o el control SHALL NOT estar disponible) porque la Capacidad A no aplica a nivel TERCIARIO.

**AC-A-6 — Una sola fase activa: activar otra desactiva la anterior**
- Given un `CourseCycle` de nivel PRIMARIO con `gradingPhase = BIM_2`
- When Secretaría activa `BIM_3`
- Then el sistema SHALL dejar `gradingPhase = BIM_3` (única fase activa) y `BIM_2` SHALL dejar de estar activo, sin estado transitorio con dos fases activas.

**AC-A-7 — CIERRE es reversible a bimestre**
- Given un `CourseCycle` con `gradingPhase = CIERRE`
- When Secretaría activa `BIM_4`
- Then el sistema SHALL permitir la transición y SHALL dejar `gradingPhase = BIM_4`.

**AC-A-8 — Guard de calificación: BIM_n permite solo el período n**
- Given un `CourseCycle` con `gradingPhase = BIM_2`
- When un docente autorizado intenta registrar `SubjectPeriodGrade` para el período 2
- Then el sistema SHALL aceptar la calificación.

**AC-A-9 — Guard de calificación: BIM_n rechaza otros períodos**
- Given un `CourseCycle` con `gradingPhase = BIM_2`
- When un docente autorizado intenta registrar `SubjectPeriodGrade` para el período 1 o para el período 3
- Then el sistema SHALL rechazar ambas operaciones con un error de fase inválida.

**AC-A-10 — Guard de calificación: NULL bloquea todo (cutover duro)**
- Given un `CourseCycle` recién migrado con `gradingPhase = NULL`
- When un docente autorizado intenta registrar `SubjectPeriodGrade` para cualquier período (1 a 4)
- Then el sistema SHALL rechazar la operación indicando que no hay fase activa.

**AC-A-11 — Guard de calificación: CIERRE rechaza bimestres**
- Given un `CourseCycle` con `gradingPhase = CIERRE`
- When un docente autorizado intenta registrar `SubjectPeriodGrade` para cualquier período
- Then el sistema SHALL rechazar la operación.

**AC-A-12 — Guard de calificación: CIERRE permite SOLO SubjectFinalGrade**
- Given un `CourseCycle` con `gradingPhase = CIERRE`
- When Secretaría (o rol autorizado) registra `SubjectFinalGrade` de tipo FINAL, DICIEMBRE, MARZO o DEFINITIVA
- Then el sistema SHALL aceptar la operación para los 4 tipos.

**AC-A-13 — Guard de notas especiales: rechazado fuera de CIERRE**
- Given un `CourseCycle` con `gradingPhase = BIM_1` (o `NULL`)
- When se intenta registrar `SubjectFinalGrade` de cualquier tipo
- Then el sistema SHALL rechazar la operación porque las notas especiales solo son editables en fase `CIERRE`.

**AC-A-14 — Ortogonalidad: la fase NO afecta asistencia**
- Given un `CourseCycle` con `gradingPhase = NULL` (bloqueado para calificar)
- When un preceptor autorizado registra asistencia del día para ese curso
- Then el sistema SHALL aceptar el registro de asistencia sin considerar el valor de `gradingPhase`, siempre que el mes de asistencia correspondiente esté abierto (Capacidad B).

---

## Capacidad B — Cierre mensual de asistencia por curso

**Nivel pedagógico:** ALL (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO).

### Requisitos normativos

- El sistema MUST exponer un estado de asistencia mensual por `(courseCycleId, year, month)`, con valor por defecto **abierto** cuando no existe registro explícito.
- El sistema MUST permitir abrir y cerrar un mes exclusivamente a usuarios con rank >= 40 (Secretario+).
- El sistema MUST rechazar el cierre/apertura de mes para roles con rank < 40.
- Cuando un mes está cerrado, el sistema MUST rechazar el registro de asistencia (día) tanto general como por materia, para CUALQUIER rol, incluidos ADMIN, DIRECTOR y ROOT — sin excepción ni bypass.
- Cuando un mes está cerrado, el sistema MUST permitir únicamente operaciones de lectura e impresión sobre ese mes.
- El sistema MUST rechazar la generación de un nuevo mes de asistencia si el mes previamente generado para ese `courseCycle` no está cerrado.
- El sistema MUST permitir la generación del primer mes de un ciclo (sin mes previo generado) sin requerir cierre previo.
- El sistema MUST permitir reabrir un mes cerrado exclusivamente a Secretario+, incluso si ya existe un mes posterior generado.
- El sistema MUST aplicar el guard de cierre de mes en backend, independientemente del estado de la UI.
- El sistema MUST NOT usar `gradingPhase` (Capacidad A) para decidir si un mes de asistencia está abierto o cerrado, y viceversa.

### Escenarios de aceptación

**AC-B-1 — Abrir/cerrar mes: permitido a Secretario+**
- Given un mes de asistencia (courseCycle, 2026, 6) en estado abierto, y un usuario con rol SECRETARIO
- When el usuario cierra el mes
- Then el sistema SHALL persistir el mes como cerrado y SHALL responder éxito.

**AC-B-2 — Abrir/cerrar mes: rechazado a PRECEPTOR**
- Given un mes de asistencia en estado abierto, y un usuario con rol PRECEPTOR (rank 30)
- When el usuario intenta cerrar el mes
- Then el sistema SHALL rechazar la operación con un error de autorización.

**AC-B-3 — Abrir/cerrar mes: rechazado a TEACHER**
- Given un mes de asistencia en estado abierto, y un usuario con rol TEACHER (rank 20)
- When el usuario intenta cerrar el mes
- Then el sistema SHALL rechazar la operación con un error de autorización.

**AC-B-4 — Mes cerrado bloquea registro general para TODOS (incluido ADMIN)**
- Given un mes de asistencia cerrado para un `courseCycle`
- When un usuario con rol ADMIN (rank 60) intenta registrar asistencia general de un día de ese mes
- Then el sistema SHALL rechazar la operación indicando que el mes está cerrado, sin excepción por rank.

**AC-B-5 — Mes cerrado bloquea registro por materia para TODOS**
- Given un mes de asistencia cerrado para un `courseCycle`
- When un docente o preceptor autorizado intenta registrar asistencia por materia de un día de ese mes
- Then el sistema SHALL rechazar la operación indicando que el mes está cerrado.

**AC-B-6 — Mes cerrado: ROOT tampoco tiene bypass**
- Given un mes de asistencia cerrado para un `courseCycle`
- When un usuario con rol ROOT (rank 99) intenta registrar asistencia (general o por materia) de un día de ese mes
- Then el sistema SHALL rechazar la operación; el read-only del mes cerrado MUST NOT tener excepción por rol, incluido ROOT.

**AC-B-7 — Mes cerrado: lectura e impresión permitidas**
- Given un mes de asistencia cerrado
- When cualquier rol con acceso de lectura consulta o solicita impresión de la planilla de ese mes
- Then el sistema SHALL permitir la operación de solo lectura.

**AC-B-8 — Generar mes: rechazado si el previo no está cerrado**
- Given un `courseCycle` con el mes (2026, 5) ya generado y en estado abierto (no cerrado)
- When Secretaría intenta generar el mes (2026, 6)
- Then el sistema SHALL rechazar la generación indicando que el mes previo debe cerrarse primero.

**AC-B-9 — Generar mes: permitido si el previo está cerrado**
- Given un `courseCycle` con el mes (2026, 5) generado y cerrado
- When Secretaría genera el mes (2026, 6)
- Then el sistema SHALL aceptar la generación y SHALL crear el mes (2026, 6) en estado abierto por defecto.

**AC-B-10 — Generar el primer mes del ciclo: exento de la validación de cierre previo**
- Given un `courseCycle` sin ningún mes de asistencia generado previamente
- When Secretaría genera el primer mes (ej. 2026, 3)
- Then el sistema SHALL aceptar la generación sin exigir cierre de un mes previo (no existe).

**AC-B-11 — Reabrir mes: permitido a Secretario+ aun con mes siguiente generado**
- Given un `courseCycle` con el mes (2026, 5) cerrado y el mes (2026, 6) ya generado (abierto)
- When Secretaría reabre el mes (2026, 5)
- Then el sistema SHALL aceptar la reapertura y SHALL dejar (2026, 5) en estado abierto, sin afectar el estado de (2026, 6).

**AC-B-12 — Reabrir mes: rechazado a rol menor**
- Given un `courseCycle` con el mes (2026, 5) cerrado, y un usuario con rol PRECEPTOR
- When el usuario intenta reabrir el mes
- Then el sistema SHALL rechazar la operación con un error de autorización.

**AC-B-13 — Estado por defecto: mes sin registro explícito es abierto**
- Given un `courseCycle` sin fila de estado para (2026, 4) en el store de cierre mensual
- When se consulta el estado de asistencia de ese mes
- Then el sistema SHALL considerarlo abierto por defecto y SHALL permitir el registro de asistencia.

**AC-B-14 — Aplica a TODOS los niveles pedagógicos**
- Given un `courseCycle` de nivel INICIAL o TERCIARIO con un mes cerrado
- When se intenta registrar asistencia de ese mes
- Then el sistema SHALL rechazar la operación igual que en PRIMARIO/SECUNDARIO, porque la Capacidad B no distingue nivel pedagógico.

**AC-B-15 — Ortogonalidad: el cierre de mes NO depende de la fase de bimestre**
- Given un `courseCycle` de nivel SECUNDARIO con `gradingPhase = CIERRE` (calificación bloqueada) y el mes de asistencia (2026, 6) abierto
- When un preceptor autorizado registra asistencia de un día de ese mes
- Then el sistema SHALL aceptar el registro de asistencia, ya que el guard de asistencia MUST NOT consultar `gradingPhase`.

---

## Edge cases adicionales (no cubiertos arriba)

- **Límite de mes/año:** el sistema MUST tratar el estado de cierre como scoped a `(courseCycleId, year, month)` — cerrar diciembre de 2026 MUST NOT afectar diciembre de 2027 ni el mismo mes de otro `courseCycle`.
- **Transición de fase sin curso asociado a nivel válido:** si se intenta activar fase sobre un `courseCycle` inexistente o de nivel no soportado, el sistema MUST responder un error de validación (no un guard silencioso).
- **DIRECTOR (rank 50) y ADMIN (rank 60):** ambos MUST poder activar fase (Capacidad A) y abrir/cerrar/reabrir mes (Capacidad B), por ser rank >= 40. Ningún guard de estas capacidades MUST tratar a DIRECTOR/ADMIN de forma distinta a SECRETARIO salvo el propio umbral de rank.
- **ROOT:** para Capacidad A (activar fase), ROOT MUST tener acceso igual que Secretario+ (rank 99 >= 40). Para Capacidad B, ROOT MUST poder abrir/cerrar/reabrir mes, pero MUST NOT tener bypass del read-only de un mes cerrado para *registrar* asistencia (ver AC-B-6): el rol que abre/cierra el candado no es el mismo permiso que el de saltarlo estando cerrado.

## Fuera de alcance de esta spec

- No se especifica backfill de datos históricos (cutover duro, ver proposal §9).
- No se especifica retiro del campo legacy `activeGradingPeriod`.
- No se especifica reportería, notificaciones o auditoría de cambios de fase/cierre.
- Detalle de forma de endpoints, nombres de enum/modelo Prisma y estructura de puertos de autorización: se resuelve en `sdd-design`.
