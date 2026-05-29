# Delta for Study Plans

Canonical spec: `openspec/specs/study-plans/spec.md`

## MODIFIED Requirements

### Requirement: List Study Plans

`GET /v1/study-plans` MUST return plans scoped to the user's institution. An optional `level` query parameter SHALL filter results. ROOT users MUST specify `institutionId` as a query parameter, and the study-plan list UI MUST default that institution filter to the first option in the dropdown, not an empty or "all" value. Non-ROOT users SHALL see a disabled text input showing their institution name. `GET /v1/study-plans/:id/courses` MUST return course data including `courseGrade` and `courseDivision` fields for each course. The plan list MUST render each plan as a collapsible accordion. Multiple plans MAY be expanded simultaneously. Courses SHALL be collapsed by default; clicking a course toggles its subjects. Subjects SHALL be collapsed by default within each course. Chevron icons (▶) SHALL rotate 90° when expanded. All expansion state MUST be managed via a `Set<string>` of expanded IDs in React.

(Previously: ROOT users specified `institutionId`; non-ROOT users were auto-scoped without the new default/input behavior.)

#### Scenario: Non-ROOT lists plans for own institution

- GIVEN a DIRECTOR user with `institutionId="inst-1"`
- WHEN `GET /v1/study-plans` is called
- THEN only plans where `institutionId="inst-1"` are returned

#### Scenario: Filter by level

- GIVEN plans exist for PRIMARIO and SECUNDARIO at the user's institution
- WHEN `GET /v1/study-plans?level=2` is called
- THEN only PRIMARIO-level plans are returned

#### Scenario: ROOT lists plans for a specific institution

- GIVEN a ROOT user
- WHEN `GET /v1/study-plans?institutionId=inst-1` is called
- THEN plans for `inst-1` only are returned

#### Scenario: ROOT defaults to the first institution in the dropdown

- GIVEN a ROOT user and a loaded institution dropdown with multiple institutions
- WHEN the study-plan list screen renders
- THEN the institution filter MUST select the first institution by default
- AND it MUST NOT default to an empty or "all" value

#### Scenario: Non-ROOT sees a disabled institution name input

- GIVEN a non-ROOT user assigned to "Inst A"
- WHEN the study-plan list screen renders
- THEN the institution filter MUST be shown as a disabled text input
- AND it MUST display "Inst A"

#### Scenario: Courses include grade and division

- GIVEN plan `sp-1` with course `cs-1` (grade "3ro", division "A")
- WHEN `GET /v1/study-plans/sp-1/courses` is called
- THEN each course item includes `courseGrade: "3ro"` and `courseDivision: "A"`

#### Scenario: Multiple plans expanded simultaneously

- GIVEN plans `sp-1` and `sp-2` displayed as accordions
- WHEN user expands `sp-1` then expands `sp-2`
- THEN both plans remain expanded

#### Scenario: Chevron rotates on expand

- GIVEN plan `sp-1` is collapsed with ▶ icon
- WHEN user clicks to expand `sp-1`
- THEN the ▶ icon rotates 90° clockwise
