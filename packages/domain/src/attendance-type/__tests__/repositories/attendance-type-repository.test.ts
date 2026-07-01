/**
 * T2.1.1 — Contract test: AttendanceTypeRepository port compiles with all methods.
 * This test verifies the interface shape via TypeScript structural typing.
 * RED phase: fails because the interface does not exist yet.
 */
import { describe, it, expect, vi } from 'vitest';
import type { AttendanceTypeRepository } from '../../repositories/attendance-type-repository';
import { AttendanceType } from '../../entities/attendance-type';
import { AttendanceTypeCode } from '../../value-objects/attendance-type-code';
import {
  AttendanceBehavior,
  AttendanceBehaviorValue,
} from '../../value-objects/attendance-behavior';

function makeEntity(): AttendanceType {
  return AttendanceType.reconstruct({
    id: 'ent-1',
    code: AttendanceTypeCode.reconstruct('P'),
    description: 'Presente',
    absenceValue: 0,
    level: 2,
    behavior: AttendanceBehavior.create(AttendanceBehaviorValue.NO_COMPUTA).unwrap(),
    isSystem: true,
    active: true,
  });
}

describe('AttendanceTypeRepository — port contract', () => {
  it('mock satisfies the full AttendanceTypeRepository interface', () => {
    // Build a mock that satisfies the interface structurally
    const mock: AttendanceTypeRepository = {
      findById: vi.fn(),
      findByLevelCode: vi.fn(),
      list: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      existsByLevelCode: vi.fn(),
    };

    expect(typeof mock.findById).toBe('function');
    expect(typeof mock.findByLevelCode).toBe('function');
    expect(typeof mock.list).toBe('function');
    expect(typeof mock.save).toBe('function');
    expect(typeof mock.delete).toBe('function');
    expect(typeof mock.existsByLevelCode).toBe('function');
  });

  it('findById resolves with AttendanceType or null', async () => {
    const entity = makeEntity();
    const mock: AttendanceTypeRepository = {
      findById: vi.fn().mockResolvedValue(entity),
      findByLevelCode: vi.fn(),
      list: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      existsByLevelCode: vi.fn(),
    };

    const result = await mock.findById('ent-1');
    expect(result).toBe(entity);
  });

  it('existsByLevelCode resolves boolean (excludeId optional)', async () => {
    const mock: AttendanceTypeRepository = {
      findById: vi.fn(),
      findByLevelCode: vi.fn(),
      list: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      existsByLevelCode: vi.fn().mockResolvedValue(true),
    };

    const a = await mock.existsByLevelCode(2, 'P');
    const b = await mock.existsByLevelCode(2, 'P', 'exclude-this-id');
    expect(a).toBe(true);
    expect(b).toBe(true);
  });
});
