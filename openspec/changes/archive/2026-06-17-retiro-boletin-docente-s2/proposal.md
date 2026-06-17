# Proposal: retiro-boletin-docente-s2

> Fase: sdd-propose · Store: hybrid · 2026-06-17
> S2 de `retiro-teacher-legacy`. Approach B (student-scoped). Delivery: single PR (~100 líneas).

## Intent

Eliminar todos los reads de la tabla `Teacher` desde `generate-boletin.use-case.ts`: los 3 sitios que hoy resuelven el nombre del docente vía `subjectAssignment.include({ teacher })`. Tras S2 el boletín no lee `Teacher` en ninguna rama, lo que **desbloquea dropear la tabla `Teacher`** + el FK `SubjectAssignment.teacherId`.

**Corrección de alcance (design):** `SubjectAssignment` NO se puede eliminar del boletín en S2. En la rama legacy (Inicial/Terciario) esa query es el backbone: provee la lista de materias y es la **única clave de join a las notas** (`NotaTrimestral.assignmentId → SubjectAssignment.id`; `NotaTrimestral` no tiene `subjectId`). Por eso `SubjectAssignment` se conserva ahí; solo se quita el `include: { teacher }`. Éxito = boletín Inicial sigue mostrando docente (vía modelo nuevo), Primario/Secundario/Terciario sin regresión, **cero reads de `Teacher`** en el use-case. Dropear `SubjectAssignment` queda para una etapa posterior que primero migre el grading de Inicial/Terciario fuera de `NotaTrimestral` (NO es S3 trivial).

## Scope

**IN**
- Reemplazar los 3 lookups de `SubjectAssignment` en `generate-boletin.use-case.ts`.
- Nuevo helper bulk para resolución student-scoped del docente (rama Inicial/legacy).
- `docente = ''` directo en Primario/Secundario (sin query).
- Tests (~5-8 nuevos).

**OUT / Diferido**
- NO tocar `schema.prisma`: el modelo `SubjectAssignment` (+ datos) y la tabla `Teacher` quedan. S2 solo deja de LEER `Teacher` desde el boletín; el drop de `Teacher` es una etapa posterior (también bloqueada por mesas/actas de examen — Teacher track).
- NO cambiar plantillas (`MateriaBoletin.docente: string` se mantiene).
- NO nueva DI (`PrismaService` ya inyectado).
- NO tocar el Teacher track ni el archival de S3.

## Approach (B — student-scoped)

Resolver docentes por (alumno, materia) recorriendo el modelo nuevo con queries bulk IN por CourseCycle (sin N+1): MateriaXCursoXCiclo → AlumnosXMateriaXCursoXCiclo → AlumnosXGrupo → GrupoXCursoXMateriaXCiclo → DocenteXCiclo → master `User`. Dedup obligatorio de `docenteXCicloId` (se dropeó el `@@unique`).

- **P1 — co-docencia (N>1):** unir nombres con `" / "` → `"Apellido, Nombre / Apellido2, Nombre2"`. Sin cambio de tipo ni plantilla.
- **P2 — Inicial en blanco:** se acepta degradación a blanco cuando el modelo resuelve 0 docentes. NO es bloqueante de código.
- **P3 — Primario/Secundario:** no renderizan docente → `docente = ''` directo, y se elimina su query a `SubjectAssignment` (ya no leen `Teacher`). **Terciario:** tampoco renderiza docente (confirmado en `boletin-terciario.hbs`) → `docente = ''`; el resolver del modelo nuevo se aplica **solo a Inicial**. La rama legacy conserva su query a `SubjectAssignment` para materias+notas, pero sin el `include: { teacher }`.

## Impact

- Único cambio visible: PDF de Inicial (la fuente del nombre cambia de tabla legacy a modelo nuevo).
- **R4 (cambio de comportamiento):** la fuente del nombre pasa de `Teacher` (tenant) a `User` (master); pueden diferir si se editó el `Teacher` post-backfill.
- Tenant client para DocenteXCiclo/grupos; master client (PrismaService) para nombres de `User` — nunca mezclar.

## Deploy precondition (operacional, NO bloqueante de código)

Antes de deployar S2 verificar que el **backfill materia-grupo corrió en TODOS los tenants**. Si no, Inicial mostrará `<td>` vacío para CCs no materializados (P2).

## Risks

- R1 (ALTO): Inicial en blanco si el backfill no corrió → precondition de deploy.
- R3 (MEDIO): `@@unique` dropeado → dedup de `docenteXCicloId`.
- R4 (MEDIO): divergencia Teacher/User post-backfill.

## Delivery

Single PR, ~100 líneas, 1 archivo + tests. Auto-chain NO necesario.
