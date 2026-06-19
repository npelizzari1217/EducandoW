import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/auth-context';
import { useActiveInstitution } from '../../context/active-institution-context';

interface Institution {
  id: string;
  name: string;
}

/**
 * Global institution selector — visible ONLY for ROOT users.
 * Fetches all institutions from GET /institutions and binds to the
 * ActiveInstitution context. Selection triggers a page reload (MVP strategy).
 */
export function ActiveInstitutionSelector() {
  const { user } = useAuth();
  const { activeId, setActive, clear } = useActiveInstitution();
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  const isRoot = user?.roles?.includes('ROOT') ?? false;

  useEffect(() => {
    if (!isRoot) return;
    apiClient
      .get('/institutions')
      .then((r) => {
        setInstitutions(r.data?.data ?? []);
      })
      .catch(() => {});
  }, [isRoot]);

  if (!isRoot) return null;

  return (
    <select
      value={activeId ?? ''}
      onChange={(e) => {
        if (e.target.value) {
          setActive(e.target.value);
        } else {
          clear();
        }
      }}
      style={{
        padding: '0.35rem 0.6rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontSize: 'var(--text-sm)',
        minWidth: '200px',
      }}
    >
      <option value="">Seleccionar institución</option>
      {institutions.map((inst) => (
        <option key={inst.id} value={inst.id}>
          {inst.name}
        </option>
      ))}
    </select>
  );
}
