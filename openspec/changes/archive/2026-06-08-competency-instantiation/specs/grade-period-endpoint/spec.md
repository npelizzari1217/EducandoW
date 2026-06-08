# Spec — grade-period-endpoint

> **New capability spec**: no prior base spec. Describes the PATCH endpoint to grade a
> specific period within a `CompetencyValuation`.

---

## Scope

**In**: `PATCH /v1/competency-valuations/:uuid/periods/:periodItemId` — set or clear a
grade on one (valuation, period item) pair; lazy creation of `CompetencyPeriodValuation`
child row; validation of template membership and scale membership.
**Out**: front-end grading UI (Fase 3b); report-card rendering (Fase 4);
bulk-grading endpoints; GET endpoints for period children.

---

## Requirement: Grade a Period (PATCH endpoint)

The system MUST expose:

```
PATCH /v1/competency-valuations/:uuid/periods/:periodItemId
```

**Request body**: `{ gradeScaleValueId: string | null }`
- Non-null value: UUID of the `GradeScaleValue` to assign.
- `null`: clears the current grade (sets `gradeScaleValueId`, `gradeCode`, `internalStatus` to null).

**Processing contract** (in order):

1. Resolve `CompetencyValuation` by `:uuid` → 404 if not found.
2. Resolve the `CourseCycle` (via `CompetencyValuation.courseCycleId`) to obtain
   `level` and `modality`.
3. Resolve the `GradingPeriodTemplate` for `(institutionId, level, modality)` →
   HTTP 400 (`GradingPeriodTemplateNotFoundError`) if none is configured for this cycle.
4. Verify `:periodItemId` belongs to that template →
   HTTP 400 (`PeriodItemNotInTemplateError`) if not found.
5. When `gradeScaleValueId` is non-null: resolve the `GradeScaleValue` by UUID and
   verify it belongs to the `GradeScale` configured for the same `(institutionId, level, modality)` →
   HTTP 400 (`GradeScaleValueMismatchError`) if mismatched or not found.
6. If a `CompetencyPeriodValuation` child row exists for `(valuationId, periodItemId)`
   and `modificable=false` → HTTP 400 (`PeriodLockedError`).
7. Lazily create the child row if it does not yet exist
   (defaults: `modificable=true`, `imprimible=false`).
8. Persist: `gradeScaleValueId`, snapshot `gradeCode` and `internalStatus` from the
   `GradeScaleValue` at write time (or set all three to null when clearing).
9. Return HTTP 200 with the `CompetencyPeriodValuation` data.

---

### Scenario GPE-1: Grade a period — happy path (lazy create child row)

- GIVEN `CompetencyValuation` uuid="v-1" with `courseCycleId="cc-1"` (no period children)
- AND the cycle's template has `periodItemId=7` as a valid item
- AND `gradeScaleValueId="gsv-a"` exists in the matching scale (`gradeCode="MB"`,
  `internalStatus=APROBADO`)
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7` with `{ gradeScaleValueId: "gsv-a" }`
- THEN a `CompetencyPeriodValuation` child row is created for `(valuationId, periodItemId=7)`
- AND `gradeCode="MB"`, `internalStatus=APROBADO` are snapshotted
- AND the response is HTTP 200 with the created row

### Scenario GPE-2: Grade a period — update existing child row

- GIVEN a `CompetencyPeriodValuation` already exists for `(v-1, periodItem=7)` with
  `gradeCode="B"`, `modificable=true`
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7` with `{ gradeScaleValueId: "gsv-mb" }`
- THEN the row is updated: `gradeCode` and `internalStatus` are re-snapshotted from `gsv-mb`
- AND HTTP 200 is returned

### Scenario GPE-3: Clear grade (set null)

- GIVEN a `CompetencyPeriodValuation` for `(v-1, 7)` with `gradeCode="MB"`, `modificable=true`
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7` with `{ gradeScaleValueId: null }`
- THEN `gradeScaleValueId`, `gradeCode`, `internalStatus` are all set to `null`
- AND HTTP 200 is returned

### Scenario GPE-4: Grade a locked period (modificable=false)

- GIVEN a `CompetencyPeriodValuation` for `(v-1, 7)` with `modificable=false`
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7` with `{ gradeScaleValueId: "gsv-a" }`
- THEN the system returns HTTP 400 with `PeriodLockedError`
- AND the row is unchanged

### Scenario GPE-5: CompetencyValuation not found

- GIVEN no `CompetencyValuation` with uuid="nonexistent"
- WHEN `PATCH /v1/competency-valuations/nonexistent/periods/7`
- THEN the system returns HTTP 404

### Scenario GPE-6: GradingPeriodTemplate not configured for cycle's level+modality

- GIVEN the institution has no `GradingPeriodTemplate` for `(PRIMARIO, COMUN)`
- AND `CompetencyValuation v-1` belongs to a cycle with `level=PRIMARIO, modality=COMUN`
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7`
- THEN the system returns HTTP 400 with `GradingPeriodTemplateNotFoundError`
- AND no child row is created (graceful reject, no crash)

### Scenario GPE-7: periodItemId does not belong to the cycle's template

- GIVEN `CompetencyValuation v-1` belongs to `courseCycleId="cc-1"` (level=PRIMARIO, modality=COMUN)
- AND `periodItemId=99` does NOT belong to the `GradingPeriodTemplate` for that level+modality
- WHEN `PATCH /v1/competency-valuations/v-1/periods/99`
- THEN the system returns HTTP 400 with `PeriodItemNotInTemplateError`

### Scenario GPE-8: gradeScaleValueId belongs to a different scale (mismatch)

- GIVEN `gradeScaleValueId="gsv-z"` belongs to a `GradeScale` for `(SECUNDARIO, TECNICA)`,
  not for `(PRIMARIO, COMUN)` which is the cycle's level+modality
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7` with `{ gradeScaleValueId: "gsv-z" }`
- THEN the system returns HTTP 400 with `GradeScaleValueMismatchError`

### Scenario GPE-9: gradeScaleValueId UUID not found

- GIVEN `gradeScaleValueId="gsv-unknown"` does not exist in the DB
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7` with `{ gradeScaleValueId: "gsv-unknown" }`
- THEN the system returns HTTP 404

---

## HTTP Mapping

| Situation                                      | HTTP Status |
|------------------------------------------------|-------------|
| Grade set or cleared successfully              | 200 OK      |
| CompetencyValuation uuid not found             | 404         |
| GradeScaleValue uuid not found                 | 404         |
| Template not configured for level+modality     | 400         |
| periodItemId not in template                   | 400         |
| gradeScaleValueId belongs to wrong scale       | 400         |
| Period locked (modificable=false)              | 400         |

No 422 or 409 codes are used on this endpoint (project override).
