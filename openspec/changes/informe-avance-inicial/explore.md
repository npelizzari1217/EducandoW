# Explore: informe-avance-inicial

> Fase: sdd-explore · Store: hybrid · 2026-06-17 · Feature nueva (no es slice del retiro de Teacher)

## Hallazgo clave (bueno): el modelo YA EXISTE
`InformeEvolutivo` (entidad de dominio + use-cases + repo + controller + modelo Prisma + módulo) **ya está implementado y cableado**:
- `InformeEvolutivo { studentId, salaId, periodo (1T/2T/3T), fecha, observacionesGenerales?, areas[] }`
- `AreaDesarrollo { area, observacion (narrativa — el campo clave), valoracion (DESTACADO/LOGRADO/EN_PROCESO/NO_LOGRADO) }`
- Áreas (comentario schema): SOCIO_AFECTIVA / MOTRIZ / COGNITIVA / LENGUAJE / CREATIVA.
- Endpoints `POST/GET/GET:id/PATCH /inicial/informes` (auth REPORTS + @Levels INICIAL).

## El gap (único bloqueante real)
El **boletín de Inicial NO lee `InformeEvolutivo`** — cae al path legacy `NotaTrimestral` (numérico, conceptualmente incorrecto para Inicial). O sea: los informes se pueden cargar por API, pero el boletín no los muestra (intenta mostrar notas numéricas que no existen). El boletín de Inicial hoy está roto/vacío.

## Approach recomendado: A (wire-up del boletín, ~6 tareas, sin migración)
1. `buildMateriasInicial` en generate-boletin.use-case.ts (lee InformeEvolutivo → mapea AreaDesarrollo a la salida con observacion + valoracion).
2. Dispatch nuevo: `Math.floor(level/10) === 1 → buildMateriasInicial`.
3. Extender `MateriaBoletin`/`DatosBoletin` con `observacion` + `observacionesGenerales`.
4. Reescribir `boletin-inicial.hbs`: mostrar observacionesGenerales + por área (nombre/observacion/valoracion); quitar columna "Docente" (Sala.teacherId se fue en S3b-1); corregir `{{periodo}}` (hoy muestra el año, no el trimestre).
5. Tests del boletín Inicial + tests de los 4 use-cases de InformeEvolutivo (no existen — TDD).
6. Revisar el batch path.

Tamaño: **S/M, ~6 tareas, sin Prisma migration, sin entidades nuevas.** El modelo es fit-for-purpose; solo falta conectarlo.

## Decisiones de producto (para hardening — diferibles, no bloquean MVP)
P1 ¿Las 5 áreas son fijas para todas las instituciones? (→ AreaNombre VO o free string). P2 ¿Docentes cargan informes solos? (→ SalaXDocente vs admin-only; hoy admin-only). P3 ¿Valoración fija (4 niveles) o configurable? P4 estructura de períodos (Periodo 1T/2T/3T vs GradingPeriodDate). P5 estado "No evaluado". P6 workflow borrador→publicado.

## Riesgos
- CRÍTICO: `boletin-inicial.hbs` no tiene el campo narrativo `observacion` (rediseño, no parche).
- MEDIO: sin authz de docente post-S3b-1 (admin-only es el MVP pragmático).
- MEDIO: `area` es free string (sin enum).
- BAJO: faltan tests de los use-cases; `periodo` deprecado.

## Migración de datos legacy: empezar fresco (el NotaTrimestral de Inicial es forzado, sin valor).

## Relación con retiro de Teacher
Cuando el boletín de Inicial lea InformeEvolutivo (Approach A), Inicial deja de depender del path legacy NotaTrimestral → un paso hacia poder dropear el legacy (junto con Terciario).

## Siguiente: resolver MVP vs hardening → sdd-propose. (Approach A es safe-to-propose ya.)
