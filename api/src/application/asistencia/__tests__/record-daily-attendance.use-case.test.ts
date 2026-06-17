/**
 * RecordDailyAttendanceUseCase tests — Fase 6
 * F6-T6: subject teacher without preceptor assignment → ForbiddenError
 * F6-T7: preceptor → records successfully
 * F6-T4: SECRETARIO (D3) → bypass
 * TDD: RED → GREEN
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordDailyAttendanceUseCase } from '../record-daily-attendance.use-case';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';
import {
  AsistenciaDiaria,
  DocenteXCiclo,
  type DailyAttendanceRepository,
  type DocenteXCicloRepository,
  type AsignacionCursoXCicloRepository,
} from '@educandow/domain';
import { ForbiddenError } from '@educandow/domain';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── helpers ────────────────────────────────────────────────────────────────────

const date = new Date('2026-08-10');

function makeDocente(id: string, userId: string, cycleId: string): DocenteXCiclo {
  return DocenteXCiclo.reconstruct({
    id,
    userId,
    cycleId,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeAsistencia(courseCycleId: string, studentId: string): AsistenciaDiaria {
  return AsistenciaDiaria.create({ courseCycleId, studentId, date, statusCode: 'P' });
}

interface Repos {
  attendanceRepo: DailyAttendanceRepository;
  docenteRepo: DocenteXCicloRepository;
  asignacionRepo: AsignacionCursoXCicloRepository;
  mockClient: {
    courseCycle: { findUnique: ReturnType<typeof vi.fn> };
  };
}

function makeRepos(overrides: {
  docente?: DocenteXCiclo | null;
  isPreceptor?: boolean;
  courseCycle?: { cycleId: string } | null;
} = {}): Repos {
  const docente = overrides.docente !== undefined
    ? overrides.docente
    : makeDocente('dxc-1', 'user-1', 'cycle-1');

  const isPreceptor = overrides.isPreceptor !== undefined
    ? overrides.isPreceptor
    : true;

  const cc = overrides.courseCycle !== undefined
    ? overrides.courseCycle
    : { cycleId: 'cycle-1' };

  const mockClient = {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(cc),
    },
  };

  return {
    attendanceRepo: {
      record: vi.fn().mockImplementation(async (data) =>
        makeAsistencia(data.courseCycleId, data.studentId)),
      findByCourseAndDate: vi.fn().mockResolvedValue([]),
      findByCourseAndStudent: vi.fn().mockResolvedValue([]),
    },
    docenteRepo: {
      findById: vi.fn().mockResolvedValue(docente),
      findByUserId: vi.fn().mockResolvedValue(docente ? [docente] : []),
      findByCycleId: vi.fn().mockResolvedValue(docente ? [docente] : []),
      findByUserAndCycle: vi.fn().mockResolvedValue(docente),
      upsert: vi.fn().mockResolvedValue(docente),
    },
    asignacionRepo: {
      assign: vi.fn(),
      findByCourseId: vi.fn().mockResolvedValue([]),
      findByCourseAndDocente: vi.fn().mockResolvedValue([]),
      isPreceptor: vi.fn().mockResolvedValue(isPreceptor),
      remove: vi.fn().mockResolvedValue(undefined),
      removeTitularesForCourse: vi.fn().mockResolvedValue(undefined),
      findTitularCourseIdsByUser: vi.fn().mockResolvedValue([]),
    },
    mockClient,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('RecordDailyAttendanceUseCase', () => {
  let repos: Repos;

  beforeEach(() => {
    repos = makeRepos();
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
  });

  // F6-T7: preceptor records daily attendance → success
  it('F6-T7: preceptor records daily attendance for their CC → success', async () => {
    const uc = new RecordDailyAttendanceUseCase(
      repos.attendanceRepo,
      repos.docenteRepo as any,
      repos.asignacionRepo as any,
    );

    const result = await uc.execute({
      courseCycleId: 'cc-1',
      studentId: 'student-1',
      date,
      statusCode: 'P',
      userId: 'user-1',
      userRoles: ['TEACHER'],
    });

    expect(result.courseCycleId).toBe('cc-1');
    expect(result.studentId).toBe('student-1');
    expect(result.statusCode).toBe('P');
    expect(repos.attendanceRepo.record).toHaveBeenCalledOnce();
  });

  // F6-T6: subject teacher (not preceptor) → ForbiddenError
  it('F6-T6: teacher not assigned as preceptor → ForbiddenError', async () => {
    repos = makeRepos({ isPreceptor: false });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);

    const uc = new RecordDailyAttendanceUseCase(
      repos.attendanceRepo,
      repos.docenteRepo as any,
      repos.asignacionRepo as any,
    );

    await expect(
      uc.execute({
        courseCycleId: 'cc-1',
        studentId: 'student-1',
        date,
        statusCode: 'A',
        userId: 'user-teacher',
        userRoles: ['TEACHER'],
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(repos.attendanceRepo.record).not.toHaveBeenCalled();
  });

  // F6-T4 (daily): SECRETARIO → D3 bypass
  it('F6-T4: SECRETARIO bypasses Door 2 (D3) and records daily attendance', async () => {
    const uc = new RecordDailyAttendanceUseCase(
      repos.attendanceRepo,
      repos.docenteRepo as any,
      repos.asignacionRepo as any,
    );

    const result = await uc.execute({
      courseCycleId: 'cc-1',
      studentId: 'student-1',
      date,
      statusCode: 'P',
      userId: 'user-sec',
      userRoles: ['SECRETARIO'],
    });

    expect(result.courseCycleId).toBe('cc-1');
    // D3: no preceptor check
    expect(repos.asignacionRepo.isPreceptor).not.toHaveBeenCalled();
    expect(repos.attendanceRepo.record).toHaveBeenCalledOnce();
  });

  // ROOT → bypass
  it('ROOT bypasses all checks and records', async () => {
    const uc = new RecordDailyAttendanceUseCase(
      repos.attendanceRepo,
      repos.docenteRepo as any,
      repos.asignacionRepo as any,
    );

    const result = await uc.execute({
      courseCycleId: 'cc-1',
      studentId: 'student-1',
      date,
      statusCode: 'P',
      userId: 'user-root',
      userRoles: ['ROOT'],
    });

    expect(result.courseCycleId).toBe('cc-1');
    expect(repos.docenteRepo.findByUserAndCycle).not.toHaveBeenCalled();
  });

  // docenteXCiclo not found for this cycle → ForbiddenError
  it('docenteXCiclo not found for user in cycle → ForbiddenError', async () => {
    repos = makeRepos({ docente: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);

    const uc = new RecordDailyAttendanceUseCase(
      repos.attendanceRepo,
      repos.docenteRepo as any,
      repos.asignacionRepo as any,
    );

    await expect(
      uc.execute({
        courseCycleId: 'cc-1',
        studentId: 'student-1',
        date,
        statusCode: 'A',
        userId: 'user-x',
        userRoles: ['TEACHER'],
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  // CC not found → ForbiddenError
  it('courseCycle not found → ForbiddenError', async () => {
    repos = makeRepos({ courseCycle: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);

    const uc = new RecordDailyAttendanceUseCase(
      repos.attendanceRepo,
      repos.docenteRepo as any,
      repos.asignacionRepo as any,
    );

    await expect(
      uc.execute({
        courseCycleId: 'cc-unknown',
        studentId: 'student-1',
        date,
        statusCode: 'A',
        userId: 'user-1',
        userRoles: ['TEACHER'],
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
