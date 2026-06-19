# Proposal: vencimiento-regularidad-terciario

> Phase: sdd-propose · Date: 2026-06-18 · Artifact store: hybrid · Change 2 of 2

## Intent

La regularidad (estado `REGULAR`) de una materia de Terciario hoy no caduca: un alumno
puede rendir el final indefinidamente. La normativa exige que la regularidad **venza tras
N llamados de examen** (configurable, default 5) contados desde el primer turno posterior
a la aprobación de la cursada. El change 1 (`llamados-examen-terciario`, ya mergeado) modeló
los turnos como entidad de primera clase. Ahora corresponde aplicar la regla de vencimiento.

**Éxito**: una materia con regularidad vencida (a) no puede rendir el final como regular
(error de dominio explícito) y (b) deja de listarse como vigente en el boletín — efecto
equivalente al que el usuario describió como "debe recursar / queda LIBRE".

## Scope

**In-scope**
- `InscripcionMateria.fechaRegularidad DateTime?` (schema + entity), escrito por
  `ConfirmarNotaCursadaUC` cuando `condicion = REGULAR`.
- `Carrera.llamadosVencimiento Int @default(5)` (schema + entity) — config por carrera/tenant.
- Regla de vencimiento en `FinalEligibilityPolicy.check()` (nuevo paso de guard).
- Nuevo `RegularidadVencidaError` de dominio.
- Conteo de llamados vía `LlamadoExamenRepository.findByAnioAcademico` (turnos con
  `fechaInicio > fechaRegularidad`).
- Integración en `buildMateriasTerciario` (boletín): excluir regulares vencidas del listado vigente.

**Out-of-scope**
- Cron / background job — el vencimiento es CALCULADO al vuelo.
- Cambio de estado persistido (no se escribe `REGULAR → LIBRE` en DB).
- Nuevo estado `VENCIDA` (la expiry es derivada).
- Re-regularización tras vencimiento (futuro).
- FK `ActaExamen → LlamadoExamen` (la asociación por fecha alcanza; FK diferida).

## Approach

**On-the-fly (Approach A del explore).** El estado en DB sigue siendo `REGULAR`; el
vencimiento se DERIVA en el momento del guard y del boletín. Regla: contar los
`LlamadoExamen` activos con `fechaInicio > fechaRegularidad`; si ese conteo
`>= carrera.llamadosVencimiento`, la regularidad está vencida. El caller
(`RegistrarNotaFinalUC` / boletín) carga el conteo y `llamadosVencimiento` y los pasa a la
policy, que permanece pura (sin I/O). Encaja con el patrón funcional existente de
`FinalEligibilityPolicy` y no requiere scheduler.

**Backfill**: las inscripciones `REGULAR` preexistentes tienen `fechaRegularidad = NULL` →
se tratan como **NO vencidas** (default seguro, no rompe regularidades históricas).

## Dependencies

- Change 1 `llamados-examen-terciario` — **DONE/mergeado**. Aporta `LlamadoExamen` +
  `findByAnioAcademico` (activos, orden `fechaInicio ASC`), el building block del conteo.

## Risks / Open Questions

- **Backfill NULL**: `fechaRegularidad = NULL` ⇒ no vencida. Asumido seguro; confirmar que
  no se requiere migración de datos retroactiva.
- **Boundary "primer turno posterior"**: el conteo usa `fechaInicio > fechaRegularidad`
  (estricto). Validar el caso límite cuando la aprobación cae dentro de un llamado en curso.
- **Display en boletín** (no decidido): excluir silenciosamente vs. mostrar con etiqueta
  "VENCIDA". Lean: excluir, consistente con la regla de "boletín = vigentes".
- **Estado `VENCIDA` distinto** para auditoría (futuro): la expiry derivada alcanza por ahora.
