import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListInstitutionsUseCase } from '../use-cases/institution.use-cases';
import { Institution } from '@educandow/domain';

function makeMockInst(id: string, name: string, dbName: string) {
  return {
    id: { get: () => id },
    name,
    dbName,
  } as unknown as Institution;
}

const mockRepo = {
  findAll: vi.fn(),
};

describe('ListInstitutionsUseCase — tenant filter', () => {
  let useCase: ListInstitutionsUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ListInstitutionsUseCase(mockRepo as any);
  });

  it('returns all institutions when no tenantId is provided', async () => {
    const all = [
      makeMockInst('id-1', 'Escuela A', 'educandow_id-1'),
      makeMockInst('id-2', 'Escuela B', 'educandow_id-2'),
      makeMockInst('id-3', 'Escuela C', 'educandow_id-3'),
    ];
    mockRepo.findAll.mockResolvedValue(all);

    const result = await useCase.execute();

    expect(result).toHaveLength(3);
    expect(result).toEqual(all);
  });

  it('filters to only the matching tenant institution', async () => {
    const all = [
      makeMockInst('id-1', 'Escuela A', 'educandow_id-1'),
      makeMockInst('id-2', 'Escuela B', 'educandow_id-2'),
    ];
    mockRepo.findAll.mockResolvedValue(all);

    const result = await useCase.execute('id-2');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Escuela B');
    expect(result[0].id.get()).toBe('id-2');
  });

  it('returns empty array when no institution matches tenantId', async () => {
    const all = [
      makeMockInst('id-1', 'Escuela A', 'educandow_id-1'),
    ];
    mockRepo.findAll.mockResolvedValue(all);

    const result = await useCase.execute('nonexistent-tenant');

    expect(result).toHaveLength(0);
  });
});
