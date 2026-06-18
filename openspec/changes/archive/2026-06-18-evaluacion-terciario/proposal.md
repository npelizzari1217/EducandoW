# Proposal: evaluacion-terciario

> Fase: sdd-propose · Store: hybrid · 2026-06-18 · Basado en explore.md (#1143)

## Intent

El flujo de evaluación de Terciario no está modelado. Hoy la cursada se guarda como un `float` crudo (`notaCursada`) sin parciales, TP ni recuperatorios, y el final (`ActaExamenNota`) no tiene contador de intentos ni enforcement del límite de 3. Esto deja el proceso real (2 parciales + 1 TP obligatorio + recuperatorios + final con hasta 3 intentos) sin soporte y el boletín Terciario roto. **Éxito:** la secretaría puede registrar la cursada estructurada y los finales por intento, con guards de negocio (REGULAR para rendir, máx 3 intentos, auto-LIBRE).

## Scope

**In-scope (Fase A + B, primer cambio):**
- Nueva entidad `NotaCursadaTerciario` { inscripcionMateriaId, slot (PARCIAL_1/PARCIAL_2/RECUPERATORIO_PARCIAL_1/RECUPERATORIO_PARCIAL_2/TP), nota, condicion, fecha }.
- Campo `intento` (1|2|3) en `ActaExamenNota` + backfill `intento=1` a filas existentes.
- Enforcement: máx 3 intentos DESAPROBADO/AUSENTE, guard "REGULAR para rendir final", auto-transición a LIBRE al 3er fallo.
- Entrada admin (secretaría) de cursada y finales + tests (TDD estricto).

**Out-of-scope (cambios posteriores):**
- Fase C (`boletin-terciario`): `buildMateriasTerciario` + rediseño de template — siguiente cambio.
- Fase D (`docente-grade-entry`): authz de docente Terciario (DocenteXCiclo o modelo paralelo) — diferido.
- Retiro del legacy `NotaTrimestral` y tabla `Teacher`.

## Approach (alto nivel)

`@educandow/domain` define `NotaCursadaTerciario` como sub-notas de la cursada (la `notaCursada` se computa o confirma). El `intento` vive en `ActaExamenNota` (no en `ActaExamen`), por decisión de la exploración. Los guards de negocio (elegibilidad de final, límite de intentos, transición a LIBRE) se modelan en el dominio y se aplican en la capa de aplicación NestJS. Migración Prisma tenant con backfill. Authz se mantiene como hoy (`@Roles GRADES` + `@Levels TERCIARIO`); la entrada por docente queda para Fase D.

## Risks / Open Questions

- Boletín Terciario hoy roto/vacío (lee `NotaTrimestral`); este cambio NO lo arregla — Fase C lo hace. Comunicar al PO.
- Backfill `intento=1` sobre `ActaExamenNota` existentes: validar que no haya filas huérfanas o duplicadas.
- Decidir el alcance exacto sin resolver las decisiones de producto da un spec desalineado.

## Decisions Needed (antes de sdd-spec — MVP)

1. PROMOCIONAL: ¿bypassa el final?
2. Período: ¿bimestral/cuatrimestral vs el actual ANUAL/1C/2C?
3. ¿TP obligatorio bloquea rendir el final?
4. Elegibilidad de recuperatorio: ¿DESAPROBADO y/o AUSENTE?
5. Cómputo de `notaCursada`: ¿automático desde slots o confirmación manual?
6. Condiciones exactas para pasar a LIBRE.
7. ¿Adoptar `GradingPeriodDate` o fechas libres?

> Confirmado por exploración: `intento` en `ActaExamenNota` (no en `ActaExamen`). Entrada por secretaría en este cambio (docente diferido a Fase D).
