# Proposal: Curso por Ciclo (CourseCycle)

## Intent

Vincular cursos del plan de estudio con ciclos lectivos. Hoy `CourseSection` existe suelto con `academicYear` como string libre, sin FK a `AcademicCycle`. Esto impide saber qué cursos pertenecen a qué ciclo, filtrar por ciclo, o cerrar un ciclo bloqueando modificaciones. Se necesita una entidad intermedia `CourseCycle` (patrón Enrollment: `Student` + `AcademicCycle` → `Enrollment`).

**Nivel pedagógico**: ALL — Inicial, Primario, Secundario, Terciario.

## Scope

### In Scope
- Entidad `CourseCycle` con 18 campos (ID autonumérico, FKs a Curso/StudyPlan/AcademicCycle, nombre en MAYÚSCULA, nivel, active, calificación, texto promoción, 8 fechas de bimestre, fecha última modificación)
- Value Objects: nombre uppercased, notas, fechas
- Repositorio Prisma con unique constraint `(courseId, cycleId)`
- Use cases: CRUD, listar por ciclo+nivel, listar por plan, toggle active/inactive
- Use case "Generar cursos": dado StudyPlan + AcademicCycle, crea CourseCycle para todos los cursos del plan (sin duplicados)
- Endpoints REST: `GET/POST/PATCH/DELETE /v1/course-cycles` + `POST /v1/course-cycles/generate`
- Frontend: página con tabla filtrable por nivel+ciclo, formulario CRUD, combobox para asignación, botón "Generar cursos"
- Soft delete, regla `active=false` bloquea modificaciones propias y de dependencias

### Out of Scope
- Relación CourseCycle → Student (matrícula por curso-ciclo, fase siguiente)
- Relación CourseCycle → Teacher (asignación docente)
- Relación CourseCycle → Subject (materias del curso en el ciclo)
- Migración de datos históricos (los `academicYear` sueltos en CourseSection no se migran)

## Capabilities

### New Capabilities
- `course-cycle`: Entidad CourseCycle — CRUD, generación masiva desde plan de estudio, filtrado por ciclo y nivel, activación/desactivación con bloqueo de edición

### Modified Capabilities
- None (nuevo bounded context, no modifica specs existentes)

## Approach

1. **Prisma**: nueva tabla `course_cycles` en `schema_tenant.prisma` con FK a `CourseSection`, `StudyPlan`, `AcademicCycle`. Unique `(courseId, cycleId)`. ID autonumérico (`@default(autoincrement())`), NO UUID.
2. **Domain** (`@educandow/domain`): entidad `CourseCycle` con factory `create()`, Value Objects para `CourseName` (uppercase), `PassingGrade`, `BimestreDate`. Inmutabilidad histórica: ciertos campos calculables se guardan al crear.
3. **Application** (`api/src/application/course-cycle/use-cases/`): `CreateCourseCycleUseCase`, `UpdateCourseCycleUseCase`, `DeleteCourseCycleUseCase`, `ListCourseCyclesUseCase`, `GetCourseCycleUseCase`, `GenerateCourseCyclesUseCase` (generación masiva), `ToggleActiveUseCase`. Active=false → validation guard que rechaza modificaciones.
4. **Presentation** (`api/src/presentation/course-cycle/`): controller + DTOs Zod + module. Endpoints bajo `/v1/course-cycles`.
5. **Frontend** (`web/src/pages/dashboard/course-cycles.tsx`): tabla con filtros (combo nivel + combo ciclo), formulario, botón "Generar cursos". Combobox para selección de curso. NUNCA mostrar ID, siempre `nombre`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/prisma/schema_tenant.prisma` | Modified | Nueva tabla `course_cycles` + relaciones FK |
| `packages/domain/src/course-cycle/` | New | Entidad CourseCycle + Value Objects |
| `api/src/application/course-cycle/` | New | Use cases (CRUD, generar, toggle) |
| `api/src/infrastructure/persistence/prisma/repositories/` | New | `PrismaCourseCycleRepository` |
| `api/src/presentation/course-cycle/` | New | Controller, DTOs, module |
| `web/src/pages/dashboard/course-cycles.tsx` | New | Página CRUD + generar |
| `web/src/components/layout/sidebar.tsx` | Modified | Agregar "Cursos por Ciclo" al menú |
| `web/src/App.tsx` | Modified | Ruta `/course-cycles` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ID autonumérico en tenant schema (Prisma requiere `@@map` sin `@default(uuid())`) | Med | Probar migración en dev; Prisma soporta `@default(autoincrement())` nativo |
| Generación masiva puede crear cientos de registros | Low | `createMany` en transaction; skip duplicados vía unique constraint |
| Active=false debe bloquear cascade | Med | Validación en use case antes de cualquier write; test de integración |
| Colisión de unique constraint en generación concurrente | Low | Transaction con `skipDuplicates: true` de Prisma |

## Rollback Plan

1. Revertir migration (crear migration inversa y aplicarla)
2. Eliminar archivos creados: domain entity, use cases, controller, repositorio, página frontend
3. Remover entrada del sidebar y ruta de App.tsx
4. Ejecutar `pnpm test` para verificar que nada roto

## Dependencies

- `CourseSection` (cursos) — ya existe en schema_tenant
- `StudyPlan` (planes de estudio) — ya existe, endpoint `GET /v1/study-plans/:id/courses` disponible
- `AcademicCycle` (ciclos lectivos) — ya existe, endpoint `GET /v1/academic-cycles` disponible
- `@educandow/domain` — package compartido para entidades y Value Objects
- Patrón Enrollment — referencia de arquitectura para FK + unique constraint

## Success Criteria

- [ ] Migración crea tabla `course_cycles` con unique `(courseId, cycleId)` e ID autonumérico
- [ ] `POST /v1/course-cycles` crea un CourseCycle con nombre en MAYÚSCULA
- [ ] `POST /v1/course-cycles/generate` crea registros para todos los cursos de un plan en un ciclo, sin duplicados
- [ ] `PATCH` rechazado si `active=false` (HTTP 409)
- [ ] `GET /v1/course-cycles?cycleId=X&level=Y` filtra correctamente
- [ ] Frontend: tabla muestra nombre (no ID), combobox busca cursos, botón "Generar cursos" funcional
- [ ] Unit tests de dominio (Value Objects, immutabilidad), integration tests de repositorio (unique constraint, cascade)
- [ ] `pnpm test` pasa con ≥80% coverage en el nuevo código
