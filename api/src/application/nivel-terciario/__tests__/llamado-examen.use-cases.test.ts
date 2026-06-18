import { describe, it, expect, vi } from 'vitest';
import {
  LlamadoExamen,
  NotFoundError,
  InvalidLlamadoRangeError,
  LlamadoOverlapError,
} from '@educandow/domain';
import type { LlamadoExamenRepository } from '@educandow/domain';
import {
  CreateLlamadoExamenUC,
  UpdateLlamadoExamenUC,
  ListLlamadosExamenUC,
  DeleteLlamadoExamenUC,
} from '../use-cases/llamado-examen.use-cases';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLlamado(overrides: Partial<{
  nombre: string;
  anioAcademico: string;
  fechaInicio: Date;
  fechaFin: Date;
}> = {}) {
  return LlamadoExamen.create({
    nombre: 'Julio 2025',
    anioAcademico: '2025',
    fechaInicio: new Date('2025-07-01'),
    fechaFin: new Date('2025-07-15'),
    ...overrides,
  }).unwrap();
}

function makeRepo(overrides: Partial<LlamadoExamenRepository> = {}): LlamadoExamenRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByAnioAcademico: vi.fn().mockResolvedValue([]),
    findOverlapping: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    countAfter: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

// ── CreateLlamadoExamenUC ─────────────────────────────────────────────────────

describe('CreateLlamadoExamenUC', () => {
  it('1. Valid input → ok(LlamadoExamen), entity persisted', async () => {
    const repo = makeRepo();
    const uc = new CreateLlamadoExamenUC(repo);
    const result = await uc.execute({
      nombre: 'Julio 2025',
      anioAcademico: '2025',
      fechaInicio: new Date('2025-07-01'),
      fechaFin: new Date('2025-07-15'),
    });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeInstanceOf(LlamadoExamen);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('2. fechaInicio > fechaFin → err(InvalidLlamadoRangeError), no repo interaction', async () => {
    const repo = makeRepo();
    const uc = new CreateLlamadoExamenUC(repo);
    const result = await uc.execute({
      nombre: 'Bad Range',
      anioAcademico: '2025',
      fechaInicio: new Date('2025-07-15'),
      fechaFin: new Date('2025-07-01'),
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(InvalidLlamadoRangeError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('3. Overlapping active record in same anioAcademico → err(LlamadoOverlapError)', async () => {
    const existing = makeLlamado();
    const repo = makeRepo({ findOverlapping: vi.fn().mockResolvedValue([existing]) });
    const uc = new CreateLlamadoExamenUC(repo);
    const result = await uc.execute({
      nombre: 'Overlap',
      anioAcademico: '2025',
      fechaInicio: new Date('2025-07-10'),
      fechaFin: new Date('2025-07-20'),
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(LlamadoOverlapError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('4. Same dates as active record in a DIFFERENT anioAcademico → ok (no overlap)', async () => {
    const repo = makeRepo({ findOverlapping: vi.fn().mockResolvedValue([]) });
    const uc = new CreateLlamadoExamenUC(repo);
    const result = await uc.execute({
      nombre: 'Otro año',
      anioAcademico: '2026',
      fechaInicio: new Date('2025-07-01'),
      fechaFin: new Date('2025-07-15'),
    });
    expect(result.isOk()).toBe(true);
  });

  it('5. Same dates as soft-deleted record in same anioAcademico → ok', async () => {
    const repo = makeRepo({ findOverlapping: vi.fn().mockResolvedValue([]) });
    const uc = new CreateLlamadoExamenUC(repo);
    const result = await uc.execute({
      nombre: 'Reemplaza eliminado',
      anioAcademico: '2025',
      fechaInicio: new Date('2025-07-01'),
      fechaFin: new Date('2025-07-15'),
    });
    expect(result.isOk()).toBe(true);
  });
});

// ── UpdateLlamadoExamenUC ─────────────────────────────────────────────────────

describe('UpdateLlamadoExamenUC', () => {
  it('6. Unknown id → err(NotFoundError)', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const uc = new UpdateLlamadoExamenUC(repo);
    const result = await uc.execute('nonexistent', { nombre: 'X' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  it('7. id exists but deletedAt != null → err(NotFoundError)', async () => {
    const entity = makeLlamado();
    entity.softDelete();
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(entity) });
    const uc = new UpdateLlamadoExamenUC(repo);
    const result = await uc.execute(entity.id.get(), { nombre: 'X' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  it('8. Valid { nombre } update → ok(LlamadoExamen) with new nombre', async () => {
    const entity = makeLlamado();
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(entity) });
    const uc = new UpdateLlamadoExamenUC(repo);
    const result = await uc.execute(entity.id.get(), { nombre: 'Agosto 2025' });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().nombre).toBe('Agosto 2025');
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('9. fechaInicio > fechaFin on update → err(InvalidLlamadoRangeError)', async () => {
    const entity = makeLlamado();
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(entity) });
    const uc = new UpdateLlamadoExamenUC(repo);
    const result = await uc.execute(entity.id.get(), {
      fechaInicio: new Date('2025-08-01'),
      fechaFin: new Date('2025-07-01'),
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(InvalidLlamadoRangeError);
  });

  it('10. Overlap with a different active record → err(LlamadoOverlapError)', async () => {
    const entity = makeLlamado();
    const other = makeLlamado({ nombre: 'Otro', fechaInicio: new Date('2025-07-10'), fechaFin: new Date('2025-07-20') });
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(entity),
      findOverlapping: vi.fn().mockResolvedValue([other]),
    });
    const uc = new UpdateLlamadoExamenUC(repo);
    const result = await uc.execute(entity.id.get(), { fechaFin: new Date('2025-07-20') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(LlamadoOverlapError);
  });

  it('11. Self-exclusion: extend own fechaFin with no other records → ok', async () => {
    const entity = makeLlamado();
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(entity),
      findOverlapping: vi.fn().mockResolvedValue([]),
    });
    const uc = new UpdateLlamadoExamenUC(repo);
    const result = await uc.execute(entity.id.get(), { fechaFin: new Date('2025-07-31') });
    expect(result.isOk()).toBe(true);
  });
});

// ── ListLlamadosExamenUC ──────────────────────────────────────────────────────

describe('ListLlamadosExamenUC', () => {
  it('12. Returns only active records for given anioAcademico, sorted fechaInicio ASC', async () => {
    const e1 = makeLlamado({ nombre: 'Julio', fechaInicio: new Date('2025-07-01'), fechaFin: new Date('2025-07-15') });
    const e2 = makeLlamado({ nombre: 'Agosto', fechaInicio: new Date('2025-08-01'), fechaFin: new Date('2025-08-15') });
    const repo = makeRepo({ findByAnioAcademico: vi.fn().mockResolvedValue([e1, e2]) });
    const uc = new ListLlamadosExamenUC(repo);
    const result = await uc.execute('2025');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(2);
    expect(repo.findByAnioAcademico).toHaveBeenCalledWith('2025');
  });

  it('13. Empty year → ok([]) with empty array', async () => {
    const repo = makeRepo({ findByAnioAcademico: vi.fn().mockResolvedValue([]) });
    const uc = new ListLlamadosExamenUC(repo);
    const result = await uc.execute('2030');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
  });

  it('14. Soft-deleted records excluded from result (repo responsibility, returns active only)', async () => {
    const active1 = makeLlamado({ nombre: 'A1' });
    const active2 = makeLlamado({ nombre: 'A2', fechaInicio: new Date('2025-08-01'), fechaFin: new Date('2025-08-15') });
    const repo = makeRepo({ findByAnioAcademico: vi.fn().mockResolvedValue([active1, active2]) });
    const uc = new ListLlamadosExamenUC(repo);
    const result = await uc.execute('2025');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(2);
  });
});

// ── DeleteLlamadoExamenUC ─────────────────────────────────────────────────────

describe('DeleteLlamadoExamenUC', () => {
  it('15. Active record → ok(void), entity has active=false and deletedAt set', async () => {
    const entity = makeLlamado();
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(entity) });
    const uc = new DeleteLlamadoExamenUC(repo);
    const result = await uc.execute(entity.id.get());
    expect(result.isOk()).toBe(true);
    expect(entity.active).toBe(false);
    expect(entity.deletedAt).toBeInstanceOf(Date);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('16. Unknown id → err(NotFoundError)', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const uc = new DeleteLlamadoExamenUC(repo);
    const result = await uc.execute('nonexistent');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  it('17. Already soft-deleted record → err(NotFoundError)', async () => {
    const entity = makeLlamado();
    entity.softDelete();
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(entity) });
    const uc = new DeleteLlamadoExamenUC(repo);
    const result = await uc.execute(entity.id.get());
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });
});

// ── Boundary test ─────────────────────────────────────────────────────────────

describe('Boundary: adjacent dates must NOT overlap', () => {
  it('18. Existing [2025-07-01, 2025-07-15]; create [2025-07-16, 2025-07-31] → ok', async () => {
    const repo = makeRepo({ findOverlapping: vi.fn().mockResolvedValue([]) });
    const uc = new CreateLlamadoExamenUC(repo);
    const result = await uc.execute({
      nombre: 'Agosto Adjacent',
      anioAcademico: '2025',
      fechaInicio: new Date('2025-07-16'),
      fechaFin: new Date('2025-07-31'),
    });
    expect(result.isOk()).toBe(true);
  });
});
