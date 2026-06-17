# Proposal: informe-avance-inicial

> Fase: sdd-propose · Store: hybrid · 2026-06-17 · Nivel afectado: INICIAL · Branch: feat/informe-avance-inicial

## Intent

El modelo `InformeEvolutivo` (entidad + 4 use-cases + repo + controller + Prisma + módulo) YA EXISTE y está cableado: los informes evolutivos de Inicial se cargan y consultan por API. Pero el **boletín de Inicial no los lee** — cae al path legacy `NotaTrimestral` (numérico, conceptualmente inválido para Inicial), así que hoy renderiza vacío o incorrecto. Es un bug en vivo. Este cambio conecta el boletín al modelo existente. Éxito = el boletín de Inicial muestra `observacionesGenerales` y, por área, la narrativa + valoración cargadas en `InformeEvolutivo`, y deja de leer `NotaTrimestral`.

## Scope — IN (Approach A: wire-up del boletín)

- Inyectar `InformeRepository` opcional en `GenerateBoletinUseCase` (mismo patrón que los repos opcionales actuales).
- Nuevo método privado `buildMateriasInicial(client, enrollment)`: lee `InformeEvolutivo` (por `studentId` + `periodo`) y mapea cada `AreaDesarrollo` → salida con `area`/`nombre`, `observacion` (narrativa) y `valoracion`; expone `observacionesGenerales`.
- Nuevo arm de dispatch en `buildMaterias`: `Math.floor(level/10) === 1 → buildMateriasInicial` (hoy cae al legacy).
- Extender tipos de salida (`MateriaBoletin` / `DatosBoletin` en `boletin.template.ts`) con `observacion?` + `observacionesGenerales?` — **aditivo y opcional**.
- Reescribir `boletin-inicial.hbs`: render de `observacionesGenerales` + por área (nombre / narrativa / valoración); QUITAR la columna "Docente" (`Sala.teacherId` se fue en S3b-1); corregir `{{periodo}}` (hoy muestra el año, debe mostrar el trimestre).
- Tests: unit de los 4 use-cases de `InformeEvolutivo` (no existen — TDD) + test del boletín Inicial (asserta que lee `InformeEvolutivo` y NO `NotaTrimestral` para level 1).

## Scope — OUT / Deferred

Hardening en changes futuros, no bloquean el MVP: **P1** enum/VO de Área, **P2** authz self-service docente (SalaXDocente), **P3** VO de valoración, **P4** alineación con `GradingPeriodDate` / deprecación de `periodo`, **P5** estado "No evaluado", **P6** workflow borrador→publicado. Más amplio: gating del retiro de Teacher/legacy-grading. Sin migración Prisma, sin entidades nuevas, **no se dropea `NotaTrimestral`** (decisión frozen-legacy: Inicial solo deja de LEERLO en el boletín).

## Approach (A)

Conectar el boletín al modelo ya existente. No se reescribe dominio. El batch (`generate-boletin-batch.use-case.ts`) delega en `singleUC.execute()`, así que hereda el fix **sin un arm propio** — menor superficie y riesgo.

## Impact

- Fixea el boletín roto de Inicial: pasa a renderizar datos reales del informe evolutivo.
- Inicial deja de depender del path legacy `NotaTrimestral` → **paso hacia el retiro del legacy-grading** (pero este change no dropea nada).
- Aditivo: los campos nuevos de tipo no deben regresionar Primario/Secundario/Terciario (guardas `{{#if}}`, campos opcionales).

## Risks

- CRÍTICO: `boletin-inicial.hbs` no tiene campo narrativo — es rediseño, no parche; cubrir con snapshot/test.
- MEDIO: regresión accidental en otros niveles por los campos aditivos → test de no-regresión.
- MEDIO/abierto: ¿qué trimestre renderiza el boletín? Hoy `datos.periodo = academicYear`; falta decidir selección de período (¿uno o los tres informes?) → resolver en sdd-design.
- MEDIO: mapeo enrollment → `salaId`/`periodo` para el lookup del informe (design).
- BAJO: `area` es free string (sin enum); admin-only sin authz de docente (MVP pragmático).

## Delivery

Auto-chain, single PR (~6 tareas, sin migración).
