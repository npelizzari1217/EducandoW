# Spec — valuations-tab-cleanup

> **Delta spec**: removes the broken "Valoraciones por Alumno" tab and `ValuationsTab`
> component from `competencies.tsx`. The tab currently sends the legacy flat payload
> (`valoracion1..4`) that the Fase-3 backend no longer accepts.

---

## Scope

**In**: `competencies.tsx` — removal of `ValuationsTab` and all references to the legacy
flat valuation fields (`valoracion1`, `valoracion2`, `valoracion3`, `valoracion4`,
`modificable1..4`, `imprimible1..4`).  
**Out**: new grading page and components (spec'd in `competency-grading-grid`);
other tabs in `competencies.tsx` (untouched).

---

## Requirement: ValuationsTab Removed from competencies.tsx

After the change is applied, `competencies.tsx` MUST NOT:

1. Render, import, or reference a `ValuationsTab` component.
2. Contain any code that sends the legacy flat valuation payload
   (`{ valoracion1, valoracion2, valoracion3, valoracion4 }` or
   the matching `modificable1..4` / `imprimible1..4` fields).

`competencies.tsx` MUST continue to function correctly for all remaining capabilities
(competency definitions, subject details, any other tabs present before the change).

---

### Scenario VTC-1: ValuationsTab reference is absent from competencies.tsx

- GIVEN the current file renders a "Valoraciones por Alumno" tab via `ValuationsTab`
- WHEN the change is applied
- THEN `competencies.tsx` does NOT render `ValuationsTab`
- AND the file does NOT import or reference `ValuationsTab` by any name or path

### Scenario VTC-2: Legacy flat payload fields are absent from competencies.tsx

- GIVEN the current file contains code that constructs or sends
  `{ valoracion1, valoracion2, valoracion3, valoracion4, ... }`
- WHEN the change is applied
- THEN no code in `competencies.tsx` references `valoracion1`, `valoracion2`,
  `valoracion3`, or `valoracion4` as payload fields

### Scenario VTC-3: Remaining functionality in competencies.tsx is unaffected

- GIVEN `competencies.tsx` has other tabs or sections unrelated to valuations
- WHEN the ValuationsTab cleanup is applied
- THEN those other tabs render and behave correctly
- AND no functionality regression is introduced to unrelated capabilities
