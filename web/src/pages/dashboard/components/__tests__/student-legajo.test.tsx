/**
 * Tests for StudentLegajo — calificaciones + selección de ciclo (sobre la lista) + boletín.
 *
 * Regression base: tras la migración del modelo de notas (Nota/Evaluacion → SubjectPeriodGrade
 * / SubjectFinalGrade), el legajo llamaba al endpoint eliminado `/notas` y la sección de
 * Calificaciones quedaba vacía. Los tests fijan que el legajo trae las notas desde
 * GET /grading/subject-grades/by-student y las muestra.
 *
 * Feature: las materias se muestran por ciclo lectivo SELECCIONADO. La selección se hace
 * clickeando una fila de "Cursos Ciclo" (sin combo). Por omisión queda seleccionado el
 * CursoXCiclo activo/vigente (fallback: el más reciente). El nivel se muestra con su
 * descripción (Inicial/Primario/Secundario/Terciario), no con el código numérico.
 * Botón "Boletín" descarga el PDF del ciclo seleccionado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
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
    active: true,
    level: 30, // Secundario
    academicYear: '2026',
    cycleName: 'Secundario 2026',
    grade: '4',
    division: 'A',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
];

// Dos ciclos donde el ACTIVO NO es el más reciente, para probar que el default
// prioriza "activo/vigente" sobre "año más nuevo":
//   - m-1: 2026 (más reciente), Terciario, active:false, printable:true  → cc-1 (Matemática)
//   - m-2: 2025,                Secundario, active:true,  printable:false → cc-2 (Historia)
const MEMBERSHIPS_MULTI = [
  {
    id: 'm-1',
    courseCycleId: 'cc-1',
    printable: true,
    active: false,
    level: 40, // Terciario
    academicYear: '2026',
    cycleName: 'Terciario 2026',
    grade: '1',
    division: 'A',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'm-2',
    courseCycleId: 'cc-2',
    printable: false,
    active: true,
    level: 30, // Secundario
    academicYear: '2025',
    cycleName: 'Secundario 2025',
    grade: '6',
    division: 'B',
    createdAt: '2025-03-01T00:00:00.000Z',
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

// cc-1 → Matemática · cc-2 → Historia
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

  it('NO renderiza un combo de ciclo (la selección es sobre la lista)', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('el botón Boletín descarga el boletín del ciclo (membership.id)', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    const btn = await screen.findByRole('button', { name: /boletín/i });
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);

    expect(mockDownloadBoletin).toHaveBeenCalledWith('m-1');
  });

  it('muestra el nivel con su descripción, no el código numérico', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });

    // level 30 → "Secundario" (no "30")
    expect(screen.getByText('Secundario')).toBeInTheDocument();
    expect(screen.queryByText('30')).not.toBeInTheDocument();
  });
});

describe('StudentLegajo — selección de ciclo sobre la lista (varios ciclos)', () => {
  beforeEach(async () => {
    setupApiMock(MEMBERSHIPS_MULTI);
    await loadComponent();
  });

  it('por omisión selecciona el ciclo ACTIVO (aunque no sea el más reciente)', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    // Activo = m-2 (2025, cc-2) → Historia visible; Matemática (cc-1, 2026) NO.
    await waitFor(() => {
      expect(screen.getByText('Historia')).toBeInTheDocument();
    });
    expect(screen.queryByText('Matemática')).not.toBeInTheDocument();
  });

  it('solo pide notas del ciclo seleccionado (no aplana todos)', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    await waitFor(() => {
      expect(screen.getByText('Historia')).toBeInTheDocument();
    });

    const gradeCalls = mockApiGet.mock.calls.filter(
      (args: any[]) => args[0] === '/grading/subject-grades/by-student',
    );
    expect(gradeCalls.every((c: any[]) => c[1]?.params?.courseCycleId === 'cc-2')).toBe(true);
  });

  it('al clickear una fila de Cursos Ciclo cambia el ciclo y pide sus notas', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    await waitFor(() => {
      expect(screen.getByText('Historia')).toBeInTheDocument();
    });

    // Fila de m-1: su celda "Año lectivo" es exactamente "2026".
    const row2026 = screen.getByText('2026').closest('tr')!;
    fireEvent.click(row2026);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        '/grading/subject-grades/by-student',
        expect.objectContaining({
          params: expect.objectContaining({ courseCycleId: 'cc-1', studentId: 'stu-1' }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });
  });

  it('marca visualmente la fila seleccionada (indicador ●)', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    await waitFor(() => {
      expect(screen.getByText('Historia')).toBeInTheDocument();
    });

    // El activo por defecto es la fila 2025 (m-2) → debe tener el indicador ●.
    const row2025 = screen.getByText('2025').closest('tr')!;
    expect(within(row2025).getByText('●')).toBeInTheDocument();
  });

  it('Boletín: deshabilitado en el activo no imprimible, habilitado al elegir uno imprimible', async () => {
    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    // Default m-2 (printable:false) → deshabilitado
    const btn = await screen.findByRole('button', { name: /boletín/i });
    await waitFor(() => expect(btn).toBeDisabled());

    // Selecciono m-1 (2026, printable:true) → habilitado y descarga m-1
    fireEvent.click(screen.getByText('2026').closest('tr')!);
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    expect(mockDownloadBoletin).toHaveBeenCalledWith('m-1');
  });
});

describe('StudentLegajo — default sin ciclo activo', () => {
  it('cae al ciclo más reciente cuando ninguno está activo', async () => {
    const noneActive = MEMBERSHIPS_MULTI.map((m) => ({ ...m, active: false }));
    setupApiMock(noneActive);
    await loadComponent();

    render(<StudentLegajo studentId="stu-1" institutionId="inst-1" />);

    // Ninguno activo → más reciente = m-1 (2026, cc-1) → Matemática
    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });
    expect(screen.queryByText('Historia')).not.toBeInTheDocument();
  });
});
