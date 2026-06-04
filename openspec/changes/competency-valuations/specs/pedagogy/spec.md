# Delta for Pedagogy

## ADDED Requirements

### Requirement: SubjectCompetency as Pedagogy Domain Entity

The `pedagogy` bounded context MUST include a `SubjectCompetency` domain entity
representing a named qualitative objective linked to a `Subject`.
The entity MUST be owned by the `pedagogy` package under
`packages/domain/src/pedagogy/entities/`.

Full spec: `openspec/changes/competency-valuations/specs/subject-competencies/spec.md`

#### Scenario: SubjectCompetency belongs to pedagogy bounded context

- GIVEN the system processes subject-level competency definitions
- WHEN `SubjectCompetency` is instantiated
- THEN it MUST reside in `packages/domain/src/pedagogy/entities/subject-competency.ts`
- AND it MUST NOT import from infrastructure or application layers

---

### Requirement: CompetencyValuation as Pedagogy Domain Entity

The `pedagogy` bounded context MUST include a `CompetencyValuation` domain entity
representing a student's qualitative assessment across four academic periods for
a single competency.
The entity MUST be owned by the `pedagogy` package under
`packages/domain/src/pedagogy/entities/`.

Full spec: `openspec/changes/competency-valuations/specs/competency-valuations/spec.md`

#### Scenario: CompetencyValuation belongs to pedagogy bounded context

- GIVEN the system processes student period-based competency assessments
- WHEN `CompetencyValuation` is instantiated
- THEN it MUST reside in `packages/domain/src/pedagogy/entities/competency-valuation.ts`
- AND it MUST NOT import from infrastructure or application layers

---

### Requirement: Repository Ports for Competency Entities

The `pedagogy` bounded context MUST define repository interfaces (ports) for
`SubjectCompetency` and `CompetencyValuation` in
`packages/domain/src/pedagogy/repositories/`.

These ports MUST follow the existing `IRepository` / Result pattern convention
already used in the domain package.

#### Scenario: Repository ports are in the domain layer

- GIVEN the Clean Architecture dependency rule
- WHEN `ISubjectCompetencyRepository` or `ICompetencyValuationRepository` is referenced
- THEN they MUST be importable from the domain package without pulling in Prisma or NestJS
