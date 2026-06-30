/**
 * Round5-Bug3: throwGuardianError must re-throw unknown/infra errors unchanged
 * instead of wrapping them in BadRequestException.
 *
 * Updated for Result migration (PR-2): removeGuardian handler no longer has try/catch;
 * domain errors come from Result.err; infra errors propagate directly.
 */
import { describe, it, expect, vi } from 'vitest';
import { StudentController } from '../../src/presentation/student/student.controller';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotFoundError, ValidationError, err, ok } from '@educandow/domain';

function makeController(removeGuardianUC: { execute: ReturnType<typeof vi.fn> }) {
  return new StudentController(
    null as any, // createUC
    null as any, // listUC
    null as any, // getUC
    null as any, // deleteUC
    null as any, // patchUC
    null as any, // myDataUC
    null as any, // myChildrenUC
    null as any, // assignGuardianUC
    removeGuardianUC as any, // removeGuardianUC
    null as any, // listGuardiansUC
    null as any, // createStudyTutorUC
    null as any, // updateStudyTutorUC
    null as any, // studentRepo
  );
}

describe('StudentController.removeGuardian — Round5-Bug3 error propagation', () => {
  it('(Round5-Bug3) non-domain infra error propagates unchanged, NOT wrapped in BadRequestException', async () => {
    const infraError = new Error('DB connection lost');
    const mockUC = { execute: vi.fn().mockRejectedValue(infraError) };
    const controller = makeController(mockUC);

    let caughtError: unknown;
    try {
      await controller.removeGuardian('s1', 'g1');
    } catch (e) {
      caughtError = e;
    }

    // Must be the original error, NOT a BadRequestException wrapper
    expect(caughtError).toBe(infraError);
    expect(caughtError).not.toBeInstanceOf(BadRequestException);
  });

  it('(Round5-Bug3) NotFoundError in Result.err is mapped to NotFoundException (not BadRequest)', async () => {
    const notFoundErr = new NotFoundError('StudentGuardian', 'g1');
    const mockUC = { execute: vi.fn().mockResolvedValue(err(notFoundErr)) };
    const controller = makeController(mockUC);

    await expect(controller.removeGuardian('s1', 'g1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('(Round5-Bug3) infra ValidationError propagates unchanged (no catch in handler — REQ-08)', async () => {
    const infraErr = new ValidationError('SOME_DOMAIN_ERROR');
    const mockUC = { execute: vi.fn().mockRejectedValue(infraErr) };
    const controller = makeController(mockUC);

    let caughtError: unknown;
    try {
      await controller.removeGuardian('s1', 'g1');
    } catch (e) {
      caughtError = e;
    }

    // Infra ValidationError propagates as-is; NOT wrapped in BadRequestException
    expect(caughtError).toBe(infraErr);
    expect(caughtError).not.toBeInstanceOf(BadRequestException);
  });

  it('successful Result returns without throwing', async () => {
    const mockUC = { execute: vi.fn().mockResolvedValue(ok(undefined)) };
    const controller = makeController(mockUC);

    await expect(controller.removeGuardian('s1', 'g1')).resolves.toBeUndefined();
  });
});
