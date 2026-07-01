import { describe, it, expect } from 'vitest';
import { SetGradingPhaseSchema } from '../dto/grading-phase.dto';

describe('SetGradingPhaseSchema', () => {
  it.each(['BIM_1', 'BIM_2', 'BIM_3', 'BIM_4', 'CIERRE'])('accepts %s', (value) => {
    const result = SetGradingPhaseSchema.safeParse({ gradingPhase: value });
    expect(result.success).toBe(true);
  });

  it('accepts null (clears the active phase)', () => {
    const result = SetGradingPhaseSchema.safeParse({ gradingPhase: null });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid phase string', () => {
    const result = SetGradingPhaseSchema.safeParse({ gradingPhase: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing gradingPhase field', () => {
    const result = SetGradingPhaseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
