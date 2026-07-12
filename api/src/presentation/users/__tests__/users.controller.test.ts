import { describe, it, expect, vi } from 'vitest';
import type { Request } from 'express';
import { ok, err } from '@educandow/domain';
import {
  InsufficientRoleHierarchyError,
  CrossInstitutionForbiddenError,
} from '../../../application/shared/errors/authorization-errors';
import { UsersController } from '../users.controller';

/**
 * Unit tests for UsersController — verifies the `isErr() → throw` idiom (AEM-R5/R2 end-to-end,
 * project convention already used 23+ times elsewhere). The 4 use cases are mocked; no Nest
 * module is bootstrapped.
 */
function makeMockReq(): Request {
  return {
    user: { roles: ['ROOT'], institutionId: undefined, modules: [] },
  } as unknown as Request;
}

function makeController(overrides: {
  createExecute?: ReturnType<typeof vi.fn>;
  updateExecute?: ReturnType<typeof vi.fn>;
  deleteExecute?: ReturnType<typeof vi.fn>;
} = {}) {
  const listUC = { execute: vi.fn() };
  const createUC = { execute: overrides.createExecute ?? vi.fn() };
  const updateUC = { execute: overrides.updateExecute ?? vi.fn() };
  const deleteUC = { execute: overrides.deleteExecute ?? vi.fn() };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controller = new UsersController(listUC as any, createUC as any, updateUC as any, deleteUC as any);
  return { controller, listUC, createUC, updateUC, deleteUC };
}

describe('UsersController — isErr()/throw idiom (AEM-R5/R2)', () => {
  describe('create', () => {
    it('throws the ApplicationError instance when createUC.execute resolves err(...)', async () => {
      const authError = new InsufficientRoleHierarchyError('no hierarchy');
      const { controller } = makeController({
        createExecute: vi.fn().mockResolvedValue(err(authError)),
      });

      await expect(
        controller.create(makeMockReq(), {
          email: 'new@test.com',
          password: 'secret123',
          name: 'New User',
        }),
      ).rejects.toBe(authError);
    });

    it('returns the unwrapped data when createUC.execute resolves ok(...)', async () => {
      const payload = { data: { id: 'user-1' } };
      const { controller } = makeController({
        createExecute: vi.fn().mockResolvedValue(ok(payload)),
      });

      const result = await controller.create(makeMockReq(), {
        email: 'new@test.com',
        password: 'secret123',
        name: 'New User',
      });

      expect(result).toEqual(payload);
    });
  });

  describe('update', () => {
    it('throws the ApplicationError instance when updateUC.execute resolves err(...)', async () => {
      const authError = new CrossInstitutionForbiddenError('cross institution');
      const { controller } = makeController({
        updateExecute: vi.fn().mockResolvedValue(err(authError)),
      });

      await expect(
        controller.update(makeMockReq(), 'user-1', { name: 'New Name' }),
      ).rejects.toBe(authError);
    });

    it('returns the unwrapped data when updateUC.execute resolves ok(...)', async () => {
      const payload = { data: { id: 'user-1' } };
      const { controller } = makeController({
        updateExecute: vi.fn().mockResolvedValue(ok(payload)),
      });

      const result = await controller.update(makeMockReq(), 'user-1', { name: 'New Name' });

      expect(result).toEqual(payload);
    });
  });

  describe('delete', () => {
    it('throws the ApplicationError instance when deleteUC.execute resolves err(...)', async () => {
      const authError = new InsufficientRoleHierarchyError('no hierarchy');
      const { controller } = makeController({
        deleteExecute: vi.fn().mockResolvedValue(err(authError)),
      });

      await expect(controller.delete(makeMockReq(), 'user-1')).rejects.toBe(authError);
    });

    it('returns undefined without throwing when deleteUC.execute resolves ok(undefined)', async () => {
      const { controller } = makeController({
        deleteExecute: vi.fn().mockResolvedValue(ok(undefined)),
      });

      const result = await controller.delete(makeMockReq(), 'user-1');

      expect(result).toBeUndefined();
    });
  });
});
