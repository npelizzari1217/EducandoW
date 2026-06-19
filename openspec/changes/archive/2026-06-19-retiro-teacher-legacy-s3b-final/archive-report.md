# Archive Report: retiro-teacher-legacy-s3b-final

> Status: COMPLETE
> Archived: 2026-06-19
> PR: #37 — mergeado a main

## Resumen del change

Último slice del epic `retiro-teacher-legacy`. Eliminó la tabla `teachers` de la base de datos
tenant, junto con la entidad de dominio `Teacher`, la interfaz `TeacherRepository`, y todo el
dead code asociado en `packages/domain`.

## Scope ejecutado

### Archivos eliminados (4)
- `packages/domain/src/personnel/entities/teacher.ts`
- `packages/domain/src/personnel/repositories/teacher-repository.ts`
- `packages/domain/src/personnel/__tests__/entities/teacher.test.ts`
- `packages/domain/src/personnel/entities/teacher.spec.ts`

### Archivos modificados (6)
- `packages/domain/src/personnel/entities/index.ts` — export `Teacher` removido
- `packages/domain/src/personnel/index.ts` — exports `Teacher` + `TeacherRepository` removidos
- `packages/domain/src/index.ts` — exports `Teacher` + `TeacherRepository` removidos
- `api/prisma_tenant/schema.prisma` — bloque `model Teacher` (L93-114) eliminado
- `api/src/presentation/auth/dto/register.request.ts` — dead exports `CreateTeacherSchema`/`CreateTeacherDTO` (L77-88) eliminados
- `web/src/__tests__/App.test.tsx` — mock stale de `../pages/dashboard/teachers` (L11) eliminado

### Migración creada (1)
- `api/prisma_tenant/migrations/20260619300000_drop_teachers/migration.sql`
  ```sql
  -- S3b-final (retiro-teacher-legacy): teachers sin FK children tras retiro-grading-legacy-s3pre.
  DROP TABLE IF EXISTS "teachers";
  ```

## Estimación vs real
- Estimado: ~252 líneas eliminadas, ~20 agregadas (migración) — 10 archivos
- Neto: ~232 líneas (dentro de budget BAJO)

## Gates de calidad (PR #37)
- Tests: PASS (build + test suite verdes)
- Schema: `pnpm --filter api prisma:generate` ejecutado correctamente
- TypeScript: `tsc --noEmit` sin errores nuevos
- Sweep DB: `client.teacher` → 0 referencias en `api/src`

## Verificación en dev
- Migración `20260619300000_drop_teachers` aplicada en entorno dev
- Verificado post-migración: tabla `teachers` NO EXISTE, 0 FK children, 0 filas huérfanas

## Nota de flujo SDD
El flujo se comprimió a `explore → apply → verify → archive` (sin proposal/spec/design/tasks
formales) porque el scope era **borrado mecánico de código dead** (~232 líneas netas)
sin cambio de comportamiento. Todos los análisis de FKs y precondiciones estaban documentados
en `explore.md`; no había decisiones de diseño ni contratos de API nuevos.

## Precondición cumplida
`retiro-grading-legacy-s3pre` dropeó `subject_assignments` — último FK child de `teachers`.
Verificado en dev antes de ejecutar este slice: `teachers` sin FK children.

## Identidad docente post-retiro
La identidad del docente vive 100% en:
- `User` (master DB): identidad de persona + rol `'TEACHER'` (acceso, sobrevive)
- `DocenteXCiclo` (tenant DB): enrolamiento por ciclo lectivo
- `AsignacionCursoXCiclo(rol=TITULAR)`: asignación homeroom

La tabla `teachers`, la entidad `Teacher`, y el repositorio `TeacherRepository`
**no existen más en ningún ambiente**.
