import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mock apiClient ─────────────────────────────────────────────────────────────
vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const mockStudents = [
  { studentId: 's-1', firstName: 'Ana', lastName: 'García' },
  { studentId: 's-2', firstName: 'Luis', lastName: 'López' },
  { studentId: 's-3', firstName: 'María', lastName: 'Pérez' },
];

const mockCompetencies = [
  { uuid: 'c-1', studyPlanSubjectId: 'sps-1', name: 'Competencia 1', active: true },
  { uuid: 'c-2', studyPlanSubjectId: 'sps-1', name: 'Competencia 2', active: true },
];

const mockTemplates = [
  {
    id: 'tpl-1',
    name: 'Template Primario',
    level: 2,
    modality: 0,
    active: true,
    items: [
      { id: 'pi-1', name: '1er Trimestre', sort_order: 1 },
      { id: 'pi-2', name: '2do Trimestre', sort_order: 2 },
      { id: 'pi-3', name: '3er Trimestre', sort_order: 3 },
      { id: 'pi-4', name: '4to Trimestre', sort_order: 4 },
    ],
  },
];

const mockScales = [
  {
    id: 'scale-1',
    name: 'Escala Primario',
    level: 2,
    modality: 0,
    active: true,
    values: [
      { id: 'gsv-mb', scale_id: 'scale-1', code: 'MB', label: 'Muy Bueno', internal_status: 'APROBADO', sort_order: 1, active: true },
      { id: 'gsv-b',  scale_id: 'scale-1', code: 'B',  label: 'Bueno',     internal_status: 'APROBADO', sort_order: 2, active: true },
      { id: 'gsv-ep', scale_id: 'scale-1', code: 'EP', label: 'En Proceso', internal_status: 'EN_PROCESO', sort_order: 3, active: true },
      { id: 'gsv-na', scale_id: 'scale-1', code: 'NA', label: 'No Aprobado', internal_status: 'NO_APROBADO', sort_order: 4, active: true },
      { id: 'gsv-l',  scale_id: 'scale-1', code: 'L',  label: 'Libre', internal_status: 'LIBRE', sort_order: 5, active: true },
    ],
  },
];

// Valuations for 3 students × 2 competencies = 6 parent valuations
// val-1: s-1, c-1 — has grade MB for pi-1; LOCKED for pi-2
// val-2: s-1, c-2 — empty (no period grades)
// val-3: s-2, c-1 — has grade B for pi-1
// val-4: s-2, c-2 — has internalStatus badge variety
// val-5: s-3, c-1 — empty
// val-6: s-3, c-2 — empty
const mockValuations = [
  {
    valuationId: 'val-1',
    studentId: 's-1',
    competencyId: 'c-1',
    periodValuations: [
      { periodItemId: 'pi-1', gradeScaleValueId: 'gsv-mb', gradeCode: 'MB', internalStatus: 'APROBADO', modificable: true, imprimible: true },
      { periodItemId: 'pi-2', gradeScaleValueId: 'gsv-b',  gradeCode: 'B',  internalStatus: 'APROBADO', modificable: false, imprimible: true },
    ],
  },
  {
    valuationId: 'val-2',
    studentId: 's-1',
    competencyId: 'c-2',
    periodValuations: [],
  },
  {
    valuationId: 'val-3',
    studentId: 's-2',
    competencyId: 'c-1',
    periodValuations: [
      { periodItemId: 'pi-1', gradeScaleValueId: 'gsv-b', gradeCode: 'B', internalStatus: 'APROBADO', modificable: true, imprimible: true },
    ],
  },
  {
    valuationId: 'val-4',
    studentId: 's-2',
    competencyId: 'c-2',
    periodValuations: [
      { periodItemId: 'pi-1', gradeScaleValueId: 'gsv-ep', gradeCode: 'EP', internalStatus: 'EN_PROCESO', modificable: true, imprimible: false },
    ],
  },
  {
    valuationId: 'val-5',
    studentId: 's-3',
    competencyId: 'c-1',
    periodValuations: [
      { periodItemId: 'pi-1', gradeScaleValueId: null, gradeCode: null, internalStatus: 'LIBRE', modificable: true, imprimible: false },
    ],
  },
  {
    valuationId: 'val-6',
    studentId: 's-3',
    competencyId: 'c-2',
    periodValuations: [
      { periodItemId: 'pi-1', gradeScaleValueId: 'gsv-na', gradeCode: 'NA', internalStatus: 'NO_APROBADO', modificable: true, imprimible: false },
    ],
  },
];

import apiClient from '../../../api/client';
import { CompetencyGradingGrid } from '../components/CompetencyGradingGrid';

const defaultProps = {
  courseCycleId: 'cc-1',
  studyPlanId: 'sp-1',
  studyPlanSubjectId: 'sps-1',
  level: 2,
  modality: 0 as number | null,
};

function setupDefaultMocks() {
  vi.clearAllMocks();
  (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url === '/course-cycles/cc-1/students') {
      return Promise.resolve({ data: { data: mockStudents } });
    }
    if (url === '/subject-competencies') {
      return Promise.resolve({ data: { data: mockCompetencies } });
    }
    if (url === '/grading/period-templates') {
      return Promise.resolve({ data: { data: mockTemplates } });
    }
    if (url === '/grading/scales') {
      return Promise.resolve({ data: { data: mockScales } });
    }
    if (url === '/competency-valuations') {
      return Promise.resolve({ data: { data: mockValuations } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
  (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { data: { gradeScaleValueId: 'gsv-mb', gradeCode: 'MB', internalStatus: 'APROBADO', modificable: true } },
  });
}

async function waitForGridLoaded() {
  // Wait until loading state resolves and period tabs are rendered
  await waitFor(() => {
    expect(screen.getByText('1er Trimestre')).toBeInTheDocument();
  });
}

// ── CGG-1: Happy path matrix ───────────────────────────────────────────────────

describe('CGG-1: matrix renders with existing grades', () => {
  beforeEach(() => setupDefaultMocks());

  it('renders student rows and competency columns after load', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // 3 student names in the grid
    expect(screen.getByText('Ana García')).toBeInTheDocument();
    expect(screen.getByText('Luis López')).toBeInTheDocument();
    expect(screen.getByText('María Pérez')).toBeInTheDocument();

    // 2 competency column headers
    expect(screen.getByText('Competencia 1')).toBeInTheDocument();
    expect(screen.getByText('Competencia 2')).toBeInTheDocument();
  });

  it('cell (s-1, c-1) shows MB as current grade value for period 1', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // The dropdown for Ana García × Competencia 1 should have gsv-mb selected
    const cell = screen.getByTestId('cell-s-1-c-1');
    const select = within(cell).getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('gsv-mb');
  });

  it('cells without existing grades show empty/placeholder value', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // s-1, c-2 has no period grades → empty select
    const cell = screen.getByTestId('cell-s-1-c-2');
    const select = within(cell).getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('');
  });
});

// ── CGG-2: Period navigation ───────────────────────────────────────────────────

describe('CGG-2: period navigation switches displayed period', () => {
  beforeEach(() => setupDefaultMocks());

  it('clicking period 2 tab shows val-1:pi-2 (B) instead of val-1:pi-1 (MB)', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // Period 1 (active by default): s-1, c-1 → MB
    const cell = screen.getByTestId('cell-s-1-c-1');
    expect((within(cell).getByRole('combobox') as HTMLSelectElement).value).toBe('gsv-mb');

    // Switch to period 2
    await userEvent.click(screen.getByText('2do Trimestre'));

    // s-1, c-1 for pi-2 → B (modificable=false → disabled)
    expect((within(screen.getByTestId('cell-s-1-c-1')).getByRole('combobox') as HTMLSelectElement).value).toBe('gsv-b');
  });

  it('no new API calls are made when switching periods (CGG-2)', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    const prevCallCount = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls.length;
    await userEvent.click(screen.getByText('2do Trimestre'));

    expect((apiClient.get as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(prevCallCount);
  });
});

// ── CGG-3: Locked cells ────────────────────────────────────────────────────────

describe('CGG-3: locked cells (modificable=false)', () => {
  beforeEach(() => setupDefaultMocks());

  it('s-1 c-1 in period 2 (modificable=false) shows disabled dropdown + lock icon', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    await userEvent.click(screen.getByText('2do Trimestre'));

    const cell = screen.getByTestId('cell-s-1-c-1');
    const select = within(cell).getByRole('combobox');
    expect(select).toBeDisabled();
    expect(within(cell).getByTestId('lock-icon')).toBeInTheDocument();
  });

  it('no PATCH is issued when a locked cell dropdown is changed', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    await userEvent.click(screen.getByText('2do Trimestre'));
    // Locked cell: cannot interact (disabled)
    const cell = screen.getByTestId('cell-s-1-c-1');
    const select = within(cell).getByRole('combobox');
    expect(select).toBeDisabled();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
});

// ── CGG-4: internalStatus badge colors ────────────────────────────────────────

describe('CGG-4: internalStatus badges', () => {
  beforeEach(() => setupDefaultMocks());

  it('APROBADO cell shows green badge', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // s-1, c-1 has APROBADO
    const cell = screen.getByTestId('cell-s-1-c-1');
    const badge = within(cell).getByTestId('status-badge');
    expect(badge).toHaveStyle({ color: 'var(--color-success)' });
  });

  it('EN_PROCESO cell shows yellow badge', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // s-2, c-2 has EN_PROCESO
    const cell = screen.getByTestId('cell-s-2-c-2');
    const badge = within(cell).getByTestId('status-badge');
    expect(badge).toHaveStyle({ color: 'var(--color-warning, #f59e0b)' });
  });

  it('NO_APROBADO cell shows red badge', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // s-3, c-2 has NO_APROBADO
    const cell = screen.getByTestId('cell-s-3-c-2');
    const badge = within(cell).getByTestId('status-badge');
    expect(badge).toHaveStyle({ color: 'var(--color-danger)' });
  });

  it('LIBRE cell shows muted badge', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // s-3, c-1 has LIBRE
    const cell = screen.getByTestId('cell-s-3-c-1');
    const badge = within(cell).getByTestId('status-badge');
    expect(badge).toHaveStyle({ color: 'var(--color-text-muted)' });
  });

  it('null internalStatus cell shows no badge', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // s-1, c-2 has no periodValuation → null internalStatus
    const cell = screen.getByTestId('cell-s-1-c-2');
    expect(within(cell).queryByTestId('status-badge')).not.toBeInTheDocument();
  });
});

// ── CGG-5: per-cell PATCH on dropdown change ──────────────────────────────────

describe('CGG-5: per-cell PATCH on dropdown change', () => {
  beforeEach(() => setupDefaultMocks());

  it('dropdown change issues PATCH with correct URL and body', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    const cell = screen.getByTestId('cell-s-1-c-2'); // empty cell (modificable=true)
    const select = within(cell).getByRole('combobox');

    await userEvent.selectOptions(select, 'gsv-mb');

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/competency-valuations/val-2/periods/pi-1',
        { gradeScaleValueId: 'gsv-mb' },
        expect.objectContaining({ params: expect.anything() }),
      );
    });
  });

  it('on 200 response cell updates to new value and saveState becomes idle', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    const cell = screen.getByTestId('cell-s-1-c-2');
    const select = within(cell).getByRole('combobox');

    await userEvent.selectOptions(select, 'gsv-mb');

    await waitFor(() => {
      // After success: dropdown reflects the new value
      expect((within(screen.getByTestId('cell-s-1-c-2')).getByRole('combobox') as HTMLSelectElement).value).toBe('gsv-mb');
      // No error indicator
      expect(within(screen.getByTestId('cell-s-1-c-2')).queryByTestId('cell-error')).not.toBeInTheDocument();
    });
  });
});

// ── CGG-6: PATCH failure shows cell-level error indicator ─────────────────────

describe('CGG-6: PATCH failure shows cell-level error indicator', () => {
  beforeEach(() => {
    setupDefaultMocks();
    (apiClient.patch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
  });

  it('shows error indicator after PATCH failure', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    const cell = screen.getByTestId('cell-s-1-c-2');
    const select = within(cell).getByRole('combobox');

    await userEvent.selectOptions(select, 'gsv-mb');

    await waitFor(() => {
      expect(within(screen.getByTestId('cell-s-1-c-2')).getByTestId('cell-error')).toBeInTheDocument();
    });
  });
});

// ── CGG-7: "Guardar todo" sends PATCHes for all dirty/error cells ─────────────

describe('CGG-7: Guardar todo batch save', () => {
  it('sends one PATCH per error cell and clears them on success', async () => {
    setupDefaultMocks();

    let patchCallCount = 0;
    (apiClient.patch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      patchCallCount++;
      if (patchCallCount <= 3) {
        // First 3 auto-saves fail → cells go to error state
        return Promise.reject(new Error('Fail'));
      }
      // Subsequent calls (from saveAll) succeed
      return Promise.resolve({
        data: { data: { gradeScaleValueId: 'gsv-mb', gradeCode: 'MB', internalStatus: 'APROBADO', modificable: true } },
      });
    });

    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // Change 3 cells (auto-saves will fail → error state)
    const cell12 = screen.getByTestId('cell-s-1-c-2');
    const cell31 = screen.getByTestId('cell-s-3-c-1');

    await userEvent.selectOptions(within(cell12).getByRole('combobox'), 'gsv-mb');
    await userEvent.selectOptions(within(cell31).getByRole('combobox'), 'gsv-b');
    await userEvent.selectOptions(within(screen.getByTestId('cell-s-3-c-2')).getByRole('combobox'), 'gsv-ep');

    // Wait for error states to appear
    await waitFor(() => {
      expect(within(screen.getByTestId('cell-s-1-c-2')).getByTestId('cell-error')).toBeInTheDocument();
    });

    // Click "Guardar todo"
    await userEvent.click(screen.getByRole('button', { name: /guardar todo/i }));

    // Verify 3 more PATCHes were issued (total 6 = 3 failed + 3 retry)
    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledTimes(6);
    });
  });
});

// ── CGG-8: Empty state — no students ─────────────────────────────────────────

describe('CGG-8: empty state — no students', () => {
  beforeEach(() => {
    setupDefaultMocks();
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/course-cycles/cc-1/students') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/subject-competencies') {
        return Promise.resolve({ data: { data: mockCompetencies } });
      }
      if (url === '/grading/period-templates') {
        return Promise.resolve({ data: { data: mockTemplates } });
      }
      if (url === '/grading/scales') {
        return Promise.resolve({ data: { data: mockScales } });
      }
      if (url === '/competency-valuations') {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('shows empty-state message when no students', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/no hay alumnos inscriptos/i)).toBeInTheDocument();
    });
  });
});

// ── CGG-9: Empty state — no competencies ──────────────────────────────────────

describe('CGG-9: empty state — no competencies', () => {
  beforeEach(() => {
    setupDefaultMocks();
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/course-cycles/cc-1/students') {
        return Promise.resolve({ data: { data: mockStudents } });
      }
      if (url === '/subject-competencies') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/grading/period-templates') {
        return Promise.resolve({ data: { data: mockTemplates } });
      }
      if (url === '/grading/scales') {
        return Promise.resolve({ data: { data: mockScales } });
      }
      if (url === '/competency-valuations') {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('shows empty-state message when no competencies', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/sin competencias configuradas/i)).toBeInTheDocument();
    });
  });
});

// ── CGG-10: Empty state — no period template ──────────────────────────────────

describe('CGG-10: empty state — no period template', () => {
  beforeEach(() => {
    setupDefaultMocks();
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/course-cycles/cc-1/students') {
        return Promise.resolve({ data: { data: mockStudents } });
      }
      if (url === '/subject-competencies') {
        return Promise.resolve({ data: { data: mockCompetencies } });
      }
      if (url === '/grading/period-templates') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/grading/scales') {
        return Promise.resolve({ data: { data: mockScales } });
      }
      if (url === '/competency-valuations') {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('shows empty-state message when no period template', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/períodos no configurados/i)).toBeInTheDocument();
    });
  });
});

// ── CGG-11: Empty state — no grade scale ──────────────────────────────────────

describe('CGG-11: empty state — no grade scale', () => {
  beforeEach(() => {
    setupDefaultMocks();
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/course-cycles/cc-1/students') {
        return Promise.resolve({ data: { data: mockStudents } });
      }
      if (url === '/subject-competencies') {
        return Promise.resolve({ data: { data: mockCompetencies } });
      }
      if (url === '/grading/period-templates') {
        return Promise.resolve({ data: { data: mockTemplates } });
      }
      if (url === '/grading/scales') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/competency-valuations') {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('shows empty-state message when no grade scale', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/escala de calificación no configurada/i)).toBeInTheDocument();
    });
  });
});

// ── CGG-13: Imprimible toggle per cell ────────────────────────────────────────
// [RED] This test will fail until the imprimible checkbox is added to GradeCell.

describe('CGG-13: imprimible toggle per cell', () => {
  beforeEach(() => setupDefaultMocks());

  it('renders imprimible checkbox for cell with imprimible=true (checked)', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // val-1: s-1, c-1, pi-1 has imprimible=true
    const cell = screen.getByTestId('cell-s-1-c-1');
    const checkbox = within(cell).getByRole('checkbox', { name: /imprimir/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it('renders imprimible checkbox for cell with imprimible=false (unchecked)', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // val-4: s-2, c-2, pi-1 has imprimible=false
    const cell = screen.getByTestId('cell-s-2-c-2');
    const checkbox = within(cell).getByRole('checkbox', { name: /imprimir/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('clicking the checkbox issues PATCH with imprimible: true', async () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // val-4: s-2, c-2, pi-1 has imprimible=false → click to enable
    const cell = screen.getByTestId('cell-s-2-c-2');
    const checkbox = within(cell).getByRole('checkbox', { name: /imprimir/i });

    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/competency-valuations/val-4/periods/pi-1',
        { imprimible: true },
        expect.objectContaining({ params: expect.anything() }),
      );
    });
  });

  it('clicking an already-checked checkbox issues PATCH with imprimible: false', async () => {
    // Reset mock to return new imprimible=false response
    (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { gradeScaleValueId: 'gsv-mb', gradeCode: 'MB', internalStatus: 'APROBADO', modificable: true, imprimible: false } },
    });

    render(<CompetencyGradingGrid {...defaultProps} />);
    await waitForGridLoaded();

    // val-1: s-1, c-1, pi-1 has imprimible=true → uncheck
    const cell = screen.getByTestId('cell-s-1-c-1');
    const checkbox = within(cell).getByRole('checkbox', { name: /imprimir/i });
    expect(checkbox).toBeChecked();

    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/competency-valuations/val-1/periods/pi-1',
        { imprimible: false },
        expect.objectContaining({ params: expect.anything() }),
      );
    });
  });
});

// ── CGG-12: Loading state ──────────────────────────────────────────────────────

describe('CGG-12: loading state during initial fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // All fetches never resolve → loading stays true
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));
  });

  it('shows loading state while fetches are in-flight', () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    expect(screen.getByTestId('grid-loading')).toBeInTheDocument();
  });

  it('no interactive elements (dropdowns, Guardar todo) while loading', () => {
    render(<CompetencyGradingGrid {...defaultProps} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar todo/i })).not.toBeInTheDocument();
  });
});
