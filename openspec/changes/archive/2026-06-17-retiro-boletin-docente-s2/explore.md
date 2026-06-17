# Explore: retiro-boletin-docente-s2

> Fase: sdd-explore · Store: hybrid · 2026-06-17
> S2 de `retiro-teacher-legacy`: migrar el lookup de nombre de docente del boletín de `SubjectAssignment` al modelo nuevo (`DocenteXCiclo`/grupo).

## Resumen ejecutivo

`generate-boletin.use-case.ts` tiene 3 sitios que consultan `SubjectAssignment` para el nombre del docente (Primario, Secundario, legacy Inicial/Terciario). **Asimetría clave:** las plantillas de Primario y Secundario NO renderizan el docente (se calcula y se descarta). **Solo `boletin-inicial.hbs` lo muestra** (`<td>{{docente}}</td>`, línea 49). Terciario tampoco. → migrar tiene **cero impacto visual** en Primario/Secundario; el único punto visible es Inicial.

Path nuevo: chain de 6 queries bulk (5 tenant + 1 master), patrones ya establecidos (`ListDocentesXCicloUseCase` para el lookup cross-DB de User; `PrismaAlumnosXGrupoRepository` para el traverse student→grupo). `PrismaService` ya está inyectado en el boletín → **sin DI nueva**. `MateriaBoletin.docente` sigue siendo `string` → sin cambio de tipo ni de plantilla.

## Sitios actuales

| Rama | Líneas | Query | ¿Renderiza? |
|---|---|---|---|
| Primario | 324–336 | `subjectAssignment.findMany({select:{teacher}})` | **NO** (campo descartado) |
| Secundario | 525–537 | idem | **NO** |
| Legacy Inicial/Terciario | 223–226 | `subjectAssignment.findMany({include:{teacher}})` | **Solo Inicial** (`<td>{{docente}}</td>`) |

## Path del modelo nuevo (student-scoped, bulk)

```
CourseCycle.uuid
 → materias_x_curso_x_ciclo (courseCycleId, subjectId)
 → alumnos_x_materia_x_curso_x_ciclo (materiaId, studentId)
 → alumnos_x_grupo_x_curso_x_materia_x_ciclo (alumnoMateriaId)
 → grupos_x_curso_x_materia_x_ciclo (grupoId → docenteXCicloId)
 → docentes_x_ciclo (id → userId)
 → [cross-DB] master.User (userId → firstName/lastName)
```
6 queries bulk (IN) por CC, sin N+1. **Dedup obligatorio de docenteXCicloId**: se dropeó el `@@unique([materiaXCursoXCicloId, docenteXCicloId])` (migración `20260613100000`).

### Cardinalidad: 0, 1 o N docentes por (alumno, materia)
- 0 → modelo no materializado / alumno sin grupo / docente sin userId.
- N → co-docencia o materia partida (alumno en varios grupos).

## Approach recomendado: B (student-scoped)
El boletín es un documento **por alumno** → mostrar solo los docentes de los grupos del alumno (no todos los de la materia). Approach A (materia-scoped, 4 queries) sobre-reporta en materias partidas. B (6 queries bulk) es semánticamente correcto y sigue patrones existentes. Para Primario/Secundario (no renderizan) basta con setear `docente=''` y NO consultar nada.

## Decisiones de producto requeridas (antes de proponer)
- **P1 — Regla de co-docencia (BLOQUEANTE):** cuando hay N>1 docentes, ¿qué muestra el campo `docente: string`? Opciones: join `"Apellido, Nombre / ..."` (sin cambio de plantilla, transparente — recomendado); primero alfabético; o blanco.
- **P2 — Degradación a blanco en Inicial (BLOQUEANTE solo Inicial):** si el chain devuelve 0 docentes (backfill no corrido o docente sin userId), Inicial muestra `<td>` vacío. ¿Aceptable (deploy condicionado a verificar backfill por tenant) o se bloquea hasta verificar?
- **P3 — Valor en Primario/Secundario (NO bloqueante):** como no se renderiza, setear `''` (sin query) — decidido: sí, simplifica y elimina el consumo de SubjectAssignment ahí.

## Riesgos
- R1 (ALTO): Inicial en blanco si el backfill no corrió en algún tenant → verificar antes de deploy.
- R2 (ALTO): regla de co-docencia indefinida → P1.
- R3 (MEDIO): `@@unique` dropeado → dedup de docenteXCicloId.
- R4 (MEDIO): fuente del nombre cambia de `Teacher` (tenant) a `User` (master) → pueden diferir si se editó post-backfill.

## Scope
~1 archivo (`generate-boletin.use-case.ts`), ~100 líneas, single PR (auto-chain no necesario), 0 DI nueva, ~5-8 tests nuevos.

## Siguiente paso
Resolver P1 y P2 → `sdd-propose`. Approach B.
