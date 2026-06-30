/**
 * Round5-Bug3: throwGuardianError must re-throw unknown/infra errors unchanged
 * instead of wrapping them in BadRequestException.
 *
 * RED: generic Error from use case becomes BadRequestException (wrong)
 * GREEN: generic Error propagates as-is; NotFoundError → NotFoundException; ValidationError → 400
 */
import { describe, it, expect, vi } from 'vitest';
import { StudentController } from '../../src/presentation/student/student.controller';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@educandow/domain';

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

  it('(Round5-Bug3) NotFoundError from removeGuardian is mapped to NotFoundException (not BadRequest)', async () => {
    const notFoundErr = new NotFoundError('StudentGuardian', 'g1');
    const mockUC = { execute: vi.fn().mockRejectedValue(notFoundErr) };
    const controller = makeController(mockUC);

    await expect(controller.removeGuardian('s1', 'g1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('(Round5-Bug3) domain ValidationError is still mapped to BadRequestException', async () => {
    const domainErr = new ValidationError('SOME_DOMAIN_ERROR');
    const mockUC = { execute: vi.fn().mockRejectedValue(domainErr) };
    const controller = makeController(mockUC);

    await expect(controller.removeGuardian('s1', 'g1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
