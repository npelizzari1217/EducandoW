# Proposal: Student Observations

## Intent

Legacy system WINDEV tracks pedagogical and psychopedagogical observations per student (`WIN_EOE_Table`, `WIN_EOE_PsicoPedagogia_Table`). EducandoW has NO observation system. Teachers and administrators need to record free-text observations linked to a student — academic notes, behavior reports, or EOE team interventions — with role-based visibility.

## Scope

### In Scope
- Domain entity `StudentObservation` with type discriminator (PEDAGOGICAL | PSYCHOPEDAGOGICAL)
- Database model: `studentId`, `type`, `content`, `authorId`, `createdAt`
- API: create, list by student, list by course, delete (author or admin)
- Role-based access: TEACHER+ create/view; author/admin delete
- PSYCHOPEDAGOGICAL type restricted to DIRECTOR+ and EOE roles

### Out of Scope
- Frontend UI (separate change)
- Audit log (existing audit-log pattern, optional follow-up)
- File attachments on observations

## Capabilities

### New Capabilities
- `student-observations`: pedagogical and psychopedagogical free-text observations per student

### Modified Capabilities
- None (new module, no spec-level changes to existing capabilities)

## Approach

Clean Architecture layers:

| Layer | Deliverable |
|-------|-------------|
| Domain | `ObservationType` VO (`PEDAGOGICAL \| PSYCHOPEDAGOGICAL`), `StudentObservation` entity, `StudentObservationRepository` port, domain errors |
| Application | `CreateObservation`, `ListObservationsByStudent`, `ListObservationsByCourse`, `DeleteObservation` use cases |
| Infrastructure | Prisma model `StudentObservation`, repository implementation, migration |
| Presentation | `ObservationController` with DTOs, `@Roles` decorator guards |

Access model: teachers (rank ≥ 20) create/view all PEDAGOGICAL observations, DIRECTOR+ (rank ≥ 50) create/view PSYCHOPEDAGOGICAL. Delete: author or ADMIN+. PSYCHOPEDAGOGICAL observations hidden from TEACHER-level list responses; only DIRECTOR+ and PRECEPTOR+ receive those.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/domain/src/pedagogy/` | New | `StudentObservation` entity, `ObservationType` VO, repository port |
| `api/src/application/student/` | New | Use cases for observation CRUD |
| `api/src/infrastructure/persistence/prisma/` | New | Repository impl + schema migration |
| `api/prisma_tenant/schema.prisma` | Modified | New `StudentObservation` model + relation to `Student` |
| `api/src/presentation/student/` | Modified | New controller + DTOs |

**Level**: ALL

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PSYCHOPEDAGOGICAL data leaking to TEACHER role | Low | `ListObservationsUseCase` filters by caller rank; tested via integration tests |
| N+1 queries listing observations per course | Low | Batch-load by student ID array in single query |

## Rollback Plan

1. Revert Prisma migration (down migration removes `student_observations` table)
2. Delete observation controller, use cases, entity, and repository
3. No existing data or endpoints depend on this — safe to remove

## Dependencies

- Existing `Student` table and `TEACHER`/`DIRECTOR`/`ADMIN` roles (already present)
- Schema migration policy (`db-migration-policy` spec)

## Success Criteria

- [ ] `POST /v1/students/:studentId/observations` creates observation with type and content
- [ ] `GET /v1/students/:studentId/observations` returns observations filtered by caller's role rank
- [ ] `GET /v1/courses/:courseId/observations` lists all students' observations in course context
- [ ] `DELETE /v1/observations/:id` succeeds for author or ADMIN+, returns 403 otherwise
- [ ] PSYCHOPEDAGOGICAL observations invisible to TEACHER role in list endpoints
