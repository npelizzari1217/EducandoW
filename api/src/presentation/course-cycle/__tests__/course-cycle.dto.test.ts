import { describe, it, expect } from 'vitest';
import { GenerateCourseCyclesSchema } from '../dto/course-cycle.dto';

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
