/**
 * Tests for StudentObservationsPanel (type-specific).
 * SDD-2 R15: enrollment resolution removed; academicCycleId prop used directly.
 *
 * Covers:
 * - Client-side filter: each type panel renders only its type's rows
 * - No type <select> in the create form
 * - PSYCHOPEDAGOGICAL: POSTs without academicCycleId
 * - PEDAGOGICAL with academicCycleId prop: includes it in POST body, no enrollment fetch
 * - PEDAGOGICAL without academicCycleId: disables form and shows warning
 * - Type-specific empty-state text
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StudentObservationsPanel } from '../components/StudentObservationsPanel';
import apiClient from '../../../api/client';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: { data: null } }),
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const mixedObservations = [
  { id: 'obs-ped', studentId: 'stu-1', type: 'PEDAGOGICAL', content: 'Observación pedagógica uno' },
  { id: 'obs-psico', studentId: 'stu-1', type: 'PSYCHOPEDAGOGICAL', content: 'Observación psicopedagógica uno' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function setupMocks(observations = mixedObservations) {
  vi.clearAllMocks();
  (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string) => {
      if (url === '/students/stu-1/observations') {
        return Promise.resolve({ data: { data: observations } });
      }
      return Promise.resolve({ data: { data: [] } });
    },
  );
  (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
}

function renderPanel(
  type: 'PEDAGOGICAL' | 'PSYCHOPEDAGOGICAL',
  { observations = mixedObservations, academicCycleId }: { observations?: typeof mixedObservations; academicCycleId?: string } = {},
) {
  setupMocks(observations);
  return render(
    <MemoryRouter>
      <StudentObservationsPanel studentId="stu-1" type={type} academicCycleId={academicCycleId} />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('StudentObservationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // SOP-1: PSYCHOPEDAGOGICAL panel filters to psico rows only
  it('SOP-1: PSYCHOPEDAGOGICAL panel renders only psychopedagogical observations', async () => {
    renderPanel('PSYCHOPEDAGOGICAL');

    await waitFor(() => screen.getByText('Observación psicopedagógica uno'));

    expect(screen.queryByText('Observación pedagógica uno')).not.toBeInTheDocument();
  });

  // SOP-2: PEDAGOGICAL panel filters to pedagogical rows only
  it('SOP-2: PEDAGOGICAL panel renders only pedagogical observations', async () => {
    renderPanel('PEDAGOGICAL', { academicCycleId: 'cycle-uuid-2026' });

    await waitFor(() => screen.getByText('Observación pedagógica uno'));

    expect(screen.queryByText('Observación psicopedagógica uno')).not.toBeInTheDocument();
  });

  // SOP-3: Create form has no type selector
  it('SOP-3: create form has no type <select>', async () => {
    renderPanel('PSYCHOPEDAGOGICAL');

    await userEvent.click(screen.getByRole('button', { name: /nueva observación/i }));

    // No combobox (select) for type — only the textarea
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  // SOP-4: PSYCHOPEDAGOGICAL creates without academicCycleId or enrollmentId
  it('SOP-4: PSYCHOPEDAGOGICAL panel POSTs without academicCycleId', async () => {
    renderPanel('PSYCHOPEDAGOGICAL');

    await userEvent.click(screen.getByRole('button', { name: /nueva observación/i }));
    await userEvent.type(screen.getByRole('textbox'), 'Test psico');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/student-observations',
        expect.objectContaining({
          studentId: 'stu-1',
          type: 'PSYCHOPEDAGOGICAL',
          content: 'Test psico',
        }),
        expect.anything(),
      );
    });

    // academicCycleId and enrollmentId must NOT appear in the POST body
    const body = (apiClient.post as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(body).not.toHaveProperty('academicCycleId');
    expect(body).not.toHaveProperty('enrollmentId');

    // enrollment endpoint must NOT have been called
    const getUrls = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );
    expect(getUrls).not.toContain('/enrollments');
  });

  // SOP-5: PEDAGOGICAL with academicCycleId prop — uses it directly in POST, no enrollment fetch
  it('SOP-5: PEDAGOGICAL panel with academicCycleId prop POSTs with academicCycleId (no enrollment fetch)', async () => {
    renderPanel('PEDAGOGICAL', { academicCycleId: 'cycle-uuid-2026' });

    await waitFor(() => screen.getByRole('button', { name: /nueva observación/i }));

    // No enrollment fetch on mount
    const getUrlsBeforeClick = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );
    expect(getUrlsBeforeClick).not.toContain('/enrollments');

    await userEvent.click(screen.getByRole('button', { name: /nueva observación/i }));
    await userEvent.type(screen.getByRole('textbox'), 'Ped content');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/student-observations',
        expect.objectContaining({
          studentId: 'stu-1',
          type: 'PEDAGOGICAL',
          content: 'Ped content',
          academicCycleId: 'cycle-uuid-2026',
        }),
        expect.anything(),
      );
    });

    // Still no enrollment call
    const getUrls = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );
    expect(getUrls).not.toContain('/enrollments');
  });

  // SOP-6: PEDAGOGICAL without academicCycleId disables create button and shows warning
  it('SOP-6: PEDAGOGICAL panel disables create button and shows warning when no academicCycleId prop', async () => {
    renderPanel('PEDAGOGICAL'); // no academicCycleId

    await waitFor(() => {
      expect(
        screen.getByText(/no hay un ciclo lectivo activo/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /nueva observación/i })).toBeDisabled();
  });

  // SOP-7: PSYCHOPEDAGOGICAL empty-state text is type-specific
  it('SOP-7: PSYCHOPEDAGOGICAL empty state says "psicopedagógicas"', async () => {
    renderPanel('PSYCHOPEDAGOGICAL', { observations: [] });

    await waitFor(() =>
      screen.getByText(/no hay observaciones psicopedagógicas para este alumno/i),
    );
  });

  // SOP-8: PEDAGOGICAL empty-state text is type-specific
  it('SOP-8: PEDAGOGICAL empty state says "pedagógicas"', async () => {
    renderPanel('PEDAGOGICAL', { observations: [], academicCycleId: 'cycle-uuid-2026' });

    await waitFor(() =>
      screen.getByText(/no hay observaciones pedagógicas para este alumno/i),
    );
  });
});
