/**
 * StudentController — throwGuardianError() private method
 * TDD Phase 1 — TASK-01 (RED): ForbiddenError must map to ForbiddenException (403), not BadRequestException (400).
 *
 * Satisfies: REQ-02
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ForbiddenError } from '@educandow/domain';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let StudentController: any;

beforeAll(async () => {
  const mod = await import('../student.controller');
  StudentController = mod.StudentController;
});

/** Minimal controller instance — throwGuardianError uses no instance fields */
function makeController() {
  const ctrl = Object.create(StudentController.prototype);
  // Populate the constructor fields to avoid any prototype-chain issues
  ctrl.createUC = { execute: vi.fn() };
  ctrl.listUC = { execute: vi.fn() };
  ctrl.getUC = { execute: vi.fn() };
  ctrl.deleteUC = { execute: vi.fn() };
  ctrl.patchUC = { execute: vi.fn() };
  ctrl.myDataUC = { execute: vi.fn() };
  ctrl.myChildrenUC = { execute: vi.fn() };
  ctrl.assignGuardianUC = { execute: vi.fn() };
  ctrl.removeGuardianUC = { execute: vi.fn() };
  ctrl.listGuardiansUC = { execute: vi.fn() };
  ctrl.createStudyTutorUC = { execute: vi.fn() };
  ctrl.updateStudyTutorUC = { execute: vi.fn() };
  ctrl.studentRepo = { search: vi.fn() };
  return ctrl;
}

describe('StudentController.throwGuardianError()', () => {
  describe('REQ-02: ForbiddenError → ForbiddenException (403)', () => {
    it('throws ForbiddenException when given a ForbiddenError', () => {
      const ctrl = makeController();
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ctrl as any).throwGuardianError(new ForbiddenError('test forbidden')),
      ).toThrow(ForbiddenException);
    });

    it('does NOT throw BadRequestException when given a ForbiddenError', () => {
      const ctrl = makeController();
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ctrl as any).throwGuardianError(new ForbiddenError('test forbidden')),
      ).not.toThrow(BadRequestException);
    });
  });
});
