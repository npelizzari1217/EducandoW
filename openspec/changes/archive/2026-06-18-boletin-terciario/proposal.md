# Proposal: Boletín Terciario (Fase C)

**Nivel pedagógico afectado:** TERCIARIO
**Capacidades:** generación de boletín PDF (`GenerateBoletinUseCase`), plantilla `boletin-terciario.hbs`.

## Intent
Hoy el boletín Terciario sale siempre vacío: cae en el else legacy de `buildMaterias()` que lee `CourseCycles → NotaTrimestral`, tablas que no existen para Terciario. Fase A+B (`evaluacion-terciario`) ya construyó `NotaCursadaTerciario` y `ActaExamenNota.intento`, así que ahora podemos cablear el boletín correcto. **Éxito:** un alumno de Terciario obtiene un PDF que funciona como TRANSCRIPCIÓN de sus materias vigentes al momento de pedirlo.

## Scope
**In:**
- Semántica de transcripción con reglas de inclusión confirmadas:
  - INCLUIR aprobadas con final (REGULAR/PROMOCIONAL/APROBADO).
  - INCLUIR regulares con TP aprobado que adeudan final.
  - INCLUIR en curso ese año (INSCRIPTO/CURSANDO, parciales en progreso).
  - EXCLUIR las que no aprobaron la cursada (LIBRE → recursa).
- Branch decade-4 (Terciario) en `buildMaterias()` ANTES del else legacy.
- Nuevo `buildMateriasTerciario()` con include chains de Prisma (Approach A).
- Header de carrera (Q2): join `InscripcionMateria → MateriaCarrera → Carrera.name`, fallback `enrollment.grade`.
- Cuatrimestres (Q3): mostrar 1C y 2C del año, agrupados.
- Tipos opcionales en `MateriaBoletin` (`slotsCursada`, `notaCursadaConfirmada`, `condicionCursada`, `intentosFinales`) y rediseño de `boletin-terciario.hbs`.

**Out (explícito):**
- **Vencimiento de regularidad** — no existe modelo de expiración hoy; se difiere a un change aparte. No se filtra por vencido.
- **Retiro del path legacy `NotaTrimestral`** para otros niveles.
- **Entrada de docente** / carga de notas.

## Approach
Approach A: agregar `private async buildMateriasTerciario(client, enrollment)` que arma la cadena `Enrollment → InscripcionMateria (filtrada por studentId + anioAcademico) → MateriaCarrera/Subject + NotaCursadaTerciario[] + ActaExamenNota[] (vía ActaExamen, con intento)`. Sin cambios de DI ni de `reportes.module.ts`; espeja el patrón legacy/Inicial existente. El branch de dispatch se inserta antes del else para que Terciario deje de caer en el camino roto.

## Dependencies
Depende de `evaluacion-terciario` (PR #23, branch `feat/evaluacion-terciario`, NO mergeado). `NotaCursadaTerciario` y `ActaExamenNota.intento` deben estar en la rama destino. La implementación DEBE stackearse sobre `feat/evaluacion-terciario`.

## Risks / Open Questions
- **Q1 (abierto, no decidir):** `ActaExamen` no tiene `anioAcademico`, solo `fecha`. Para una transcripción de estado vigente, la inclinación es mostrar todos los finales de las inscripciones incluidas (all-time), pero hay que confirmar vs filtrar por `fecha` dentro del año.
- **Dead code:** la jerarquía `BoletínTemplate` (`BoletínTerciario`, etc.) NO está en el path de PDF; lo usado son los HBS + `DatosBoletin`. No tocar como si fuera fuente de verdad.
- **`enrollment.grade` nullable:** el fallback del header de carrera puede ser null/vacío; definir comportamiento en spec.
