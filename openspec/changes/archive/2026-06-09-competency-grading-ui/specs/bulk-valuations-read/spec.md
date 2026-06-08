# Spec — bulk-valuations-read

> **New capability spec**: bulk read endpoint for `CompetencyValuation` parents plus their
> lazily-created `CompetencyPeriodValuation` children, scoped by course cycle and subject.

---

## Scope

**In**: `GET /v1/competency-valuations?courseCycleId=&studyPlanSubjectId=` — returns every
parent valuation for the given cycle/subject pair, each with its existing period children.  
**Out**: PATCH grading endpoint (already spec'd in `grade-period-endpoint`);
report-card read (Fase 4); pagination of results.

---

## Requirement: Bulk Read — Parent Valuations + Period Children

The system MUST expose:

```
GET /v1/competency-valuations?courseCycleId=<uuid>&studyPlanSubjectId=<id>
```

**Both query params are REQUIRED.** Omitting either MUST return HTTP 400.

**Response shape** (HTTP 200):

```json
{
  "data": [
    {
      "valuationId": "<uuid>",
      "studentId": "<uuid or id>",
      "competencyId": "<id>",
      "periodValuations": [
        {
          "periodItemId": "<id>",
          "gradeScaleValueId": "<uuid | null>",
          "gradeCode": "<string | null>",
          "internalStatus": "APROBADO | NO_APROBADO | EN_PROCESO | LIBRE | null",
          "modificable": true,
          "imprimible": false
        }
      ]
    }
  ]
}
```

`periodValuations` contains ONLY lazily-created `CompetencyPeriodValuation` children
(those materialized by at least one prior PATCH). A parent with no graded periods MUST
return `periodValuations: []` — not `null` and not omitted.

**Processing contract** (order-enforced):

1. Validate `courseCycleId` and `studyPlanSubjectId` are both present → HTTP 400 if either missing.
2. Resolve all `CompetencyValuation` records where `courseCycleId` matches AND `competencyId`
   belongs to a competency of the given `studyPlanSubjectId` (via `SubjectCompetency`).
3. For each parent, join its `CompetencyPeriodValuation` children.
4. Return `{ "data": [...] }`. Empty is valid — returns `{ "data": [] }` with HTTP 200.

---

### Scenario BVR-1: Happy path — parents with and without period children

- GIVEN `courseCycleId="cc-1"` has 2 students each with 2 competencies for `studyPlanSubjectId=10`
- AND student "s-1" / competency "c-1" has one graded period child: `(periodItemId=3, gradeCode="MB", modificable=true)`
- AND student "s-2" / competency "c-1" has no graded period children
- WHEN `GET /v1/competency-valuations?courseCycleId=cc-1&studyPlanSubjectId=10`
- THEN HTTP 200 is returned with `data` containing 4 entries (2 students × 2 competencies)
- AND the entry for (s-1, c-1) has `periodValuations` with 1 child where `gradeCode="MB"`
- AND the entry for (s-2, c-1) has `periodValuations: []`

### Scenario BVR-2: Missing `courseCycleId` → 400

- GIVEN the request omits `courseCycleId`
- WHEN `GET /v1/competency-valuations?studyPlanSubjectId=10`
- THEN HTTP 400 is returned

### Scenario BVR-3: Missing `studyPlanSubjectId` → 400

- GIVEN the request omits `studyPlanSubjectId`
- WHEN `GET /v1/competency-valuations?courseCycleId=cc-1`
- THEN HTTP 400 is returned

### Scenario BVR-4: No matching valuations → empty list, not 404

- GIVEN `courseCycleId="cc-new"` has no `CompetencyValuation` records
- WHEN `GET /v1/competency-valuations?courseCycleId=cc-new&studyPlanSubjectId=10`
- THEN HTTP 200 is returned with `{ "data": [] }`

### Scenario BVR-5: Parent with no graded periods returns empty array, not null

- GIVEN a `CompetencyValuation` for (s-1, c-1, cc-1) exists with no `CompetencyPeriodValuation` children
- WHEN `GET /v1/competency-valuations?courseCycleId=cc-1&studyPlanSubjectId=10`
- THEN the matching entry is present in `data` with `"periodValuations": []`

### Scenario BVR-6: Correct child join — children attached only to their parent

- GIVEN valuations for (s-1, c-1) and (s-2, c-1) both exist in cc-1
- AND (s-1, c-1) has a period child for `periodItemId=3` with `gradeCode="MB"`
- AND (s-2, c-1) has a period child for `periodItemId=3` with `gradeCode="B"`
- WHEN `GET /v1/competency-valuations?courseCycleId=cc-1&studyPlanSubjectId=10`
- THEN the entry for (s-1, c-1) contains only `gradeCode="MB"` in its `periodValuations`
- AND the entry for (s-2, c-1) contains only `gradeCode="B"` in its `periodValuations`

---

## HTTP Mapping

| Situation                                          | HTTP Status |
|----------------------------------------------------|-------------|
| Valuations returned (including empty list)         | 200 OK      |
| `courseCycleId` param missing                      | 400         |
| `studyPlanSubjectId` param missing                 | 400         |
