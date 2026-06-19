/**
 * T-13 [RED] — TerciarioAuthorizerService unit tests.
 * Mocks DocenteXMateriaCarreraRepository + TenantContext.getClient.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerciarioAuthorizerService } from '../terciario-authorizer.service';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';
import type { DocenteXMateriaCarreraRepository } from '@educandow/domain';
import { DocenteXMateriaCarrera } from '@educandow/domain';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Factories ─────────────────────────────────────────────────────────────────

function makeAssignment(active = true): DocenteXMateriaCarrera {
  return DocenteXMateriaCarrera.reconstruct({
    id: 'dxmc-1',
    userId: 'user-1',
    materiaCarreraId: 'materia-1',
    anioAcademico: '2026',
    active,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRepo(overrides: Partial<DocenteXMateriaCarreraRepository> = {}): DocenteXMateriaCarreraRepository {
  return {
    findActiveAssignment: vi.fn().mockResolvedValue(null),
    findAny: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    listByMateria: vi.fn().mockResolvedValue([]),
    listByDocente: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeClient(overrides: Partial<{
  inscripcionMateria: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
}> = {}) {
  return {
    inscripcionMateria: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.inscripcionMateria,
    },
  };
}

describe('TerciarioAuthorizerService', () => {
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    client = makeClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(client as never);
  });

  // ── canWriteGrades ───────────────────────────────────────────────────────────

  describe('canWriteGrades', () => {
    it('Door 2: SECRETARIO role returns true without repo call (SPEC-3.A)', async () => {
      const repo = makeRepo();
      const svc = new TerciarioAuthorizerService(repo);

      const result = await svc.canWriteGrades('user-1', ['SECRETARIO'], 'insc-1');

      expect(result).toBe(true);
      expect(repo.findActiveAssignment).not.toHaveBeenCalled();
    });

    it('Door 2: DIRECTOR role returns true without repo call', async () => {
      const repo = makeRepo();
      const svc = new TerciarioAuthorizerService(repo);

      const result = await svc.canWriteGrades('user-1', ['DIRECTOR'], 'insc-1');
      expect(result).toBe(true);
      expect(repo.findActiveAssignment).not.toHaveBeenCalled();
    });

    it('Door 3: active assignment returns true (SPEC-3.B)', async () => {
      const repo = makeRepo({ findActiveAssignment: vi.fn().mockResolvedValue(makeAssignment()) });
      const svc = new TerciarioAuthorizerService(repo);
      client.inscripcionMateria.findUnique.mockResolvedValue({
        materiaCarreraId: 'materia-1',
        anioAcademico: '2026',
      });

      const result = await svc.canWriteGrades('user-1', ['TEACHER'], 'insc-1');
      expect(result).toBe(true);
    });

    it('Door 3: no assignment returns false (SPEC-3.C)', async () => {
      const repo = makeRepo({ findActiveAssignment: vi.fn().mockResolvedValue(null) });
      const svc = new TerciarioAuthorizerService(repo);
      client.inscripcionMateria.findUnique.mockResolvedValue({
        materiaCarreraId: 'materia-2',
        anioAcademico: '2026',
      });

      const result = await svc.canWriteGrades('user-1', ['TEACHER'], 'insc-2');
      expect(result).toBe(false);
    });

    it('Door 3: inactive row returns false (SPEC-3.D)', async () => {
      // inactive row → findActiveAssignment returns null (it filters active=true)
      const repo = makeRepo({ findActiveAssignment: vi.fn().mockResolvedValue(null) });
      const svc = new TerciarioAuthorizerService(repo);
      client.inscripcionMateria.findUnique.mockResolvedValue({
        materiaCarreraId: 'materia-1',
        anioAcademico: '2026',
      });

      const result = await svc.canWriteGrades('user-1', ['TEACHER'], 'insc-1');
      expect(result).toBe(false);
    });

    it('null tenant client returns false without throw (SPEC-8.A)', async () => {
      vi.mocked(TenantContext.getClient).mockReturnValue(null);
      const repo = makeRepo();
      const svc = new TerciarioAuthorizerService(repo);

      const result = await svc.canWriteGrades('user-1', ['TEACHER'], 'insc-1');
      expect(result).toBe(false);
      expect(repo.findActiveAssignment).not.toHaveBeenCalled();
    });

    it('missing inscripcion returns false (null-safety, SPEC-3.3)', async () => {
      const repo = makeRepo();
      const svc = new TerciarioAuthorizerService(repo);
      client.inscripcionMateria.findUnique.mockResolvedValue(null);

      const result = await svc.canWriteGrades('user-1', ['TEACHER'], 'nonexistent-insc');
      expect(result).toBe(false);
      expect(repo.findActiveAssignment).not.toHaveBeenCalled();
    });
  });

  // ── getAllowedStudentIds ──────────────────────────────────────────────────────

  describe('getAllowedStudentIds', () => {
    it('Door 2: SECRETARIO returns "all" without repo call', async () => {
      const repo = makeRepo();
      const svc = new TerciarioAuthorizerService(repo);

      const result = await svc.getAllowedStudentIds('user-1', ['SECRETARIO'], 'materia-1', '2026');
      expect(result).toBe('all');
      expect(repo.findActiveAssignment).not.toHaveBeenCalled();
    });

    it('Door 2: DIRECTOR returns "all" without repo call', async () => {
      const repo = makeRepo();
      const svc = new TerciarioAuthorizerService(repo);

      const result = await svc.getAllowedStudentIds('user-1', ['DIRECTOR'], 'materia-1', '2026');
      expect(result).toBe('all');
    });

    it('Door 3: assigned returns array of studentIds (SPEC-7.A)', async () => {
      const repo = makeRepo({ findActiveAssignment: vi.fn().mockResolvedValue(makeAssignment()) });
      const svc = new TerciarioAuthorizerService(repo);
      client.inscripcionMateria.findMany.mockResolvedValue([
        { studentId: 's1' },
        { studentId: 's2' },
      ]);

      const result = await svc.getAllowedStudentIds('user-1', ['TEACHER'], 'materia-1', '2026');
      expect(result).toEqual(['s1', 's2']);
    });

    it('Door 3: not assigned returns null (SPEC-7.B)', async () => {
      const repo = makeRepo({ findActiveAssignment: vi.fn().mockResolvedValue(null) });
      const svc = new TerciarioAuthorizerService(repo);

      const result = await svc.getAllowedStudentIds('user-1', ['TEACHER'], 'materia-1', '2026');
      expect(result).toBeNull();
    });

    it('null tenant client returns null (fail-closed)', async () => {
      vi.mocked(TenantContext.getClient).mockReturnValue(null);
      const repo = makeRepo();
      const svc = new TerciarioAuthorizerService(repo);

      const result = await svc.getAllowedStudentIds('user-1', ['TEACHER'], 'materia-1', '2026');
      expect(result).toBeNull();
    });
  });
});
