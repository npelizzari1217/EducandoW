# Tasks: 02-sidebar-levels

## T1: Update NavItem interface + constants

**Archivo**: `web/src/components/layout/sidebar.tsx`

- [x] Agregar `levelId?: number` al interface `NavItem` (1=Inicial, 2=Primario, 3=Secundario, 4=Terciario)
- [x] Agregar constante `LEVEL_LABELS: Record<number, string>` con el mapeo de levelId a etiquetas
- [x] Mantener `requiresLevel?: boolean` para items genéricos (Estudiantes, Docentes, etc.)

## T2: Restructure navGroups

**Archivo**: `web/src/components/layout/sidebar.tsx`

- [x] Eliminar los grupos top-level: `nivel-primario`, `secundario`, `inicial`, `terciario`
- [x] Mover sus items al array del grupo `academico` con `levelId` correspondiente:
  - [x] Salas, Informes Evolutivos, Planificaciones → `levelId: 1`
  - [x] Grados, Calificaciones (primario) → `levelId: 2`
  - [x] Cursos, Mesas de Examen → `levelId: 3`
  - [x] Carreras, Inscripciones (terciario) → `levelId: 4`

## T3: Update filter logic

**Archivo**: `web/src/components/layout/sidebar.tsx`

- [x] Derivar niveles base desde composite codes: `new Set(config.levels.map(c => Math.floor(c / 10)))`
- [x] Agregar filtro por `levelId` en `makeFilterItem`:
  - [x] Si `item.levelId !== undefined && user?.role !== 'ROOT' && !baseLevels.has(item.levelId)` → ocultar
- [x] Mantener filtros existentes: `requiresLevel`, `featureFlag`, `roles`
- [x] ROOT ve todos los niveles sin restricción

## T4: Update render function

**Archivo**: `web/src/components/layout/sidebar.tsx`

- [x] Crear función `renderGroupItems()` que itera `visibleItems` y detecta cambios de `levelId`
- [x] Insertar `<div className="sidebar-section-label">` con la etiqueta del nivel cuando `levelId` cambia
- [x] Reemplazar `group.visibleItems.map(renderLink)` por `renderGroupItems(group.visibleItems)`

## T5: Add CSS for section labels

**Archivo**: `web/src/components/layout/sidebar.css`

- [x] Agregar `.sidebar-section-label` con estilo sutil (font-size sm, color muted, uppercase o semibold, padding)
- [x] Agregar regla en tablet collapsed mode para ocultar sub-headings

## T6: Update tests

**Archivo**: `web/src/components/layout/__tests__/sidebar.test.tsx`

- [x] Cambiar `mockLevels` de `[1, 2, 3, 4]` a `[10, 20, 30, 40]` (composite codes)
- [x] Agregar tests para filtrado por nivel específico (ej: solo Primario y Secundario activos)
- [x] Agregar tests para ROOT bypass (todos los niveles visibles)
- [x] Agregar tests para sub-headings visibles/ocultos

## T7: Verification

- [x] `pnpm test` — todos los tests pasan
- [x] `pnpm lint` — sin errores nuevos (solo pre-existing errors en otros archivos)
