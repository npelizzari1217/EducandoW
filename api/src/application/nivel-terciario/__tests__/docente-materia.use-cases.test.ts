/**
 * T-15 [RED] — Admin assignment use-cases tests.
 * Mock DocenteXMateriaCarreraRepository; no real DB.
 */
import { describe, it, expect, vi } from 'vitest';
import { DocenteXMateriaCarrera } from '@educandow/domain';
import type { DocenteXMateriaCarreraRepository } from '@educandow/domain';
import {
  AssignDocenteMateriaUC,
  ListAssignmentsUC,
  UnassignDocenteMateriaUC,
} from '../use-cases/docente-materia.use-cases';

// ── Factories ─────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ['SECRETARIO'];
const TEACHER_ROLES = ['TEACHER'];

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

// ── AssignDocenteMateriaUC ────────────────────────────────────────────────────

describe('AssignDocenteMateriaUC', () => {
  const input = { userId: 'user-1', materiaCarreraId: 'materia-1', anioAcademico: '2026' };

  it('Non-admin → Err(FORBIDDEN) (SPEC-4.1 / 4.B)', async () => {
    const repo = makeRepo();
    const uc = new AssignDocenteMateriaUC(repo);

    const result = await uc.execute(TEACHER_ROLES, input);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('FORBIDDEN');
    expect(repo.findAny).not.toHaveBeenCalled();
  });

  it('Admin, no existing row → creates entity and saves (SPEC-4.A)', async () => {
    const repo = makeRepo({ findAny: vi.fn().mockResolvedValue(null) });
    const uc = new AssignDocenteMateriaUC(repo);

    const result = await uc.execute(ADMIN_ROLES, input);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeInstanceOf(DocenteXMateriaCarrera);
    expect(result.unwrap().active).toBe(true);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('Admin, existing active row → Err(DOCENTE_ALREADY_ASSIGNED) 409 (SPEC-1.B / 4.2)', async () => {
    const existing = makeAssignment(true);
    const repo = makeRepo({ findAny: vi.fn().mockResolvedValue(existing) });
    const uc = new AssignDocenteMateriaUC(repo);

    const result = await uc.execute(ADMIN_ROLES, input);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('DOCENTE_ALREADY_ASSIGNED');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('Admin, existing inactive row → reactivates and saves (ADR-2)', async () => {
    const existing = makeAssignment(false);
    const reactivateSpy = vi.spyOn(existing, 'reactivate');
    const repo = makeRepo({ findAny: vi.fn().mockResolvedValue(existing) });
    const uc = new AssignDocenteMateriaUC(repo);

    const result = await uc.execute(ADMIN_ROLES, input);

    expect(result.isOk()).toBe(true);
    expect(reactivateSpy).toHaveBeenCalledOnce();
    expect(repo.save).toHaveBeenCalledWith(existing);
    expect(result.unwrap().active).toBe(true);
  });
});

// ── ListAssignmentsUC ─────────────────────────────────────────────────────────

describe('ListAssignmentsUC', () => {
  it('Non-admin → Err(FORBIDDEN)', async () => {
    const repo = makeRepo();
    const uc = new ListAssignmentsUC(repo);

    const result = await uc.execute(TEACHER_ROLES, { materiaCarreraId: 'materia-1' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('FORBIDDEN');
  });

  it('Admin, materiaCarreraId supplied → calls listByMateria (SPEC-4.3)', async () => {
    const assignment = makeAssignment();
    const repo = makeRepo({ listByMateria: vi.fn().mockResolvedValue([assignment]) });
    const uc = new ListAssignmentsUC(repo);

    const result = await uc.execute(ADMIN_ROLES, { materiaCarreraId: 'materia-1' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(repo.listByMateria).toHaveBeenCalledWith('materia-1', undefined);
  });

  it('Admin, materiaCarreraId + anioAcademico → passes both to listByMateria (SPEC-4.3 filter)', async () => {
    const repo = makeRepo({ listByMateria: vi.fn().mockResolvedValue([]) });
    const uc = new ListAssignmentsUC(repo);

    await uc.execute(ADMIN_ROLES, { materiaCarreraId: 'materia-1', anioAcademico: '2026' });

    expect(repo.listByMateria).toHaveBeenCalledWith('materia-1', '2026');
  });

  it('Admin, userId supplied → calls listByDocente (SPEC-4.4)', async () => {
    const assignment = makeAssignment();
    const repo = makeRepo({ listByDocente: vi.fn().mockResolvedValue([assignment]) });
    const uc = new ListAssignmentsUC(repo);

    const result = await uc.execute(ADMIN_ROLES, { userId: 'user-1' });

    expect(result.isOk()).toBe(true);
    expect(repo.listByDocente).toHaveBeenCalledWith('user-1');
  });

  it('Result contains only active rows (returned by repo SPEC-4.C)', async () => {
    const active = makeAssignment(true);
    const repo = makeRepo({ listByMateria: vi.fn().mockResolvedValue([active]) });
    const uc = new ListAssignmentsUC(repo);

    const result = await uc.execute(ADMIN_ROLES, { materiaCarreraId: 'materia-1' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().every(a => a.active)).toBe(true);
  });
});

// ── UnassignDocenteMateriaUC ─────────────────────────────────────────────────

describe('UnassignDocenteMateriaUC', () => {
  it('Non-admin → Err(FORBIDDEN)', async () => {
    const repo = makeRepo();
    const uc = new UnassignDocenteMateriaUC(repo);

    const result = await uc.execute(TEACHER_ROLES, 'dxmc-1');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('FORBIDDEN');
  });

  it('Row not found → Err(NOT_FOUND) 404 (SPEC-4.5)', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const uc = new UnassignDocenteMateriaUC(repo);

    const result = await uc.execute(ADMIN_ROLES, 'dxmc-999');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('NOT_FOUND');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('Row already inactive → Err(ASSIGNMENT_ALREADY_INACTIVE) 409 (SPEC-4.E)', async () => {
    const inactive = makeAssignment(false);
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(inactive) });
    const uc = new UnassignDocenteMateriaUC(repo);

    const result = await uc.execute(ADMIN_ROLES, 'dxmc-1');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('ASSIGNMENT_ALREADY_INACTIVE');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('Active row → calls unassign + save, returns ok (SPEC-4.D)', async () => {
    const active = makeAssignment(true);
    const unassignSpy = vi.spyOn(active, 'unassign');
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(active) });
    const uc = new UnassignDocenteMateriaUC(repo);

    const result = await uc.execute(ADMIN_ROLES, 'dxmc-1');

    expect(result.isOk()).toBe(true);
    expect(unassignSpy).toHaveBeenCalledOnce();
    expect(repo.save).toHaveBeenCalledWith(active);
  });
});
