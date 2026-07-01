import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Reflector } from '@nestjs/core';
import {
  AttendanceTypeCodeDuplicateError,
  AttendanceTypeNotFoundError,
  AttendanceTypeLevelOutOfScopeError,
  SystemAttendanceTypeError,
  ok,
  err,
} from '@educandow/domain';
import { ROLES_KEY } from '../../../infrastructure/auth/decorators/roles.decorator';
import { AttendanceType, AttendanceTypeCode, AttendanceBehavior, AttendanceBehaviorValue } from '@educandow/domain';

// ── Current-user fixtures (PR2 — @CurrentUser) ──────────────────

const rootUser = { userId: 'u-root', roles: ['ROOT'] } as any;
const teacherLevel2 = { userId: 'u-teacher', roles: ['TEACHER'], levels: [20] } as any;

// Dynamically imported to run after mocks are wired (TDD pattern).
let AttendanceTypeController: any;

beforeAll(async () => {
  const mod = await import('../attendance-type.controller');
  AttendanceTypeController = mod.AttendanceTypeController;
});

// ── Helpers ──

function makeEntity(overrides: Partial<{
  id: string;
  level: number;
  code: string;
  description: string;
  absenceValue: number;
  behavior: AttendanceBehaviorValue;
  isSystem: boolean;
  active: boolean;
}> = {}) {
  return AttendanceType.reconstruct({
    id: overrides.id ?? 'uuid-1',
    code: AttendanceTypeCode.reconstruct(overrides.code ?? 'P'),
    description: overrides.description ?? 'Presente',
    absenceValue: overrides.absenceValue ?? 0,
    level: overrides.level ?? 2,
    behavior: AttendanceBehavior.reconstruct(overrides.behavior ?? AttendanceBehaviorValue.NO_COMPUTA),
    isSystem: overrides.isSystem ?? false,
    active: overrides.active ?? true,
  });
}

// ── Controller factory with mocked use cases ──

function makeController(overrides: Record<string, unknown> = {}) {
  const ctrl = Object.create(AttendanceTypeController.prototype);
  const mockCreate = overrides.createUC ?? { execute: vi.fn().mockResolvedValue(ok(makeEntity())) };
  const mockList = overrides.listUC ?? { execute: vi.fn().mockResolvedValue([makeEntity()]) };
  const mockGet = overrides.getUC ?? { execute: vi.fn().mockResolvedValue(ok(makeEntity())) };
  const mockUpdate = overrides.updateUC ?? { execute: vi.fn().mockResolvedValue(ok(makeEntity())) };
  const mockDelete = overrides.deleteUC ?? { execute: vi.fn().mockResolvedValue(ok(undefined)) };
  const mockGeneratePdf = overrides.generatePdfUC ?? { execute: vi.fn().mockResolvedValue(Buffer.from('PDF')) };

  Object.assign(ctrl, {
    createUC: mockCreate,
    listUC: mockList,
    getUC: mockGet,
    updateUC: mockUpdate,
    deleteUC: mockDelete,
    generatePdfUC: mockGeneratePdf,
  });

  return ctrl;
}

function makeRes() {
  return {
    set: vi.fn(),
    send: vi.fn(),
  };
}

// ═══════════════════════════════════════════════════════════
// POST — create
// ═══════════════════════════════════════════════════════════

describe('AttendanceTypeController.create', () => {
  it('returns { data: {...} } with status 201 on success', async () => {
    const entity = makeEntity({ id: 'entity-1' });
    const ctrl = makeController({
      createUC: { execute: vi.fn().mockResolvedValue(ok(entity)) },
    });

    const result = await ctrl.create(rootUser, {
      code: 'P',
      description: 'Presente',
      absenceValue: 0,
      level: 2,
      behavior: AttendanceBehaviorValue.NO_COMPUTA,
    });

    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('entity-1');
  });

  it('throws when create returns err(AttendanceTypeCodeDuplicateError)', async () => {
    const ctrl = makeController({
      createUC: {
        execute: vi.fn().mockResolvedValue(err(new AttendanceTypeCodeDuplicateError(2, 'P'))),
      },
    });

    await expect(
      ctrl.create(rootUser, { code: 'P', description: 'Presente', absenceValue: 0, level: 2, behavior: AttendanceBehaviorValue.NO_COMPUTA }),
    ).rejects.toThrow(AttendanceTypeCodeDuplicateError);
  });

  // ── PR2 — T9 (RED): @CurrentUser pasado al use case + 403 fuera de scope (ADD-4.1) ──

  it('passes @CurrentUser() to createUC.execute', async () => {
    const mockExecute = vi.fn().mockResolvedValue(ok(makeEntity()));
    const ctrl = makeController({ createUC: { execute: mockExecute } });

    await ctrl.create(teacherLevel2, {
      code: 'P', description: 'Presente', absenceValue: 0, level: 2, behavior: AttendanceBehaviorValue.NO_COMPUTA,
    });

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'P', level: 2 }),
      teacherLevel2,
    );
  });

  it('propagates AttendanceTypeLevelOutOfScopeError thrown by createUC (mapped to 403 by the global filter)', async () => {
    const ctrl = makeController({
      createUC: { execute: vi.fn().mockRejectedValue(new AttendanceTypeLevelOutOfScopeError(3)) },
    });

    await expect(
      ctrl.create(teacherLevel2, { code: 'X', description: 'X', absenceValue: 0, level: 3, behavior: AttendanceBehaviorValue.NO_COMPUTA }),
    ).rejects.toBeInstanceOf(AttendanceTypeLevelOutOfScopeError);
  });
});

// ═══════════════════════════════════════════════════════════
// GET — list
// ═══════════════════════════════════════════════════════════

describe('AttendanceTypeController.list', () => {
  it('returns { data: [...] } when UC returns entities', async () => {
    const entities = [makeEntity({ id: 'e1' }), makeEntity({ id: 'e2' })];
    const ctrl = makeController({
      listUC: { execute: vi.fn().mockResolvedValue(entities) },
    });

    const result = await ctrl.list(rootUser, undefined, undefined);

    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('e1');
  });

  it('passes level filter to the use case', async () => {
    const mockExecute = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({ listUC: { execute: mockExecute } });

    await ctrl.list(rootUser, '2', undefined);

    const callArg = mockExecute.mock.calls[0][0];
    expect(callArg?.level).toBe(2);
  });

  it('passes active=true filter to the use case', async () => {
    const mockExecute = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({ listUC: { execute: mockExecute } });

    await ctrl.list(rootUser, undefined, 'true');

    const callArg = mockExecute.mock.calls[0][0];
    expect(callArg?.active).toBe(true);
  });

  // ── PR2 — T9 (RED): @CurrentUser pasado al use case + 403 fuera de scope (ADD-4.1) ──

  it('passes @CurrentUser() to listUC.execute', async () => {
    const mockExecute = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({ listUC: { execute: mockExecute } });

    await ctrl.list(teacherLevel2, undefined, undefined);

    expect(mockExecute).toHaveBeenCalledWith(undefined, teacherLevel2);
  });

  it('propagates AttendanceTypeLevelOutOfScopeError thrown by listUC (mapped to 403 by the global filter, NEVER 200 with data:[])', async () => {
    const ctrl = makeController({
      listUC: { execute: vi.fn().mockRejectedValue(new AttendanceTypeLevelOutOfScopeError(3)) },
    });

    await expect(ctrl.list(teacherLevel2, '3', undefined)).rejects.toBeInstanceOf(AttendanceTypeLevelOutOfScopeError);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /:id — get
// ═══════════════════════════════════════════════════════════

describe('AttendanceTypeController.getOne', () => {
  it('returns { data: {...} } when entity found', async () => {
    const entity = makeEntity({ id: 'found-1' });
    const ctrl = makeController({
      getUC: { execute: vi.fn().mockResolvedValue(ok(entity)) },
    });

    const result = await ctrl.getOne(rootUser, 'found-1');
    expect(result.data.id).toBe('found-1');
  });

  it('throws when entity not found', async () => {
    const ctrl = makeController({
      getUC: {
        execute: vi.fn().mockResolvedValue(err(new AttendanceTypeNotFoundError('missing-id'))),
      },
    });

    await expect(ctrl.getOne(rootUser, 'missing-id')).rejects.toThrow(AttendanceTypeNotFoundError);
  });

  // ── PR3 — T18 (RED): @CurrentUser pasado al use case + 403 fuera de scope ──

  it('passes @CurrentUser() to getUC.execute', async () => {
    const mockExecute = vi.fn().mockResolvedValue(ok(makeEntity()));
    const ctrl = makeController({ getUC: { execute: mockExecute } });

    await ctrl.getOne(teacherLevel2, 'uuid-1');

    expect(mockExecute).toHaveBeenCalledWith('uuid-1', teacherLevel2);
  });

  it('propagates AttendanceTypeLevelOutOfScopeError thrown by getUC (mapped to 403 by the global filter)', async () => {
    const ctrl = makeController({
      getUC: { execute: vi.fn().mockRejectedValue(new AttendanceTypeLevelOutOfScopeError(3)) },
    });

    await expect(ctrl.getOne(teacherLevel2, 'uuid-3')).rejects.toBeInstanceOf(AttendanceTypeLevelOutOfScopeError);
  });
});

// ═══════════════════════════════════════════════════════════
// PATCH /:id — update
// ═══════════════════════════════════════════════════════════

describe('AttendanceTypeController.update', () => {
  it('returns { data: {...} } with 200 on success', async () => {
    const updated = makeEntity({ description: 'Updated' });
    const ctrl = makeController({
      updateUC: { execute: vi.fn().mockResolvedValue(ok(updated)) },
    });

    const result = await ctrl.update(rootUser, 'uuid-1', { description: 'Updated' });
    expect(result.data).toBeDefined();
  });

  it('throws when update returns err(SystemAttendanceTypeError)', async () => {
    const ctrl = makeController({
      updateUC: {
        execute: vi.fn().mockResolvedValue(err(new SystemAttendanceTypeError())),
      },
    });

    await expect(ctrl.update(rootUser, 'sys-id', { description: 'Changed' })).rejects.toThrow(SystemAttendanceTypeError);
  });

  it('throws when update returns err(AttendanceTypeNotFoundError)', async () => {
    const ctrl = makeController({
      updateUC: {
        execute: vi.fn().mockResolvedValue(err(new AttendanceTypeNotFoundError('no-id'))),
      },
    });

    await expect(ctrl.update(rootUser, 'no-id', {})).rejects.toThrow(AttendanceTypeNotFoundError);
  });

  // ── PR3 — T18 (RED): @CurrentUser pasado al use case + 403 fuera de scope ──

  it('passes @CurrentUser() to updateUC.execute', async () => {
    const mockExecute = vi.fn().mockResolvedValue(ok(makeEntity()));
    const ctrl = makeController({ updateUC: { execute: mockExecute } });

    await ctrl.update(teacherLevel2, 'uuid-1', { description: 'Updated' });

    expect(mockExecute).toHaveBeenCalledWith('uuid-1', { description: 'Updated' }, teacherLevel2);
  });

  it('propagates AttendanceTypeLevelOutOfScopeError thrown by updateUC (mapped to 403 by the global filter)', async () => {
    const ctrl = makeController({
      updateUC: { execute: vi.fn().mockRejectedValue(new AttendanceTypeLevelOutOfScopeError(3)) },
    });

    await expect(
      ctrl.update(teacherLevel2, 'uuid-3', { description: 'X' }),
    ).rejects.toBeInstanceOf(AttendanceTypeLevelOutOfScopeError);
  });
});

// ═══════════════════════════════════════════════════════════
// DELETE /:id — delete
// ═══════════════════════════════════════════════════════════

describe('AttendanceTypeController.remove', () => {
  it('returns undefined (204 no body) on success', async () => {
    const ctrl = makeController({
      deleteUC: { execute: vi.fn().mockResolvedValue(ok(undefined)) },
    });

    const result = await ctrl.remove(rootUser, 'uuid-1');
    expect(result).toBeUndefined();
  });

  it('throws when delete returns err(SystemAttendanceTypeError)', async () => {
    const ctrl = makeController({
      deleteUC: {
        execute: vi.fn().mockResolvedValue(err(new SystemAttendanceTypeError())),
      },
    });

    await expect(ctrl.remove(rootUser, 'sys-id')).rejects.toThrow(SystemAttendanceTypeError);
  });

  it('throws when delete returns err(AttendanceTypeNotFoundError)', async () => {
    const ctrl = makeController({
      deleteUC: {
        execute: vi.fn().mockResolvedValue(err(new AttendanceTypeNotFoundError('no-id'))),
      },
    });

    await expect(ctrl.remove(rootUser, 'no-id')).rejects.toThrow(AttendanceTypeNotFoundError);
  });

  // ── PR3 — T18 (RED): @CurrentUser pasado al use case + 403 fuera de scope ──

  it('passes @CurrentUser() to deleteUC.execute', async () => {
    const mockExecute = vi.fn().mockResolvedValue(ok(undefined));
    const ctrl = makeController({ deleteUC: { execute: mockExecute } });

    await ctrl.remove(teacherLevel2, 'uuid-1');

    expect(mockExecute).toHaveBeenCalledWith('uuid-1', teacherLevel2);
  });

  it('propagates AttendanceTypeLevelOutOfScopeError thrown by deleteUC (mapped to 403 by the global filter)', async () => {
    const ctrl = makeController({
      deleteUC: { execute: vi.fn().mockRejectedValue(new AttendanceTypeLevelOutOfScopeError(3)) },
    });

    await expect(ctrl.remove(teacherLevel2, 'uuid-3')).rejects.toBeInstanceOf(AttendanceTypeLevelOutOfScopeError);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /print — printList (PR4, T27 RED)
// ═══════════════════════════════════════════════════════════

describe('AttendanceTypeController.printList', () => {
  it('calls generatePdfUC.execute with @CurrentUser + query and returns the PDF with attachment headers', async () => {
    const mockExecute = vi.fn().mockResolvedValue(Buffer.from('PDF-BYTES'));
    const ctrl = makeController({ generatePdfUC: { execute: mockExecute } });
    const res = makeRes();

    await ctrl.printList(teacherLevel2, { level: 2, active: undefined }, res);

    expect(mockExecute).toHaveBeenCalledWith({ level: 2, active: undefined, currentUser: teacherLevel2 });
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Type': 'application/pdf',
      'Content-Disposition': expect.stringContaining('attachment'),
    }));
    expect(res.send).toHaveBeenCalledWith(Buffer.from('PDF-BYTES'));
  });

  it('propagates AttendanceTypeLevelOutOfScopeError thrown by generatePdfUC (mapped to 403 by the global filter, no PDF ever sent)', async () => {
    const ctrl = makeController({
      generatePdfUC: { execute: vi.fn().mockRejectedValue(new AttendanceTypeLevelOutOfScopeError(3)) },
    });
    const res = makeRes();

    await expect(ctrl.printList(teacherLevel2, { level: 3 }, res)).rejects.toBeInstanceOf(
      AttendanceTypeLevelOutOfScopeError,
    );
    expect(res.send).not.toHaveBeenCalled();
  });

  it('exposes @Roles module/action metadata consistent with list()/getOne() (ATTENDANCE_TYPES/READ)', () => {
    const reflector = new Reflector();
    const roles = reflector.get(ROLES_KEY, AttendanceTypeController.prototype.printList);
    expect(roles).toContainEqual({ module: 'ATTENDANCE_TYPES', action: 'READ' });
  });
});

// ═══════════════════════════════════════════════════════════
// HTTP status codes via @HttpCode decorators
// ═══════════════════════════════════════════════════════════

describe('AttendanceTypeController — HTTP status codes', () => {
  it('delete method returns undefined (NestJS sends 204 via @HttpCode decorator)', async () => {
    const ctrl = makeController();
    const result = await ctrl.remove(rootUser, 'some-id');
    expect(result).toBeUndefined();
  });

  it('toResponse helper returns expected fields, including behavior + derived assignable', async () => {
    const entity = makeEntity({
      id: 'resp-1',
      code: 'SAB',
      description: 'Sábado',
      absenceValue: 0,
      level: 2,
      behavior: AttendanceBehaviorValue.NO_ELEGIBLE,
      isSystem: true,
      active: true,
    });
    const ctrl = makeController({
      getUC: { execute: vi.fn().mockResolvedValue(ok(entity)) },
    });
    const result = await ctrl.getOne(rootUser, 'resp-1');
    expect(result.data).toMatchObject({
      id: 'resp-1',
      code: 'SAB',
      description: 'Sábado',
      absence_value: 0,
      level: 2,
      behavior: AttendanceBehaviorValue.NO_ELEGIBLE,
      assignable: false, // derived: NO_ELEGIBLE.isEligible() === false (compat check)
      is_system: true,
      active: true,
    });
  });
});
