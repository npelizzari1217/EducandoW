# Tasks: docente-ciclo-grupos

> 7 fases secuenciales — Fases 3 y 4 pueden ejecutarse en paralelo entre sí tras Fase 2.
> Cada fase = 1 PR con migración reversible. Ninguna tabla se elimina en este cambio (D5).
> Las decisiones de `decisions.md` prevalecen sobre cualquier supuesto anterior.

## Dependency Map

```
1 → 2 → 3 ──→ 5 → 6 → 7
         ↘         ↗
          4 ─────→
```

- Fases 3 y 4 son paralelas (no comparten FK entre sí; ambas dependen solo de DocenteXCiclo de Fase 2).
- Fase 5 depende de Fase 3 (grupos) y opcionalmente de Fase 4 (gestión scope).
- Fase 6 depende de Fases 3 (grupos) y 4 (AsignacionCursoXCiclo para preceptor).
- Fase 7 depende de Fases 3–6 completas.

---

## Fase 1 — Persona en User (master) · PR 1/7

**Satisface**: UP-R1, UP-R2, UP-R3
**Prerequisito de**: Fase 2 (el backfill de DocenteXCiclo copia datos de User ya enriquecido)

### Schema & Migración

- [x] F1-S1: Agregar a `User` en `api/prisma_master/schema.prisma`:
  `firstName String?`, `lastName String?`, `dni String?`, `title String?`, `phone String?`
  (mantener `name` existente; no eliminarlo — usado por auth/display)
- [x] F1-S2: Agregar `@@unique([institutionId, dni])` al modelo `User`
  (NULLs son distintos en Postgres → ROOT y usuarios sin DNI coexisten sin conflicto)
- [x] F1-S3: Generar migración Prisma master (`prisma migrate dev`); revisar SQL antes de aplicar en prod

### Backfill Script

- [x] F1-B1: Crear `api/scripts/backfill-user-persona.ts` — patrón de `backfill-system-attendance-types.ts`:
  loop sobre instituciones activas del master → por tenant encontrar Teachers con `userId != null`
  → copiar `dni`, `titulo→title`, `telefono→phone`, `nombre→firstName`, `apellido→lastName`
  al User vinculado (upsert: no pisar campos ya poblados con valores no-null — UP-S5)
- [x] F1-B2: Log informativo de Teachers con `userId = null` encontrados por institución
  (el borrado de huérfanos ocurre en Fase 2 por D4; aquí solo se reporta)
- [x] F1-B3: Verificar idempotencia: segunda ejecución sobre el mismo dataset no debe sobreescribir
  campos ya poblados con null ni crear errores de unicidad

### Dominio & Aplicación

- [x] F1-A1: Actualizar tipo/entidad `User` en `@educandow/domain` para incluir los 5 campos opcionales
- [x] F1-A2: Actualizar `users.use-cases.ts` — los read paths de usuario deben exponer los 5 campos nuevos
- [x] F1-A3: Cualquier read path que hoy tome `dni/titulo/telefono/nombre/apellido` de `Teacher` ligado a
  un `User` debe priorizar los valores del `User` (UP-R3, UP-S6); documentar la precedencia en el use-case

### Presentación

- [x] F1-P1: Actualizar DTOs de respuesta de User para incluir `firstName`, `lastName`, `dni`, `title`, `phone`
- [x] F1-P2: Si el endpoint de creación/actualización de User (PATCH/PUT) existe, agregar validaciones
  opcionales para los 5 campos nuevos

### Tests

- [x] F1-T1: Unit — UP-S1: User con los 5 campos → todos devueltos en read
- [x] F1-T2: Unit — UP-S2: User sin campos persona → todos null, sin error ni default
- [x] F1-T3: Unit — UP-S5: backfill ejecutado dos veces → mismo resultado, sin sobreescribir no-nulls
- [ ] F1-T4: Integration — UP-S3: script copia Teacher(userId=u1, dni, titulo, telefono, nombre, apellido) → User u1
- [ ] F1-T5: Integration — UP-S4: Teacher(userId=null) → skipeado, script continúa sin error
- [ ] F1-T6: Integration — UP-S6: User actualizado post-migración con título distinto al Teacher →
  valor del User prevalece en el read path

---

## Fase 2 — DocenteXCiclo + migración Teacher→User+DocenteXCiclo (tenant) · PR 2/7

**Satisface**: DC-R1 a DC-R5
**Decisión D4**: Teachers con `userId = null` se ELIMINAN en el backfill (no se migran)
**Decisión D5**: La tabla `Teacher` NO se elimina; coexiste
**Depende de**: Fase 1 completada (backfill F1-B1 debe haber corrido antes del backfill de esta fase)

### Schema & Migración

- [x] F2-S1: Agregar modelo `DocenteXCiclo` a `api/prisma_tenant/schema.prisma`:
  ```
  id String @id @default(uuid())
  userId String @map("user_id")           // master User.id, sin FK cross-DB
  cycleId String @map("cycle_id")         // → AcademicCycle.uuid
  active Boolean @default(true)
  deletedAt DateTime? @map("deleted_at")
  createdAt / updatedAt
  @@unique([userId, cycleId])
  @@index([cycleId])
  @@index([userId])
  @@map("docentes_x_ciclo")
  ```
- [x] F2-S2: Migración manual en `api/prisma_tenant/migrations/20260612140000_add_docente_ciclo/migration.sql`; desplegada en todos los tenants vía `migrate-all-tenants.ts` y también en `educandow_test`

### Backfill Script

- [x] F2-B1: Crear `api/scripts/backfill-docente-x-ciclo.ts`:
  - Por cada institución activa: buscar Teachers con `userId != null` que tengan
    alguna SubjectAssignment activa OR sean `homeroomTeacherId` de un CourseCycle activo
    → para cada ciclo involucrado → upsert `DocenteXCiclo(userId, cycleId)` (skipDuplicates)
  - **D4**: Eliminar Teachers con `userId = null`. Loguear cantidad pre-borrado.
    Abortar si count > umbral configurable (seguridad ante prod)
- [x] F2-B2: Idempotencia verificada: segunda corrida → mismo count, sin duplicados

### Dominio

- [x] F2-D1: Crear entidad `DocenteXCiclo` en `@educandow/domain` (id, userId, cycleId, active)
- [x] F2-D2: Crear interface `DocenteXCicloRepository`:
  `findById(id)`, `findByUserId(userId)`, `findByCycleId(cycleId)`,
  `findByUserAndCycle(userId, cycleId)`, `upsert(data): DocenteXCiclo`

### Infraestructura

- [x] F2-I1: Implementar `PrismaDocenteXCicloRepository` en la capa de infraestructura tenant

### Aplicación

- [x] F2-A1: Crear `DocenteXCicloService` (application service compartido):
  `getOrCreateForCycle(userId, cycleId): Promise<DocenteXCiclo>` — upsert idempotente,
  devuelve el registro existente si ya existe (DC-S3). Este servicio es llamado por Fases 3 y 4.
- [x] F2-A2: Registrar `DocenteXCicloRepository` + `DocenteXCicloService` en `DocenteCicloModule` (NestJS)

### Presentación

- [x] F2-P1: Crear endpoint `GET /docentes-x-ciclo?cycleId=` — lista docentes del ciclo con datos
  de persona joineados desde User master (DC-R2: persona viene del User, no del DocenteXCiclo — DC-S4)
- [x] F2-P2: DTOs de respuesta: incluir `{ docenteXCicloId, userId, cycleId, firstName, lastName, dni, title, phone }`
  (los campos de persona se obtienen de User, no se almacenan en DocenteXCiclo)

### Tests

- [x] F2-T1: Unit — DC-S3: segunda asignación al mismo (userId, cycleId) devuelve el mismo `id`; no duplica
- [x] F2-T2: Unit — DC-S5: User con módulo GRADES → puede someter notas vía su DocenteXCiclo
- [x] F2-T3: Unit — DC-S6: User sin módulo GRADES → rechazado en Door 1, independiente de DocenteXCiclo
- [x] F2-T4: Unit — DC-S7: User con ATTENDANCE + asignación preceptor → acceso a asistencia diaria
- [x] F2-T5: Unit — DC-S8: entity reconstruct preserves cycle scoping; deletedAt optional (domain test)
- [ ] F2-T6: Integration — DC-S1: asignar User a CursoXCiclo → crea DocenteXCiclo si no existía
- [ ] F2-T7: Integration — DC-S2: asignar User a grupo de materia → crea DocenteXCiclo si no existía
- [ ] F2-T8: Integration — DC-S9: tenant I2 no ve DocenteXCiclo de I1
- [x] F2-T9: Backfill unit: collectCycleIdsForTeacher (homeroom + assignment paths, dedup, empty); idempotencia real verificada con 2 corridas sobre DB local

---

## Fase 3 — MateriaXCursoXCiclo + AlumnosXMateria + Grupos + AlumnosXGrupo (tenant) · PR 3/7

**Satisface**: MGC-R1 a MGC-R6, smart-course-creation delta (adición y re-sync)
**Decisión D1**: re-generación aditiva + re-sync solo de descripciones/competencias del plan;
  NUNCA tocar calificaciones, grupos existentes ni AlumnosXGrupo ya cargados
**Decisión D5**: `SubjectAssignment` NO se elimina; el backfill migra datos pero la tabla coexiste
**Depende de**: Fase 2 (GrupoXCursoXMateriaXCiclo.docenteXCicloId → DocenteXCiclo)
**ALERTA DE TAMAÑO**: Estimación ~1300 líneas — requiere decisión de entrega explícita
  (sub-split 3a/3b/3c o `size:exception`) antes del apply

### Schema & Migración

- [x] F3-S1: Agregar `MateriaXCursoXCiclo` al tenant schema:
  `courseCycleId → CourseCycle.uuid (FK)`, `subjectId → Subject.id (FK)`,
  `studyPlanSubjectId String? @map("study_plan_subject_id")` (provenance),
  `@@unique([courseCycleId, subjectId])`, `@@index([courseCycleId])`, `@map("materias_x_curso_x_ciclo")`
- [x] F3-S2: Agregar `AlumnosXMateriaXCursoXCiclo`:
  `materiaXCursoXCicloId FK`, `studentId → Student.id (FK)`,
  `@@unique([materiaXCursoXCicloId, studentId])`, `@@index([materiaXCursoXCicloId])`,
  `@map("alumnos_x_materia_x_curso_x_ciclo")`
- [x] F3-S3: Agregar `GrupoXCursoXMateriaXCiclo`:
  `materiaXCursoXCicloId FK`, `docenteXCicloId FK → DocenteXCiclo.id`, `name String?`,
  `@@unique([materiaXCursoXCicloId, docenteXCicloId])`, `@@index([materiaXCursoXCicloId])`,
  `@@index([docenteXCicloId])`, `@map("grupos_x_curso_x_materia_x_ciclo")`
- [x] F3-S4: Agregar `AlumnosXGrupoXCursoXMateriaXCiclo`:
  `grupoId FK → GrupoXCursoXMateriaXCiclo.id`,
  `alumnosXMateriaXCursoXCicloId FK → AlumnosXMateriaXCursoXCiclo.id`
  (el FK garantiza grupo ⊆ materia a nivel BD — diseño explícito),
  `@@unique([grupoId, alumnosXMateriaXCursoXCicloId])`,
  índices por ambos FK, `@map("alumnos_x_grupo_x_curso_x_materia_x_ciclo")`
- [x] F3-S5: Generar migración Prisma; revisar SQL de FKs; desplegar multi-tenant

### Backfill Script

- [ ] F3-B1: Crear `api/scripts/backfill-materia-grupo.ts` — por institución activa → por CourseCycle activo:
  1. Materializar plan: `StudyPlanSubject` del plan del CC → upsert `MateriaXCursoXCiclo` (skipDuplicates, guardar `studyPlanSubjectId`)
  2. Por cada materia materializada: upsert `AlumnosXMateriaXCursoXCiclo` = alumnos inscriptos en el CC (skipDuplicates)
  3. Por cada `SubjectAssignment` activa en el CC → buscar `DocenteXCiclo` del teacher:
     crear `GrupoXCursoXMateriaXCiclo` (1 grupo = todos) + `AlumnosXGrupoXCursoXMateriaXCiclo` = universo completo
     (skipDuplicates en ambas tablas)
  4. `SubjectAssignment` NO se elimina (D5)
- [ ] F3-B2: Validar idempotencia: doble corrida produce el mismo estado sin errores

### Dominio

- [ ] F3-D1: Entidad `MateriaXCursoXCiclo` + interface `MateriaXCursoXCicloRepository`:
  `findByCourseCycleId(ccId)`, `upsertMany(data[])`, `findById(id)`, `updateDescription(id, data)`
- [ ] F3-D2: Entidad `AlumnosXMateriaXCursoXCiclo` + interface `AlumnosXMateriaRepository`:
  `findByMateria(materiaId)`, `addStudent(materiaId, studentId)`,
  `isMember(materiaId, studentId): boolean`
- [ ] F3-D3: Entidad `GrupoXCursoXMateriaXCiclo` + interface `GrupoRepository`:
  `findByMateria(materiaId)`, `findByDocente(docenteXCicloId)`,
  `findGroupsForDocente(docenteXCicloId, materiaId)`, `create(data)`, `findById(id)`
- [ ] F3-D4: Entidad `AlumnosXGrupoXCursoXMateriaXCiclo` + interface `AlumnosXGrupoRepository`:
  `addStudent(grupoId, alumnosXMateriaId)`, `findByGrupo(grupoId)`,
  `isMember(grupoId, alumnosXMateriaId): boolean`

### Infraestructura

- [ ] F3-I1: `PrismaMateriaXCursoXCicloRepository`
- [ ] F3-I2: `PrismaAlumnosXMateriaRepository`
- [ ] F3-I3: `PrismaGrupoRepository`
- [ ] F3-I4: `PrismaAlumnosXGrupoRepository`
- [ ] F3-I5: Registrar los 4 repositorios en el módulo NestJS del tenant

### Aplicación

- [ ] F3-A1: Extender `GenerateCourseCyclesUseCase` (o el use-case de "Generar"):
  - Paso adicional post-creación/verificación del CourseCycle: `createMany` de `MateriaXCursoXCiclo`
    por cada `StudyPlanSubject` del plan (skipDuplicates — idempotente)
  - Re-sync aditivo (D1): para MXCCs ya existentes, actualizar `description` y competencias desde el plan
    (pisar solo datos definitorios del plan — nunca grades, ni grupos, ni AlumnosXGrupo)
  - Lanzado como fire-and-forget o awaited (seguir patrón existente del use-case)
- [ ] F3-A2: `AddStudentToMateriaUseCase`:
  - Validar que el student pertenece al registro de inscriptos de la institución (no del flujo de ingresantes — MGC-S5)
  - Crear `AlumnosXMateriaXCursoXCiclo`; no exponer bulk endpoint (MGC-S6)
- [ ] F3-A3: `CreateGrupoUseCase`:
  - Recibe `(materiaXCursoXCicloId, userId, name?)`
  - Llama `DocenteXCicloService.getOrCreateForCycle(userId, cycleId)` → obtiene `docenteXCicloId`
  - Valida que el `cycleId` del docente coincide con el ciclo del CC
  - Persiste `GrupoXCursoXMateriaXCiclo`
- [ ] F3-A4: `AddStudentToGrupoUseCase`:
  - Recibe `(grupoId, alumnosXMateriaXCursoXCicloId)` (el FK es directo — FK garantiza la restricción a BD)
  - Validar que `alumnosXMateriaXCursoXCicloId` pertenece a la misma `materiaXCursoXCicloId` del grupo (MGC-S11)
  - Rechazar si el alumno pertenece a un CC distinto al del grupo (MGC-S10 — detectar vía join)
  - Permitir overlap: mismo alumno en 2 grupos de la misma materia (MGC-S12 — co-docencia)
- [ ] F3-A5: `ListMateriasUseCase`: lista `MateriaXCursoXCiclo` de un CourseCycle con conteo de alumnos y grupos
- [ ] F3-A6: `ListGruposUseCase`: lista grupos de una `MateriaXCursoXCiclo` con `docenteXCicloId`,
  nombre del docente (join desde User), y lista de alumnos del grupo

### Presentación

- [ ] F3-P1: `POST /course-cycles/:ccId/materias/:materiaId/alumnos` — agregar alumno al universo de la materia
- [ ] F3-P2: `GET /course-cycles/:ccId/materias` — listar materias del CursoXCiclo
- [ ] F3-P3: `POST /course-cycles/:ccId/materias/:materiaId/grupos` — crear grupo
- [ ] F3-P4: `GET /course-cycles/:ccId/materias/:materiaId/grupos` — listar grupos de la materia
- [ ] F3-P5: `POST /grupos/:grupoId/alumnos` — agregar alumno al grupo (recibe `alumnosXMateriaId`)
- [ ] F3-P6: `GET /grupos/:grupoId/alumnos` — listar alumnos del grupo
- [ ] F3-P7: DTOs de request y response para todos los endpoints nuevos

### Tests

- [ ] F3-T1: Unit — D1: re-generación actualiza descriptions/competencias del plan; no modifica grades,
  grupos existentes ni AlumnosXGrupo ya cargados
- [ ] F3-T2: Unit — MGC-S3: dos CCs del mismo plan producen dos sets independientes de MateriaXCursoXCiclo
- [ ] F3-T3: Unit — MGC-S9: alumno presente en universo de materia puede agregarse al grupo
- [ ] F3-T4: Unit — MGC-S11: alumno fuera del universo de la materia → error al intentar agregar al grupo
- [ ] F3-T5: Unit — MGC-S10: alumno de otro CC → rechazado al agregar al grupo
- [ ] F3-T6: Unit — MGC-S12: mismo alumno en G1 y G2 de la misma materia → ambos aceptados (co-docencia)
- [ ] F3-T7: Unit — MGC-S7: materia no partida con 1 grupo cubre todos los alumnos
- [ ] F3-T8: Unit — MGC-S8: materia partida con G1(D1) + G2(D2), subconjuntos distintos
- [ ] F3-T9: Integration — MGC-S1: "Generar" con plan de N materias → N `MateriaXCursoXCiclo` creadas
- [ ] F3-T10: Integration — MGC-S2: crear `CicloLectivo` sin CC → 0 `MateriaXCursoXCiclo`
- [ ] F3-T11: Integration — backfill: SubjectAssignment → 1 grupo por materia con universo completo;
  doble corrida idempotente (skipDuplicates sin error)
- [ ] F3-T12: Integration — MGC-S13: cross-institution isolation

---

## Fase 4 — Asignación nivel curso (AsignacionCursoXCiclo) (tenant) · PR 4/7

**Satisface**: ACC-R1 a ACC-R5
**Decisión D2**: múltiples DocenteXCiclo por CursoXCiclo; `turno` opcional e informativo, sin constraint
**Decisión D5**: `CourseCycle.homeroomTeacherId` se depreca (comentario en schema) pero NO se elimina
**Depende de**: Fase 2 (DocenteXCiclo). **Paralela con Fase 3** (no hay FK entre ambas)

### Schema & Migración

- [ ] F4-S1: Agregar enums al tenant schema:
  `enum RolCurso { PRECEPTOR TITULAR }` · `enum TurnoCurso { MANANA TARDE VESPERTINO NOCHE }`
- [ ] F4-S2: Agregar modelo `AsignacionCursoXCiclo`:
  `courseCycleId → CourseCycle.uuid (FK)`, `docenteXCicloId FK → DocenteXCiclo.id`,
  `rol RolCurso`, `turno TurnoCurso?`,
  `@@unique([courseCycleId, docenteXCicloId, rol, turno])` (turno null = distintos de turno no-null en Postgres),
  `@@index([courseCycleId])`, `@map("asignaciones_curso_x_ciclo")`
- [ ] F4-S3: Agregar comentario `// @deprecated — migrado a AsignacionCursoXCiclo rol=TITULAR (Fase 4)`
  al campo `homeroomTeacherId` en `CourseCycle` (sin dropearlo — D5)
- [ ] F4-S4: Generar migración Prisma + deploy multi-tenant

### Backfill Script

- [ ] F4-B1: Crear `api/scripts/backfill-asignacion-curso.ts`:
  - Por cada CourseCycle activo con `homeroomTeacherId != null`:
    buscar el `DocenteXCiclo` del Teacher vinculado (vía Teacher.userId → DocenteXCiclo)
    → upsert `AsignacionCursoXCiclo(courseCycleId, docenteXCicloId, rol=TITULAR, turno=null)` (skipDuplicates)
  - El campo `homeroomTeacherId` NO se borra (D5)
  - Loguear CCs donde el Teacher no tiene DocenteXCiclo (edge case; debería ser 0 tras Fase 2)
- [ ] F4-B2: Validar idempotencia

### Dominio

- [ ] F4-D1: Entidad `AsignacionCursoXCiclo` + enums `RolCurso`, `TurnoCurso` en `@educandow/domain`
- [ ] F4-D2: Interface `AsignacionCursoXCicloRepository`:
  `assign(data)`, `findByCourseId(courseCycleId)`,
  `findByCourseAndDocente(courseCycleId, docenteXCicloId)`,
  `isPreceptor(userId, courseCycleId): Promise<boolean>`,
  `remove(id)`

### Infraestructura

- [ ] F4-I1: `PrismaAsignacionCursoXCicloRepository`
- [ ] F4-I2: Registrar en el módulo NestJS correspondiente

### Aplicación

- [ ] F4-A1: `AssignDocenteToCursoUseCase`:
  - Recibe `(courseCycleId, userId, rol: RolCurso, turno?: TurnoCurso)`
  - Valida que el `cycleId` del CC coincide con el ciclo del userId (ACC-S6)
  - Llama `DocenteXCicloService.getOrCreateForCycle(userId, cycleId)` → obtiene `docenteXCicloId`
  - Sin restricción de unicidad de turno (D2 — ACC-S2: 2 preceptores en el mismo turno son válidos)
  - Persiste `AsignacionCursoXCiclo`
- [ ] F4-A2: `ListAsignacionesCursoUseCase`: lista asignaciones del CC con persona desde User master
- [ ] F4-A3: `RemoveAsignacionCursoUseCase`

### Presentación

- [ ] F4-P1: `POST /course-cycles/:ccId/asignaciones` — asignar DocenteXCiclo como preceptor o titular
- [ ] F4-P2: `GET /course-cycles/:ccId/asignaciones` — listar con persona enriquecida
- [ ] F4-P3: `DELETE /course-cycles/:ccId/asignaciones/:id`
- [ ] F4-P4: DTOs: `{ rol, turno?, docenteXCicloId, userId, firstName, lastName, ... }`

### Tests

- [ ] F4-T1: Unit — D2/ACC-S2: segundo preceptor en el mismo turno → sin conflicto, ambos válidos
- [ ] F4-T2: Unit — ACC-S6: asignar DocenteXCiclo de ciclo C2 a CC de ciclo C1 → rechazado
- [ ] F4-T3: Unit — ACC-S7: asignar preceptor no crea ni modifica ningún GrupoXCursoXMateriaXCiclo
- [ ] F4-T4: Unit — ACC-S4/S5: asignar titular funciona; reemplazar titular actualiza la asignación
- [ ] F4-T5: Integration — ACC-S1: preceptor asignado con turno → persiste correctamente
- [ ] F4-T6: Integration — ACC-S3: 2 preceptores con distintos turnos en el mismo CC
- [ ] F4-T7: Integration — ACC-S8: cross-tenant isolation
- [ ] F4-T8: Integration — backfill: `homeroomTeacherId` → `AsignacionCursoXCiclo TITULAR`;
  doble corrida idempotente; campo `homeroomTeacherId` sigue presente en el CC

---

## Fase 5 — Notas por grupo + validación de escritura (fix bug) · PR 5/7

**Satisface**: notas delta (todas las escenas) — cierra bug de autorización en upsert
**Decisión D3**: SECRETARIO/DIRECTOR/ADMIN/ROOT pueden escribir notas sin asignación a grupo
**Sin cambio de schema** (notas siguen keyeadas por `(student, courseCycle, subject)`)
**Depende de**: Fase 3 (GrupoRepository, AlumnosXGrupoRepository disponibles)

### Dominio

- [ ] F5-D1: Crear port `AssignmentAuthorizerPort` en `@educandow/domain`:
  `canWriteGrades(userId, userRoles, materiaXCursoXCicloId): Promise<boolean>`
  (abstrae la verificación de los 3 pasos: userId→DocenteXCiclo→Grupo→pertenencia)
- [ ] F5-D2: Extender `GrupoRepository` con `findGroupsForDocente(docenteXCicloId, materiaXCursoXCicloId)`
  si no fue agregado en Fase 3
- [ ] F5-D3: Extender `DocenteXCicloRepository` con `findByUserAndCycle(userId, cycleId)`
  si no fue agregado en Fase 2

### Aplicación

- [ ] F5-A1: Implementar `AssignmentAuthorizer` (application service):
  ```
  userId
    → DocenteXCiclo(cycleId del CC)
    → GrupoXCursoXMateriaXCiclo(materia del subject en ese CC)
    → ¿studentId ∈ AlumnosXGrupo de esos grupos?
  ```
  ROOT bypass completo. SECRETARIO/DIRECTOR/ADMIN bypass Door 2 (D3) — solo validan Door 1 (módulo).
  Cachear el `docenteXCicloId` en el request scope si es posible (evitar N+1 en upserts batch).
- [ ] F5-A2: Modificar `get-subject-grades-by-subject.use-case.ts`:
  - Reemplazar la authz basada en `Teacher + SubjectAssignment` por `AssignmentAuthorizer`
  - Para TEACHER: filtrar alumnos retornados al subconjunto del/los grupo(s) asignados al docente
  - Para SECRETARIO/DIRECTOR: retornar todos los alumnos de todos los grupos (notas delta — "Secretario ve todos")
  - Mantener ROOT bypass existente
- [ ] F5-A3: Modificar `upsert-subject-period-grades.use-case.ts`:
  - Llamar `AssignmentAuthorizer.canWriteGrades(userId, userRoles, materiaXCursoXCicloId)`
    ANTES de cualquier `saveMany` (notas delta — "Write validates group assignment")
  - Retornar `{ forbidden: true }` / HTTP 403 si falla; NO escribir ningún registro
- [ ] F5-A4: Modificar `upsert-subject-final-grades.use-case.ts`: igual que F5-A3
- [ ] F5-A5: Documentar en ambos upserts que el `@@unique` en `SubjectPeriodGrade/SubjectFinalGrade`
  garantiza 1 registro por alumno-materia; co-docencia comparte el mismo registro (notas delta — "Co-docencia")

### Tests

- [ ] F5-T1: Unit — Docente no asignado → 403 en `upsert-subject-period-grades` (bug cerrado)
- [ ] F5-T2: Unit — Docente no asignado → 403 en `upsert-subject-final-grades`
- [ ] F5-T3: Unit — Docente en misma institución pero distinta materia → 403 (asignación de grupo específico requerida)
- [ ] F5-T4: Unit — Docente asignado → 200, grade persistido
- [ ] F5-T5: Unit — Co-docencia: D2 sobreescribe registro de D1 → 1 registro, sin duplicado (notas delta escena co-docencia)
- [ ] F5-T6: Unit — ROOT → bypass de authz, escribe siempre
- [ ] F5-T7: Unit — SECRETARIO/DIRECTOR → bypass Door 2 (D3), escribe sin asignación de grupo
- [ ] F5-T8: Integration — `get-subject-grades`: TEACHER D1 ve solo alumnos de G1 (no G2 de la misma materia)
- [ ] F5-T9: Integration — `get-subject-grades`: SECRETARIO ve todos los alumnos de G1 y G2

---

## Fase 6 — Asistencia (ausentes por materia + presente diario) · PR 6/7

**Satisface**: asistencia delta (todas las escenas)
**Decisión D3**: SECRETARIO/DIRECTOR/ADMIN/ROOT pueden leer/escribir asistencia sin asignación
**Depende de**: Fase 3 (grupos para ausencias por materia) + Fase 4 (AsignacionCursoXCiclo para preceptor)
**Nota**: Revisar schema tenant actual de asistencia antes de definir si se agregan columnas
  o tablas nuevas — la decisión de schema la toma el apply

### Schema & Migración

- [ ] F6-S1: Auditar schema tenant actual: identificar tabla(s) de asistencia existentes
  (`attendance`, `studentAttendance`, o similar). Determinar si ya existe la discriminación
  ausencia-por-materia vs presencia-diaria o si se requiere una tabla nueva / nuevas columnas.
- [ ] F6-S2: Agregar modelo `AusenciaXGrupo` (ausencias por materia) si no existe separación:
  `grupoId FK → GrupoXCursoXMateriaXCiclo.id`, `studentId FK`, `date Date`,
  `observaciones String?`, `@@unique([grupoId, studentId, date])`, `@@index([grupoId, date])`
- [ ] F6-S3: Verificar que la tabla de asistencia diaria tiene `courseCycleId FK` y `date`.
  Agregar `courseCycleId` si falta. Asegurar que diaria y por-materia son tipos/tablas separados
  y no se mezclan (asistencia delta — "registros independientes").
- [ ] F6-S4: Generar migración + deploy multi-tenant

### Dominio

- [ ] F6-D1: Definir o extender port `SubjectAbsenceRepository`:
  `record(grupoId, studentId, date, obs?)`, `findByGrupoAndDate(grupoId, date)`, `delete(id)`
- [ ] F6-D2: Definir o extender port `DailyAttendanceRepository`:
  `record(courseCycleId, studentId, date, type)`,
  `findByCourseAndDate(courseCycleId, date)`

### Infraestructura

- [ ] F6-I1: `PrismaSubjectAbsenceRepository` (o extensión del repo de asistencia existente)
- [ ] F6-I2: `PrismaDailyAttendanceRepository` (o extensión del repo existente)
- [ ] F6-I3: Registrar en módulo NestJS

### Aplicación

- [ ] F6-A1: `RecordSubjectAbsenceUseCase`:
  - Door 1: módulo `ATTENDANCE:CREATE` del User
  - Door 2: `AssignmentAuthorizer` (reutilizar de Fase 5) — verifica que el userId es DocenteXCiclo
    asignado al grupo (adaptado para attendance scope)
  - D3: SECRETARIO/DIRECTOR bypass Door 2
  - Rechaza si teacher no está en el grupo → HTTP 403 (asistencia delta escena 2)
- [ ] F6-A2: `RecordDailyAttendanceUseCase`:
  - Door 1: módulo `ATTENDANCE:CREATE`
  - Door 2: `AsignacionCursoXCicloRepository.isPreceptor(userId, courseCycleId)`
  - D3: SECRETARIO/DIRECTOR bypass Door 2
  - Rechaza si user no es preceptor del CC → HTTP 403 (asistencia delta escena 5)
  - Los registros de asistencia diaria son independientes de los de ausencias por materia (asistencia delta escena "independientes")
- [ ] F6-A3: `GetSubjectAbsencesUseCase`: lectura scoped al grupo para TEACHER; scope completo para SECRETARIO/DIRECTOR
- [ ] F6-A4: `GetDailyAttendanceUseCase`: lectura scoped al CC para PRECEPTOR; scope completo para SECRETARIO/DIRECTOR

### Presentación

- [ ] F6-P1: `POST /grupos/:grupoId/ausencias` — registrar ausencia por materia
- [ ] F6-P2: `GET /grupos/:grupoId/ausencias?date=` — listar ausencias del grupo por fecha
- [ ] F6-P3: `POST /course-cycles/:ccId/asistencia-diaria` — registrar presencia diaria
- [ ] F6-P4: `GET /course-cycles/:ccId/asistencia-diaria?date=`
- [ ] F6-P5: DTOs para request y response de ambos tipos

### Tests

- [ ] F6-T1: Unit — Door 1 pass + Door 2 pass → ausencia por materia aceptada
- [ ] F6-T2: Unit — Door 1 pass + Door 2 fail (no asignado al grupo) → 403 (asistencia delta escena 2)
- [ ] F6-T3: Unit — Door 1 fail (sin módulo) + Door 2 pass → 403
- [ ] F6-T4: Unit — D3: SECRETARIO lee toda la asistencia de su scope (asistencia delta escena "Secretario lee")
- [ ] F6-T5: Unit — Materia partida: D1 registra G1, D2 registra G2 simultáneamente → sin conflicto (asistencia delta escena 3)
- [ ] F6-T6: Unit — Teacher de materia sin asignación de preceptor intenta asistencia diaria → 403 (asistencia delta escena 4)
- [ ] F6-T7: Unit — Preceptor asignado registra asistencia diaria del CC → 200 (asistencia delta escena 1)
- [ ] F6-T8: Integration — registro diario y registro por materia del mismo alumno en la misma fecha → ambos persisten independientemente (asistencia delta escena "registros independientes")
- [ ] F6-T9: Integration — 3-door enforcement: módulo presente + asignación ausente → 403; viceversa → 403; ambos → 200

---

## Fase 7 — UI: navegación Curso→Materia→Grupo, filtros por rol · PR 7/7

**Satisface**: spec UI derivada de todas las capabilities anteriores
**Depende de**: Fases 3, 4, 5 y 6 completadas (todos los endpoints disponibles)

### Navegación

- [ ] F7-N1: Agregar entrada/enlace desde la vista de CursoXCiclo hacia "Materias del ciclo"
  (consume `GET /course-cycles/:ccId/materias`)
- [ ] F7-N2: Desde cada materia: link a grupos. Si `grupos.length === 1` → navegar directo al único grupo.
  Si `grupos.length > 1` → mostrar selector de grupo antes de abrir la vista de notas/asistencia.
- [ ] F7-N3: Guard de ruta: acceso a notas requiere módulo GRADES; acceso a asistencia requiere ATTENDANCE.
  Sin el módulo → redirigir a no-autorizado.

### Filtrado por Rol

- [ ] F7-R1: TEACHER (módulo GRADES sin rol SECRETARIO/DIRECTOR):
  ve solo sus grupos asignados en la lista de grupos de cada materia
- [ ] F7-R2: SECRETARIO/DIRECTOR/ADMIN: ve todos los grupos de la materia
- [ ] F7-R3: Ocultar botón "Asignar docente a grupo" y "Asignar preceptor/titular" para TEACHER;
  visible para SECRETARIO/ADMIN
- [ ] F7-R4: HTTP 403 recibido desde el backend → mostrar mensaje de "Sin acceso" (no crash)

### Vista de Notas

- [ ] F7-G1: Tabla de notas renderiza solo alumnos del grupo activo (para TEACHER);
  renderiza todos los alumnos con indicador de grupo (para management)
- [ ] F7-G2: Selector de grupo visible condicionalmente cuando `grupos.length > 1`;
  oculto automáticamente para materia no partida
- [ ] F7-G3: Mensaje de error amigable si docente recibe 403 al intentar editar una nota fuera de su scope

### Vista de Asistencia

- [ ] F7-A1: Vista de "Asistencia diaria" accesible desde el panel del CursoXCiclo (no desde la materia).
  Solo visible para usuarios con asignación de preceptor en ese CC o con rol SECRETARIO/DIRECTOR.
- [ ] F7-A2: Vista de "Ausencias por materia" accesible desde el grupo (dentro de la materia).
  Solo visible para el docente asignado al grupo o para SECRETARIO/DIRECTOR.
- [ ] F7-A3: Ambas vistas claramente diferenciadas en la UI (labels distintos, no mezclar tipos)

### UX de Asignación

- [ ] F7-U1: Panel SECRETARIO/ADMIN en materia: asignar/desasignar docente a un grupo
  (llama `POST /grupos/:grupoId` o equivalente de CreateGrupo con docenteId)
- [ ] F7-U2: Panel SECRETARIO/ADMIN en CursoXCiclo: asignar preceptor/titular con turno opcional (D2)
  (llama `POST /course-cycles/:ccId/asignaciones`)
- [ ] F7-U3: Campo `turno` en formulario de asignación marcado como "(opcional)" — D2

### UX de Re-generación (D1)

- [ ] F7-D1: El botón "Generar" en CursoXCiclo muestra una advertencia si el CC ya tiene
  `MateriaXCursoXCiclo` existentes: "Este curso ya fue generado. Se agregarán las materias
  faltantes del plan y se re-sincronizarán las descripciones."
- [ ] F7-D2: La advertencia indica explícitamente que NO se tocarán notas, grupos ni alumnos ya cargados (D1)

### Tests

- [ ] F7-T1: Component — selector de grupo no renderiza cuando `grupos.length === 1`
- [ ] F7-T2: Component — selector de grupo renderiza opciones cuando `grupos.length > 1`
- [ ] F7-T3: Component — TEACHER: solo sus grupos aparecen en la lista de la materia
- [ ] F7-T4: Component — SECRETARIO: todos los grupos aparecen
- [ ] F7-T5: Component — route guard redirige a no-autorizado si user no tiene módulo GRADES
- [ ] F7-T6: Component — botón "Asignar docente" oculto para TEACHER, visible para ADMIN
- [ ] F7-T7: Component — advertencia de re-generación presente cuando CC ya tiene materias

---

## Review Workload Forecast

| Fase | PR | Est. líneas | Riesgo 400L | Chained PR recomendado |
|------|----|-------------|-------------|------------------------|
| 1 — Persona User (master) | 1/7 | ~250 | **Low** | No |
| 2 — DocenteXCiclo (tenant) | 2/7 | ~500 | **High** | Sí: 2a schema/domain/infra · 2b app/backfill/tests |
| 3 — Materia + Grupos (tenant) | 3/7 | ~1300 | **Very High** | Sí: 3a schema · 3b domain/infra · 3c app/backfill/tests |
| 4 — AsignacionCursoXCiclo (tenant) | 4/7 | ~480 | **High** | Sí: 4a schema/domain · 4b app/backfill/tests |
| 5 — Notas authz fix (sin schema) | 5/7 | ~360 | **Medium** | No (borderline; monitorear) |
| 6 — Asistencia | 6/7 | ~640 | **High** | Sí: 6a schema/domain · 6b app/tests |
| 7 — UI | 7/7 | ~700 | **High** | Sí: 7a nav/roles · 7b notas/asistencia/UX |

**Chained PRs recommended: Yes**

**400-line budget risk: High** — Fases 2, 3, 4, 6, 7 exceden el presupuesto individualmente.
La Fase 3 es Very High (~1300 líneas) y requiere sub-split mandatorio o `size:exception` explícita.

**Decision needed before apply: Yes**

Puntos de decisión críticos antes de iniciar el apply:
1. **Fase 3**: definir sub-split (3a/3b/3c) o aprobar `size:exception` por la magnitud de entidades nuevas.
2. **Fase 6**: auditar schema de asistencia actual antes de diseñar la migración; la estructura de tabla puede variar si ya existe discriminación diaria/por-materia.
3. **Fases 2, 4**: confirmar si se prefiere sub-split o se acepta el tamaño con un reviewer adicional.

Total estimado de la iniciativa: ~4230 líneas en 7 PRs base (~12–14 PRs si se sub-splitean las fases grandes).
