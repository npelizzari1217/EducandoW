# Delta for Smart Course Creation

> Capability: smart-course-creation (MODIFIED)
> Change: docente-ciclo-grupos · Fase 3
> Base spec: openspec/specs/smart-course-creation/spec.md

## ADDED Requirements

### Requirement: CursoXCiclo Generation Materializes Plan Subjects

When a user generates a `CursoXCiclo` by selecting a `CicloLectivo`, a study plan,
and confirming ("Generar"), the system SHALL create one `MateriaXCursoXCiclo` record
for every subject in the selected study plan, linked to the newly created `CursoXCiclo`.
Creating a `CicloLectivo` alone MUST NOT produce subject rows.

#### Scenario: Generating CursoXCiclo materializes all plan subjects

- GIVEN a CicloLectivo C1 and a StudyPlan with subjects [Matemática, Lengua, Historia]
- WHEN the user selects C1 + that plan and presses "Generar"
- THEN 3 MateriaXCursoXCiclo records are created, linked to the new CursoXCiclo
- AND the CursoXCiclo record itself is persisted in the same operation

#### Scenario: Creating the academic cycle alone does not materialize subjects

- GIVEN a new CicloLectivo is created with no CursoXCiclo associated
- WHEN the CicloLectivo is saved
- THEN zero MateriaXCursoXCiclo records are created

#### Scenario: Re-generating with no linked data replaces subject rows

- GIVEN CursoXCiclo CC1 was generated with PlanA (5 subjects)
- AND no grades, groups, or student-subject records are linked to CC1
- WHEN CC1 is regenerated selecting PlanB (7 subjects)
- THEN the 5 original MateriaXCursoXCiclo rows are removed and 7 new ones are created

#### Scenario: Re-generation blocked when graded data exists

- GIVEN CursoXCiclo CC1 was generated with PlanA and at least one grade record exists
- WHEN CC1 is regenerated with a different plan
- THEN the operation is rejected to protect existing grade data

---

### Requirement: Student Enrollment in CursoXCiclo Is Manual

Students are NOT auto-populated when a `CursoXCiclo` is generated. An authorized user
MUST add students individually, selecting from the students already enrolled in the
institution (the student registry). The ingresantes / new-enrollment flow is NOT a
valid source. Bulk assignment is OUT OF SCOPE.

#### Scenario: Generation completes with zero students enrolled

- GIVEN a CursoXCiclo is generated from a cycle + study plan
- WHEN the generation operation completes
- THEN no AlumnosXMateriaXCursoXCiclo records are created automatically;
  the student list for every subject is empty until populated manually

#### Scenario: Student from enrolled registry added to the course

- GIVEN student S is enrolled in institution I1 (present in the student registry)
- AND CursoXCiclo CC1 exists in I1
- WHEN an authorized user adds S to CC1
- THEN S becomes available as a candidate in AlumnosXMateriaXCursoXCiclo for the subjects of CC1
