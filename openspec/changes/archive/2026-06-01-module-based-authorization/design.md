# Design: Module-Based Authorization

## Technical Approach

Replace ALL `@Roles('ADMIN','MANAGER',...)` with `@Roles('ROOT', {module, action})` across 20 controllers. Add 2 missing modules (STUDY_PLANS, CLASSROOMS) to seed data. Convert sidebar filtering, ProtectedRoute, and App.tsx from role-name checks to module+action checks. ROOT bypass stays everywhere.

The `RolesGuard` already supports `{module, action}` entries — no guard changes needed. The `User` domain entity already has `hasPermission(module, action)` with ROOT bypass. Infrastructure is in place; this change is a conversion of authorization declarations.

## Architecture Decisions

### Decision: Module Code Mapping

**Choice**: Map each controller to the semantically closest existing module; add STUDY_PLANS and CLASSROOMS for uncovered areas.

**Alternatives considered**: One module per controller (too granular: 20+ modules), fewer broader modules (too coarse: REPORTS for everything pedagogy-related).

**Rationale**: The 10 existing modules (seed-rbac.sql + seed.ts) cover 80% of controllers. STUDY_PLANS and CLASSROOMS cover planificaciones/salas and study plans without overloading GRADES or COURSES.

### Decision: Navigation Module Codes

**Choice**: Add `moduleCode?: string` to `NavItem`. Filter checks `isRoot(user) || userHasModuleRead(user, item.moduleCode)`.

**Alternatives considered**: Module code per group (coarse: whole sidebar section hidden when missing one module); keep roles array (defeated purpose).

**Rationale**: Per-item granularity matches the existing per-item role filtering. `isRoot` helper already exists in the codebase pattern.

### Decision: Seed Data Consistency

**Choice**: Update BOTH `seed.ts` AND `seed-rbac.sql`. SQL seed is the canonical RBAC reference but it is MISSING DIRECTOR, SECRETARIO, PRECEPTOR roles — add them.

**Rationale**: Two seed files exist (SQL for direct DB seeding, TS for Prisma seeding). Both must stay in sync.

## Module ↔ Controller Mapping

| Controller | Module Code | Actions |
|-----------|-------------|---------|
| auth (POST register) | USERS | CREATE |
| users | USERS | READ, CREATE, UPDATE, DELETE |
| modules | ROOT only | — |
| institutions | INSTITUTIONS | READ, CREATE, UPDATE, DELETE, PRINT |
| teachers | TEACHERS | READ, CREATE, UPDATE, DELETE |
| students | STUDENTS | READ, CREATE, UPDATE, DELETE |
| enrollments | ENROLLMENTS | READ, CREATE, DELETE |
| pedagogy: academic-cycles | COURSES | READ |
| pedagogy: subjects | SUBJECTS | READ, CREATE, UPDATE, DELETE |
| pedagogy: course-sections | COURSES | READ, CREATE, UPDATE, DELETE |
| pedagogy: subject-assignments | COURSES | READ, CREATE, DELETE |
| pedagogy: evaluaciones | GRADES | READ, CREATE, DELETE |
| pedagogy: notas | GRADES | READ, CREATE, DELETE |
| pedagogy: periodos | GRADES | READ, CREATE, DELETE |
| pedagogy: notas-trimestrales | GRADES | READ, CREATE, DELETE |
| pedagogy: attendance | ATTENDANCE | READ, CREATE, DELETE |
| pedagogy: study-plans | STUDY_PLANS | READ, CREATE, UPDATE, DELETE |
| nivel-inicial/planificacion | CLASSROOMS | CREATE, READ, UPDATE |
| nivel-inicial/informe-evolutivo | REPORTS | CREATE, READ, UPDATE |
| nivel-inicial/sala | CLASSROOMS | CREATE, READ, UPDATE, DELETE |
| nivel-primario/calificacion | GRADES | CREATE, READ, UPDATE |
| nivel-primario/grado | COURSES | CREATE, READ, UPDATE, DELETE |
| nivel-secundario/curso | COURSES | CREATE, READ, UPDATE, DELETE |
| nivel-secundario/mesa-examen | GRADES | CREATE, READ (inscripciones: CREATE, READ) |
| nivel-secundario/regimen-academico | COURSES | CREATE, READ, UPDATE |
| nivel-terciario/acta-examen | GRADES | CREATE, READ |
| nivel-terciario/titulo | REPORTS | CREATE, READ, UPDATE |
| nivel-terciario/carrera | COURSES | CREATE, READ, UPDATE, DELETE |
| nivel-terciario/inscripcion-materia | ENROLLMENTS | CREATE, READ, UPDATE |

## Sidebar Module Mapping

Each nav item gets `moduleCode` (no `roles` array). `makeFilterItem` checks `user.modules` for READ action on item's moduleCode.

| Item | moduleCode |
|------|-----------|
| Dashboard | (always visible) |
| Estudiantes | STUDENTS |
| Docentes | TEACHERS |
| Inscripciones | ENROLLMENTS |
| Legajos | STUDENTS |
| Planes de Estudio | STUDY_PLANS |
| Usuarios | USERS |
| Alumnos por curso | COURSES |
| Calificaciones parciales | GRADES |
| Asistencia del día | ATTENDANCE |
| Salas | CLASSROOMS |
| Informes Evolutivos | REPORTS |
| Planificaciones | CLASSROOMS |
| Grados | COURSES |
| Calificaciones (primario) | GRADES |
| Cursos | COURSES |
| Mesas de Examen | GRADES |
| Carreras | COURSES |
| Inscripciones (terciario) | ENROLLMENTS |
| Instituciones | INSTITUTIONS |
| Módulos | (ROOT only — no moduleCode needed) |

## Frontend Route Protection

**ProtectedRoute** accepts `moduleCode` and `action` instead of `roles`. Removes `roles?: string[]`, adds:

```ts
interface Props { children: React.ReactNode; moduleCode?: string; action?: string; }
```

Check becomes: `user.modules.some(m => m.moduleCode === moduleCode && m.actions.includes(action || 'READ'))`.

**App.tsx** updates: `/institutions` → `moduleCode="INSTITUTIONS" action="READ"`, `/modules` → ROOT-only kept via existing check.

## Seed Data Changes

### New Modules (both seed-rbac.sql + seed.ts)

```
STUDY_PLANS (id: m-study-plans) — Planes de estudio
CLASSROOMS   (id: m-classrooms) — Salas y aulas
```

### New Roles (seed-rbac.sql — already in seed.ts)

```
DIRECTOR (id: r-director), SECRETARIO (id: r-secretario), PRECEPTOR (id: r-preceptor)
```

### Role ↔ Module Assignments

DIRECTOR: all 12 modules, all actions (like ADMIN but broader)
SECRETARIO: STUDENTS, ENROLLMENTS, ATTENDANCE, GRADES, REPORTS (all actions)
PRECEPTOR: STUDENTS(READ), ATTENDANCE(CREATE,READ)
STUDY_PLANS → ADMIN, MANAGER, DIRECTOR (all actions)
CLASSROOMS → ADMIN, MANAGER, DIRECTOR, TEACHER(STUDENTS→READ), SECRETARIO

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/prisma/seed-rbac.sql` | Modify | Add DIRECTOR/SECRETARIO/PRECEPTOR roles, STUDY_PLANS/CLASSROOMS modules, role_module assignments |
| `api/prisma/seed.ts` | Modify | Add STUDY_PLANS/CLASSROOMS modules and their role_module entries |
| `api/src/presentation/**/*.controller.ts` (20 files) | Modify | Replace `@Roles(roleString)` with `@Roles('ROOT', {module, action})` |
| `web/src/components/layout/sidebar.tsx` | Modify | Add `moduleCode` to NavItem, update `makeFilterItem`, replace all `roles` arrays |
| `web/src/components/layout/protected-route.tsx` | Modify | Replace `roles` prop with `moduleCode` + `action`, use module check |
| `web/src/App.tsx` | Modify | Convert ProtectedRoute role props to moduleCode/action |
| `web/src/pages/dashboard/users.tsx` | Modify | Keep role hierarchy logic (out of scope), add module permission checks where applicable |

## Open Questions

- None — all module mappings are deterministic from existing seed data and controller methods.
