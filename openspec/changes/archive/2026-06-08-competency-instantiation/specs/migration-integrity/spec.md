# Spec — migration-integrity

> **New spec**: covers the destructive schema migration and FK integrity rules for
> `CompetencyValuation` and `CompetencyPeriodValuation`.

---

## Scope

**In**: destructive migration steps (tables empty, user-confirmed); FK on-delete behaviors
for all relations touching the two valuation tables.
**Out**: data backfill (no data exists); read-endpoint shape changes (Fase 4);
`Enrollment→CourseCycle` FK (Fase 4).

---

## Requirement: Destructive Migration

The migration applies to a state where `competency_valuations` is empty and
`competency_period_valuations` does not yet exist. No backfill is needed.

The migration MUST execute the following steps in order:

1. **DROP** columns `valuation1`–`valuation4`, `modificable1`–`modificable4`,
   `imprimible1`–`imprimible4`, `periodActive` from `competency_valuations`.
2. **ADD** column `courseCycleId` (`String`, NOT NULL) to `competency_valuations`
   with FK → `CourseCycle.uuid`.
3. **DROP** the existing UNIQUE constraint on `(studentId, competencyId)`.
4. **ADD** new UNIQUE constraint on `(studentId, competencyId, courseCycleId)`.
5. **CREATE** table `competency_period_valuations` as specified in
   `normalized-valuation-model/spec.md`.

The migration is safe to re-run on empty tables (idempotent intent).

### Scenario MI-1: Migration succeeds on empty tables

- GIVEN `competency_valuations` is empty and `competency_period_valuations` does not exist
- WHEN the migration is applied
- THEN the resulting schema has `courseCycleId` on `competency_valuations`, flat columns
  are absent, and `competency_period_valuations` table exists with the correct structure
- AND no data is lost (tables were empty)

### Scenario MI-2: Post-migration insert without courseCycleId is rejected

- GIVEN the migration has been applied
- WHEN a `CompetencyValuation` insert is attempted WITHOUT `courseCycleId`
- THEN the DB rejects it with a NOT NULL constraint violation

### Scenario MI-3: Post-migration insert with old flat columns is rejected

- GIVEN the migration has been applied
- WHEN an insert or query references columns `valuation1` or `periodActive`
- THEN the DB rejects it (columns do not exist)

---

## Requirement: FK Integrity Rules

The following FK on-delete behaviors MUST be enforced at the database level:

| Parent Entity                  | Child Entity                   | On Delete Parent |
|-------------------------------|-------------------------------|-----------------|
| `CourseCycle`                 | `CompetencyValuation`          | **RESTRICT**    |
| `CompetencyValuation`         | `CompetencyPeriodValuation`    | **CASCADE**     |
| `GradingPeriodTemplateItem`   | `CompetencyPeriodValuation`    | **RESTRICT**    |
| `SubjectCompetency`           | `CompetencyValuation`          | CASCADE (existing, preserved) |
| `Student`                     | `CompetencyValuation`          | CASCADE (existing, preserved) |

### Scenario MI-4: Cannot delete a CourseCycle that has valuations (Restrict)

- GIVEN a `CourseCycle` has one or more `CompetencyValuation` records
- WHEN a DELETE on that `CourseCycle` is attempted at the DB level
- THEN the DB raises a foreign key constraint violation and rejects the DELETE
- AND the `CourseCycle` record remains intact

### Scenario MI-5: Deleting a CourseCycle with no valuations succeeds

- GIVEN a `CourseCycle` has zero `CompetencyValuation` records
- WHEN it is deleted
- THEN the DELETE succeeds (Restrict does not fire with zero children)

### Scenario MI-6: Deleting a CompetencyValuation cascades to all its period children

- GIVEN a `CompetencyValuation` has 3 `CompetencyPeriodValuation` children
- WHEN the `CompetencyValuation` parent is deleted
- THEN all 3 `CompetencyPeriodValuation` children are deleted automatically (cascade)
- AND no orphan period-valuation rows remain

### Scenario MI-7: Cannot delete a GradingPeriodTemplateItem referenced by a period valuation (Restrict)

- GIVEN a `GradingPeriodTemplateItem` is referenced by at least one `CompetencyPeriodValuation`
- WHEN a DELETE on that `GradingPeriodTemplateItem` is attempted at the DB level
- THEN the DB raises a foreign key constraint violation and rejects the DELETE

### Scenario MI-8: Deleting a GradingPeriodTemplateItem with no period valuations succeeds

- GIVEN a `GradingPeriodTemplateItem` has no referencing `CompetencyPeriodValuation` rows
- WHEN it is deleted
- THEN the DELETE succeeds

### Scenario MI-9: Deleting a SubjectCompetency cascades to its CompetencyValuation records

- GIVEN a `SubjectCompetency` has `CompetencyValuation` records across multiple cycles
- WHEN the `SubjectCompetency` is deleted
- THEN all associated `CompetencyValuation` parents are deleted (existing cascade)
- AND via the CompetencyValuation→CompetencyPeriodValuation cascade, all period children
  are also deleted

### Scenario MI-10: Deleting a Student cascades to all their valuations

- GIVEN a `Student` has `CompetencyValuation` records across multiple cycles
- WHEN the `Student` is deleted
- THEN all their `CompetencyValuation` records are deleted (existing cascade)
- AND all associated `CompetencyPeriodValuation` rows are deleted transitively

---

## Invariants (post-migration)

1. `competency_valuations.courseCycleId` is NOT NULL — every parent is bound to a cycle.
2. UNIQUE `(studentId, competencyId, courseCycleId)` — one parent per student/competency/cycle triple.
3. UNIQUE `(valuationId, periodItemId)` — one child per valuation/period pair.
4. `CompetencyPeriodValuation` rows only exist if a grade has been explicitly assigned
   (lazy creation; the absence of a child row means "not yet graded").
5. `CourseCycle` records with existing valuations cannot be deleted without first removing
   those valuations.
6. `GradingPeriodTemplateItem` records with existing `CompetencyPeriodValuation` rows
   cannot be deleted.
