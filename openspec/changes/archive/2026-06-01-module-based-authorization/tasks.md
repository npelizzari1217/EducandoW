# Tasks: Module-Based Authorization

**Change**: module-based-authorization
**Mode**: hybrid (TDD enabled)

---

## Phase 1: Seed Data

- [x] **T1.1** — Agregar roles + módulos faltantes en seed SQL
  - Archivo: `api/prisma/seed-rbac.sql`
  - Agregar roles: DIRECTOR, SECRETARIO, PRECEPTOR
  - Agregar módulos: STUDY_PLANS, CLASSROOMS
  - Agregar role_module entries para todos los roles con sus módulos

- [x] **T1.2** — Sincronizar seed TS
  - Archivo: `api/prisma/seed.ts`
  - Reflejar mismos cambios

## Phase 2: Controllers (20 archivos)

Convertir `@Roles('ADMIN','MANAGER',...)` → `@Roles('ROOT', {module:'X', action:'READ'})` para GET, `CREATE` para POST, etc.

- [x] **T2.1** — `auth.controller.ts`
- [x] **T2.2** — `users.controller.ts` (completar parcial)
- [x] **T2.3** — `modules.controller.ts` (ROOT only 💀)
- [x] **T2.4** — `institution.controller.ts` (completar parcial)
- [x] **T2.5** — `teacher.controller.ts`
- [x] **T2.6** — `student.controller.ts` (completar parcial)
- [x] **T2.7** — `enrollment.controller.ts`
- [x] **T2.8** — `pedagogy.controller.ts` (34 endpoints)
- [x] **T2.9** — `nivel-inicial/planificacion.controller.ts`
- [x] **T2.10** — `nivel-inicial/informe-evolutivo.controller.ts`
- [x] **T2.11** — `nivel-inicial/sala.controller.ts`
- [x] **T2.12** — `nivel-primario/calificacion.controller.ts`
- [x] **T2.13** — `nivel-primario/grado.controller.ts`
- [x] **T2.14** — `nivel-secundario/curso.controller.ts`
- [x] **T2.15** — `nivel-secundario/mesa-examen.controller.ts`
- [x] **T2.16** — `nivel-secundario/regimen-academico.controller.ts`
- [x] **T2.17** — `nivel-terciario/acta-examen.controller.ts`
- [x] **T2.18** — `nivel-terciario/titulo.controller.ts`
- [x] **T2.19** — `nivel-terciario/carrera.controller.ts`
- [x] **T2.20** — `nivel-terciario/inscripcion-materia.controller.ts`

- [x] **T2.21** — Build gate API (`pnpm --filter api build`)

## Phase 3: Frontend

- [x] **T3.1** — Sidebar: agregar `moduleCode` a `NavItem`, filtrar por módulo
  - Archivo: `web/src/components/layout/sidebar.tsx`
  - Agregar `moduleCode?: string` a `NavItem`
  - Actualizar `makeFilterItem` para aceptar y usar `modules`
  - Quitar `roles` de todos los items, poner `moduleCode`
  - ROOT bypass: si es ROOT, mostrar todo

- [x] **T3.2** — ProtectedRoute: cambiar de roles a módulos
  - Archivo: `web/src/components/layout/protected-route.tsx`
  - Reemplazar prop `roles` por `moduleCode`
  - Verificar: ROOT || hasPermission(moduleCode, 'READ')

- [x] **T3.3** — Actualizar páginas frontend
  - `users.tsx` — reemplazar cheques de rol por módulo
  - `teachers.tsx` — reemplazar `user.roles.includes('ROOT')`
  - `enrollments.tsx` — idem
  - `institutions.tsx` — idem
  - `students.tsx` — idem
  - `study-plans.tsx` — idem

- [x] **T3.4** — Build gate web (`pnpm --filter web build`)

## Phase 4: Full Verification

- [x] **T4.1** — Test suite completa: `pnpm test`
- [x] **T4.2** — Build completo: `pnpm build`
