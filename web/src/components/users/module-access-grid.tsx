import { type FC, useCallback, useMemo } from 'react';

// ── Tipos ─────────────────────────────────────────────────

interface ModuleInfo {
  code: string;
  name: string;
  actions: string[];
}

interface ModuleAccessItem {
  moduleCode: string;
  actions: string[];
}

interface Props {
  availableModules: ModuleInfo[];
  value: ModuleAccessItem[];
  onChange: (moduleAccess: ModuleAccessItem[]) => void;
}

// ── Constantes ────────────────────────────────────────────

const ACTIONS = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] as const;

const ACTION_LABELS: Record<string, string> = {
  READ: 'Ver',
  CREATE: 'Crear',
  UPDATE: 'Editar',
  DELETE: 'Eliminar',
  PRINT: 'Imprimir',
};

// ── Componente ────────────────────────────────────────────

const ModuleAccessGrid: FC<Props> = ({ availableModules, value, onChange }) => {
  // Índice de acceso rápido: moduleCode → Set<action>
  const accessMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of value) {
      map.set(item.moduleCode, new Set(item.actions));
    }
    return map;
  }, [value]);

  const isChecked = useCallback(
    (moduleCode: string, action: string) => {
      return accessMap.get(moduleCode)?.has(action) ?? false;
    },
    [accessMap],
  );

  const handleToggle = useCallback(
    (moduleCode: string, action: string) => {
      const next = new Map<string, Set<string>>();
      // Copiar estado actual
      for (const item of value) {
        next.set(item.moduleCode, new Set(item.actions));
      }

      const currentActions = next.get(moduleCode);
      if (currentActions) {
        // Toggle: si existe → quitar, si no → agregar
        if (currentActions.has(action)) {
          currentActions.delete(action);
          if (currentActions.size === 0) {
            next.delete(moduleCode);
          }
        } else {
          currentActions.add(action);
        }
      } else {
        next.set(moduleCode, new Set([action]));
      }

      // Convertir Map → ModuleAccessItem[]
      const result: ModuleAccessItem[] = [];
      for (const [code, actionsSet] of next) {
        result.push({ moduleCode: code, actions: Array.from(actionsSet) });
      }

      onChange(result);
    },
    [value, onChange],
  );

  // Selecciona o deselecciona una acción en TODOS los módulos disponibles.
  // Si todos ya tienen la acción → la quita en todos (deselect-all).
  // Si alguno no la tiene → la agrega en todos (select-all).
  const handleToggleColumn = useCallback(
    (action: string) => {
      // Clonar estado actual (mismo patrón que handleToggle)
      const next = new Map<string, Set<string>>();
      for (const item of value) {
        next.set(item.moduleCode, new Set(item.actions));
      }

      // Verificar si toda la columna ya está seleccionada
      const all = availableModules.every((m) => next.get(m.code)?.has(action));

      for (const mod of availableModules) {
        if (all) {
          // Deseleccionar en todos; eliminar módulos que quedan con Set vacío
          const set = next.get(mod.code);
          if (set) {
            set.delete(action);
            if (set.size === 0) next.delete(mod.code);
          }
        } else {
          // Seleccionar en todos los módulos disponibles
          const set = next.get(mod.code) ?? new Set<string>();
          set.add(action);
          next.set(mod.code, set);
        }
      }

      // Convertir Map → ModuleAccessItem[]
      const result: ModuleAccessItem[] = [];
      for (const [code, actionsSet] of next) {
        result.push({ moduleCode: code, actions: Array.from(actionsSet) });
      }

      onChange(result);
    },
    [value, availableModules, onChange],
  );

  if (availableModules.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        overflowX: 'auto',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text)',
        }}
      >
        {/* Encabezado */}
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            <th
              style={{
                padding: '0.6rem 0.75rem',
                textAlign: 'left',
                fontWeight: 600,
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                minWidth: '160px',
              }}
            >
              Módulo
            </th>
            {ACTIONS.map((action) => {
              // Tri-estado derivado de value + availableModules (sin estado propio)
              const count = availableModules.filter((m) => isChecked(m.code, action)).length;
              const all = count === availableModules.length && count > 0;
              const some = count > 0 && !all;
              return (
                <th
                  key={action}
                  style={{
                    padding: '0.6rem 0.5rem',
                    textAlign: 'center',
                    fontWeight: 600,
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    width: '80px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <span>{ACTION_LABELS[action] ?? action}</span>
                    {/* indeterminate es propiedad sólo-DOM: se setea vía ref callback */}
                    <input
                      type="checkbox"
                      data-testid={`column-header-${action}`}
                      checked={all}
                      ref={(el) => { if (el) el.indeterminate = some; }}
                      onChange={() => handleToggleColumn(action)}
                      style={{
                        accentColor: 'var(--color-primary)',
                        width: '1rem',
                        height: '1rem',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Filas de módulos */}
        <tbody>
          {availableModules.map((mod) => (
            <tr
              key={mod.code}
              style={{
                borderBottom: '1px solid var(--color-border)',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--color-bg)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {/* Nombre del módulo */}
              <td
                style={{
                  padding: '0.5rem 0.75rem',
                  fontWeight: 500,
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text)',
                }}
              >
                {mod.name}
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    marginLeft: '0.35rem',
                  }}
                >
                  {mod.code}
                </span>
              </td>

              {/* Checkboxes por acción */}
              {ACTIONS.map((action) => (
                <td
                  key={action}
                  style={{
                    padding: '0.5rem',
                    textAlign: 'center',
                  }}
                >
                  <input
                    type="checkbox"
                    data-testid={`cell-${mod.code}-${action}`}
                    checked={isChecked(mod.code, action)}
                    onChange={() => handleToggle(mod.code, action)}
                    style={{
                      accentColor: 'var(--color-primary)',
                      width: '1rem',
                      height: '1rem',
                      cursor: 'pointer',
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ModuleAccessGrid;
export type { ModuleInfo, ModuleAccessItem };
