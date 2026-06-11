/**
 * Tests for StudentObservationsPanel (type-specific).
 *
 * Covers:
 * - Client-side filter: each type panel renders only its type's rows
 * - No type <select> in the create form
 * - PSYCHOPEDAGOGICAL: POSTs without enrollmentId
 * - PEDAGOGICAL: fetches /enrollments, picks ACTIVE, includes enrollmentId in POST
 * - PEDAGOGICAL: disables form and shows warning when no active enrollment
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

const activeEnrollments = [
  { id: 'enr-active', studentId: 'stu-1', status: 'ACTIVE' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function setupMocks(enrollments = activeEnrollments, observations = mixedObservations) {
  vi.clearAllMocks();
  (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string) => {
      if (url === '/students/stu-1/observations') {
        return Promise.resolve({ data: { data: observations } });
      }
      if (url === '/enrollments') {
        return Promise.resolve({ data: { data: enrollments } });
      }
      return Promise.resolve({ data: { data: [] } });
    },
  );
  (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
}

function renderPanel(
  type: 'PEDAGOGICAL' | 'PSYCHOPEDAGOGICAL',
  { enrollments = activeEnrollments, observations = mixedObservations } = {},
) {
  setupMocks(enrollments, observations);
  return render(
    <MemoryRouter>
      <StudentObservationsPanel studentId="stu-1" type={type} />
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
    renderPanel('PEDAGOGICAL');

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

  // SOP-4: PSYCHOPEDAGOGICAL creates without enrollmentId
  it('SOP-4: PSYCHOPEDAGOGICAL panel POSTs without enrollmentId', async () => {
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

    // enrollmentId must NOT appear in the POST body
    const body = (apiClient.post as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(body).not.toHaveProperty('enrollmentId');

    // enrollment endpoint must NOT have been called
    const getUrls = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );
    expect(getUrls).not.toContain('/enrollments');
  });

  // SOP-5: PEDAGOGICAL resolves active enrollment and includes enrollmentId in POST
  it('SOP-5: PEDAGOGICAL panel fetches /enrollments on mount and includes enrollmentId in POST', async () => {
    renderPanel('PEDAGOGICAL');

    // Enrollment fetch happened
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/enrollments',
        expect.objectContaining({
          params: expect.objectContaining({ studentId: 'stu-1' }),
        }),
      );
    });

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
          enrollmentId: 'enr-active',
        }),
        expect.anything(),
      );
    });
  });

  // SOP-6: PEDAGOGICAL disables form when no active enrollment
  it('SOP-6: PEDAGOGICAL panel disables create button and shows warning when no active enrollment', async () => {
    renderPanel('PEDAGOGICAL', { enrollments: [] });

    await waitFor(() => {
      expect(
        screen.getByText(/no tiene una inscripción activa/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /nueva observación/i })).toBeDisabled();
  });

  // SOP-7: PEDAGOGICAL with inactive enrollment only → treats as no active enrollment
  it('SOP-7: PEDAGOGICAL panel disables form when only non-ACTIVE enrollments exist', async () => {
    renderPanel('PEDAGOGICAL', {
      enrollments: [{ id: 'enr-old', studentId: 'stu-1', status: 'COMPLETED' }],
    });

    await waitFor(() => {
      expect(screen.getByText(/no tiene una inscripción activa/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /nueva observación/i })).toBeDisabled();
  });

  // SOP-8: PSYCHOPEDAGOGICAL empty-state text is type-specific
  it('SOP-8: PSYCHOPEDAGOGICAL empty state says "psicopedagógicas"', async () => {
    renderPanel('PSYCHOPEDAGOGICAL', { observations: [] });

    await waitFor(() =>
      screen.getByText(/no hay observaciones psicopedagógicas para este alumno/i),
    );
  });

  // SOP-9: PEDAGOGICAL empty-state text is type-specific
  it('SOP-9: PEDAGOGICAL empty state says "pedagógicas"', async () => {
    renderPanel('PEDAGOGICAL', { observations: [] });

    await waitFor(() =>
      screen.getByText(/no hay observaciones pedagógicas para este alumno/i),
    );
  });

  // SOP-10: institutionId is threaded through to enrollment fetch
  it('SOP-10: PEDAGOGICAL panel passes institutionId in enrollment fetch params', async () => {
    setupMocks();
    render(
      <MemoryRouter>
        <StudentObservationsPanel studentId="stu-1" institutionId="inst-42" type="PEDAGOGICAL" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/enrollments',
        expect.objectContaining({
          params: expect.objectContaining({
            studentId: 'stu-1',
            institutionId: 'inst-42',
          }),
        }),
      );
    });
  });
});
