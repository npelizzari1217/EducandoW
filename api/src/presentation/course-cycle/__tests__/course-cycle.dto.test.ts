import { describe, it, expect, vi } from 'vitest';
import { GenerateCourseCyclesSchema } from '../dto/course-cycle.dto';
import { CourseCycleController } from '../course-cycle.controller';
import { CourseCycleNotFoundError, CourseCycle, CourseName, PassingGrade, Level, LevelType } from '@educandow/domain';

// ── CourseCycleController helpers ──────────────────────────────

function makeCC() {
  return CourseCycle.create({
    courseId: 'course-1',
    studyPlanId: 'plan-1',
    cycleId: 'cycle-1',
    courseName: CourseName.create('MATEMÁTICA').unwrap(),
    level: Level.reconstruct(LevelType.PRIMARIO),
    passingGrade: PassingGrade.create(6).unwrap(),
    promotionText: null,
    firstBimonth: null,
    secondBimonth: null,
    thirdBimonth: null,
    fourthBimonth: null,
  });
}

function makeController(overrides: Record<string, unknown> = {}) {
  return new CourseCycleController(
    overrides.createUC as any,
    overrides.updateUC as any,
    overrides.deleteUC as any,
    overrides.toggleUC as any,
    overrides.getUC as any,
    overrides.listUC as any,
    overrides.generateUC as any,
    overrides.getGradingPeriodUC as any,
    overrides.setGradingPeriodUC as any,
    overrides.listStudentsUC as any,
    overrides.listTeacherCCsUC as any,
    overrides.listTeacherSubjectsUC as any,
    overrides.listAdminSubjectsUC as any,
  );
}

// ── GET :uuid — modality in response (CCM-1, CCM-2) ───────────

describe('CourseCycleController — GET :uuid (modality)', () => {
  it('CCM-1: response includes modality field when cycle found', async () => {
    const cc = makeCC();
    const getUC = {
      execute: vi.fn().mockResolvedValue({ isOk: () => true, isErr: () => false, unwrap: () => ({ cycle: cc, modality: 0 }) }),
    };
    const ctrl = makeController({ getUC });

    const response = await ctrl.get(cc.uuid);

    expect(response.data).toHaveProperty('modality', 0);
    expect(response.data).toHaveProperty('uuid', cc.uuid);
    expect(response.data).toHaveProperty('level');
  });

  it('CCM-2: throws CourseCycleNotFoundError when cycle not found', async () => {
    const error = new CourseCycleNotFoundError('cc-none');
    const getUC = {
      execute: vi.fn().mockResolvedValue({ isOk: () => false, isErr: () => true, unwrapErr: () => error }),
    };
    const ctrl = makeController({ getUC });

    await expect(ctrl.get('cc-none')).rejects.toThrow(CourseCycleNotFoundError);
  });
});

// ── GET :uuid/students (SBC-1, SBC-2, SBC-3) ──────────────────

describe('CourseCycleController — GET :uuid/students', () => {
  it('SBC-1: returns enrolled students list', async () => {
    const students = [
      { studentId: 'stu-1', firstName: 'Juan', lastName: 'Pérez' },
      { studentId: 'stu-2', firstName: 'Ana', lastName: 'López' },
    ];
    const listStudentsUC = { execute: vi.fn().mockResolvedValue(students) };
    const ctrl = makeController({ listStudentsUC });

    const response = await ctrl.listStudents('cc-1');

    expect(response.data).toHaveLength(2);
    expect(response.data[0]).toEqual({ studentId: 'stu-1', firstName: 'Juan', lastName: 'Pérez' });
  });

  it('SBC-2: propagates CourseCycleNotFoundError (→ 404)', async () => {
    const listStudentsUC = {
      execute: vi.fn().mockRejectedValue(new CourseCycleNotFoundError('cc-nonexistent')),
    };
    const ctrl = makeController({ listStudentsUC });

    await expect(ctrl.listStudents('cc-nonexistent')).rejects.toThrow(CourseCycleNotFoundError);
  });

  it('SBC-3: returns [] when cycle has no enrolled students', async () => {
    const listStudentsUC = { execute: vi.fn().mockResolvedValue([]) };
    const ctrl = makeController({ listStudentsUC });

    const response = await ctrl.listStudents('cc-empty');

    expect(response.data).toEqual([]);
  });
});

// ── GenerateCourseCyclesSchema ─────────────────────────────────

describe('GenerateCourseCyclesSchema', () => {
  it('accepts level, cycleId, and optional studyPlanId', () => {
    const result = GenerateCourseCyclesSchema.safeParse({
      level: 20,
      cycleId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.level).toBe(20);
      expect(result.data.cycleId).toBe('00000000-0000-0000-0000-000000000001');
      expect(result.data.studyPlanId).toBeUndefined();
    }
  });

  it('accepts with all three fields', () => {
    const result = GenerateCourseCyclesSchema.safeParse({
      level: 30,
      cycleId: '00000000-0000-0000-0000-000000000001',
      studyPlanId: '00000000-0000-0000-0000-000000000002',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing level', () => {
    const result = GenerateCourseCyclesSchema.safeParse({
      cycleId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing cycleId', () => {
    const result = GenerateCourseCyclesSchema.safeParse({
      level: 20,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid level type', () => {
    const result = GenerateCourseCyclesSchema.safeParse({
      level: 'veinte',
      cycleId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(false);
  });
});
