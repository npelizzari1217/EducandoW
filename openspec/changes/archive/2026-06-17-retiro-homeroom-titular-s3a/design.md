# Design: retiro-homeroom-titular-s3a

> Fase: sdd-design · Store: hybrid · 2026-06-17
> S3a — migración del modo homeroom de `ListTeacherCourseCyclesUseCase` al modelo nuevo (AsignacionCursoXCiclo rol=TITULAR), sin cambio de schema.

## Architecture approach

Clean/Hexagonal preservada. El cambio NO introduce capas nuevas: reemplaza el path de lectura legacy del modo homeroom por una nueva query encapsulada en el port `AsignacionCursoXCicloRepository`. El use-case sigue orquestando por puertos; la query Prisma vive en el adaptador. Patrón idéntico al que ya usa el modo subject (DocenteXCiclo) — coherencia interna del use-case.

Boundary key: el use-case pasa de depender de DOS puertos legacy (`TeacherRepository` + `CourseCycleRepository.findByHomeroomTeacher`) a UN puerto del modelo nuevo (`AsignacionCursoXCicloRepository.findTitularCourseIdsByUser`) + el `findByUuids` ya existente. Output `Array<{cycle, modality}>` intacto.

Tenant-only: toda query corre sobre `TenantContext.getClient()` (cliente tenant). Sin master DB.

## Data flow

### OLD (homeroom, a remover)
```
userId → teacherRepo.findByUserId(userId) → Teacher|null
       → (null ⇒ [])
       → courseCycleRepo.findByHomeroomTeacher(teacher.id.get()) → CourseCycle[]
       → filtro década (Primario=2) → findGradingContextsByUuids → map {cycle, modality}
```
2 queries sobre modelo viejo (`teachers`, `course_cycles.homeroom_teacher_id`).

### NEW (homeroom, single join)
```
userId → asignacionRepo.findTitularCourseIdsByUser(userId) → string[] (courseCycleId UUIDs, dedup)
       → courseCycleRepo.findByUuids(uuids) → CourseCycle[]  (ya existe; [] ⇒ [])
       → filtro década (Primario=2) → findGradingContextsByUuids → map {cycle, modality}
```
1 query de resolución (`asignaciones_curso_x_ciclo` con nested filter sobre `docentes_x_ciclo`) + el `findByUuids` existente. El TAIL compartido (filtro década + `findGradingContextsByUuids` + map) NO cambia.

**Modo subject: SIN CAMBIOS.** Confirmado en lectura: `teacherRepo` solo se usa en el branch homeroom (use-case líneas 46-48). El branch subject (DocenteXCiclo → grupos → materias → findByUuids) no toca `teacherRepo`.

## Component map (qué se toca)

| Componente | Archivo | Cambio |
|---|---|---|
| Port AsignacionCursoXCiclo | `packages/domain/src/asignacion-curso-ciclo/repositories/asignacion-curso-x-ciclo-repository.ts` | +método `findTitularCourseIdsByUser` |
| Impl Prisma AsignacionCursoXCiclo | `api/src/infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository.ts` | +método (nested filter + dedup) |
| Use-case | `api/src/application/grading/list-teacher-course-cycles.use-case.ts` | constructor −teacherRepo +asignacionRepo; reescritura branch homeroom; doc-comment |
| Port CourseCycle | `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts` | −`findByHomeroomTeacher` (líneas 67-72) |
| Impl Prisma CourseCycle | `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts` | −`findByHomeroomTeacher` (líneas 146-156) |
| DI module | `api/src/presentation/course-cycle/course-cycle.module.ts` | −PrismaTeacherRepository/token; +PrismaAsignacionCursoXCicloRepository directo en providers + factory |
| Spec use-case | `api/src/application/grading/list-teacher-course-cycles.use-case.spec.ts` | reescribir bloque homeroom (mock asignacionRepo, no Teacher) |
| Spec repo CC | `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.spec.ts` | −bloque `findByHomeroomTeacher` (líneas 68-122) |
| Spec repo Asignacion | `prisma-asignacion-curso-x-ciclo.repository.spec.ts` | +test del nuevo método |

## ADR-style decisions

### D1 — Nuevo método `findTitularCourseIdsByUser` con single join (nested filter)
**Decisión.** Firma exacta en el port:
```ts
/**
 * Returns deduplicated CourseCycle UUIDs where the given master User is the
 * homeroom titular (rol=TITULAR) via an active DocenteXCiclo. AD-6 "por curso"
 * path on the new model. Empty array when none. Tenant scoping via TenantContext.
 */
findTitularCourseIdsByUser(userId: string): Promise<string[]>;
```
Impl Prisma (cliente tenant, dedup con Set):
```ts
async findTitularCourseIdsByUser(userId: string): Promise<string[]> {
  const rows = await this.client.asignacionCursoXCiclo.findMany({
    where: {
      rol: RolCurso.TITULAR,
      docenteXCiclo: { userId, active: true },
    },
    select: { courseCycleId: true },
  });
  return [...new Set(rows.map((r) => r.courseCycleId))];
}
```
**Por qué.** Confirmado contra `schema.prisma`: `AsignacionCursoXCiclo` tiene la relación `docenteXCiclo → DocenteXCiclo` (línea 156), `DocenteXCiclo` tiene `userId` (177) y `active` (180); enum `RolCurso.TITULAR` existe (129-132). El nested filter resuelve en UNA query lo que el modo subject hace en varios pasos — y como homeroom no necesita grupos/materias, no requiere el pipeline largo. Devuelve `string[]` (UUIDs) para encajar directo en `findByUuids`.
**Rechazado.** (a) Resolver primero `DocenteXCiclo` por userId y luego asignaciones (2 queries) — más roundtrips, sin ganancia. (b) Devolver entidades `AsignacionCursoXCiclo` y mapear en el use-case — fuga de detalle de persistencia al application layer; el use-case solo necesita los UUIDs. (c) `findFirst`/distinct de Prisma — el dedup con Set es trivial y explícito; el `@@unique([courseCycleId, docenteXCicloId, rol, turno])` ya limita duplicados pero un user podría ser TITULAR del mismo CC vía dos turnos distintos, así que el dedup es necesario y correcto.

### D2 — Reescritura del branch homeroom + cambio de constructor
**Decisión.** Constructor: reemplazar `teacherRepo: TeacherRepository` por `asignacionRepo: AsignacionCursoXCicloRepository` **en la misma posición (primer parámetro)**, manteniendo `docenteRepo, grupoRepo, courseCycleRepo`. Quitar `TeacherRepository` del import type. Branch homeroom nuevo:
```ts
if (input.mode === 'homeroom') {
  // AD-6 "por curso" path — modelo NUEVO: userId → AsignacionCursoXCiclo(TITULAR)
  const ccUuids = await this.asignacionRepo.findTitularCourseIdsByUser(input.userId);
  courseCycles = await this.courseCycleRepo.findByUuids(ccUuids);
} else {
  // ... subject branch SIN CAMBIOS ...
}
```
El TAIL compartido (líneas 84-104: `allowedDecades`, filtro `Math.floor(level/10)`, `findGradingContextsByUuids`, map) queda intacto. `findByUuids` ya maneja `[]` (port doc línea 84-85) → no hace falta early-return explícito, pero el TAIL ya hace `if (filtered.length === 0) return []`.
**Por qué.** Output type idéntico; homeroom sigue Primario-only (`HOMEROOM_DECADE = 2`). Mantener la posición del parámetro minimiza el diff del factory DI y deja el orden semántico homeroom-first coherente con el original.
**Rechazado.** Añadir `asignacionRepo` al final y dejar `teacherRepo` nullable — deja deuda y un puerto muerto inyectado; viola la intención del retiro.

### D3 — Eliminar `findByHomeroomTeacher` (port + impl + test)
**Decisión.** Borrar el método del port (`course-cycle-repository.ts` líneas 67-72) y de la impl (`prisma-course-cycle.repository.ts` líneas 146-156), y el bloque de tests del repo (`prisma-course-cycle.repository.spec.ts` líneas 68-122, incl. la mención en el header doc línea 3).
**Por qué.** Grep confirma que el ÚNICO caller de producción es el use-case (línea 48), que este mismo cambio reescribe. El resto de matches son specs (que se ajustan en este change), docs y archive. Cero callers tras D2 → método muerto.
**Rechazado.** Dejarlo "por si acaso" — código muerto; el drop de `homeroomTeacherId` es un slice posterior y ese método ya no aporta.

### D4 — DI: registrar `PrismaAsignacionCursoXCicloRepository` directo en providers (sin importar AsignacionCursoModule)
**Decisión.** En `course-cycle.module.ts`:
- Quitar import de `PrismaTeacherRepository` (línea 24) y los providers `PrismaTeacherRepository` + `{ provide: 'TeacherRepository', useExisting: PrismaTeacherRepository }` (líneas 111-112).
- Añadir import de `PrismaAsignacionCursoXCicloRepository` y registrarlo directo en `providers` (igual patrón que `PrismaDocenteXCicloRepository`/`PrismaGrupoRepository`).
- Cambiar el factory de `ListTeacherCourseCyclesUseCase` (líneas 117-126): primer param `asignacionRepo: PrismaAsignacionCursoXCicloRepository`; `inject` con `PrismaAsignacionCursoXCicloRepository` en lugar de `PrismaTeacherRepository`.
**Por qué.** Confirmado por lectura del módulo: `PrismaTeacherRepository`/token `TeacherRepository` es consumido ÚNICAMENTE por el factory de `ListTeacherCourseCyclesUseCase` — ningún otro provider del módulo lo inyecta. Registrar el repo de asignaciones directo (como ya se hace con DocenteXCiclo/Grupo, que son repos de otros agregados usados localmente) evita importar `AsignacionCursoModule` y el riesgo de import circular (R5).
**Rechazado.** Importar `AsignacionCursoModule` y consumir su provider exportado — riesgo de ciclo de módulos (R5); el módulo de asignaciones podría depender (directa o transitivamente) de CourseCycle. El registro directo es el patrón ya establecido en este módulo.

### D5 — Sin cambio de schema
**Decisión.** `CourseCycle.homeroomTeacherId` (columna, FK `homeroomTeacher Teacher?` onDelete:SetNull, índice `@@index([homeroomTeacherId])`) **queda** (schema líneas 350-358, 373). Los mappers `toDomain` de los repos que hagan passthrough de ese campo no se tocan. Cero migración.
**Por qué.** El drop de la columna/FK/índice es un slice posterior planificado (D5 en proposal; ver archive grading-primario). Quitar solo la lógica de lectura desacopla el cambio de código del cambio de datos y mantiene el PR chico/reversible.
**Rechazado.** Dropear la columna ahora — ampliaría scope, exigiría migración tenant y un backfill verificado; fuera de S3a.

### D6 — Test strategy (TDD estricto)
**Decisión.**
- **Use-case spec** (`list-teacher-course-cycles.use-case.spec.ts`):
  - `makeRepos`: quitar `teacherRepo` (líneas 102-105) y `findByHomeroomTeacher` del `courseCycleRepo` (línea 116); añadir `asignacionRepo: { findTitularCourseIdsByUser: vi.fn().mockResolvedValue([]) }`.
  - Constructor en `beforeEach` (líneas 137-142 y cualquier otro describe): pasar `repos.asignacionRepo` como primer arg en lugar de `repos.teacherRepo`.
  - Bloque homeroom (≈ líneas 365-420) reescrito:
    - `[RED]` TITULAR de N CCs → `findTitularCourseIdsByUser` mockeado a `['cc-homeroom']`, `findByUuids` a esos CCs → resultado con esos CCs (reemplaza TIA-R5).
    - `[RED]` sin TITULAR → `findTitularCourseIdsByUser` a `[]`, `findByUuids` a `[]` → `[]`.
    - `[RED]` filtra non-Primario (TIA-R9) → ahora vía `findByUuids` con CC terciario incluido → solo Primario.
    - `[RED]` **assert Teacher NO se lee**: el use-case ya no recibe `teacherRepo`; el test verifica que `asignacionRepo.findTitularCourseIdsByUser` fue llamado con `userId` y que homeroom NO llama a `docenteRepo`/`grupoRepo`.
  - Subject specs: solo se ajusta el arg del constructor; lógica intacta.
- **Repo Asignacion spec** (`prisma-asignacion-curso-x-ciclo.repository.spec.ts`): `[RED]` test del nuevo método — mock del client `asignacionCursoXCiclo.findMany`, assert del `where` (rol TITULAR + nested `docenteXCiclo:{userId,active:true}`) y del dedup (rows con courseCycleId repetido → array único).
- **Repo CourseCycle spec**: eliminar bloque `findByHomeroomTeacher` (líneas 68-122) y la referencia en el header.
**Por qué.** TDD estricto del proyecto (test primero, coverage ≥80%). Los asserts "Teacher NOT read" y el dedup son los invariantes nuevos que justifican el cambio.

## Integration points / contract
- **API**: `GET /course-cycles?teacherUserId=...&role=homeroom` — handler y DTO sin cambios; output `{cycle, modality}[]` idéntico.
- **Frontend**: `use-teacher-grading-access.ts` solo chequea `length>0` y usa `id`/`level` — contrato preservado, sin cambios (confirmado en exploración).
- **Deploy (R4)**: precondición operacional — verificar skip-count de TITULAR del backfill Fase 4 por tenant ANTES de prod. Un CC skippeado (Teacher.userId null o sin DocenteXCiclo) → nav homeroom vacía (degradación silenciosa). NO es código; es checklist de release.

## Estimación
~200 líneas, **single PR**. 4 archivos de producción (2 ports/impls de asignacion, use-case, module, 1 impl/port de course-cycle removal) + 3 specs. Sin migración Prisma. Riesgo de review bajo.

## Verificación de STOP-conditions (todas despejadas)
- `findByHomeroomTeacher` OTHER callers: **ninguno** en producción (solo use-case línea 48; resto specs/docs/archive). ✔
- Quitar `teacherRepo` rompe subject: **no** — subject no usa `teacherRepo` (solo branch homeroom 46-48). ✔
- DI hidden dep en TeacherRepository: **no** — único consumidor del token/clase es el factory de `ListTeacherCourseCyclesUseCase`. ✔

## Siguiente paso: sdd-tasks (cuando spec esté lista).
