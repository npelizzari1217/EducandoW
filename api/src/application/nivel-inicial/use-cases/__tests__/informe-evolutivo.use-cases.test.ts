import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationError, NotFoundError, InformeEvolutivo, Periodo, Id } from '@educandow/domain';
import type { InformeRepository } from '@educandow/domain';
import {
  CreateInformeUseCase,
  GetInformeUseCase,
  ListInformesUseCase,
  UpdateInformeUseCase,
} from '../informe-evolutivo.use-cases';

// ── Mock factory ──────────────────────────────────────────────────────────────

function mockInformeRepo(overrides: Partial<InformeRepository> = {}): InformeRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

/** Creates a minimal InformeEvolutivo for use in test doubles. */
function makeInforme(overrides: { periodo?: string; observacionesGenerales?: string } = {}): InformeEvolutivo {
  return InformeEvolutivo.reconstruct({
    id: Id.reconstruct('informe-test-id'),
    studentId: 'stu-1',
    salaId: 'sala-1',
    periodo: Periodo.reconstruct(overrides.periodo ?? '1T'),
    fecha: new Date('2026-05-01'),
    observacionesGenerales: overrides.observacionesGenerales,
    areas: [
      { id: 'area-1', informeId: 'informe-test-id', area: 'COGNITIVA', observacion: 'Avanzó bien', valoracion: 'LOGRADO' },
    ],
  });
}

// ── CreateInformeUseCase ──────────────────────────────────────────────────────

describe('CreateInformeUseCase', () => {
  let repo: InformeRepository;
  let uc: CreateInformeUseCase;

  beforeEach(() => {
    repo = mockInformeRepo();
    uc = new CreateInformeUseCase(repo);
  });

  it('persists via repo.save and returns Ok(InformeEvolutivo) with correct fields', async () => {
    const result = await uc.execute({
      studentId: 'stu-1',
      salaId: 'sala-1',
      periodo: '1T',
      fecha: '2026-05-01',
      observacionesGenerales: 'Buena integración grupal',
      areas: [
        { id: 'a-1', informeId: '', area: 'SOCIO_AFECTIVA', observacion: 'Muestra empatía', valoracion: 'DESTACADO' },
      ],
    });

    expect(result.isOk()).toBe(true);
    const informe = result.unwrap();
    expect(informe.studentId).toBe('stu-1');
    expect(informe.salaId).toBe('sala-1');
    expect(informe.periodo.get()).toBe('1T');
    expect(informe.observacionesGenerales).toBe('Buena integración grupal');
    expect(repo.save).toHaveBeenCalledOnce();
    expect(repo.save).toHaveBeenCalledWith(informe);
  });

  it('returns Err(ValidationError) for invalid periodo "4T" without calling repo.save', async () => {
    const result = await uc.execute({
      studentId: 'stu-1',
      salaId: 'sala-1',
      periodo: '4T',
      fecha: '2026-05-01',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(result.unwrapErr().message).toContain('1T, 2T, or 3T');
    expect(repo.save).not.toHaveBeenCalled();
  });
});

// ── GetInformeUseCase ─────────────────────────────────────────────────────────

describe('GetInformeUseCase', () => {
  let repo: InformeRepository;
  let uc: GetInformeUseCase;

  beforeEach(() => {
    repo = mockInformeRepo();
    uc = new GetInformeUseCase(repo);
  });

  it('returns Ok(informe) when findById resolves to an entity', async () => {
    const informe = makeInforme();
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(informe);

    const result = await uc.execute('informe-test-id');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(informe);
    expect(repo.findById).toHaveBeenCalledWith('informe-test-id');
  });

  it('returns Err(NotFoundError) with the id in the message when findById returns null', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await uc.execute('nonexistent-id');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    expect(result.unwrapErr().message).toContain('nonexistent-id');
  });
});

// ── ListInformesUseCase ───────────────────────────────────────────────────────

describe('ListInformesUseCase', () => {
  let repo: InformeRepository;
  let uc: ListInformesUseCase;

  beforeEach(() => {
    repo = mockInformeRepo();
    uc = new ListInformesUseCase(repo);
  });

  it('calls findAll with the passed filters and returns Ok([...])', async () => {
    const informe1 = makeInforme({ periodo: '1T' });
    const informe2 = makeInforme({ periodo: '2T' });
    (repo.findAll as ReturnType<typeof vi.fn>).mockResolvedValue([informe1, informe2]);

    const filters = { studentId: 'stu-1', salaId: 'sala-1' };
    const result = await uc.execute(filters);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(2);
    expect(repo.findAll).toHaveBeenCalledWith(filters);
  });

  it('returns Ok([]) when no informes match', async () => {
    const result = await uc.execute({ studentId: 'stu-none' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
  });
});

// ── UpdateInformeUseCase ──────────────────────────────────────────────────────

describe('UpdateInformeUseCase', () => {
  let repo: InformeRepository;
  let uc: UpdateInformeUseCase;
  let existing: InformeEvolutivo;

  beforeEach(() => {
    existing = makeInforme({ periodo: '1T', observacionesGenerales: 'Observación inicial' });
    repo = mockInformeRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    uc = new UpdateInformeUseCase(repo);
  });

  it('calls repo.save with updated entity and returns Ok(updated) with merged fields', async () => {
    const result = await uc.execute('informe-test-id', {
      periodo: '2T',
      observacionesGenerales: 'Nueva observación',
    });

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    expect(updated.periodo.get()).toBe('2T');
    expect(updated.observacionesGenerales).toBe('Nueva observación');
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('returns Err(NotFoundError) when the informe does not exist and does NOT call repo.save', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await uc.execute('missing-id', { periodo: '2T' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('partial update (only observacionesGenerales) preserves other fields from existing', async () => {
    const result = await uc.execute('informe-test-id', {
      observacionesGenerales: 'Solo actualizo esto',
    });

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    // periodo NOT in update → preserved from existing
    expect(updated.periodo.get()).toBe('1T');
    expect(updated.studentId).toBe(existing.studentId);
    expect(updated.salaId).toBe(existing.salaId);
    expect(updated.observacionesGenerales).toBe('Solo actualizo esto');
    expect(repo.save).toHaveBeenCalledOnce();
  });
});
