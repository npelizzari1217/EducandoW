# Proposal: retiro-sala-grado-curso-teacher-s3b1

> Fase: sdd-propose · Store: hybrid · 2026-06-17
> Branch: `feat/retiro-sala-grado-curso-teacher-s3b1`

## Intent

Eliminar el vínculo legacy `teacherId` de `Sala` (Inicial), `Grado` (Primario) y `Curso`
(Secundario) como parte del retiro del modelo `Teacher`. El campo es un primitivo crudo
(input de UUID, sin lookup de nombre, sin consumidores aguas abajo tras S2) y NO mapea al
modelo de ciclos (`AsignacionCursoXCiclo` es cycle-scoped; `Sala`/`Grado` son year-scoped):
migrar es estructuralmente inviable. Éxito = `Sala`/`Grado`/`Curso` sin referencia a
`Teacher`, schema/dominio/app/web consistentes, `prisma generate` y tests verdes.

## Scope

**In:**
- Schema `api/prisma_tenant/schema.prisma`: drop `teacherId` + FK (`→Teacher.id` SetNull) +
  índice en `salas` y `grados`; drop `teacherId` + FK en `cursos` (sin índice). Quitar back-relations en `Teacher`.
- Dominio: quitar `teacherId` de `Sala` (`SalaProps`/`CreateSalaProps`/`SalaFilters`) y `Grado`.
- Aplicación: `Create/UpdateSalaInput`, `Create/UpdateGradoInput`.
- DTOs: create/update sala y grado.
- Infra: prisma-sala y prisma-grado (create/update/toDomain/filter); limpieza menor de `CursoRow`.
- Controllers: mapeo de respuesta sala + grado.
- Web: input docente en sala-form y grado-form; columna "Docente" del listado de Grado; interfaces TS.
- Migración SQL a mano (drop constraint/index/column con `IF EXISTS`).
- Tests: sala.test, grado.test, sala.use-cases.test.

**Out:**
- Bloque `generator erd` intacto.
- Otros consumidores de `Teacher` (`/teachers`, `MesaExamen`/`ActaExamen`).
- Tabla `Teacher` PERMANECE.
- Sin migración de datos ni backfill (Approach A).

## Approach (A — Eliminar el campo)

Drop puro. FK ya es SetNull, así que no hay riesgo de integridad. `Curso.teacherId` es
columna fantasma (ningún código la lee/escribe): drop trivial, cero cambios de app. Descartamos
Approach B (repuntar a `User.id`) porque el feature era primitivo y sin uso real: mantener un
campo de docente no aporta valor y agrega un backfill cross-DB innecesario.

## Impact

~20 archivos, ~150-200 líneas (mayormente borrados). Deploy per-tenant vía
`pnpm --filter api migrate-tenants` con migración escrita a mano, reversible por comentario.
Sin backfill. Delivery auto-chain: single PR.

## Risks

- **R1 (data loss, ACEPTADO):** valores `teacherId` no-null en `Sala`/`Grado` en prod se pierden.
  Aceptado: feature primitivo (UUID crudo, sin lookup), sin consumidores aguas abajo.
- **R4 (nulo):** `Curso.teacherId` es ghost column → impacto cero.

## Out-of-scope / Deferred

- Cualquier reemplazo de "docente de sala/grado" en el modelo de ciclos (no existe target viable).
- Retiro de la tabla `Teacher` (fases posteriores del retiro).
