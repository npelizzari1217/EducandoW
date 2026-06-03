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

---

## 17. Pantallas no CRUD (Login, Register, Dashboard Home, 404, Perfil)

Las pantallas que **no** siguen el patrón ABM estándar tienen reglas propias. Esta sección cubre los cinco tipos de pantalla no CRUD del sistema.

### 17.1 Layout por tipo de pantalla

Cada tipo de pantalla usa un wrapper distinto. NUNCA mezclar layouts — si una pantalla no está en esta tabla, usá `DashboardLayout`.

| Pantalla | Wrapper | Sidebar visible | Ancho máximo |
|----------|---------|:---:|--------------|
| Login | Ninguno (página standalone) | No | 420px (card centrado) |
| Register | Ninguno (página standalone) | No | 420px (card centrado) |
| Dashboard Home | `DashboardLayout` | Sí | Full width |
| 404 | Ninguno (página standalone) | No | 520px (contenido centrado) |
| Perfil / Configuración | `DashboardLayout` | Sí | 800px (contenido centrado dentro del layout) |

### 17.2 Login y Register

Ambas pantallas comparten estructura base y solo difieren en la cantidad de campos.

**Estructura obligatoria**:

```tsx
// Login — pages/auth/login.tsx
<div className="auth-page">
  <div className="auth-card">
    <img src="/logo.svg" alt="EducandoW" className="auth-logo" />
    <h1 className="auth-title">Iniciar sesión</h1>

    <form onSubmit={handleSubmit} className="auth-form">
      <Input name="email" label="Email" type="email" error={errors.email} ... />
      <Input name="password" label="Contraseña" type={showPassword ? 'text' : 'password'} error={errors.password} ... />
      <button type="button" className="password-toggle" onClick={togglePassword} aria-label="Mostrar contraseña">
        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
      </button>

      {serverError && (
        <div className="auth-error">
          <span className="auth-error-icon">⚠️</span>
          <span>{serverError}</span>
        </div>
      )}

      <Button variant="primary" type="submit" loading={loading} className="auth-submit">
        Ingresar
      </Button>
    </form>

    <p className="auth-switch">
      ¿No tenés cuenta? <Link to="/register">Registrate</Link>
    </p>
  </div>

  {loading && <div className="auth-loading-overlay"><Spinner /></div>}
</div>
```

**Reglas**:

- **Redirect si ya está autenticado**: al montar el componente, si `useAuth().user` no es `null`, redirigir a `/dashboard` con `<Navigate to="/dashboard" />`.
- **Password toggle**: botón con ícono de ojo (👁️ / 👁️‍🗨️) posicionado dentro del campo de contraseña, a la derecha. Sin borde, fondo transparente, `var(--color-text-muted)`. No usar librerías externas para esto.
- **Errores**: usar el bloque `auth-error` con tokens de diseño (ver §1.2). Fondo: `var(--color-danger)` con opacidad 8%. Borde: `1px solid var(--color-danger)`. NUNCA estilos inline.
- **Loading state**: overlay semitransparente sobre el card (`background: rgba(255,255,255,0.7)`) con un spinner centrado. El botón muestra el estado `loading` del componente `Button` (ver §1.3).
- **Link de switcheo**: entre Login y Register, siempre al pie del formulario. Texto: "¿No tenés cuenta? Registrate" / "¿Ya tenés cuenta? Iniciá sesión".

**Register — campos adicionales**:

La pantalla de Register agrega los campos `nombre`, `apellido`, `confirmPassword` antes del email. La validación de `confirmPassword` debe chequear que coincida con `password` en el cliente antes de enviar.

```css
/* pages/auth/auth.css */
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  padding: var(--space-md);
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-2xl);
  position: relative;  /* para el loading overlay */
}

.auth-logo {
  display: block;
  margin: 0 auto var(--space-xl);
  height: 48px;
}

.auth-title {
  text-align: center;
  font-size: var(--text-2xl);
  font-weight: 600;
  margin-bottom: var(--space-xl);
  color: var(--color-text);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.auth-error {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--color-danger) 8%, transparent);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.auth-submit {
  margin-top: var(--space-sm);
  width: 100%;
}

.auth-switch {
  text-align: center;
  margin-top: var(--space-lg);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.auth-switch a {
  color: var(--color-primary);
  font-weight: 500;
}

.auth-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.7);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.password-toggle {
  position: absolute;
  right: var(--space-md);
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: var(--space-xs);
}
```

### 17.3 Dashboard Home

Es la pantalla que ve el usuario apenas inicia sesión. Su contenido varía según el `role`.

**Estructura**:

```tsx
// pages/dashboard/home/home.tsx
<DashboardLayout>
  <header className="page-header">
    <div>
      <h1 className="page-title">👋 ¡Hola{user?.nombre ? `, ${user.nombre}` : ''}!</h1>
      <p className="page-subtitle">{greetingByRole(role)}</p>
    </div>
  </header>

  {loading ? (
    <HomeSkeleton />
  ) : (
    <>
      {/* Grid de KPIs — 3 o 4 cards numéricos */}
      <section className="stats-grid">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="stat-card">
            <span className="stat-icon">{kpi.icon}</span>
            <span className="stat-value">{kpi.value}</span>
            <span className="stat-label">{kpi.label}</span>
          </Card>
        ))}
      </section>

      {/* Acciones rápidas */}
      <section className="quick-actions">
        <h2 className="section-title">Acciones rápidas</h2>
        <div className="quick-actions-grid">
          {quickActions.map(action => (
            <Button key={action.label} variant="ghost" onClick={action.onClick}>
              <span className="action-icon">{action.icon}</span>
              {action.label}
            </Button>
          ))}
        </div>
      </section>

      {/* Contenido variable por rol */}
      {role === 'admin' && <AdminDashboard extras={...} />}
      {role === 'docente' && <DocenteDashboard extras={...} />}
      {role === 'preceptor' && <PreceptorDashboard extras={...} />}
    </>
  )}
</DashboardLayout>
```

**Reglas**:

- **KPIs**: 3 o 4 cards en grid (`grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`). Cada card muestra: ícono grande (2rem), valor numérico (2rem, bold), y label descriptivo (`var(--text-sm)`, `var(--color-text-muted)`). Los KPIs típicos son: alumnos activos, docentes, materias, inscripciones del ciclo actual.
- **Acciones rápidas**: botones grandes tipo menú (no botones primarios). Uno por acción frecuente: "Inscribir alumno", "Cargar asistencia", "Ver calendario", "Generar boletín". Usar `Button variant="ghost"` con ícono a la izquierda.
- **Contenido por rol**: cada rol ve KPIs y acciones distintas. El `role` viene de `useAuth()` (ver §1.4). Si el contenido del rol es extenso, extraerlo a un componente separado (`admin-home.tsx`, `docente-home.tsx`).
- **Skeleton**: mientras los KPIs cargan, mostrar 4 cards fantasma con `skeleton-pulse` (ver §6.1). No usar spinner.
- **API**: los datos del home vienen de `GET /v1/dashboard/summary`. La respuesta incluye `kpis` y `quickActions` ya filtrados por rol y por institución (§1.4).

```css
/* pages/dashboard/home/home.css */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.stat-card {
  text-align: center;
  padding: var(--space-lg);
}

.stat-icon { font-size: 2rem; display: block; margin-bottom: var(--space-sm); }
.stat-value { font-size: 2rem; font-weight: 700; color: var(--color-text); display: block; }
.stat-label { font-size: var(--text-sm); color: var(--color-text-muted); }

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-sm);
}

.quick-actions-grid .action-icon {
  margin-right: var(--space-sm);
}
```

### 17.4 Página 404

Pantalla standalone para rutas no encontradas. No usa `DashboardLayout` ni hace llamadas a la API.

**Estructura**:

```tsx
// pages/not-found/not-found.tsx
<div className="not-found-page">
  <div className="not-found-content">
    <span className="not-found-code">404</span>
    <h1 className="not-found-title">Página no encontrada</h1>
    <p className="not-found-message">
      La página que estás buscando no existe o fue movida.
    </p>
    <Button variant="primary" onClick={() => navigate('/dashboard')}>
      Volver al inicio
    </Button>
  </div>
</div>
```

**Reglas**:

- **Código de error**: `font-size: 6rem`, `font-weight: 800`, color `var(--color-text-muted)` con opacidad adicional (30%). Letra grande y tenue, como fondo decorativo.
- **Mensaje**: texto claro y en español. Nada de "404 Not Found" en inglés. El mensaje debe orientar al usuario: "La página que estás buscando no existe o fue movida."
- **Botón**: "Volver al inicio" navega a `/dashboard` si está autenticado, o a `/login` si no.
- **No llamar a la API**: esta pantalla no hace fetch. Si el backend devuelve 404 para un recurso (ej: alumno inexistente), eso se maneja en la pantalla correspondiente con un empty/error state (ver §6.2 y §6.3), NO redirigiendo a esta página.
- **Centrado absoluto**: la página ocupa `100vh`, contenido centrado con flexbox.

```css
/* pages/not-found/not-found.css */
.not-found-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  padding: var(--space-md);
}

.not-found-content {
  text-align: center;
  max-width: 520px;
}

.not-found-code {
  font-size: 6rem;
  font-weight: 800;
  color: color-mix(in srgb, var(--color-text-muted) 30%, transparent);
  display: block;
  line-height: 1;
  margin-bottom: var(--space-md);
}

.not-found-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}

.not-found-message {
  color: var(--color-text-muted);
  margin-bottom: var(--space-xl);
  font-size: var(--text-base);
}
```

### 17.5 Perfil / Configuración

Pantalla de gestión de cuenta del usuario. Usa `DashboardLayout` con contenido centrado a 800px. La configuración se divide en pestañas (tabs), cada una con su propio endpoint de guardado.

**Estructura**:

```tsx
// pages/dashboard/profile/profile.tsx
<DashboardLayout>
  <header className="page-header">
    <h1 className="page-title">Mi perfil</h1>
  </header>

  <div className="profile-container">
    {/* Tabs de navegación */}
    <nav className="profile-tabs" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`profile-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.icon} {tab.label}
        </button>
      ))}
    </nav>

    {/* Contenido de cada tab */}
    <div className="profile-content" role="tabpanel">
      {activeTab === 'personal' && (
        <ProfilePersonalTab
          data={profile}
          onChange={handleChange}
          errors={errors}
          saving={savingPersonal}
          onSave={() => saveSection('personal')}
        />
      )}
      {activeTab === 'security' && (
        <ProfileSecurityTab
          saving={savingSecurity}
          onSave={(data) => saveSection('security', data)}
        />
      )}
      {activeTab === 'appearance' && (
        <ProfileAppearanceTab
          preferences={preferences}
          saving={savingAppearance}
          onSave={(data) => saveSection('appearance', data)}
        />
      )}
    </div>

    {/* Danger zone — siempre visible al final */}
    <section className="danger-zone">
      <h2 className="danger-zone-title">Zona de peligro</h2>
      <p className="danger-zone-description">
        Estas acciones son irreversibles. Procedé con cuidado.
      </p>
      <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
        Eliminar mi cuenta
      </Button>
    </section>
  </div>

  {showDeleteConfirm && (
    <ConfirmDialog
      open={showDeleteConfirm}
      title="Eliminar cuenta"
      message="¿Estás seguro? Esta acción no se puede deshacer. Perderás todos tus datos permanentemente."
      onConfirm={handleDeleteAccount}
      onCancel={() => setShowDeleteConfirm(false)}
    />
  )}
</DashboardLayout>
```

**Reglas**:

- **Tres tabs fijos**:
  1. **Datos personales** (`personal`): nombre, apellido, email (solo lectura si viene de SSO), teléfono, foto de perfil.
  2. **Seguridad** (`security`): cambio de contraseña (contraseña actual + nueva + confirmación).
  3. **Apariencia** (`appearance`): tema (claro/oscuro), tamaño de fuente, densidad de la UI.

- **Avatar upload en tab Personal**: input `type="file"` oculto, disparado por un botón o clickeando la imagen actual. Mostrar preview circular antes de guardar. Máximo 2MB, formatos JPG/PNG. Validar en cliente antes de enviar. Usar `URL.createObjectURL()` para la preview.

```tsx
// Preview de avatar antes de guardar
<div className="avatar-upload">
  <img
    src={avatarPreview || profile.avatarUrl || '/default-avatar.png'}
    alt="Foto de perfil"
    className="avatar-preview"
    onClick={() => fileInputRef.current?.click()}
  />
  <input
    ref={fileInputRef}
    type="file"
    accept="image/jpeg,image/png"
    hidden
    onChange={handleAvatarChange}
  />
  <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
    Cambiar foto
  </Button>
</div>
```

- **Guardado por sección**: cada tab tiene su propio botón "Guardar" y estado `saving`. No hay un botón global. Esto permite endpoints independientes (`PATCH /v1/profile/personal`, `PUT /v1/profile/password`, `PATCH /v1/profile/preferences`). Si falla una sección, las otras no se ven afectadas.
- **Danger zone**: siempre al final del contenido, visible en todos los tabs. Fondo con borde `var(--color-danger)` (opacidad 15%), padding generoso. El botón de eliminación abre un `ConfirmDialog` (ver §9) que pide al usuario escribir "ELIMINAR" como confirmación adicional.
- **Toast**: cada save exitoso muestra toast de éxito (ver §10). Cada error muestra toast de error con el mensaje del servidor.
- **Accesibilidad**: los tabs usan `role="tablist"`, `role="tab"` y `role="tabpanel"` con `aria-selected`. Ver §13 para reglas completas de accesibilidad.

```css
/* pages/dashboard/profile/profile.css */
.profile-container {
  max-width: 800px;
  margin: 0 auto;
}

.profile-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-border);
  margin-bottom: var(--space-xl);
}

.profile-tab {
  padding: var(--space-sm) var(--space-lg);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.profile-tab:hover {
  color: var(--color-text);
}

.profile-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.avatar-upload {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.avatar-preview {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--color-border);
  cursor: pointer;
  transition: border-color 0.15s;
}

.avatar-preview:hover {
  border-color: var(--color-primary);
}

.danger-zone {
  margin-top: var(--space-2xl);
  padding: var(--space-xl);
  border: 2px solid color-mix(in srgb, var(--color-danger) 15%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-danger) 5%, transparent);
}

.danger-zone-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-danger);
  margin-bottom: var(--space-sm);
}

.danger-zone-description {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-md);
}
```

### 17.6 Archivos esperados

Cada pantalla no CRUD sigue su propia estructura de archivos. Esto es lo que debe generar un sub-agente para cada tipo:

```
web/src/pages/
├── auth/
│   ├── login.tsx              # Pantalla de login (§17.2)
│   ├── register.tsx           # Pantalla de registro (§17.2)
│   ├── auth.css               # Estilos compartidos de auth
│   └── __tests__/
│       ├── login.test.tsx
│       └── register.test.tsx
├── dashboard/
│   ├── home/
│   │   ├── home.tsx           # Dashboard Home (§17.3)
│   │   ├── home.css
│   │   ├── home-skeleton.tsx  # Componente de skeleton loading
│   │   └── __tests__/
│   │       └── home.test.tsx
│   └── profile/
│       ├── profile.tsx              # Contenedor de tabs (§17.5)
│       ├── profile.css
│       ├── profile-personal-tab.tsx # Tab: datos personales + avatar
│       ├── profile-security-tab.tsx # Tab: cambio de contraseña
│       ├── profile-appearance-tab.tsx # Tab: tema y preferencias
│       ├── profile-types.ts         # Tipos: ProfileData, Preferences, etc.
│       ├── profile-api.ts           # Endpoints: personal, password, preferences
│       └── __tests__/
│           ├── profile.test.tsx
│           └── profile-security.test.tsx
└── not-found/
    ├── not-found.tsx          # Página 404 (§17.4)
    ├── not-found.css
    └── __tests__/
        └── not-found.test.tsx
```

**Regla**: cada pantalla que haga llamadas a la API DEBE tener su propio archivo `*-api.ts` (ej: `profile-api.ts`, no un archivo genérico `auth-api.ts`). La ruta 404 es la única excepción porque no consume endpoints.

---

## 18. Patrón Premium (IMPLEMENTADO — obligatorio para toda pantalla nueva)

> **Este patrón es el estándar real del proyecto.** Está implementado en `students.tsx` y `course-cycles.tsx`. Toda pantalla de listado nueva DEBE seguir este patrón, NO el patrón ideal de las secciones anteriores (que son aspiracionales).

### 18.1 Estructura de archivos real

```
web/src/pages/dashboard/
└── {entity}.tsx              # Página completa: lista + formulario inline + filtros
    └── __tests__/
        └── {entity}.test.tsx

web/src/components/{entity}/
└── {Entity}Form.tsx           # Formulario create/edit (usado inline en la página)

web/src/hooks/
└── use{Entity}.ts             # Hooks de API (useApiList, useApiCreate, etc.)

web/src/types/
└── {entity}.ts                # Tipos compartidos (DTOs, interfaces de respuesta)
```

### 18.2 PremiumHeader — obligatorio en todo listado

```tsx
import PremiumHeader from '../../components/ui/premium-header';

<PremiumHeader
  title="Cursos por Ciclo"
  subtitle="Administrá los cursos de cada plan de estudio por ciclo lectivo"
  icon="📚"                                          // Emoji representativo
  stats={[{ label: 'cursos', value: String(data.length) }]}  // Contador dinámico
>
  {/* Acciones opcionales: botones de crear, imprimir, etc. */}
  <Button variant="success-soft" onClick={...}>Nuevo</Button>
</PremiumHeader>
```

**Reglas del header:**
- **icon**: emoji descriptivo (👥 estudiantes, 📚 cursos, 🏫 instituciones)
- **stats**: array con al menos 1 stat (cantidad de registros). El `value` es string, actualizarlo con el length real de `data`
- **subtítulo**: frase en imperativo describiendo qué se administra
- **Acciones**: botones con variantes premium (`success-soft` para crear, `danger-soft` para cancelar)

### 18.3 Selectores de institución y filtros

```tsx
const selectStyle: React.CSSProperties = {
  padding: '0.5rem', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)', color: 'var(--color-text)',
  fontSize: 'var(--text-sm)', minWidth: '160px',
};

// Selector de institución (fuera de Card)
<div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', marginBottom: 'var(--space-md)' }}>
  <div>
    <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Institución</label>
    {isRoot ? (
      <select value={institutionId} onChange={...} style={selectStyle}>
        <option value="">Todas las instituciones</option>
        ...
      </select>
    ) : (
      <input type="text" value={config.name} disabled
        style={{ ...selectStyle, background: '#f8fafc', color: '#64748b' }} />
    )}
  </div>
</div>

// Filtros (dentro de Card)
<Card className="p-4">
  <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
    <div>
      <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Nivel</label>
      <select ... style={selectStyle}>...</select>
    </div>
    ...
  </div>
</Card>
```

**Reglas de filtros:**
- El selector de institución va **fuera** del Card de filtros
- Los filtros de entidad van **dentro** de `<Card className="p-4">`
- Layout: `display: flex; gap: var(--space-lg); align-items: flex-end; flexWrap: wrap`
- Cada filtro es un `<div>` con `<label>` arriba y `<select>` o `<input>` abajo
- Labels usan `fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block'`
- Selects usan el `selectStyle` definido como constante

### 18.4 Formulario inline (create/edit)

```tsx
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

// Mostrar/ocultar condicionalmente
{showForm && (
  <div style={{ marginTop: 'var(--space-md)' }}>
    <CourseCycleForm
      onSubmit={handleCreate}
      onCancel={() => setShowForm(false)}
      loading={creating}
      error={createError}
    />
  </div>
)}
```

**Dentro del componente Form:**
```tsx
export default function EntityForm({ initial, onSubmit, onCancel, loading, error }) {
  return (
    <Card title={isEdit ? 'Editar entidad' : 'Nueva entidad'}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

          {/* Grid de campos: 1fr 1fr 1fr para 3 selects, 1fr 1fr para pares */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <Input label="Nombre" value={...} onChange={...} required />
            <Input label="Apellido" value={...} onChange={...} required />
          </div>

          {/* Checkbox para booleanos */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
            <input type="checkbox" checked={form.active} onChange={...}
              style={{ width: '1rem', height: '1rem', accentColor: 'var(--color-primary, #16a34a)' }} />
            Activo
          </label>

          {/* Error */}
          {error && (
            <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}>
              {error}
            </div>
          )}

          {/* Acciones: Cancelar izquierda, Guardar derecha */}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="ghost" type="button" onClick={onCancel}>Cancelar</Button>
            <Button variant="success-soft" type="submit" loading={loading}>
              {isEdit ? 'Guardar cambios' : 'Crear'}
            </Button>
          </div>

        </div>
      </form>
    </Card>
  );
}
```

**Reglas del formulario:**
- **Wrapper**: `<Card title="...">` — el título refleja create vs edit
- **Layout interno**: `flexDirection: 'column', gap: 'var(--space-md)'`
- **Grid de campos**: `gridTemplateColumns: '1fr 1fr'` (o `1fr 1fr 1fr` para 3 selects)
- **Campos**: usar componente `Input` con prop `label` (NO labels manuales excepto para selects)
- **Selects**: usar `<select>` nativo con `selectStyle` (ver §18.3). El label va manual arriba con `display: 'block'`
- **Checkbox**: para campos booleanos, `<label>` con `display: flex; alignItems: center; gap: var(--space-sm)`
- **Errores**: div con `background: '#fef2f2'`, `color: 'var(--color-danger)'`, sin borde
- **Botones**: `Cancelar` con `variant="ghost"`, `Guardar/Crear` con `variant="success-soft"` y `loading={...}`

### 18.5 Tabla de listado

```tsx
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';

<Card className="mt-lg">
  {loading && <p className="text-muted-foreground">Cargando...</p>}
  {!loading && data.length === 0 && <p className="text-muted-foreground">No hay entidades.</p>}
  {!loading && data.length > 0 && (
    <Table
      columns={[
        { key: 'name', header: 'Nombre' },
        { key: 'status', header: 'Estado', render: (item) => (
          <span style={{
            display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-xs)', fontWeight: 500,
            background: item.active ? '#dcfce7' : '#fee2e2',
            color: item.active ? '#16a34a' : '#dc2626',
          }}>
            {item.active ? 'Activo' : 'Inactivo'}
          </span>
        )},
        { key: 'actions', header: '', render: (item) => (
          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            <Button variant="action" size="sm" onClick={() => setEditing(item.actions)}>Editar</Button>
            <Button variant="danger-soft" size="sm" onClick={() => handleDelete(item.actions.uuid)} loading={deleting}>Eliminar</Button>
          </div>
        )},
      ]}
      data={tableData}
    />
  )}
</Card>
```

**Reglas de tabla:**
- **Wrapper**: `<Card className="mt-lg">`
- **Loading**: `<p className="text-muted-foreground">Cargando...</p>`
- **Empty**: `<p className="text-muted-foreground">No hay entidades.</p>`
- **Columna de estado (activo/inactivo)**: badge inline con estilos:
  - Activo: `background: '#dcfce7'` (verde claro), `color: '#16a34a'` (verde)
  - Inactivo: `background: '#fee2e2'` (rojo claro), `color: '#dc2626'` (rojo)
  - `display: 'inline-block'`, `padding: '0.125rem 0.5rem'`, `borderRadius: 'var(--radius-sm)'`
- **Columna de acciones**: `header: ''` (sin título), última columna
  - `display: 'flex', gap: 'var(--space-xs)'`
  - Botón Editar: `variant="action" size="sm"`
  - Botón Eliminar: `variant="danger-soft" size="sm"` con `loading={deleting}`
- **tableData**: mapear `data` para armar filas con campos display-friendly (labels, nombres de ciclo, etc.)

### 18.6 Variantes de Button usadas

| Variante | Uso | Apariencia |
|----------|-----|------------|
| `success-soft` | Crear, Guardar cambios | Fondo verde suave, texto verde |
| `danger-soft` | Cancelar formulario, Eliminar | Fondo rojo suave, texto rojo |
| `action` | Editar (en tabla) | Fondo azul suave, texto azul |
| `ghost` | Cancelar (en form), Buscar | Sin fondo, solo texto |

### 18.7 Toast de notificaciones

```tsx
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

// Éxito
setToast({ message: 'Creados: 3 | Total: 5', type: 'success' });

// Error
setToast({ message: e?.response?.data?.error?.message ?? 'Error', type: 'error' });

// Render (fixed, bottom-right, clickeable para cerrar)
{toast && (
  <div
    style={{
      position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9999,
      padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)',
      background: toast.type === 'success' ? '#16a34a' : '#dc2626',
      color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 500,
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)', maxWidth: '400px', cursor: 'pointer',
    }}
    onClick={() => setToast(null)}
  >
    {toast.message}
  </div>
)}
```

**Reglas del toast:**
- Posición: `fixed, bottom: 1rem, right: 1rem`
- Éxito: `background: '#16a34a'` (verde sólido)
- Error: `background: '#dc2626'` (rojo sólido)
- Click para cerrar (setea `toast` a `null`)
- Sin animaciones, sin timeout automático — el usuario lo cierra

### 18.8 Hooks de API

```typescript
// hooks/use{Entity}.ts
import { useApiList, useApiCreate, useApiDelete, useApiUpdate } from './use-api';

const BASE_URL = '/entity';

export function useEntity(params?: Record<string, string>) {
  return useApiList<EntityType>(BASE_URL, params);
}

export function useCreateEntity() {
  return useApiCreate<CreateDto>(BASE_URL);
}

export function useUpdateEntity() {
  return useApiUpdate<UpdateDto>(BASE_URL);
}

export function useDeleteEntity() {
  return useApiDelete(BASE_URL);
}
```

**Regla**: una entidad = un archivo de hooks. No mezclar hooks de distintas entidades.

### 18.9 Ejemplo completo de referencia

La implementación de referencia es `web/src/pages/dashboard/students.tsx`. Para ver el patrón premium completo, leer ese archivo. `course-cycles.tsx` es el ejemplo más reciente con todos los patrones aplicados (PremiumHeader, filtros, formulario inline, tabla con badges, toast).
