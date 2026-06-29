/**
 * Tests for StudentLegajo — calificaciones + selección de ciclo + boletín.
 *
 * Regression base: tras la migración del modelo de notas (Nota/Evaluacion → SubjectPeriodGrade
 * / SubjectFinalGrade), el legajo llamaba al endpoint eliminado `/notas` y la sección de
 * Calificaciones quedaba vacía. Los tests fijan que el legajo trae las notas desde
 * GET /grading/subject-grades/by-student y las muestra.
 *
 * Feature: las materias se muestran por ciclo lectivo seleccionado (no todas aplanadas).
 * Con un solo ciclo se muestra directo; con varios arranca en el más reciente y se puede
 * cambiar. Botón "Boletín" descarga el PDF del ciclo seleccionado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// ── Mock apiClient ──

const mockApiGet = vi.fn();

vi.mock('../../../../api/client', () => ({
  default: {
    get: (...args: any[]) => mockApiGet(...args),
  },
}));

// ── Mock useBoletin ──

const mockDownloadBoletin = vi.fn();

vi.mock('../../../../hooks/useBoletin', () => ({
  downloadBoletin: (...args: any[]) => mockDownloadBoletin(...args),
  downloadBoletinBatch: vi.fn(),
}));

// ── Fixtures ──

const STUDENT = {
  id: 'stu-1',
  firstName: 'Ana',
  lastName: 'García',
  dni: '11222333',
  email: null,
  birthDate: null,
  guardianName: null,
  guardianPhone: null,
  institutionId: 'inst-1',
};

const MEMBERSHIPS_SINGLE = [
  {
    id: 'm-1',
    courseCycleId: 'cc-1',
    printable: true,
    level: 2,
    academicYear: '2026',
    grade: '1',
    division: 'A',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
];

// Dos ciclos: 2025 (cc-2) y 2026 (cc-1). El más reciente es 2026 → cc-1.
const MEMBERSHIPS_MULTI = [
  {
    id: 'm-2',
    courseCycleId: 'cc-2',
    printable: false,
    level: 2,
    academicYear: '2025',
    grade: '1',
    division: 'A',
    createdAt: '2025-03-01T00:00:00.000Z',
  },
  {
    id: 'm-1',
    courseCycleId: 'cc-1',
    printable: true,
    level: 2,
    academicYear: '2026',
    grade: '2',
    division: 'A',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
];

function gradesFor(subjectName: string, courseCycleId: string) {
  return {
    courseCycleId,
    studentId: 'stu-1',
    subjects: [
      {
        subjectId: `sub-${subjectName}`,
        subjectName,
        periods: [{ periodOrdinal: 1, periodName: '1° Trimestre' }],
        periodGrades: [
          {
            periodOrdinal: 1,
            gradeScaleValueId: 'gsv-1',
            gradeCode: '8',
            internalStatus: null,
            pa: false,
            ppi: false,
            pp: false,
          },
        ],
        finalGrades: [
          {
            type: 'FINAL',
            gradeScaleValueId: 'gsv-2',
            gradeCode: '9',
            internalStatus: null,
            passed: true,
            condicion: null,
          },
        ],
        competencyValuations: [],
      },
    ],
  };
}

// cc-1 (2026) → Matemática · cc-2 (2025) → Historia
const GRADES_BY_CC: Record<string, ReturnType<typeof gradesFor>> = {
  'cc-1': gradesFor('Matemática', 'cc-1'),
  'cc-2': gradesFor('Historia', 'cc-2'),
};

function setupApiMock(memberships: typeof MEMBERSHIPS_SINGLE) {
  mockApiGet.mockReset();
  mockApiGet.mockImplementation((url: string, config?: any) => {
    if (url === '/students/stu-1') {
      return Promise.resolve({ data: { data: STUDENT } });
    }
    if (url === '/students/stu-1/memberships') {
      return Promise.resolve({ data: { data: memberships } });
    }
    if (url === '/grading/subject-grades/by-student') {
      const ccId = config?.params?.courseCycleId;
      return Promise.resolve({ data: { data: GRADES_BY_CC[ccId] ?? { subjects: [] } } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
}

// ── Dynamic import ──

let StudentLegajo: any;

async function loadComponent() {
  const mod = await import('../StudentLegajo');
  StudentLegajo = mod.StudentLegajo;
}

afterEach(() => {
  cleanup();
  mockDownloadBoletin.mockReset();
});

describe('StudentLegajo — calificaciones (un solo ciclo)', () => {
  beforeEach(async () => {
    setupApiMock(MEMBERSHIPS_SINGLE);
    await loadComponent();
  });

  it('pide las notas a /grading/subject-grades/by-student con courseCycleId + studentId', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        '/grading/subject-grades/by-student',
        expect.objectContaining({
          params: expect.objectContaining({ courseCycleId: 'cc-1', studentId: 'stu-1' }),
        }),
      );
    });
  });

  it('NO llama al endpoint legacy /notas', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });

    const notasCalls = mockApiGet.mock.calls.filter((args: any[]) => args[0] === '/notas');
    expect(notasCalls.length).toBe(0);
  });

  it('muestra la materia y las calificaciones del alumno', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });

    expect(screen.getByText(/8/)).toBeInTheDocument();
    expect(screen.getByText(/9/)).toBeInTheDocument();
  });

  it('con un solo ciclo NO muestra el selector de ciclo', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/ciclo lectivo/i)).not.toBeInTheDocument();
  });

  it('el botón Boletín descarga el boletín del ciclo (membership.id)', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    // Esperar a que la auto-selección del ciclo habilite el botón.
    const btn = await screen.findByRole('button', { name: /boletín/i });
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);

    expect(mockDownloadBoletin).toHaveBeenCalledWith('m-1');
  });
});

describe('StudentLegajo — selección de ciclo (varios ciclos)', () => {
  beforeEach(async () => {
    setupApiMock(MEMBERSHIPS_MULTI);
    await loadComponent();
  });

  it('arranca en el ciclo más reciente y muestra solo sus materias', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    // 2026 → cc-1 → Matemática visible; Historia (2025) NO
    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });
    expect(screen.queryByText('Historia')).not.toBeInTheDocument();
  });

  it('NO aplana todos los ciclos: solo pide notas del ciclo seleccionado', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });

    const gradeCalls = mockApiGet.mock.calls.filter(
      (args: any[]) => args[0] === '/grading/subject-grades/by-student',
    );
    // Solo el ciclo seleccionado (cc-1), nunca cc-2 mientras no se cambie.
    expect(gradeCalls.every((c: any[]) => c[1]?.params?.courseCycleId === 'cc-1')).toBe(true);
  });

  it('al cambiar de ciclo pide las notas del nuevo courseCycleId', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/ciclo lectivo/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'm-2' } });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        '/grading/subject-grades/by-student',
        expect.objectContaining({
          params: expect.objectContaining({ courseCycleId: 'cc-2', studentId: 'stu-1' }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Historia')).toBeInTheDocument();
    });
  });

  it('el botón Boletín usa el id de la membresía seleccionada', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    // Esperar a que el selector y la auto-selección (m-1, printable) estén listos.
    await screen.findByLabelText(/ciclo lectivo/i);
    const btn = screen.getByRole('button', { name: /boletín/i });
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);

    expect(mockDownloadBoletin).toHaveBeenCalledWith('m-1');
  });

  it('deshabilita Boletín cuando el ciclo seleccionado no es imprimible', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    const select = (await screen.findByLabelText(/ciclo lectivo/i)) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'm-2' } }); // 2025, printable: false

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /boletín/i })).toBeDisabled();
    });
  });
});
