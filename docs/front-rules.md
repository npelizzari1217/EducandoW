# EducandoW — Frontend Rules (Global)

> **Propósito**: Reglas de construcción de UI que todo sub-agente frontend DEBE respetar.
> **Alcance**: Aplica a toda pantalla de ABM/CRUD del sistema.
> **Extensión**: Cada módulo puede sobrescribir reglas puntuales en su propio `front-rules.md` (ver §14).

---

## 1. Stack & Design System

### 1.1 Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime | React | 19.x |
| Bundler | Vite | 6.x |
| Router | React Router | v7 |
| HTTP | Axios (via `api/client.ts`) | — |
| Estilos | CSS plano con custom properties | — |
| Tests | Vitest + jsdom | 1.6.x |

### 1.2 Design Tokens (NO inventar colores ni espacios)

Todos los valores de diseño vienen de `:root` en `styles/design-system.css`. Usar EXCLUSIVAMENTE estas variables:

```css
/* Colores — usar var(--color-X), NUNCA valores hardcodeados */
--color-primary / --color-primary-hover / --color-primary-light
--color-danger / --color-danger-hover
--color-success / --color-warning
--color-bg / --color-surface / --color-border
--color-text / --color-text-muted / --color-text-light

/* Espaciado — NO usar px crudos, siempre var(--space-X) */
--space-xs (0.25rem) / --space-sm (0.5rem) / --space-md (1rem)
--space-lg (1.5rem) / --space-xl (2rem) / --space-2xl (3rem)

/* Tipografía */
--font-sans: 'Inter', system-ui, -apple-system, sans-serif
--text-xs (0.75rem) ... --text-3xl (1.875rem)

/* Bordes y sombras */
--radius-sm (6px) / --radius-md (8px) / --radius-lg (12px)
--shadow-sm / --shadow-md / --shadow-lg

/* Layout */
--sidebar-width: 240px
```

### 1.3 Componentes base (reutilizar, NO reinventar)

El proyecto ya provee estos componentes en `components/ui/`. Usarlos siempre. Si falta un componente, crearlo en `components/ui/` siguiendo el mismo patrón (archivo `.tsx` + `.css`).

| Componente | Archivo | Props clave |
|-----------|---------|------------|
| `Button` | `ui/button.tsx` | `variant` (primary/danger/ghost), `size` (sm/md), `loading` |
| `Table` | `ui/table.tsx` | `columns`, `data`, `onRowClick`, `emptyMessage` |
| `Card` | `ui/card.tsx` | `title`, `actions`, `children` |
| `Input` | `ui/input.tsx` | `label`, `error`, `...input props` |

### 1.4 Providers y contexto global

NUNCA hacer `fetch` o `axios` directo. Usar el cliente HTTP:

```typescript
import apiClient from '@/api/client';  // Ya tiene interceptors de JWT y 401

// SIEMPRE usar estos hooks para datos contextuales:
import { useAuth } from '@/context/auth-context';           // user, role, login, logout
import { useInstitution } from '@/context/institution-context'; // config (25 campos)
```

### 1.5 Constantes de nivel

Para combos de nivel educativo o mostrar etiquetas, usar las constantes de `@/constants/levels`:

```typescript
import { PEDAGOGICAL_LEVELS, LEVEL_LABELS, LEVELS_BY_BASE, levelLabel } from '@/constants/levels';

// Ejemplo: combo de nivel
<select>
  {PEDAGOGICAL_LEVELS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
</select>

// Ejemplo: mostrar label dado un código
<span>{levelLabel(enrollment.level)}</span>  // 21 → "Talleres de Primario"
```

---

## 2. Arquitectura de archivos por entidad

Cada entidad (ej: Alumnos, Docentes, Materias) sigue esta estructura:

```
web/src/pages/dashboard/
└── {entity}/
    ├── {entity}-list.tsx        # Vista principal: tabla/cards + búsqueda + paginación
    ├── {entity}-list.css        # Estilos específicos de la lista
    ├── {entity}-form.tsx        # Formulario create/edit (modal o página)
    ├── {entity}-form.css        # Estilos del formulario
    ├── {entity}-detail.tsx      # Vista de detalle/impresión (opcional)
    ├── {entity}-detail.css      # Estilos de detalle
    ├── {entity}-types.ts        # Tipos locales (FormData, Filters, etc.)
    ├── {entity}-api.ts          # Funciones de API específicas de la entidad
    └── __tests__/
        ├── {entity}-list.test.tsx
        └── {entity}-form.test.tsx
```

**Regla**: Un componente por archivo. Si el componente crece mucho (>300 líneas), extraer sub-componentes a una subcarpeta `components/`.

---

## 3. Vista de Listado (Browse)

### 3.1 Desktop (>1024px)

```tsx
// Estructura obligatoria
<DashboardLayout>
  <header className="page-header">
    <div>
      <h1 className="page-title">[Icono] [Nombre Entidad]</h1>
      <p className="page-subtitle">[N] registros encontrados</p>
    </div>
    <Button variant="primary" onClick={openCreate}>+ Agregar [Entidad]</Button>
  </header>

  {/* Barra de búsqueda y filtros */}
  <SearchBar ... />

  {/* Tabla */}
  <Card>
    <Table columns={columns} data={items} emptyMessage="No hay [entidad] registrada" />
  </Card>

  {/* Paginación */}
  <Pagination ... />
</DashboardLayout>
```

**Reglas de tabla**:
- La última columna es SIEMPRE "Acciones" con ancho fijo de 120px.
- Acciones por fila: íconos de Editar (✏️), Eliminar (🗑️), Imprimir (🖨️). Sin texto, solo íconos con tooltip.
- Hover de fila: `background: var(--color-primary-light)` con transición de 150ms.
- Estados (columna "Estado"): usar badges con `var(--color-success)` y `var(--color-danger)` como fondos suaves (`background: color + 15% opacity`).

### 3.2 Mobile (<768px)

- Ocultar la `<Table>` completamente.
- Renderizar una lista de `<Card>`, uno por registro.
- Cada card muestra: título (nombre), subtítulo (dato secundario), badge de estado.
- Acciones: menú de tres puntos (⋯) en esquina superior derecha del card, o swipe izquierdo para exponer "Editar | Eliminar".
- El botón "+ Agregar" se convierte en FAB (floating action button) fijo abajo a la derecha.

```css
/* Ejemplo FAB */
.fab {
  position: fixed; bottom: var(--space-xl); right: var(--space-xl);
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--color-primary); color: #fff;
  box-shadow: var(--shadow-lg);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; z-index: 20;
}
```

### 3.3 Tablet (768px-1024px)

- Usar el layout desktop (tabla) pero con sidebar colapsado (ícono hamburger).
- Columnas de tabla reducidas: mostrar solo columnas esenciales (nombre, estado, acciones).

---

## 4. Formulario (Create / Edit)

### 4.1 Layout

```tsx
<DashboardLayout>
  <header className="page-header">
    <h1 className="page-title">{isEdit ? 'Editar' : 'Nuevo'} [Entidad]</h1>
  </header>

  <Card>
    <form onSubmit={handleSubmit} className="entity-form">
      {/* Secciones lógicas agrupadas */}
      <fieldset className="form-section">
        <legend className="form-section-title">Datos básicos</legend>
        <div className="form-grid">
          <Input name="nombre" label="Nombre" error={errors.nombre} ... />
          <Input name="apellido" label="Apellido" error={errors.apellido} ... />
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend className="form-section-title">Datos académicos</legend>
        <div className="form-grid">
          <select name="level" ...> {/* combo de PEDAGOGICAL_LEVELS */} </select>
        </div>
      </fieldset>

      {/* Barra de acciones fija abajo */}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit" loading={saving}>Guardar</Button>
      </div>
    </form>
  </Card>
</DashboardLayout>
```

### 4.2 Reglas de formulario

- **Grid**: `display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md)` en desktop. `1fr` en mobile.
- **Fieldsets**: agrupar campos relacionados con `<fieldset>` + `<legend>`. Separador visual: `border-bottom: 1px solid var(--color-border)` debajo del legend.
- **Labels**: siempre visibles arriba del input (NO placeholders como labels). Fuente: `var(--text-sm)`, peso 500.
- **Focus**: `box-shadow: 0 0 0 3px var(--color-primary-light)` con transición de 150ms.
- **Error inline**: debajo del input, texto en `var(--color-danger)`, `var(--text-xs)`. Borde del input en `var(--color-danger)`.
- **Submit deshabilitado** mientras `loading=true`.
- **Barra de acciones**: sticky al bottom o al final del form. Cancelar izquierda, Guardar derecha.
- **Confirmación al cancelar**: si el form está sucio (`isDirty`), mostrar `window.confirm('¿Descartar cambios?')`.

### 4.3 Validación

- Validar en el cliente ANTES de enviar al servidor.
- Errores del servidor (400) mostrarlos igual que los de cliente (inline o toast).
- Usar un estado `errors: Record<string, string>` mapeado por nombre de campo.

---

## 5. Vista de Detalle (Read / Print)

Cuando la entidad requiera una vista de solo lectura (ej: ficha del alumno, comprobante de inscripción):

- Layout single-column, máximo 800px de ancho centrado.
- Datos en pares clave-valor: etiqueta en gris (`var(--color-text-muted)`) a la izquierda, valor en negro a la derecha.
- Botón "Imprimir" o "Exportar PDF" en el header.
- Al imprimir (`@media print`): ocultar sidebar, header de acciones, y cualquier elemento interactivo.

---

## 6. Estados de UI (Loading, Empty, Error, Edge Cases)

### 6.1 Loading (Skeleton)

```tsx
// NUNCA usar un spinner genérico. Usar skeleton:
function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="skeleton-table">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton-cell" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

```css
.skeleton-cell {
  height: 1rem; background: var(--color-border); border-radius: var(--radius-sm);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

### 6.2 Empty State

Cuando no hay datos:
- Ícono grande (📭 o similar) centrado.
- Texto: "No hay [entidades] registradas".
- Subtítulo: "Hacé clic en '+ Agregar' para crear la primera".
- Si aplica, incluir el botón de creación en el mismo empty state.

### 6.3 Error State

Cuando la API falla:
- Card con borde `var(--color-danger)` y fondo suave.
- Mensaje: "Error al cargar los datos. [Mensaje del servidor]".
- Botón "Reintentar" que vuelve a llamar a la API.

### 6.4 Edge Cases

- **Lista con 1 solo elemento**: se muestra normalmente (sin diseño especial).
- **Form con campos condicionales**: mostrar/ocultar campos con transición suave (`max-height` + `opacity`), no con display:none brusco.
- **Texto muy largo en tabla**: truncar con `text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 200px`.
- **Nombre de institución muy largo en sidebar**: truncar con ellipsis, mostrar tooltip con el nombre completo.

---

## 7. Búsqueda y Filtrado

### 7.1 Barra de búsqueda

```tsx
<div className="search-bar">
  <Input
    name="search"
    placeholder="Buscar por nombre, DNI..."
    value={search}
    onChange={handleSearch}
  />
  <Button variant="ghost" onClick={toggleFilters}>☰ Filtros</Button>
</div>
```

- Debounce de 300ms antes de llamar a la API.
- El placeholder debe ser específico: "Buscar por nombre, apellido o DNI", no "Buscar...".
- Al borrar el texto de búsqueda, restaurar la lista completa automáticamente.

### 7.2 Panel de filtros

- Panel colapsable debajo de la search bar.
- Filtros comunes: nivel (combo de PEDAGOGICAL_LEVELS), estado (Activo/Inactivo), fecha desde/hasta.
- Botón "Limpiar filtros" que resetea todos los campos.
- Mostrar badge con cantidad de filtros activos: "Filtros (2)".

---

## 8. Paginación

```tsx
interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}
```

- Mostrar: "Mostrando 1-10 de 45 resultados".
- Controles: ◀ Anterior | Página [1] [2] [3] | Siguiente ▶.
- Tamaño de página: selector con opciones [10, 25, 50].
- Si `total === 0`, no mostrar paginación.
- En mobile, solo mostrar ◀ [página actual] ▶ (sin números de página).

---

## 9. Diálogos de Confirmación

Para acciones destructivas (eliminar, desactivar):

```tsx
function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button variant="danger" onClick={onConfirm}>Eliminar</Button>
        </div>
      </div>
    </div>
  );
}
```

```css
.modal-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  animation: fadeIn 0.15s ease;
}
.modal-content {
  background: var(--color-surface); border-radius: var(--radius-lg);
  padding: var(--space-xl); max-width: 420px; width: 90%;
  box-shadow: var(--shadow-lg);
  animation: scaleIn 0.15s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0.95); } to { transform: scale(1); } }
```

---

## 10. Notificaciones Toast

Para feedback no bloqueante (éxito al guardar, error de red):

```tsx
// Usar un sistema simple de toast:
function useToast() {
  // Retorna { success(msg), error(msg), dismiss() }
  // El toast aparece arriba a la derecha, dura 4s, se puede cerrar.
}
```

- Éxito: fondo `var(--color-success)` con opacidad 10%, borde verde, texto verde oscuro.
- Error: fondo `var(--color-danger)` con opacidad 10%, borde rojo, texto rojo oscuro.
- Posición: fijo, arriba-derecha, `z-index: 100`.
- Animación: `slideInRight` al entrar, `fadeOut` al salir.

---

## 11. Impresión y Exportación

### 11.1 Estilos de impresión

```css
@media print {
  .sidebar, .sidebar-toggle, .page-header button, .search-bar,
  .pagination, .fab, .modal-overlay, .toast-container {
    display: none !important;
  }
  .main-content { margin-left: 0 !important; padding: 0 !important; }
  .card { box-shadow: none !important; border: 1px solid #ccc !important; }
  body { font-size: 11pt; color: #000; background: #fff; }
  .table th { background: #eee !important; color: #000 !important; }
}
```

### 11.2 Botones de exportación

- Grupo de botones secundarios junto a la search bar.
- Excel (📊): exporta datos visibles (respetando filtros) a CSV/XLSX.
- PDF (🖨️): abre vista previa de impresión del navegador.
- Ambos respetan los filtros activos.

---

## 12. Responsive Breakpoints

| Breakpoint | Layout | Sidebar | Tabla | Form |
|-----------|--------|---------|-------|------|
| <768px (Mobile) | Single column | Oculto, hamburger menu | Cards | Single column |
| 768-1024px (Tablet) | Sidebar colapsado | Íconos sin texto | Columnas reducidas | 2 columnas |
| >1024px (Desktop) | Sidebar completo | Completo | Completa | 2 columnas |

```css
/* Mobile first: los estilos base son mobile, los media queries agregan desktop */
@media (min-width: 768px) { /* tablet */ }
@media (min-width: 1024px) { /* desktop */ }
```

---

## 13. Accesibilidad (obligatorio)

- **Contraste**: todo texto debe pasar WCAG AA (ratio ≥ 4.5:1).
- **Focus visible**: todo elemento interactivo debe tener un anillo de focus (`outline: 2px solid var(--color-primary); outline-offset: 2px`).
- **Labels**: todo input, select, textarea debe tener `<label>` asociado con `htmlFor`.
- **Alt text**: toda imagen o ícono decorativo con `alt=""`. Íconos funcionales con `aria-label`.
- **Teclado**: toda acción debe ser operable con Tab y Enter.
- **ARIA**: usar `aria-expanded` en acordeones, `aria-haspopup` en dropdowns, `aria-live="polite"` en regiones que se actualizan dinámicamente.

---

## 14. Performance

- **Code splitting**: usar `React.lazy()` + `Suspense` para rutas que no son la principal.
- **Memo**: `React.memo` en componentes de lista que se re-renderizan frecuentemente.
- **Debounce**: 300ms en inputs de búsqueda.
- **Imágenes**: `loading="lazy"` en todas las imágenes.
- **CSS**: evitar reflows en animaciones (preferir `transform` y `opacity`).

---

## 15. Extensión por Módulo

Cada módulo puede tener su propio `front-rules.md` en `web/src/pages/dashboard/{module}/front-rules.md` que sobrescriba o extienda reglas específicas. Ejemplo para el módulo de asistencia:

```markdown
# front-rules.md — Módulo Asistencia

## Sobrescribe regla 4.2
- El grid del formulario de asistencia es single-column siempre (lista de alumnos con radio buttons).

## Agrega
- Usar DatePicker para seleccionar la fecha de la clase.
- Mostrar contador de presentes/ausentes/tarde en tiempo real en el header del formulario.
```

El documento global (este archivo) es la base. Si una regla no se sobrescribe, aplica la global.

---

## 16. Template para Sub-Agentes

Cuando invoques un sub-agente para construir una pantalla, usá este prompt exacto:

```
Actuá como un programador experto en Frontend React. Adjunto las reglas de diseño
y estructura de componentes (docs/front-rules.md) que debés respetar a rajatabla.

Generá la pantalla completa de alta, baja, modificación e impresión para la entidad
[Nombre de la Entidad, ej: Alumnos] basándote rigurosamente en dichas reglas.

Stack: React 19, Vite 6, React Router v7, CSS con custom properties (design-system.css),
componentes base en components/ui/ (Button, Table, Card, Input, ConfirmDialog).

Datos de la API disponibles en [endpoint base, ej: GET/POST /v1/students].
Constantes de nivel en @/constants/levels.

La entidad tiene los siguientes campos: [listar campos con tipos y validaciones].
Reglas de negocio específicas: [listar reglas que impactan la UI].

Archivos a generar:
- web/src/pages/dashboard/[entity]/[entity]-list.tsx + .css
- web/src/pages/dashboard/[entity]/[entity]-form.tsx + .css
- web/src/pages/dashboard/[entity]/[entity]-types.ts
- web/src/pages/dashboard/[entity]/[entity]-api.ts
- web/src/pages/dashboard/[entity]/__tests__/[entity]-list.test.tsx
- web/src/pages/dashboard/[entity]/__tests__/[entity]-form.test.tsx
```
