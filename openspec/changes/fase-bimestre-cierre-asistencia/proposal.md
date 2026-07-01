# Proposal — Fase de bimestre + Cierre mensual de asistencia

- **Change name:** `fase-bimestre-cierre-asistencia`
- **Store:** hybrid (engram `sdd/fase-bimestre-cierre-asistencia/proposal` + este archivo)
- **Delivery:** auto-chain (PRs encadenados). Modo SDD automático. TDD estricto.
- **Nivel pedagógico afectado:** Capacidad A = PRIMARIO + SECUNDARIO. Capacidad B = ALL.

---

## 1. Intención

Introducir dos controles administrativos de consolidación de datos académicos, gobernados por Secretario o superior (rank >= 40), en un **único cambio** con **dos capacidades independientes**:

- **Capacidad A — Fase de calificación por curso (bimestre):** una máquina de estados por curso que gatea *qué se puede calificar* (bimestre vigente vs. notas especiales de cierre).
- **Capacidad B — Cierre mensual de asistencia por curso:** un candado por (curso, año, mes) que vuelve un mes de asistencia read-only total una vez consolidado/impreso.

Ambas capacidades comparten el mismo actor (Secretaría), la misma entidad ancla (CourseCycle, tenant) y las mismas superficies de UI (dashboard de cursos y de asistencia), por eso se planifican y entregan juntas. Pero son **ortogonales en su lógica**: la fase del bimestre NO afecta la asistencia, y el cierre mensual NO afecta la calificación.

## 2. Problema que resuelve

- **Hoy no existe ningún guard de fase.** Cualquier rol con acceso a calificación puede editar notas de cualquier bimestre en cualquier momento, incluso de boletines ya impresos. No hay forma de "cerrar" un período. El legacy `CourseCycle.activeGradingPeriod` (Int 1-4, `@deprecated`) no tiene UI ni enforcement, y **no puede representar el estado CIERRE** (solo notas especiales).
- **La asistencia mensual no tiene consolidación.** Un mes generado se puede seguir editando indefinidamente, sin garantía de integridad de lo ya impreso, y sin orden de avance (se puede editar un mes viejo mientras hay meses nuevos ya generados).

**Por qué ahora:** Secretaría necesita cerrar bimestres y meses de asistencia para el ciclo lectivo en curso, garantizando que lo impreso/consolidado no se altere.

## 3. Cómo se ve el éxito

- Secretaría activa una fase de bimestre por curso desde la fila de Cursos por Ciclo; la grilla de calificación queda gateada según la fase, en front y backend.
- Secretaría abre/cierra meses de asistencia por curso; un mes cerrado es read-only para TODOS (incluido admin) hasta reabrirlo.
- Ningún rol menor a Secretario ve los controles; ningún guard puede ser evadido desde el backend.
- Cobertura de tests >= 80%, suite verde (`pnpm test`), Clean Architecture respetada, sin mezclar schemas master/tenant.

---

## 4. Alcance

### IN scope

**Capacidad A — Fase de calificación por curso (PRIM + SEC):**
- Campo nuevo `gradingPhase` en `CourseCycle` (tenant): `NULL | BIM_1 | BIM_2 | BIM_3 | BIM_4 | CIERRE`. Una sola fase activa por curso. Reversible.
- Botón "Activar bimestre" + popup Modal en las filas de `web/src/pages/dashboard/course-cycles.tsx`, visible SOLO para Secretario+ y SOLO en niveles Primario/Secundario.
- Semántica de gateo (solo calificación, NUNCA asistencia):
  - `NULL`: no se puede calificar ningún bimestre (cutover duro — estado inicial en prod).
  - `BIM_n`: se califica SOLO ese bimestre; anteriores y futuros bloqueados; notas especiales bloqueadas.
  - `CIERRE`: no se califican bimestres; SOLO se editan notas especiales `SubjectFinalGrade` (FINAL/DICIEMBRE/MARZO/DEFINITIVA).
- Guards backend en los use-cases de calificación (`SubjectPeriodGrade` y `SubjectFinalGrade`) + deshabilitado de columnas en las grillas de front.
- Endpoint para leer/cambiar la fase (Secretario+).

**Capacidad B — Cierre mensual de asistencia (ALL niveles):**
- Modelo nuevo `AttendanceMonthStatus` (tenant): estado por `(courseCycleId, year, month)`, `@@unique([courseCycleId, year, month])`, default **abierto**.
- Botón abrir/cerrar mes en `web/src/pages/dashboard/asistencia-mensual.tsx`, SOLO Secretario+.
- Aplica a asistencia **general Y por materia**.
- Guards:
  - Registrar día bloqueado si el mes está cerrado (rechaza a TODOS, incluido admin — read-only total, solo impresión).
  - Generar un mes bloqueado si el mes previo generado no está cerrado (primer mes exento).
  - Reabrir: Secretario+ siempre, aun con mes siguiente ya generado.
- Control de asistencia = SOLO el estado abierto/cerrado del mes. La fase de bimestre es indiferente para asistencia.

### OUT of scope

- Migración/backfill de datos históricos para la fase de bimestre → **cutover duro**: al deployar, todos los cursos Prim/Sec quedan en `NULL` (bloqueados) hasta que Secretaría active uno por uno.
- Retiro del campo legacy `activeGradingPeriod` (se deja como está, `@deprecated`, sin tocar).
- Niveles Inicial y Terciario para la Capacidad A (excluidos por definición).
- Automatización del avance de bimestre/mes (todo cambio es manual y explícito de Secretaría).
- Reportería, notificaciones o auditoría de cambios de fase/cierre (fuera de este cambio).
- Cambios en el flujo de impresión de boletines/planillas (solo se respeta el read-only).

---

## 5. Capacidades del sistema afectadas

| Capacidad del sistema | Impacto | Capacidad del cambio |
|---|---|---|
| Calificación por período (`SubjectPeriodGrade`) | Nuevo guard de fase (bloquea/permite por bimestre) | A |
| Notas especiales (`SubjectFinalGrade`) | Nuevo guard: editables SOLO en fase CIERRE | A |
| Grillas de calificación (front by-course / by-subject) | Columnas deshabilitadas según fase | A |
| Dashboard Cursos por Ciclo | Nuevo botón + popup de activación de fase | A |
| Asistencia general (record-day) | Nuevo guard: rechaza si mes cerrado | B |
| Asistencia por materia (record-day) | Nuevo guard: rechaza si mes cerrado | B |
| Generación mensual de asistencia (`/asistencia-mensual/generate`) | Nuevo guard: mes previo debe estar cerrado | B |
| Dashboard Asistencia mensual | Nuevo botón abrir/cerrar mes | B |
| Autorización (RankGuard/useCan, rank>=40) | Reutilizada para ambos controles | A + B |
| Schema Prisma tenant | Campo nuevo (A) + modelo nuevo (B) | A + B |

## 6. Impacto en niveles pedagógicos

- **Capacidad A (fase de bimestre):** PRIMARIO + SECUNDARIO únicamente. INICIAL y TERCIARIO NO se ven afectados (no ven el botón, no se gatea su calificación por esta vía).
- **Capacidad B (cierre mensual de asistencia):** ALL (todos los niveles que tengan asistencia mensual). La restricción de nivel es exclusiva de la Capacidad A.

---

## 7. Aproximación (alto nivel — el detalle técnico va en sdd-design)

- **Clean Architecture estricta:** el estado de fase y de cierre son conceptos de **dominio** (value objects / enums self-validating con Result pattern), consumidos por use-cases de aplicación que exponen puertos de autorización de escritura (extendiendo el patrón `AssignmentAuthorizerPort` existente). La persistencia (campo `gradingPhase`, modelo `AttendanceMonthStatus`) vive en infraestructura Prisma **tenant**. La presentación (controllers Nest + páginas React) solo orquesta.
- **Autorización reutilizada:** backend con `@Rank(40)` / RankGuard; front con `useCan()` + `user.roles`. No se introduce un nuevo modelo de permisos.
- **Enforcement en dos capas:** el front deshabilita/oculta (UX), pero la verdad la imponen los guards backend (seguridad). Ambos deben cubrirse con tests.
- **Ortogonalidad:** los guards de calificación NO consultan `AttendanceMonthStatus`, y los guards de asistencia NO consultan `gradingPhase`. Son dos máquinas de estado separadas sobre la misma entidad ancla.
- **Validación de entrada con Zod; sin mezclar schemas master/tenant.**

## 8. Estrategia de entrega (PRs encadenados — auto-chain)

Cambio grande (probable > 400 líneas). Se divide en 4 slices encadenados; si un slice excede el presupuesto se subdivide automáticamente:

1. **Backend fase-bimestre (A):** dominio (enum/VO de fase) + campo Prisma `gradingPhase` + use-cases + guards de calificación + endpoint fase + tests.
2. **Front fase-bimestre (A):** botón + popup en `course-cycles.tsx`, deshabilitado de columnas en grillas de calificación, gating por `useCan()` + nivel + tests.
3. **Backend cierre-mes (B):** modelo `AttendanceMonthStatus` + use-cases abrir/cerrar/reabrir + guards de record-day (general y materia) + guard de generación + tests.
4. **Front cierre-mes (B):** botón abrir/cerrar mes en `asistencia-mensual.tsx`, estados read-only, gating por `useCan()` + tests.

Orden: A antes que B no es obligatorio (son independientes), pero se sugiere backend-antes-que-front dentro de cada capacidad. Único checkpoint humano: revisar el estado final ANTES del deploy (el usuario deploya).

## 9. Rollback plan

**Principio general:** ninguno de los dos artefactos de datos destruye información existente al aplicarse, por lo que el rollback no pierde datos académicos. El riesgo real es de *comportamiento* (gateo activo/inactivo), no de *pérdida de datos*.

### Capacidad A — campo `gradingPhase`
- **Revertir código (guards):** desplegar la versión anterior de los use-cases de calificación. Sin los guards, la calificación vuelve al comportamiento actual (todo editable). El campo `gradingPhase` queda en la tabla pero es inerte (nadie lo lee).
- **Revertir schema:** el campo es **aditivo y nullable** (`gradingPhase NULL` por default). NO hace falta dropearlo para volver atrás; se puede dejar huérfano sin romper nada. Si se decide dropearlo, es una migración tenant de una sola columna sin FKs.
- **CUTOVER DURO — advertencia crítica:** al aplicar la Capacidad A, todos los cursos Prim/Sec quedan en `NULL` = **calificación bloqueada** hasta que Secretaría active fase por curso. Si se necesita rollback de emergencia y Secretaría YA activó fases, revertir el código de guards **restaura la edición completa** (el estado guardado en `gradingPhase` se ignora); al re-aplicar, cada curso recupera su última fase persistida (no se re-cutover-ea porque el dato sigue ahí). El único escenario de fricción es el primer deploy: coordinar con Secretaría para activar fases rápido y no bloquear la operación.

### Capacidad B — modelo `AttendanceMonthStatus`
- **Revertir código (guards):** desplegar la versión anterior de los use-cases de asistencia. Sin los guards, todos los meses vuelven a ser editables (comportamiento actual). Las filas de `AttendanceMonthStatus` quedan inertes.
- **Revertir schema:** el modelo es **una tabla nueva independiente** (default abierto, `@@unique[courseCycleId,year,month]`, sin alterar las tablas de asistencia existentes `asistenciaXAlumnoXCursoXCiclo` / `asistenciaXMateriaXAlumnoXCursoXCiclo`). Dropear la tabla en una migración tenant NO afecta ningún dato de asistencia real. Como el default es **abierto**, la ausencia de fila = mes abierto, por lo que incluso con la tabla vacía el sistema opera normal.
- **Sin fricción de cutover:** a diferencia de A, el default abierto significa que aplicar B NO bloquea nada retroactivamente; solo bloquea meses que Secretaría cierre explícitamente.

### Orden de rollback recomendado
1. Revertir código (guards) primero — restaura el comportamiento en segundos, sin tocar la DB.
2. Solo si se requiere limpieza total, dropear columna (`gradingPhase`) y tabla (`AttendanceMonthStatus`) vía migraciones tenant separadas. Ninguna toca datos académicos.

## 10. Riesgos y preguntas abiertas

- **Cutover duro de A:** el primer deploy bloquea toda la calificación Prim/Sec hasta activación manual → coordinar con Secretaría (mitigable, no bloqueante).
- **Coexistencia con legacy `activeGradingPeriod`:** hay que asegurar que ningún camino de código siga leyendo el Int legacy para decidir gateo (definir en design).
- **Ortogonalidad estricta:** verificar en tests que el cruce fase↔asistencia NO ocurre (regresión típica).
- **Nombre final del enum/modelo y forma exacta del endpoint:** se resuelve en sdd-spec/sdd-design.
- **Read-only total del mes cerrado incluye admin:** confirmar que no queda ningún bypass (ej. endpoints internos o de importación) fuera del guard.
