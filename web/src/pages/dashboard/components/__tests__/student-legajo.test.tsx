/**
 * Tests for StudentLegajo — calificaciones section.
 *
 * Regression: tras la migración del modelo de notas (Nota/Evaluacion → SubjectPeriodGrade
 * / SubjectFinalGrade), el legajo llamaba al endpoint eliminado `/notas` y la sección de
 * Calificaciones quedaba vacía. Estos tests fijan que el legajo trae las notas desde
 * GET /grading/subject-grades/by-student (por cada courseCycle del alumno) y las muestra.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// ── Mock apiClient ──

const mockApiGet = vi.fn();

vi.mock('../../../../api/client', () => ({
  default: {
    get: (...args: any[]) => mockApiGet(...args),
  },
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

const MEMBERSHIPS = [
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

const GRADES_CC1 = {
  courseCycleId: 'cc-1',
  studentId: 'stu-1',
  subjects: [
    {
      subjectId: 'sub-1',
      subjectName: 'Matemática',
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

function setupApiMock() {
  mockApiGet.mockReset();
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/students/stu-1') {
      return Promise.resolve({ data: { data: STUDENT } });
    }
    if (url === '/students/stu-1/memberships') {
      return Promise.resolve({ data: { data: MEMBERSHIPS } });
    }
    if (url === '/grading/subject-grades/by-student') {
      return Promise.resolve({ data: { data: GRADES_CC1 } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
}

// ── Dynamic import ──

let StudentLegajo: any;

beforeEach(async () => {
  setupApiMock();
  const mod = await import('../StudentLegajo');
  StudentLegajo = mod.StudentLegajo;
});

afterEach(() => {
  cleanup();
});

describe('StudentLegajo — calificaciones', () => {
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

    // nota de período y nota final visibles
    expect(screen.getByText(/8/)).toBeInTheDocument();
    expect(screen.getByText(/9/)).toBeInTheDocument();
  });
});
