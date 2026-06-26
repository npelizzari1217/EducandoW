# Proposal: asistencia-dias-bloqueados

**Pedagogical level:** INICIAL | PRIMARIO | SECUNDARIO | TERCIARIO — todos los niveles que usan los tipos de asistencia de sistema (SAB/DOM/P/X). Es level-agnostic: la asistencia es por CourseCycle.

## Intent

**Problema.** Al generar la asistencia mensual (modo General y modo Por Materia) la grilla deja editables días donde NO se toma asistencia: sábados, domingos y días que no existen en el mes (29-31 según el mes). El usuario puede cargar P/A en un domingo o en un 31 de febrero, generando datos inválidos.

**Por qué ahora.** Bloquea el flujo real de toma de asistencia y ensucia los datos. El fix es barato: `days` ya es columna JSONB (`Json @default("{}")`) en ambos modelos tenant; los tipos SAB/DOM/X con su flag `assignable` ya existen y el backend ya los expone. Sin migración de schema.

**Éxito.** Al generar el mes, la grilla muestra SAB en sábados, DOM en domingos y X en días inexistentes, pre-cargados y bloqueados (sin combo editable). El backend rechaza cualquier PATCH sobre esos días. Re-generar completa/corrige los días bloqueados sin pisar la asistencia ya cargada en días hábiles.

## Scope

**In scope**
- Domain: nuevo `calendar-utils` (`daysInMonth`, `dayOfWeek`, `buildLockedDayMap(year,month)`), consolidando el `daysInMonth` hoy duplicado en 3 lugares.
- `generateMany` port + impl Prisma (general y materia): aceptar `days` y cambiar semántica a upsert/merge de días bloqueados.
- Use case `generate-monthly-attendance`: construir el locked-day map e inyectarlo.
- Guards en `record-general-attendance-day` y `record-subject-attendance-day`.
- Frontend `asistencia-mensual.tsx`: 31 columnas fijas, celdas bloqueadas para códigos no-assignables, combo filtrado por `assignable`.

**Out of scope**
- Feriados y días no laborables institucionales (solo finde + días inexistentes).
- `assignable` YA está en el `toResponse()` del attendance-type controller → NO se toca backend del catálogo.
- Otros niveles/pantallas fuera de la grilla de asistencia mensual.
- Sin migración de DB.

## Approach & rationale (ADRs)

- **ADR-1 — Marca stored.** SAB/DOM/X se guardan como dato real en `days` durante la generación (no solo render). La grilla y el backend leen el mismo origen de verdad; el front no recalcula calendario para bloquear.
- **ADR-2 — Re-generación = upsert/merge.** Filas nuevas se insertan con días bloqueados pre-cargados; filas existentes mergean SAB/DOM/X sin pisar días hábiles ya cargados. Reemplaza el `createMany skipDuplicates` actual.
- **ADR-3 — Guard backend doble.** Rechazar PATCH si el statusCode no es `assignable` Y/O si el día target es finde/inexistente (derivado del calendario en domain, no del JSONB).
- **ADR-4 — Helper de fechas en domain.** Lógica de calendario vive en `packages/domain` (clean-arch), única fuente, testeable, elimina duplicación.

## Impacto / riesgos
- Cambiar la semántica de "Generar" (skipDuplicates → upsert) puede afectar meses ya generados: mitigado porque el merge NO pisa días hábiles.
- El guard debe ser consistente entre lo stored (ADR-1) y lo derivado del calendario (ADR-3); el calendario es la autoridad.
- Rollback: revertir a `createMany skipDuplicates` y quitar guards; `days` JSONB tolera el dato extra sin migración inversa.

## Next phases
`sdd-spec` y `sdd-design` pueden correr en paralelo.
