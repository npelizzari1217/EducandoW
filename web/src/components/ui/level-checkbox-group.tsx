import { useMemo, useId } from 'react';
import { LEVEL_CATALOG } from '../../constants/levels';
import type { LevelOption } from '../../constants/levels';

/**
 * Selector de niveles educativos — checkbox grid agrupado por nivel base.
 *
 * Fuente única de verdad para el campo "Niveles educativos" que comparten
 * los formularios de Usuarios e Instituciones. Antes el bloque estaba
 * duplicado en cada página y derivó visualmente; centralizarlo evita que
 * se vuelvan a desincronizar.
 *
 * `selected` y `onToggle` operan sobre ÍNDICES dentro de LEVEL_CATALOG.
 */

const GROUP_LABELS: Record<number, string> = {
  1: 'Inicial',
  2: 'Nivel Primario',
  3: 'Secundario',
  4: 'Terciario',
  9: 'Administración',
};

interface LevelCheckboxGroupProps {
  /** Índices seleccionados dentro de LEVEL_CATALOG */
  selected: Set<number>;
  /** Alterna el índice indicado dentro de LEVEL_CATALOG */
  onToggle: (idx: number) => void;
  /** Mensaje de error opcional (validación del campo) */
  error?: string;
  /** Etiqueta del campo (por defecto "Niveles educativos") */
  label?: string;
  /**
   * Modo de selección:
   * - `'multi'` (default): checkboxes, permite múltiples selecciones.
   * - `'single'`: radios, una sola selección. El padre mantiene el Set
   *   con un solo elemento; el componente llama `onToggle(idx)` al cambiar.
   */
  mode?: 'single' | 'multi';
}

export function LevelCheckboxGroup({
  selected,
  onToggle,
  error,
  label = 'Niveles educativos',
  mode = 'multi',
}: LevelCheckboxGroupProps) {
  const radioGroupName = useId();
  const grouped = useMemo(() => {
    const map = new Map<number, { label: string; options: Array<{ idx: number; opt: LevelOption }> }>();
    for (let i = 0; i < LEVEL_CATALOG.length; i++) {
      const opt = LEVEL_CATALOG[i];
      if (!map.has(opt.levelCode)) {
        map.set(opt.levelCode, { label: GROUP_LABELS[opt.levelCode] ?? `Nivel ${opt.levelCode}`, options: [] });
      }
      map.get(opt.levelCode)!.options.push({ idx: i, opt });
    }
    return map;
  }, []);

  return (
    <div>
      <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>
        {label}
      </label>
      <div className="flex flex-col gap-md" style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
        {Array.from(grouped.entries()).map(([levelCode, group]) => (
          <div key={levelCode}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {group.label}
            </div>
            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
              {group.options.map(({ idx, opt }) => (
                <label
                  key={opt.code}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: selected.has(idx) ? 'var(--color-primary-soft, rgba(99,102,241,0.12))' : 'transparent',
                  }}
                >
                  <input
                    type={mode === 'single' ? 'radio' : 'checkbox'}
                    name={mode === 'single' ? radioGroupName : undefined}
                    checked={selected.has(idx)}
                    onChange={() => onToggle(idx)}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
