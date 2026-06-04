# Proposal: Competency Valuations

## Intent

Add competency-based qualitative assessment: define competencies per subject and record period-based valuations per student. The current system only handles numeric/conceptual grades (`Nota`, `CalificacionPrimario`, `CalificacionSecundario`) — it has no notion of competencies or rubrics linked to subjects. This replicates the WINDEV `ComXMatXCurXAlumno` functionality for qualitative competency tracking.

## Scope

### In Scope
- Define competencies/objectives per subject (name, active flag)
- Record 4-period competency valuations per student per competency
- Auto-create valuation records when subject assignments or student enrollments occur
- Editable/printable flags per period per valuation
- REST API: CRUD competencies, CRUD valuations, batch retrieval per student/subject

### Out of Scope
- Competency rubric templates (reusable across subjects)
- Competency-based promotion rules
- Frontend pages (separate change)

## Capabilities

### New Capabilities
- `subject-competencies`: define and manage competencies/objectives linked to a Subject entity
- `competency-valuations`: record, retrieve, and update period-based qualitative valuations per student per competency

### Modified Capabilities
- None

## Approach

Two new domain entities in `pedagogy` bounded context:

| Entity | Key fields | Trigger |
|--------|-----------|---------|
| `SubjectCompetency` | `subjectId`, `name`, `active` | Manual CRUD |
| `CompetencyValuation` | `studentId`, `competencyId`, `valuation{1-4}`, `modificable{1-4}`, `imprimible{1-4}`, `periodActive` | Auto-created on enrollment or subject assignment |

Auto-creation flow:
1. On `SubjectAssignment` creation → create `CompetencyValuation` records for every enrolled student in the course section, linked to each competency of the assigned subject
2. On student `Enrollment` creation → create `CompetencyValuation` records for all existing `SubjectAssignment`→`SubjectCompetency` combinations in the course section
3. Valuations default to empty, `modificable=true`, `imprimible=false`, `periodActive=1`

Infrastructure: new Prisma models + migration, NestJS module with use cases, REST controllers under `/v1/subject-competencies` and `/v1/competency-valuations`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/domain/src/pedagogy/entities/` | New | `subject-competency.ts`, `competency-valuation.ts` |
| `packages/domain/src/pedagogy/repositories/` | New | Repository ports |
| `api/prisma_tenant/schema.prisma` | Modified | New models `SubjectCompetency`, `CompetencyValuation` |
| `api/src/application/pedagogy/use-cases/` | New | CRUD use cases |
| `api/src/infrastructure/` | New | Prisma repositories |
| `api/src/presentation/` | New | NestJS controllers |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Auto-creation causes N+1 on bulk enrollment | Med | Batch insert via Prisma `createMany` |
| Race condition: enrollment + subject assignment in parallel | Low | DB unique constraint on `(studentId, competencyId)` |

## Rollback Plan

Revert migration (drop tables `subject_competencies`, `competency_valuations`), remove domain entities, controllers, and repository implementations. No existing data modified — purely additive.

## Dependencies

- `Subject`, `SubjectAssignment`, `Enrollment` entities (already exist)
- `SubjectAssignmentRepository`, `EnrollmentRepository` (read-only access needed)

## Success Criteria

- [ ] Competencies can be created, listed, updated, soft-deleted per subject
- [ ] Competency valuations auto-created on enrollment and subject assignment
- [ ] Valuations updatable per period when `modificable=true`
- [ ] Printable flag respected per period
- [ ] Coverage ≥ 80% (domain + use cases)
