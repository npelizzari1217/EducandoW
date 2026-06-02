# Archive Report: academic-cycle-crud

**Archived**: 2026-06-02
**Mode**: hybrid
**Change**: CRUD de Ciclos Lectivos + Refactor de CourseCycle (bimester inheritance)

---

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| pedagogy | Created | 9 requirements, 22 scenarios — AcademicCycle data model, VOs, CRUD endpoints, access control, frontend |
| course-cycle | Updated | 8 requirements replaced (bimester fields made optional, effectiveBimonthDates, frontend inherited dates) |

## Archive Contents

| Artifact | Status |
|----------|--------|
| proposal.md | ✅ |
| specs/pedagogy/spec.md | ✅ (delta) |
| specs/course-cycle/spec.md | ✅ (delta) |
| design.md | ✅ |
| tasks.md | ✅ (17/17 tasks complete) |

## Verification

- **Context**: 904 tests passing (domain 585 + API 231 + web 88)
- **No verify-report.md found in change folder** — verification confirmed via test output

## Source of Truth Updated

The following canonical specs now reflect the new behavior:

- `openspec/specs/pedagogy/spec.md` — **Created** (was `academic-cycle-query` scope before, now full CRUD spec)
- `openspec/specs/course-cycle/spec.md` — **Updated** (bimester fields nullable, effective dates resolution, frontend inherited dates)

## Delta Changes Applied

### Pedagogy (new canonical spec)
- **ADDED**: AcademicCycle Extended Data Model, CycleCode VO, CycleDescription VO, CRUD Endpoints, Access Control, Frontend Page
- **MODIFIED**: List Active Academic Cycles (pagination, new fields in response), Filter by Active Status (soft-delete awareness), Authorization (module-based ROOT/COURSES instead of role-based)

### Course-cycle (merged into existing canon)
- **MODIFIED**: Data Model (bimester fields → nullable), BimonthPeriod VO (null support, partial pair rejection), Bulk Generate (null bimester on generation), CRUD Endpoints (effectiveBimonthDates in response), Frontend (optional bimester fields, inherited date display)
- **UNCHANGED**: CourseName VO, PassingGrade VO, Active/Inactive Guard
