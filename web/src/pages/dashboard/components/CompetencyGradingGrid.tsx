import { useMemo } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { useGradingGrid } from './use-grading-grid';
import { internalStatusColor, internalStatusLabel } from './grading-status';
import type { CellState, ScaleValue, UseGradingGridReturn } from './use-grading-grid';

// ── Props ──────────────────────────────────────────────────────────────────────

/**
 * Subset of UseGradingGridReturn that CompetencyGradingGrid needs.
 * A parent that already owns a useGradingGrid instance can pass it here
 * so CGG skips its own redundant hook call (W1 fix).
 */
export type CompetencyGradingGridData = Pick<
  UseGradingGridReturn,
  | 'loading'
  | 'error'
  | 'students'
  | 'competencies'
  | 'periodItems'
  | 'scaleValues'
  | 'activePeriodItemId'
  | 'cells'
  | 'switchPeriod'
  | 'updateCell'
  | 'updateImprimible'
  | 'saveAll'
  | 'isSavingAll'
>;

export interface CompetencyGradingGridProps {
  courseCycleId: string;
  studyPlanId: string;
  studyPlanSubjectId: string;
  level: number;
  modality: number | null;
  /**
   * Optional pre-fetched grid data from a parent hook instance.
   * When provided, CGG skips its own useGradingGrid call to avoid
   * duplicate fetches (W1 fix). The parent is responsible for passing
   * correct data (same courseCycleId + studyPlanSubjectId).
   * Existing consumers that omit this prop are unaffected.
   */
  injectedGrid?: CompetencyGradingGridData;
  /** ROOT-only: passed through to useGradingGrid when CGG owns its own fetch. */
  institutionId?: string;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--text-sm)',
};

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  fontWeight: 600,
  background: 'var(--color-surface-secondary, var(--color-surface))',
  borderBottom: '2px solid var(--color-border)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'middle',
};

const selectStyle: React.CSSProperties = {
  padding: '0.25rem 0.4rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: 'var(--text-sm)',
  width: '100%',
  minWidth: '6rem',
};

const disabledSelectStyle: React.CSSProperties = {
  ...selectStyle,
  opacity: 0.55,
  cursor: 'not-allowed',
  background: 'var(--color-surface-secondary, #f3f4f6)',
};

const badgeStyle = (color: string): React.CSSProperties => ({
  fontSize: 'var(--text-xs)',
  fontWeight: 500,
  color,
  display: 'block',
  marginTop: '0.1rem',
  whiteSpace: 'nowrap',
});

const emptyStyle: React.CSSProperties = {
  padding: 'var(--space-xl)',
  textAlign: 'center',
  color: 'var(--color-text-secondary)',
};

const errorStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--color-danger)',
  marginTop: '0.1rem',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

interface GradeCellProps {
  cell: CellState | undefined;
  cellKey: string | null;
  scaleValues: ScaleValue[];
  onUpdate: (cellKey: string, gradeScaleValueId: string) => void;
  onUpdateImprimible: (cellKey: string, imprimible: boolean) => void;
  studentId: string;
  competencyId: string;
}

function GradeCell({ cell, cellKey, scaleValues, onUpdate, onUpdateImprimible, studentId, competencyId }: GradeCellProps) {
  const isLocked = cell?.modificable === false;
  const statusColor = internalStatusColor(cell?.internalStatus ?? null);
  const statusText = internalStatusLabel(cell?.internalStatus ?? null);
  const currentValue = cell?.gradeScaleValueId ?? '';
  const imprimible = cell?.imprimible ?? false;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!cellKey || isLocked || !e.target.value) return;
    onUpdate(cellKey, e.target.value);
  };

  const handleImprimibleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!cellKey) return;
    onUpdateImprimible(cellKey, e.target.checked);
  };

  return (
    <div data-testid={`cell-${studentId}-${competencyId}`} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <select
          role="combobox"
          value={currentValue}
          onChange={handleChange}
          disabled={isLocked || !cellKey}
          style={isLocked ? disabledSelectStyle : selectStyle}
          aria-label={`Calificación para ${studentId} en ${competencyId}`}
        >
          <option value="">—</option>
          {scaleValues.map((sv) => (
            <option key={sv.id} value={sv.id}>
              {sv.code} — {sv.label}
            </option>
          ))}
        </select>

        {isLocked && (
          <span
            data-testid="lock-icon"
            title="Celda bloqueada"
            aria-label="bloqueado"
            style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', flexShrink: 0 }}
          >
            🔒
          </span>
        )}
      </div>

      <label
        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', fontSize: 'var(--text-xs)', cursor: cellKey ? 'pointer' : 'default' }}
      >
        <input
          type="checkbox"
          checked={imprimible}
          onChange={handleImprimibleChange}
          disabled={!cellKey}
          aria-label={`Imprimir para ${studentId} en ${competencyId}`}
        />
        Imprimir
      </label>

      {statusColor && statusText && (
        <span
          data-testid="status-badge"
          style={badgeStyle(statusColor)}
          title={statusText}
        >
          {statusText}
        </span>
      )}

      {cell?.saveState === 'error' && (
        <span data-testid="cell-error" style={errorStyle} title="Error al guardar">
          ⚠ Error
        </span>
      )}

      {cell?.saveState === 'saving' && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
          ···
        </span>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CompetencyGradingGrid({
  courseCycleId,
  studyPlanId: _studyPlanId,
  studyPlanSubjectId,
  level,
  modality,
  injectedGrid,
  institutionId,
}: CompetencyGradingGridProps) {
  // When a parent passes injectedGrid, suppress this component's own fetch by
  // using empty keys (the hook early-exits when courseCycleId is falsy).
  // This prevents the duplicate fetches identified in W1.
  const ownGrid = useGradingGrid({
    courseCycleId: injectedGrid ? '' : courseCycleId,
    studyPlanSubjectId: injectedGrid ? '' : studyPlanSubjectId,
    level,
    modality,
    institutionId,
  });

  const {
    loading,
    error,
    students,
    competencies,
    periodItems,
    scaleValues,
    activePeriodItemId,
    cells,
    switchPeriod,
    updateCell,
    updateImprimible,
    saveAll,
    isSavingAll,
  } = injectedGrid ?? ownGrid;

  // Build index: `${studentId}:${competencyId}` → valuationId
  const valuationIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const [, cell] of cells) {
      const key = `${cell.studentId}:${cell.competencyId}`;
      if (!map.has(key)) map.set(key, cell.valuationId);
    }
    return map;
  }, [cells]);

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card>
        <div data-testid="grid-loading" style={emptyStyle}>
          Cargando grilla de calificaciones...
        </div>
      </Card>
    );
  }

  // ── Fetch error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <Card>
        <div style={{ ...emptyStyle, color: 'var(--color-danger)' }}>{error}</div>
      </Card>
    );
  }

  // ── Empty states (CGG-8..11) ─────────────────────────────────────────────────
  if (students.length === 0) {
    return (
      <Card>
        <div style={emptyStyle}>No hay alumnos inscriptos en este ciclo de curso.</div>
      </Card>
    );
  }

  if (competencies.length === 0) {
    return (
      <Card>
        <div style={emptyStyle}>Sin competencias configuradas para esta materia.</div>
      </Card>
    );
  }

  if (periodItems.length === 0) {
    return (
      <Card>
        <div style={emptyStyle}>Períodos no configurados para este nivel y modalidad.</div>
      </Card>
    );
  }

  if (scaleValues.length === 0) {
    return (
      <Card>
        <div style={emptyStyle}>Escala de calificación no configurada para este nivel y modalidad.</div>
      </Card>
    );
  }

  // ── Dirty/error cell count for Guardar todo button ───────────────────────────
  const pendingCount = [...cells.values()].filter(
    (c) => c.saveState === 'dirty' || c.saveState === 'error',
  ).length;

  return (
    <Card>
      {/* Period navigation tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        {periodItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => switchPeriod(item.id)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: item.id === activePeriodItemId
                ? '2px solid var(--color-primary)'
                : '1px solid var(--color-border)',
              background: item.id === activePeriodItemId
                ? 'var(--color-primary)'
                : 'var(--color-surface)',
              color: item.id === activePeriodItemId
                ? 'var(--color-on-primary, #fff)'
                : 'var(--color-text)',
              fontWeight: item.id === activePeriodItemId ? 600 : 400,
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
            }}
          >
            {item.name}
          </button>
        ))}
      </div>

      {/* Guardar todo button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-md)' }}>
        <Button
          variant="success-soft"
          onClick={() => void saveAll()}
          loading={isSavingAll}
          disabled={isSavingAll || pendingCount === 0}
        >
          {isSavingAll ? 'Guardando...' : `Guardar todo${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
        </Button>
      </div>

      {/* Grid matrix */}
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle} role="grid" aria-label="Grilla de calificación de competencias">
          <thead>
            <tr>
              <th style={{ ...thStyle, minWidth: '10rem' }}>Alumno</th>
              {competencies.map((comp) => (
                <th key={comp.uuid} style={{ ...thStyle, minWidth: '8rem' }}>
                  {comp.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.studentId}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>
                  {student.firstName} {student.lastName}
                </td>
                {competencies.map((comp) => {
                  const valuationId = valuationIndex.get(`${student.studentId}:${comp.uuid}`);
                  const cellKey = valuationId && activePeriodItemId
                    ? `${valuationId}:${activePeriodItemId}`
                    : null;
                  const cell = cellKey ? cells.get(cellKey) : undefined;

                  return (
                    <td key={comp.uuid} style={tdStyle}>
                      <GradeCell
                        cell={cell}
                        cellKey={cellKey}
                        scaleValues={scaleValues}
                        onUpdate={updateCell}
                        onUpdateImprimible={updateImprimible}
                        studentId={student.studentId}
                        competencyId={comp.uuid}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default CompetencyGradingGrid;
