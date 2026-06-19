# Delta for Report Cards

> Change: retiro-grading-legacy-s3pre · 2026-06-19
> Base spec: openspec/specs/report-cards/spec.md
> Depends on: informe-avance-inicial (2026-06-17), evaluacion-terciario (2026-06-18),
>             boletin-terciario (2026-06-18) — all archived.

---

## RETIRED Requirements

### Requirement: Legacy NotaTrimestral Path in buildMaterias() — RETIRED

> Base section: "Level-Specific PDF Templates" (report-cards/spec.md)

The `else` branch in `GenerateBoletinUseCase.buildMaterias()` (lines 244-334 of
`generate-boletin.use-case.ts`) that reads `NotaTrimestral` and `CourseCycles` for
decade-2/3 students when repos are NOT injected MUST be removed in PR-a.

This path is dead code: `reportes.module.ts` always injects all four repos
(`sgpRepo`, `pgRepo`, `fgRepo`, `cvRepo`), making the `else` branch unreachable for any
pedagogical level in production.

The `isInicial` check (lines 263-269) and `resolveDocentesForStudentCC` (lines 906-1001)
are colocated dead code within this path and MUST be removed together with it.

**Reason for retirement**: All four pedagogical levels dispatch to dedicated branches before
reaching the `else` arm. The tables it reads (`NotaTrimestral`, `SubjectAssignment`)
are dropped in PR-b.

---

### Requirement: SubjectAssignment Must Remain Intact — RETIRED

> Base section: "Docente Name Source in Generated PDFs" (report-cards/spec.md)
> Originally added: retiro-boletin-docente-s2 · 2026-06-17

The following constraint is RETIRED in its entirety:

> "The `SubjectAssignment` table and its rows MUST remain intact. The legacy
> Inicial/Terciario branch still queries `SubjectAssignment` for the subject list and as
> the join key to `NotaTrimestral` grades (`NotaTrimestral.assignmentId`;
> `NotaTrimestral` has no `subjectId`). Removing `SubjectAssignment` from this branch
> requires a separate migration stage."

**Reason for retirement**: retiro-grading-legacy-s3pre IS that separate migration stage.
`SubjectAssignment` is dropped in PR-b. The legacy branch that queried it is removed in PR-a.

---

### Requirement: NotaTrimestral-Based Boletín PDF Invalidation — RETIRED

> Base section: "PDF Storage and Re-download" (report-cards/spec.md)

The following implementation clause is RETIRED:

> "Invalidation is handled by `BoletinInvalidationService`, injected into
> `PedagogyController` and called after `postNotaTrimestral` and `deleteNotaTrimestral`."

**Reason for retirement**: The `notas_trimestrales` table is dropped in PR-b.
The endpoints `postNotaTrimestral` and `deleteNotaTrimestral` MUST NOT exist once the
domain entity and backing table are removed.

**Out of scope for this change**: Re-wiring `BoletinInvalidationService` to the new
grading model events for PRIMARIO and SECUNDARIO. The broader caching invalidation
policy (first paragraph of the PDF Storage requirement) remains in force.

---

## MODIFIED Requirements

### Requirement: Docente Name Source in Generated PDFs

> Base section: retiro-boletin-docente-s2 addition in report-cards/spec.md

The "SubjectAssignment Must Remain Intact" paragraph (retired above) MUST be removed.

All remaining constraints remain in force:
- INICIAL: `docente` MUST be sourced from the DocenteXCiclo chain resolved to
  `User.firstName` / `User.lastName` via the master Prisma client.
- PRIMARIO and SECUNDARIO: `MateriaBoletin.docente` MUST equal `""` with zero queries
  against `SubjectAssignment` or the DocenteXCiclo chain.
- TERCIARIO: `docente` MUST be `""` with no teacher-related query.
- No branch MUST read the `Teacher` table.

---

### Requirement: TERCIARIO Boletín Data Source (Transcript Model)

> Base section: "TERCIARIO Boletín Data Source" (report-cards/spec.md)
> Originally added: boletin-terciario · 2026-06-18

The positional clause "inserted BEFORE the legacy `else` that reads `NotaTrimestral`" is
superseded. After this change, no legacy `else` branch exists.

The updated statement is:

`buildMaterias()` MUST route TERCIARIO students (decade-4) to `buildMateriasTerciario`
as the last named branch in the dispatch chain. No legacy fallback branch MUST exist
after this function.

All other constraints (data source: `InscripcionMateria` + `NotaCursadaTerciario` +
`ActaExamenNota`; no reads of `NotaTrimestral` or `CourseCycles`; `DatosBoletin` carries
`cuatrimestresTerciario` and `carreraName`) remain in force unchanged.

---

## ADDED Requirements

### Requirement: No Legacy Table Reads in Boletín Generation (Post-Drop Regression Guard)

After PR-a is applied (dead code removal), `GenerateBoletinUseCase` MUST NOT issue
queries against any of the five legacy tables for any pedagogical level:
`notas`, `evaluaciones`, `notas_trimestrales`, `periodos_evaluacion`, `subject_assignments`.

This MUST be verifiable via unit-test Prisma mock assertions: the keys `notaTrimestral`,
`evaluacion`, `nota`, `periodoEvaluacion`, and `subjectAssignment` MUST NOT appear
in any mock call against the tenant Prisma client within `generate-boletin.use-case.ts`.

#### Scenario: INICIAL — boletín does not query legacy tables

- GIVEN a student enrolled at INICIAL level
- WHEN `GET /v1/reportes/boletin/:enrollmentId` is called
- THEN `GenerateBoletinUseCase` dispatches to `buildMateriasInicial` via the decade-1 branch
- AND zero queries against `notas_trimestrales`, `evaluaciones`, `notas`,
  `periodos_evaluacion`, or `subject_assignments` are issued by the use case

#### Scenario: PRIMARIO — boletín does not query legacy tables

- GIVEN a student enrolled at PRIMARIO level
- AND `sgpRepo` is injected by `reportes.module.ts`
- WHEN `GET /v1/reportes/boletin/:enrollmentId` is called
- THEN `GenerateBoletinUseCase` dispatches to `buildMateriasPrimario` via the decade-2+repos branch
- AND zero queries against the five dropped tables are issued

#### Scenario: SECUNDARIO — boletín does not query legacy tables

- GIVEN a student enrolled at SECUNDARIO level
- AND `pgRepo` is injected by `reportes.module.ts`
- WHEN `GET /v1/reportes/boletin/:enrollmentId` is called
- THEN `GenerateBoletinUseCase` dispatches to `buildMateriasSecundario` via the decade-3+repos branch
- AND zero queries against the five dropped tables are issued

#### Scenario: TERCIARIO — boletín does not query legacy tables

- GIVEN a student enrolled at TERCIARIO level
- WHEN `GET /v1/reportes/boletin/:enrollmentId` is called
- THEN `GenerateBoletinUseCase` dispatches to `buildMateriasTerciario` via the decade-4 branch
- AND zero queries against the five dropped tables are issued

#### Scenario: No legacy else-branch reachable after PR-a

- GIVEN `generate-boletin.use-case.ts` after PR-a is applied
- WHEN `buildMaterias()` is invoked for a student of any pedagogical level
- THEN the function MUST NOT contain a code path that references `NotaTrimestral`,
  `notaTrimestral`, `SubjectAssignment`, `subjectAssignment`, or `resolveDocentesForStudentCC`
- AND this is verifiable by static grep of the file after PR-a is merged
