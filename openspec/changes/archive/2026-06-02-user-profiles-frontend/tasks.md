# Tasks: User Profiles Frontend

**Change**: user-profiles-frontend
**Mode**: hybrid (TDD enabled)

---

## Phase 1: Profiles Page

- [x] **T1.1** — Crear `web/src/pages/dashboard/profiles.tsx`
  - PremiumHeader: "Perfiles de Usuario", botón Nuevo
  - Card(form): campo name + ModuleAccessGrid + botón Guardar
  - Card(table): lista de perfiles con columnas Nombre, Módulos, Acciones
  - Funciones de conversión: booleansToModuleAccess, moduleAccessToBooleans
  - Estados: loading, empty, error, success

## Phase 2: Integration

- [x] **T2.1** — Sidebar: agregar "Perfiles" en grupo Sistema
  - `{ label: 'Perfiles', path: '/profiles', moduleCode: 'USERS' }`

- [x] **T2.2** — App.tsx: agregar ruta `/profiles`
  - `<Route path="/profiles" element={<ProtectedRoute moduleCode="USERS" action="READ"><ProfilesPage /></ProtectedRoute>} />`
  - Import de ProfilesPage

- [x] **T2.3** — users.tsx: agregar selector de perfil
  - Fetch profiles en mount
  - Select entre sección Rol y Módulos
  - handleProfileChange: carga permisos → puebla grid
  - Incluir profileId en handleCreate/handleUpdate

## Phase 3: Build

- [x] **T3.1** — `pnpm --filter web build` (0 errores)
- [x] **T3.2** — `pnpm --filter web test` (todos los tests pasan)
