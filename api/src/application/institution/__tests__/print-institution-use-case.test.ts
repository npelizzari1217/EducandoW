import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrintInstitutionUseCase } from '../use-cases/institution.use-cases';
import { Institution } from '@educandow/domain';

function makeMockInst() {
  return {
    id: { get: () => 'inst-001' },
    name: 'Escuela Print',
    active: true,
    dbName: 'educandow_inst-001',
  } as unknown as Institution;
}

const mockRepo = {
  findById: vi.fn(),
};

describe('PrintInstitutionUseCase', () => {
  let useCase: PrintInstitutionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new PrintInstitutionUseCase(mockRepo as any);
  });

  it('returns print data for existing institution', async () => {
    const inst = makeMockInst();
    mockRepo.findById.mockResolvedValue(inst);

    const result = await useCase.execute('inst-001');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const data = result.unwrap();
      expect(data.name).toBe('Escuela Print');
      expect(data.printed_at).toBeDefined();
      expect(data.printed_at).toBeInstanceOf(Date);
      expect(data.printed_by).toBe('system');
    }
    expect(mockRepo.findById).toHaveBeenCalledWith('inst-001');
  });

  it('returns NotFoundError for non-existent institution', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('NOT_FOUND');
  });
});
