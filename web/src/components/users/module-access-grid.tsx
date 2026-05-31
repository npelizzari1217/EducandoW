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
            {ACTIONS.map((action) => (
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
                {ACTION_LABELS[action] ?? action}
              </th>
            ))}
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
