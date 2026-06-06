import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CreateAcademicCycleUC,
  UpdateAcademicCycleUC,
  DeleteAcademicCycleUC,
  ToggleAcademicCycleActiveUC,
  GetAcademicCycleUC,
  ListAcademicCyclesUC,
} from '../use-cases/pedagogy.use-cases';
import {
  AcademicCycle,
  CycleCode,
  CycleCodeAlreadyExistsError,
  AcademicCycleNotFoundError,
  ValidationError,
  EducationalLevel,
  EducationalLevelCode,
  EducationalModality,
  EducationalModalityCode,
} from '@educandow/domain';

// Mock AcademicCycleRepository
const mockRepo = {
  findById: vi.fn(),
  findByUuid: vi.fn(),
  findByCode: vi.fn(),
  findActive: vi.fn(),
  findAll: vi.fn(),
  save: vi.fn(),
  softDelete: vi.fn(),
};

function makeCycle(overrides?: Record<string, unknown>) {
  return AcademicCycle.create({
    name: 'Ciclo 2026',
    level: EducationalLevel.fromCode(EducationalLevelCode.PRIMARIO),
    modality: EducationalModality.fromCode(EducationalModalityCode.COMUN),
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-12-20'),
    code: CycleCode.create('2026').unwrap(),
    ...overrides,
  });
}

describe('CreateAcademicCycleUC', () => {
  let uc: CreateAcademicCycleUC;

  beforeEach(() => {
    vi.clearAllMocks();
    uc = new CreateAcademicCycleUC(mockRepo as any);
  });

  it('creates a cycle when code is unique', async () => {
    mockRepo.findByCode.mockResolvedValue(null);

    const result = await uc.execute({
      name: 'Ciclo 2026',
      level: 2,
      startDate: '2026-03-01',
      endDate: '2026-12-20',
      code: '2026',
    });

    expect(result.isOk()).toBe(true);
    const cycle = result.unwrap();
    expect(cycle.name).toBe('Ciclo 2026');
    expect(cycle.code.get()).toBe('2026');
    expect(cycle.active).toBe(true);
    expect(cycle.uuid).toBeDefined();
    expect(mockRepo.findByCode).toHaveBeenCalledWith('2026');
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('rejects duplicate code', async () => {
    mockRepo.findByCode.mockResolvedValue(makeCycle());

    const result = await uc.execute({
      name: 'Ciclo 2026',
      level: 2,
      startDate: '2026-03-01',
      endDate: '2026-12-20',
      code: '2026',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(CycleCodeAlreadyExistsError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('rejects invalid code format', async () => {
    mockRepo.findByCode.mockResolvedValue(null);

    const result = await uc.execute({
      name: 'Ciclo 2026',
      level: 2,
      startDate: '2026-03-01',
      endDate: '2026-12-20',
      code: '',
    });

    expect(result.isErr()).toBe(true);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('creates cycle with all optional fields including bimonths', async () => {
    mockRepo.findByCode.mockResolvedValue(null);

    const result = await uc.execute({
      name: 'Ciclo Completo',
      level: 3,
      startDate: '2026-03-01',
      endDate: '2026-12-20',
      code: 'CICLO-2027-A',
      firstBimonthStart: '2026-03-01',
      firstBimonthEnd: '2026-04-30',
      secondBimonthStart: '2026-05-01',
      secondBimonthEnd: '2026-06-30',
      thirdBimonthStart: '2026-07-01',
      thirdBimonthEnd: '2026-08-31',
      fourthBimonthStart: '2026-09-01',
      fourthBimonthEnd: '2026-10-31',
    });

    expect(result.isOk()).toBe(true);
    const cycle = result.unwrap();
    expect(cycle.firstBimonth).toBeDefined();
    expect(cycle.firstBimonth!.start).toEqual(new Date('2026-03-01'));
  });
});

describe('UpdateAcademicCycleUC', () => {
  let uc: UpdateAcademicCycleUC;

  beforeEach(() => {
    vi.clearAllMocks();
    uc = new UpdateAcademicCycleUC(mockRepo as any);
  });

  it('updates name', async () => {
    const existing = makeCycle();
    mockRepo.findByUuid.mockResolvedValue(existing);

    const result = await uc.execute(existing.uuid, {
      name: 'Updated Name',
    });

    expect(result.isOk()).toBe(true);
    const cycle = result.unwrap();
    expect(cycle.name).toBe('Updated Name');
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('rejects update with invalid code', async () => {
    const existing = makeCycle();
    mockRepo.findByUuid.mockResolvedValue(existing);

    const result = await uc.execute(existing.uuid, {
      code: '',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  it('returns not found for non-existent uuid', async () => {
    mockRepo.findByUuid.mockResolvedValue(null);

    const result = await uc.execute('bad-uuid', { name: 'Test' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(AcademicCycleNotFoundError);
  });
});

describe('DeleteAcademicCycleUC', () => {
  let uc: DeleteAcademicCycleUC;

  beforeEach(() => {
    vi.clearAllMocks();
    uc = new DeleteAcademicCycleUC(mockRepo as any);
  });

  it('soft deletes an existing cycle', async () => {
    const existing = makeCycle();
    mockRepo.findByUuid.mockResolvedValue(existing);

    await uc.execute(existing.uuid);

    expect(mockRepo.softDelete).toHaveBeenCalledWith(existing.uuid);
  });

  it('throws on non-existent cycle', async () => {
    mockRepo.findByUuid.mockResolvedValue(null);

    await expect(uc.execute('bad-uuid')).rejects.toBeInstanceOf(AcademicCycleNotFoundError);
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });
});

describe('ToggleAcademicCycleActiveUC', () => {
  let uc: ToggleAcademicCycleActiveUC;

  beforeEach(() => {
    vi.clearAllMocks();
    uc = new ToggleAcademicCycleActiveUC(mockRepo as any);
  });

  it('toggles active from true to false', async () => {
    const existing = makeCycle();
    mockRepo.findByUuid.mockResolvedValue(existing);

    const result = await uc.execute(existing.uuid);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().active).toBe(false);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('toggles active from false to true', async () => {
    const existing = AcademicCycle.reconstruct({
      numericId: 1,
      uuid: 'abc-123',
      code: CycleCode.reconstruct('2026'),
      name: 'Test',
      level: EducationalLevel.fromCode(EducationalLevelCode.PRIMARIO),
      modality: EducationalModality.fromCode(EducationalModalityCode.COMUN),
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-12-20'),
      active: false,
      deletedAt: null,
      firstBimonth: null,
      secondBimonth: null,
      thirdBimonth: null,
      fourthBimonth: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRepo.findByUuid.mockResolvedValue(existing);

    const result = await uc.execute(existing.uuid);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().active).toBe(true);
  });
});

describe('GetAcademicCycleUC', () => {
  let uc: GetAcademicCycleUC;

  beforeEach(() => {
    vi.clearAllMocks();
    uc = new GetAcademicCycleUC(mockRepo as any);
  });

  it('returns cycle by uuid', async () => {
    const existing = makeCycle();
    mockRepo.findByUuid.mockResolvedValue(existing);

    const result = await uc.execute(existing.uuid);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().uuid).toBe(existing.uuid);
  });

  it('returns not found for bad uuid', async () => {
    mockRepo.findByUuid.mockResolvedValue(null);
    const result = await uc.execute('bad-uuid');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(AcademicCycleNotFoundError);
  });
});

describe('ListAcademicCyclesUC', () => {
  let uc: ListAcademicCyclesUC;

  beforeEach(() => {
    vi.clearAllMocks();
    uc = new ListAcademicCyclesUC(mockRepo as any);
  });

  it('lists with filters and pagination', async () => {
    mockRepo.findAll.mockResolvedValue({
      data: [makeCycle()],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    const result = await uc.execute({ level: 2, active: true, page: 1, pageSize: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockRepo.findAll).toHaveBeenCalledWith({ level: 2, active: true, page: 1, pageSize: 20 });
  });
});
