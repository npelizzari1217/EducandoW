# Tasks: 11-institution-filter-study-plans

## T1: study-plans.tsx — Alinear filtro de institución

**Archivo**: `web/src/pages/dashboard/study-plans.tsx`

### T1.1: Institutions fetch incondicional
- Quitar el guard `if (isRoot)` del `useEffect` que fetchea `/institutions`
- Debe fetchear siempre, para todos los roles

### T1.2: Default a primera institución para ROOT
- Agregar `useEffect` que dependa de `institutions`:
  - Si `isRoot` y `institutionId` está vacío (`""`), settear a `institutions[0]?.id ?? ""`

### T1.3: Reemplazar bloque de filtro
- Cambiar `{isRoot && (<div>...</div>)}` por bloque condicional:
  - ROOT: `<select>` con todas las instituciones (ACTIVO, sin disabled)
  - No-ROOT: `<input type="text" disabled>` con nombre de institución

---

## T2: teachers.tsx — Alinear filtro de institución

**Archivo**: `web/src/pages/dashboard/teachers.tsx`

### T2.1: Default a primera institución para ROOT
- Agregar `useEffect` que dependa de `institutions`:
  - Si `isRoot` y `institutionId` está vacío, settear a `institutions[0]?.id ?? ""`

### T2.2: Reemplazar disabled select por condicional
- Cambiar:
  ```tsx
  <select disabled={!isRoot}>...</select>
  ```
  Por condicional:
  - ROOT: `<select>` activo con instituciones
  - No-ROOT: `<input type="text" disabled>` con nombre de institución

---

## T3: enrollments.tsx — Alinear filtro de institución

**Archivo**: `web/src/pages/dashboard/enrollments.tsx`

### T3.1: Default a primera institución para ROOT
- Agregar `useEffect` que dependa de `institutions`:
  - Si `isRoot` y `filters.institutionId` está vacío, settear a `institutions[0]?.id ?? ""`
  - Usar `setFilters(prev => ({...prev, institutionId: ...}))`

### T3.2: Verificar condicional existente
- El bloque de filtro ya tiene ROOT/non-ROOT condicional correcto
- Solo verificar que el disabled input muestre el nombre correcto de institución
- No tocar el `<select>` del form de creación (fuera de scope)

---

## T4: Verificación

### T4.1: Type check
- `npx tsc --noEmit` en `web/` debe pasar sin errores

### T4.2: Smoke test manual
- ROOT ve primera institución seleccionada por defecto en los 3 módulos
- No-ROOT ve input deshabilitado con su institución en los 3 módulos
- Cambiar institución en el dropdown recarga los datos correctamente
