# Proposal: Autollenado de "P" en días hábiles al Generar

## Intent

Hoy Generar crea la grilla mensual con días hábiles VACÍOS: el preceptor tipea "P" celda por celda, tarea repetitiva y propensa a error. Queremos que Generar autollene con Presente ("P") toda celda de día HÁBIL vacía, en los dos modos (General por curso y Por Materia), sin pisar jamás lo que ya cargó un docente. Valor: menos carga manual, menos omisiones, misma UX del botón existente.

## Scope

### In Scope
- Regla única: "poner Presente en toda celda de día HÁBIL VACÍA; nunca pisar valor existente".
- Modo **General (Curso)**: `generate-monthly-attendance.use-case`.
- Modo **Por Materia**: la generación materializada dentro del mismo `generate`.
- Resolver el `AttendanceType` Presente REAL por nivel del curso (no string hardcodeado).
- Grilla nueva y grilla ya generada (topear solo vacíos en filas existentes).

### Out of Scope
- Feriados (siguen marcándose a mano post-generación; ya tienen valor → se saltan).
- Autollenar valores distintos de Presente (A/T/etc.).
- Cambios de UI más allá del comportamiento del botón "Generar" existente.
- Autollenado en mes CERRADO (se omite; ver Approach).

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `attendance-recording`: al generar la grilla mensual, los días hábiles vacíos SHALL quedar prellenados con el AttendanceType Presente del nivel; NUNCA se sobrescribe un valor existente. Aplica a ambos ejes (curso y materia). Referencia `attendance-types` para el código Presente.

## Approach

- **Helper de dominio puro** en `packages/domain/src/asistencia/utils/` (junto a `calendar-utils`): `fillHabilVacios(days, presenteCode, year, month): Record<string,string>`. Usa `buildLockedDayMap` para saber qué días NO son hábiles; para cada día 1..daysInMonth que NO esté en el lockedMap y cuya key esté ausente en `days`, setea `presenteCode`. Función pura, inmutable, sin I/O.
- **Resolución del Presente por nivel**: en `application/`, un port ya existente de AttendanceTypes resuelve, para el nivel del curso, el tipo con `behavior = NO_COMPUTA` y código Presente (típicamente "P"). Devuelve `Result<AttendanceType, PresenteTypeNotFoundError>`.
- **Nivel sin tipo Presente**: NO hacer skip silencioso → devolver `Result` con `PresenteTypeNotFoundError` (contexto: nivel, courseCycleId). El use-case corta y mapea a error claro en el borde (HTTP 4xx), sin throw en domain/application.
- **Semántica idempotente**: cambia. Hoy `generate` saltea filas existentes; pasa a "asegurar filas + topear hábiles vacíos". Sigue siendo idempotente en resultado (correr dos veces no cambia nada: la 2da no encuentra vacíos).
- **Mes CERRADO**: si el estado (CC, year, month) es CLOSED, NO autollenar (grilla read-only). El use-case verifica antes de escribir y omite/rechaza según semántica actual de generate sobre mes cerrado.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/domain/src/asistencia/utils/` | New | `fillHabilVacios` puro + tests |
| `api/src/application/asistencia/use-cases/generate-monthly-attendance.use-case.ts` | Modified | Resolver Presente, aplicar fill (curso y materia), manejar Result de error |
| `application/` port AttendanceTypes | Modified/Used | Resolver Presente por nivel (behavior NO_COMPUTA) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Pisar datos de docentes al cambiar idempotencia | High impact / Low | Regla "solo si key ausente"; tests de no-sobrescritura |
| Nivel sin tipo Presente configurado | Med | Error claro con Result, no skip silencioso |
| Feriado marcado DESPUÉS de generar queda como "P" | Med | Fuera de scope; feriado se marca a mano y pisa la P |
| Divergencia curso vs materia | Med | Mismo helper en ambos ejes |

## Rollback Plan

Revertir el commit: `generate` vuelve a saltear filas existentes y crear hábiles vacíos. El helper de dominio queda sin usar (o se elimina). No hay migración de datos: las "P" ya escritas son valores válidos y no requieren limpieza.

## Dependencies

- Port/repositorio de `AttendanceType` que exponga resolución por nivel + `behavior`.

## Success Criteria

- [ ] Generar en grilla nueva → todos los hábiles vacíos quedan en "P" (curso y materia).
- [ ] Generar en grilla ya cargada → solo vacíos reciben "P"; valores docentes intactos.
- [ ] SAB/DOM/X/feriado nunca reciben "P".
- [ ] Nivel sin Presente → error claro (Result), sin throw, sin escritura parcial.
- [ ] Mes CERRADO → no se autollena.
- [ ] Cobertura ≥ 80% en helper y use-case (TDD).
