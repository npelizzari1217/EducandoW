/**
 * Orthogonality test — fase de bimestre (Capacidad A) vs. cierre mensual de
 * asistencia (Capacidad B).
 *
 * A prior sdd-verify pass confirmed structurally (via negative grep) that neither
 * capability's guard files import or read the other capability's state, and that
 * the attendance guards run UNCONDITIONALLY. This file closes the remaining gap:
 * an EXPLICIT combined-scenario test that asserts the negative cross-cutting
 * behaviour end-to-end, using the real domain entities/services for both guards.
 *
 * Covers:
 *   - gradingPhase=CIERRE (blocks bimester grading) does NOT block attendance
 *     recording when the month is OPEN (general + per-subject use cases).
 *   - A CLOSED attendance month (blocks attendance recording) does NOT block
 *     grading the active bimester via UpsertSubjectPeriodGradesUseCase, wired to
 *     the REAL GradingPhaseAuthorizerService + CourseCycle.canGradeBimester.
 *
 * Pattern: mocked repos + TenantContext, no NestJS, no DB — mirrors
 * record-general-attendance-day.use-case.test.ts, record-subject-attendance-day.use-case.test.ts
 * and upsert-subject-period-grades.use-case.spec.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AttendanceMonthStatus,
  DayMap,
  AsistenciaXAlumnoXCursoXCiclo,
  AsistenciaXMateriaXAlumnoXCursoXCiclo,
  Id,
  AttendanceTypeCode,
  CourseCycle,
  CourseName,
  PassingGrade,
  Level,
  LevelType,
  GradingPhase,
  SubjectGradingPeriod,
} from '@educandow/domain';

import { RecordGeneralAttendanceDayUseCase } from '../asistencia/record-general-attendance-day.use-case';
import { RecordSubjectAttendanceDayUseCase } from '../asistencia/record-subject-attendance-day.use-case';
import { UpsertSubjectPeriodGradesUseCase } from '../grading/upsert-subject-period-grades.use-case';
import { GradingPhaseAuthorizerService } from '../grading/grading-phase-authorizer.service';

vi.mock('../../infrastructure/auth/tenant.context', () => ({
  TenantContext: { getClient: vi.fn() },
}));

import { TenantContext } from '../../infrastructure/auth/tenant.context';

// ── Shared fixtures ─────────────────────────────────────────────────────────────

const CC_ID = 'cc-orthogonality-1';
const STUDENT_ID = 'stu-1';
const YEAR = 2026;
const MONTH = 6; // June = 30 days
const SUBJECT_ID = 'subj-1';
const MXCC_ID = 'mx-orthogonality-1';

function makeCourseCycleWithPhase(phase: string, level: LevelType = LevelType.SECUNDARIO): CourseCycle {
  const cc = CourseCycle.create({
    courseId: 'course-1',
    studyPlanId: 'plan-1',
    cycleId: 'cycle-1',
    courseName: CourseName.create('MATEMÁTICA').unwrap(),
    level: Level.reconstruct(level),
    passingGrade: PassingGrade.create(6).unwrap(),
  });
  cc.setGradingPhase(GradingPhase.create(phase).unwrap());
  return cc;
}

// ── Attendance factories (mirrors record-general/subject-attendance-day tests) ──

function makeGeneralAttendanceUC({
  monthStatus = null,
}: { monthStatus?: AttendanceMonthStatus | null } = {}) {
  const row = AsistenciaXAlumnoXCursoXCiclo.reconstruct({
    id: Id.reconstruct('row-general-1'),
    courseCycleId: CC_ID,
    studentId: STUDENT_ID,
    year: YEAR,
    month: MONTH,
    days: DayMap.empty(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const generalRepo = {
    findOne: vi.fn().mockResolvedValue(row),
    setDay: vi.fn().mockResolvedValue(row),
  };
  const attendanceTypeRepo = {
    list: vi.fn().mockResolvedValue([
      { id: 'at-1', code: AttendanceTypeCode.reconstruct('P'), level: 1, active: true, assignable: true },
    ]),
  };
  const docenteRepo = {
    findByUserAndCycle: vi.fn().mockResolvedValue({ id: 'dxc-1', userId: 'u1', cycleId: 'cycle-1' }),
  };
  const asignacionRepo = { isPreceptor: vi.fn().mockResolvedValue(true) };
  const monthStatusRepo = {
    findOne: vi.fn().mockResolvedValue(monthStatus),
    findLatestBefore: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
  };

  const uc = Object.create(RecordGeneralAttendanceDayUseCase.prototype) as RecordGeneralAttendanceDayUseCase;
  Object.assign(uc, { generalRepo, attendanceTypeRepo, docenteRepo, asignacionRepo, monthStatusRepo });

  return { uc, generalRepo, monthStatusRepo };
}

function makeSubjectAttendanceUC({
  monthStatus = null,
}: { monthStatus?: AttendanceMonthStatus | null } = {}) {
  const row = AsistenciaXMateriaXAlumnoXCursoXCiclo.reconstruct({
    id: Id.reconstruct('row-subject-1'),
    materiaXCursoXCicloId: MXCC_ID,
    studentId: STUDENT_ID,
    year: YEAR,
    month: MONTH,
    days: DayMap.empty(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  vi.mocked(TenantContext.getClient).mockReturnValue({
    materiaXCursoXCiclo: {
      findUnique: vi.fn().mockResolvedValue({ courseCycleId: CC_ID }),
    },
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue({ cycleId: 'cycle-1' }),
    },
  } as never);

  const materiaAsistRepo = {
    findOne: vi.fn().mockResolvedValue(row),
    setDay: vi.fn().mockResolvedValue(row),
  };
  const attendanceTypeRepo = {
    list: vi.fn().mockResolvedValue([
      { id: 'at-1', code: AttendanceTypeCode.reconstruct('P'), active: true, assignable: true },
    ]),
  };
  const grupoRepo = { findGroupsForDocente: vi.fn().mockResolvedValue([]) };
  const alumnosXGrupoRepo = { findStudentIdsByGrupoIds: vi.fn().mockResolvedValue([]) };
  const docenteRepo = {
    findByUserAndCycle: vi.fn().mockResolvedValue({ id: 'dxc-1', userId: 'u1', cycleId: 'cycle-1' }),
  };
  const monthStatusRepo = {
    findOne: vi.fn().mockResolvedValue(monthStatus),
    findLatestBefore: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
  };

  const uc = Object.create(RecordSubjectAttendanceDayUseCase.prototype) as RecordSubjectAttendanceDayUseCase;
  Object.assign(uc, {
    materiaAsistRepo, attendanceTypeRepo, grupoRepo, alumnosXGrupoRepo, docenteRepo, monthStatusRepo,
  });

  return { uc, materiaAsistRepo, monthStatusRepo };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Orthogonality: fase de bimestre (Capacidad A) vs. cierre mensual de asistencia (Capacidad B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gradingPhase CIERRE no bloquea el registro de asistencia cuando el mes está abierto', async () => {
    // Sanity: CIERRE genuinely blocks bimester grading elsewhere in the system —
    // this is the state we're proving does NOT leak into attendance guards.
    const ccInCierre = makeCourseCycleWithPhase('CIERRE');
    expect(ccInCierre.canGradeBimester(1)).toBe(false);
    expect(ccInCierre.canGradeFinal()).toBe(true); // CIERRE does allow final grades — irrelevant here, just documents the phase

    // Attendance month is OPEN (no AttendanceMonthStatus row = default-open).
    // Neither attendance use case receives or references `ccInCierre` at all —
    // that absence of a dependency is itself the structural proof of orthogonality.
    const { uc: generalUc, generalRepo } = makeGeneralAttendanceUC({ monthStatus: null });
    await expect(
      generalUc.execute({
        courseCycleId: CC_ID,
        studentId: STUDENT_ID,
        year: YEAR,
        month: MONTH,
        day: 15,
        statusCode: 'P',
        userId: 'u1',
        userRoles: ['SECRETARIO'],
      }),
    ).resolves.toBeDefined();
    expect(generalRepo.setDay).toHaveBeenCalledOnce();

    const { uc: subjectUc, materiaAsistRepo } = makeSubjectAttendanceUC({ monthStatus: null });
    await expect(
      subjectUc.execute({
        materiaXCursoXCicloId: MXCC_ID,
        studentId: STUDENT_ID,
        year: YEAR,
        month: MONTH,
        day: 15,
        statusCode: 'P',
        userId: 'u1',
        userRoles: ['ADMIN'],
      }),
    ).resolves.toBeDefined();
    expect(materiaAsistRepo.setDay).toHaveBeenCalledOnce();
  });

  it('mes cerrado no bloquea la calificación del bimestre activo', async () => {
    // Sanity: a CLOSED month genuinely blocks attendance recording elsewhere in
    // the system — this is the state we're proving does NOT leak into the
    // grading-phase guard.
    const closedMonth = AttendanceMonthStatus.create({ courseCycleId: CC_ID, year: YEAR, month: MONTH });
    closedMonth.close('secretario-1');
    expect(closedMonth.isClosed()).toBe(true);

    // CourseCycle is in active bimester BIM_2 — grading period 2 is gradable now.
    const ccInBim2 = makeCourseCycleWithPhase('BIM_2');
    expect(ccInBim2.canGradeBimester(2)).toBe(true);

    // Wire the REAL GradingPhaseAuthorizerService — it only ever calls
    // ccRepo.findByUuid + CourseCycle.canGradeBimester/canGradeFinal. It has no
    // dependency on AttendanceMonthStatusRepository whatsoever.
    const ccRepo = {
      findByUuid: vi.fn().mockResolvedValue(ccInBim2),
      findGradingContextByUuid: vi.fn().mockResolvedValue({ level: 20, modality: 1 }),
    };
    const phaseAuthorizer = new GradingPhaseAuthorizerService(ccRepo as never);

    const sgpRepo = {
      findByCourseCycleAndSubject: vi.fn().mockResolvedValue([
        SubjectGradingPeriod.snapshotFromTemplateItem({
          courseCycleId: CC_ID,
          subjectId: SUBJECT_ID,
          sortOrder: 2,
          name: 'Período 2',
        }),
      ]),
    };
    const periodGradeRepo = {
      findByCourseCycleAndSubject: vi.fn().mockResolvedValue([]),
      saveMany: vi.fn().mockResolvedValue(undefined),
    };
    const gradeScaleRepo = {
      findValueById: vi.fn(),
      findActiveByLevelModality: vi.fn(),
    };
    const authorizer = { canWriteGrades: vi.fn().mockResolvedValue(true) };

    vi.mocked(TenantContext.getClient).mockReturnValue({
      student: { findUnique: vi.fn().mockResolvedValue({ id: 'student-1' }) },
    } as never);

    const uc = new UpsertSubjectPeriodGradesUseCase(
      periodGradeRepo as never,
      sgpRepo as never,
      ccRepo as never,
      gradeScaleRepo as never,
      authorizer as never,
      phaseAuthorizer,
    );

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: CC_ID,
        subjectId: SUBJECT_ID,
        periodOrdinal: 2,
      }],
    });

    expect(result.isOk()).toBe(true);
    expect(periodGradeRepo.saveMany).toHaveBeenCalled();
    // UpsertSubjectPeriodGradesUseCase never received `closedMonth` or any
    // AttendanceMonthStatusRepository — grading succeeds regardless of it.
  });
});
