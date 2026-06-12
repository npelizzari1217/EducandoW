/**
 * DocenteXCicloService — application service tests (Fase 2)
 * Specs: DC-S3 (upsert idempotent), DC-S5, DC-S6, DC-S7, DC-S8
 */
import { describe, it, expect, vi } from 'vitest';
import { DocenteXCicloService } from '../docente-x-ciclo.service';
import type { DocenteXCicloRepository } from '@educandow/domain';
import { DocenteXCiclo } from '@educandow/domain';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeExistingRecord(userId = 'u-1', cycleId = 'c-1'): DocenteXCiclo {
  return DocenteXCiclo.reconstruct({
    id: 'existing-id',
    userId,
    cycleId,
    active: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  });
}

function makeRepo(existing: DocenteXCiclo | null = null): DocenteXCicloRepository {
  const created = DocenteXCiclo.reconstruct({
    id: 'new-id',
    userId: 'u-1',
    cycleId: 'c-1',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    findByCycleId: vi.fn().mockResolvedValue([]),
    findByUserAndCycle: vi.fn().mockResolvedValue(existing),
    upsert: vi.fn().mockResolvedValue(existing ?? created),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('DocenteXCicloService.getOrCreateForCycle', () => {
  // DC-S3: second assignment returns same record — no new id created
  it('returns existing record without creating a new one (DC-S3)', async () => {
    const existing = makeExistingRecord('u-1', 'c-1');
    const repo = makeRepo(existing);
    const service = new DocenteXCicloService(repo);

    const result = await service.getOrCreateForCycle('u-1', 'c-1');

    expect(result.id).toBe('existing-id');
    expect(repo.upsert).toHaveBeenCalledWith({ userId: 'u-1', cycleId: 'c-1' });
  });

  // DC-S1 / DC-S2: no existing record → upsert creates one
  it('calls upsert when no existing record found', async () => {
    const repo = makeRepo(null);
    const service = new DocenteXCicloService(repo);

    const result = await service.getOrCreateForCycle('u-2', 'c-2');

    expect(result).toBeDefined();
    expect(repo.upsert).toHaveBeenCalledWith({ userId: 'u-2', cycleId: 'c-2' });
  });

  // Idempotency: calling twice with same (userId, cycleId) calls upsert twice
  // but the repo guarantees no duplicate (the real repo uses @@unique constraint)
  it('is idempotent — repo.upsert called for each invocation', async () => {
    const existing = makeExistingRecord('u-1', 'c-1');
    const repo = makeRepo(existing);
    const service = new DocenteXCicloService(repo);

    const first = await service.getOrCreateForCycle('u-1', 'c-1');
    const second = await service.getOrCreateForCycle('u-1', 'c-1');

    expect(first.id).toBe(second.id);
    expect(repo.upsert).toHaveBeenCalledTimes(2);
  });
});

// F2-T2 / DC-S5: module check is application-layer concern; tested here as guard
describe('DocenteXCicloService — module guard helpers', () => {
  // DC-S5: User with GRADES module → canEnterGrades = true
  it('canEnterGrades returns true when user has GRADES module', () => {
    const service = new DocenteXCicloService(makeRepo());
    expect(service.canEnterGrades(['GRADES'])).toBe(true);
  });

  // DC-S6: User without GRADES module → canEnterGrades = false
  it('canEnterGrades returns false when user lacks GRADES module', () => {
    const service = new DocenteXCicloService(makeRepo());
    expect(service.canEnterGrades(['ATTENDANCE'])).toBe(false);
    expect(service.canEnterGrades([])).toBe(false);
  });

  // DC-S7: User with ATTENDANCE module → canRecordAttendance = true
  it('canRecordAttendance returns true when user has ATTENDANCE module', () => {
    const service = new DocenteXCicloService(makeRepo());
    expect(service.canRecordAttendance(['ATTENDANCE'])).toBe(true);
  });

  it('canRecordAttendance returns false when user lacks ATTENDANCE module', () => {
    const service = new DocenteXCicloService(makeRepo());
    expect(service.canRecordAttendance(['GRADES'])).toBe(false);
  });
});
