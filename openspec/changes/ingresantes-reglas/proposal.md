# Proposal: Ingresantes — Reglas de Estado, Nivel y Ciclo Obligatorio

## Intent

El flujo Ingresantes (aspirantes/admisión) no tiene spec formal: sus reglas viven en código. La máquina de estados (INSCRIPTO → PAGO_MATRICULA → ACEPTADO → INGRESO/NO_INGRESARA) la fuerza SOLO el frontend; la API permite saltar y retroceder estados. El `cycleId` es opcional, el `level` no se valida contra la institución, y el promote (ACEPTADO → crea Student + Enrollment → INGRESO) NO es transaccional: si falla el Enrollment, queda un Student huérfano. Es momento de endurecer y documentar: admisión es un proceso con dinero (matrícula) y datos sensibles donde un estado inconsistente o un alumno duplicado tiene costo real.

Nivel pedagógico afectado: ALL.

Éxito: la API rechaza transiciones inválidas (no solo el UI), el nivel y el ciclo son obligatorios y coherentes con el rol, el promote es atómico, y existe spec Given/When/Then + RFC 2119.

## Scope

### In Scope
- Forzar la secuencia de estados en el DOMINIO: progresión lineal sin saltos ni retrocesos; NO_INGRESARA desde cualquier estado no terminal; INGRESO y NO_INGRESARA terminales (inmutables); INGRESO solo vía promote.
- Nivel obligatorio según rol: ROOT y ADMIN eligen el nivel (allLevels del modelo de 3 puertas — ROOT todos, ADMIN entre los de su institución); el resto de los no-ROOT recibe su `userLevels[0].level` bloqueado (read-only).
- Ciclo lectivo obligatorio al crear: dropdown filtrado por nivel; ROOT ve todos los ciclos.
- Promote transaccional (Student + Enrollment + markIngreso en una transacción).
- Spec formal del flujo y sus reglas.

### Out of Scope
- Rediseño mayor del flujo de admisión (etapas nuevas, workflows configurables).
- Asignación masiva / promote en lote.
- Cambios al modelo de permisos (ENROLLMENTS / STUDENTS.CREATE se conservan).
- Unicidad de DNI en ingresantes (re-aplicación se mantiene).

## Approach

1. Mover la lógica de transición a la entidad/value object de estado (Result pattern), con un mapa de transiciones permitidas que la API valide antes de persistir.
2. Hacer `level` y `cycleId` obligatorios en DTO y dominio; resolver nivel por rol (patrón `userLevels[0]` ya usado en study-plans.tsx / course-sections.tsx) y filtrar ciclos por nivel en presentación.
3. Envolver el promote en transacción Prisma (tenant).
4. Redactar specs Given/When/Then + RFC 2119.

## Risks

| Riesgo | Mitigación |
|--------|------------|
| Volver `cycleId` obligatorio choca con ingresantes existentes sin ciclo | Definir migración/backfill o ciclo por defecto en design; decisión abierta |
| Forzar secuencia en API rechaza registros ya en estados "saltados" | Validar solo nuevas transiciones; relevar datos legacy antes de apply |
| `userLevels[0]` ignora usuarios con múltiples niveles | Asumir primer nivel; revisar si requiere selector para multi-nivel no-ROOT |
| Transacción en promote cambia semántica de errores parciales | Cubrir con tests de rollback en TDD |

## Rollback Plan

Cambios de dominio/API revertibles por git. Si hay migración/backfill de ciclo, prever migración inversa. Sin promote transaccional se vuelve al comportamiento previo (riesgo de huérfano) — aceptable como rollback temporal.
