/**
 * Tests for ObservationsByCyclePage — observations scoped to an academic cycle.
 * Covers: cycle selection fetch, PEDAGOGICAL enrollment resolution, not-enrolled error,
 * and PSYCHOPEDAGOGICAL without enrollmentId.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

// ── Mock apiClient ────────────────────────────────────────────────────────────

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  default: { get: mockApiGet, post: mockApiPost },
}));

// ── Mock adaptListResponse (used internally by useApiList) ───────────────────

vi.mock('../../../api/adapters/index', () => ({
  adaptListResponse: (res: any) => {
    const d = res?.data?.data;
    return Array.isArray(d) ? d : [];
  },
}));

// ── Auth mock — user with STUDENTS CREATE permission ─────────────────────────

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'ADMIN',
      roles: ['ADMIN'],
      modules: [
        { moduleCode: 'STUDENTS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
      ],
      levels: [],
    },
    logout: vi.fn(),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'fake-token',
  }),
}));

// ── Institution mock ─────────────────────────────────────────────────────────

vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: { id: 'inst-1', name: 'Escuela Test' },
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

// ── useTheme mock (consumed by PremiumHeader / Card) ─────────────────────────

vi.mock('../../../hooks/use-theme', () => ({
  useTheme: () => ({ theme: {}, setTheme: vi.fn(), applyHeaderColors: vi.fn() }),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CYCLE_2026 = {
  uuid: 'cycle-uuid-2026',
  code: '2026',
  name: 'Ciclo Lectivo 2026',
};

const mockObservations = [
  {
    id: 'obs-1',
    studentId: 'student-1',
    type: 'PEDAGOGICAL',
    content: 'Buen desempeño académico',
    enrollmentId: 'enroll-1',
  },
  {
    id: 'obs-2',
    studentId: 'student-2',
    type: 'PSYCHOPEDAGOGICAL',
    content: 'Evaluación psicopedagógica inicial',
  },
];

function setupDefaultMocks() {
  mockApiGet.mockReset();
  mockApiPost.mockReset();

  mockApiGet.mockImplementation((url: string) => {
    if (url === '/academic-cycles') {
      return Promise.resolve({ data: { data: [CYCLE_2026] } });
    }
    if (url === `/cycles/${CYCLE_2026.uuid}/observations`) {
      return Promise.resolve({ data: { data: mockObservations } });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  mockApiPost.mockResolvedValue({ data: {} });
}

// ── Page import (after mocks are hoisted) ────────────────────────────────────

import ObservationsByCyclePage from '../observations-by-cycle';

function renderPage() {
  return render(
    <MemoryRouter>
      <ObservationsByCyclePage />
    </MemoryRouter>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ObservationsByCyclePage', () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ── OBC-1: selecting a cycle fetches /cycles/:uuid/observations and renders rows ──

  it('OBC-1: selecting a cycle fetches observations and renders type badges', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for academic cycles to load into the dropdown
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Ciclo Lectivo 2026' })).toBeInTheDocument();
    });

    // Select the cycle
    const cycleSelect = screen.getByLabelText('Ciclo lectivo') as HTMLSelectElement;
    await user.selectOptions(cycleSelect, CYCLE_2026.uuid);

    // Verify the correct observations URL was fetched
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        `/cycles/${CYCLE_2026.uuid}/observations`,
        expect.anything(),
      );
    });

    // Verify observation content is rendered
    await waitFor(() => {
      expect(screen.getByText('Buen desempeño académico')).toBeInTheDocument();
      expect(screen.getByText('Evaluación psicopedagógica inicial')).toBeInTheDocument();
    });

    // Verify type badges
    expect(screen.getByText('Pedagógica')).toBeInTheDocument();
    expect(screen.getByText('Psicopedagógica')).toBeInTheDocument();
  });

  // ── OBC-2: PEDAGOGICAL create POSTs with academicCycleId (SDD-2 R14) ──────────

  it('OBC-2: PEDAGOGICAL create POSTs with academicCycleId from selected cycle (no enrollment lookup)', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for cycle dropdown to be populated
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Ciclo Lectivo 2026' })).toBeInTheDocument();
    });

    // Select the cycle
    const cycleSelect = screen.getByLabelText('Ciclo lectivo') as HTMLSelectElement;
    await user.selectOptions(cycleSelect, CYCLE_2026.uuid);

    // Wait for and click "Nueva observación"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva observación/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /nueva observación/i }));

    // Fill in the form (type defaults to PEDAGOGICAL)
    await user.type(screen.getByLabelText('Estudiante ID'), 'student-any');
    await user.type(screen.getByLabelText('Contenido'), 'Observación de desempeño');

    // Submit
    await user.click(screen.getByRole('button', { name: /guardar observación/i }));

    // No enrollment lookup must happen
    const getUrls = mockApiGet.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(getUrls).not.toContain('/enrollments');

    // POST must include academicCycleId from the selected cycle
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/student-observations',
        {
          studentId: 'student-any',
          type: 'PEDAGOGICAL',
          content: 'Observación de desempeño',
          academicCycleId: CYCLE_2026.uuid,
        },
        expect.anything(),
      );
    });
  });

  // ── OBC-4: PSYCHOPEDAGOGICAL posts without academicCycleId ───────────────────

  it('OBC-4: PSYCHOPEDAGOGICAL posts without enrollmentId and skips enrollment lookup', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for cycle dropdown
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Ciclo Lectivo 2026' })).toBeInTheDocument();
    });

    // Select the cycle
    const cycleSelect = screen.getByLabelText('Ciclo lectivo') as HTMLSelectElement;
    await user.selectOptions(cycleSelect, CYCLE_2026.uuid);

    // Open form
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva observación/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /nueva observación/i }));

    // Fill form — change type to PSYCHOPEDAGOGICAL
    await user.type(screen.getByLabelText('Estudiante ID'), 'student-any');
    const typeSelect = screen.getByLabelText('Tipo') as HTMLSelectElement;
    await user.selectOptions(typeSelect, 'PSYCHOPEDAGOGICAL');
    await user.type(screen.getByLabelText('Contenido'), 'Evaluación EOE completa');

    // Submit
    await user.click(screen.getByRole('button', { name: /guardar observación/i }));

    // POST must be called WITHOUT enrollmentId
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/student-observations',
        {
          studentId: 'student-any',
          type: 'PSYCHOPEDAGOGICAL',
          content: 'Evaluación EOE completa',
        },
        expect.anything(),
      );
    });

    // Verify enrollmentId is absent from the POST body
    const postBody = mockApiPost.mock.calls[0][1];
    expect(postBody).not.toHaveProperty('enrollmentId');

    // Enrollment lookup must NOT have been called
    const enrollmentCalls = mockApiGet.mock.calls.filter(
      (args: any[]) => args[0] === '/enrollments',
    );
    expect(enrollmentCalls).toHaveLength(0);
  });
});
