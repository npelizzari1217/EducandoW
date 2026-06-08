# Spec — course-cycle-modality

> **Delta spec**: extends the existing `GET /v1/course-cycles/:uuid` response to include
> the `modality` field. All other fields on this response remain unchanged.

---

## Scope

**In**: `GET /v1/course-cycles/:uuid` response shape — adds `modality`.  
**Out**: modality in list/filter endpoints; modality-based routing rules.

---

## Requirement: modality in CourseCycle Single Response

`GET /v1/course-cycles/:uuid` MUST include `modality` in its response body.

The response MUST contain at minimum:

```json
{
  "uuid": "<uuid>",
  "level": "<number>",
  "modality": "<number|null>",
  "studyPlanId": "<id>"
}
```

`level` and `modality` are NUMERIC codes (resolved via `findGradingContextByUuid`), NOT
strings. The frontend maps codes → labels for display. All fields present before this
change remain present and unchanged. `modality` MUST NOT be `null` if the CourseCycle
record has a modality value.

---

### Scenario CCM-1: Response includes modality field

- GIVEN a CourseCycle with uuid="cc-1", level code 2 (PRIMARIO), modality code 0 (COMUN)
- WHEN `GET /v1/course-cycles/cc-1`
- THEN HTTP 200 is returned
- AND the response body contains `"modality": 0` (numeric code)
- AND `"level": 2` is also present (existing field, unchanged)

### Scenario CCM-2: CourseCycle not found — behavior unchanged

- GIVEN no CourseCycle with uuid="cc-none"
- WHEN `GET /v1/course-cycles/cc-none`
- THEN HTTP 404 is returned (no change to error behavior)

---

## HTTP Mapping

| Situation                           | HTTP Status |
|-------------------------------------|-------------|
| CourseCycle found (modality present) | 200 OK     |
| CourseCycle uuid not found          | 404         |
