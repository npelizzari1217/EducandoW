# Delta for Pedagogy

## MODIFIED Requirements

### Requirement: AcademicCycle Extended Data Model

The system MUST persist each `AcademicCycle` with the following fields:

| Field | Type | Constraint |
|-------|------|------------|
| `id` | Int PK | autoincrement (replaces UUID PK) |
| `uuid` | String | unique, public identifier |
| `code` | String | alphanumeric uppercase 1–15 chars, `^[A-Z0-9][A-Z0-9\-]{0,14}$`, unique per tenant |
| `name` | String | required |
| `level` | `EducationalLevel` VO | INICIAL \| PRIMARIO \| SECUNDARIO \| TERCIARIO |
| `modality` | `EducationalModality` VO | COMUN \| TALLERES \| BILINGÜISMO |
| `startDate` | DateTime | required |
| `endDate` | DateTime | required |
| `active` | Boolean | default `true` |
| `deletedAt` | DateTime | nullable, soft-delete marker |
| `firstBimStart/End` | DateTime pair | optional, end > start |
| `secondBimStart/End` | DateTime pair | optional, end > start |
| `thirdBimStart/End` | DateTime pair | optional, end > start |
| `fourthBimStart/End` | DateTime pair | optional, end > start |

(Previously: `level` was `Enum` string, `modality` was a plain `String` field with no VO)

#### Scenario: AcademicCycle created with all bimester dates

- GIVEN valid `name`, `level` (EducationalLevel VO), `modality` (EducationalModality VO), `code`, `startDate`, `endDate`, and all 8 bimester dates
- WHEN `POST /v1/academic-cycles` is called
- THEN a record is persisted with `uuid` generated and `active=true`
- AND all 8 bimester dates are stored

#### Scenario: AcademicCycle created without bimester dates

- GIVEN valid `name`, `level`, `code`, `startDate`, `endDate` — no bimester dates
- WHEN `POST /v1/academic-cycles` is called
- THEN the record is persisted with all bimester date fields as `null`

---

## ADDED Requirements

### Requirement: AcademicCycle domain entity uses EducationalLevel and EducationalModality VOs

The `AcademicCycle` domain entity MUST use `EducationalLevel` and `EducationalModality` VOs
for its `level` and `modality` fields respectively.
`AcademicCycleProps.level` MUST be typed as `EducationalLevel`.
`AcademicCycleProps.modality` MUST be typed as `EducationalModality`.
`CreateAcademicCycleInput.level` MUST accept `EducationalLevel`.
`CreateAcademicCycleInput.modality` MUST accept `EducationalModality` (optional, defaults to `COMUN`).
`AcademicCycle.create()` MUST store the VO instances directly.
Getters `level` and `modality` MUST return their respective VO types.

#### Scenario: Create with valid EducationalLevel VO

- GIVEN a valid `EducationalLevel` VO for `PRIMARIO` and a valid `EducationalModality` VO for `COMUN`
- WHEN `AcademicCycle.create({ level, modality, ... })` is called
- THEN the entity is created and `cycle.level.code` equals `EducationalLevelCode.PRIMARIO`
- AND `cycle.modality.code` equals `EducationalModalityCode.COMUN`

#### Scenario: Create without modality defaults to COMUN

- GIVEN a valid `EducationalLevel` VO and no `modality` provided
- WHEN `AcademicCycle.create({ level, ... })` is called
- THEN `cycle.modality.code` equals `EducationalModalityCode.COMUN` (0)

#### Scenario: isCurrent() works with VO-typed level and modality

- GIVEN an active `AcademicCycle` whose `startDate` is in the past and `endDate` in the future
- WHEN `cycle.isCurrent()` is called
- THEN it returns `true` regardless of VO types (date comparison is unaffected)

#### Scenario: Reconstruct from persisted numeric codes

- GIVEN numeric codes stored in DB (`level: 2`, `modality: 0`)
- WHEN `AcademicCycle.reconstruct(props)` is called with `EducationalLevel.fromCode(2)` and `EducationalModality.fromCode(0)`
- THEN `cycle.level.toString()` equals `"PRIMARIO"`
- AND `cycle.modality.toString()` equals `"COMUN"`
