/**
 * GrupoSelector — conditional group selector.
 *
 * F7-N2: If grupos.length === 1 → render nothing (auto-select implied by parent).
 *        If grupos.length > 1  → render a <select> so the user can pick a group.
 */

interface Grupo {
  id: string;
  name: string | null;
  docenteName: string | null;
}

interface GrupoSelectorProps {
  grupos: Grupo[];
  selectedId: string | null;
  onChange: (id: string) => void;
}

const selectStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: 'var(--text-sm)',
  minWidth: '200px',
};

export function GrupoSelector({ grupos, selectedId, onChange }: GrupoSelectorProps) {
  // F7-T1: when only 1 group → don't render selector at all
  if (grupos.length <= 1) return null;

  return (
    <select
      data-testid="grupo-selector"
      value={selectedId ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={selectStyle}
      aria-label="Seleccionar grupo"
    >
      <option value="">— Seleccionar grupo —</option>
      {grupos.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name ?? g.docenteName ?? `Grupo ${g.id.slice(0, 6)}`}
        </option>
      ))}
    </select>
  );
}
