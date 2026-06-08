/**
 * T2.9.1 — CreateInstitutionUseCase cascade tests (RED → GREEN).
 * REQ-10 / ADR-03
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateInstitutionUseCase, CreateInstitutionInput } from '../institution.use-cases';

// ── Mocks ────────────────────────────────────────────────────

const mockRepo = {
  findById: vi.fn(),
  findAll: vi.fn(),
  findByCue: vi.fn(),
  findByDbName: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  softDelete: vi.fn(),
  existsByName: vi.fn(),
};

const mockAdminService = {
  createDatabase: vi.fn(),
  dropDatabase: vi.fn(),
  runTenantMigrations: vi.fn(),
};

const mockAdminUseCase = {
  execute: vi.fn(),
};

const mockEnsureTypes = {
  ensure: vi.fn(),
};

// ── Helpers ──────────────────────────────────────────────────

const validInput: CreateInstitutionInput = {
  name: 'Escuela Cascade',
  institution_levels: [
    { level: 'PRIMARIO', modality: 'COMUN' },
    { level: 'SECUNDARIO', modality: 'COMUN' },
  ],
  country: 'AR',
};

// ─────────────────────────────────────────────────────────────

describe('CreateInstitutionUseCase — cascade: EnsureAttendanceTypes', () => {
  let useCase: CreateInstitutionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepo.existsByName.mockResolvedValue(false);
    mockRepo.findByCue.mockResolvedValue(null);
    mockRepo.save.mockResolvedValue(undefined);
    mockRepo.delete.mockResolvedValue(undefined);
    mockAdminService.createDatabase.mockResolvedValue(undefined);
    mockAdminService.dropDatabase.mockResolvedValue(undefined);
    mockAdminService.runTenantMigrations.mockResolvedValue(undefined);
    mockEnsureTypes.ensure.mockResolvedValue(undefined);

    useCase = new CreateInstitutionUseCase(
      mockRepo as any,
      mockAdminService as any,
      mockAdminUseCase as any,
      mockEnsureTypes as any,
    );
  });

  it('calls ensureTypes.ensure with correct dbName after runTenantMigrations — REQ-10/Escenario 10.1', async () => {
    const result = await useCase.execute(validInput);

    expect(result.isOk()).toBe(true);
    expect(mockEnsureTypes.ensure).toHaveBeenCalledTimes(1);

    const [dbName, levels] = mockEnsureTypes.ensure.mock.calls[0];
    expect(dbName).toMatch(/^educandow_/);
    expect(levels).toContain(2); // PRIMARIO
    expect(levels).toContain(3); // SECUNDARIO
    expect(levels).toHaveLength(2);
  });

  it('does NOT call ensureTypes.ensure when institution has no levels — REQ-10/Escenario 10.2', async () => {
    // This path would return error because levels is required
    // Instead, test with a create that fails validation — ensure is never called
    const result = await useCase.execute({ name: 'No Levels', institution_levels: [] });

    // Should fail validation (no levels)
    expect(result.isErr()).toBe(true);
    expect(mockEnsureTypes.ensure).not.toHaveBeenCalled();
  });

  it('propagates error from ensureTypes.ensure into rollback — ADR-03', async () => {
    mockEnsureTypes.ensure.mockRejectedValue(new Error('Tenant DB unreachable'));

    const result = await useCase.execute(validInput);

    // The cascade runs inside the try block → error triggers rollback
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('Tenant DB unreachable');

    // Rollback: drop DB and delete master record
    expect(mockAdminService.dropDatabase).toHaveBeenCalled();
    expect(mockRepo.delete).toHaveBeenCalled();
  });

  it('deduplicated levels are passed to ensureTypes.ensure (no duplicates)', async () => {
    const result = await useCase.execute({
      name: 'Escuela Dup',
      institution_levels: [
        { level: 'PRIMARIO', modality: 'COMUN' },
        { level: 'PRIMARIO', modality: 'TALLERES' }, // same level, different modality
      ],
      country: 'AR',
    });

    expect(result.isOk()).toBe(true);
    const [, levels] = mockEnsureTypes.ensure.mock.calls[0];
    const unique = [...new Set(levels)];
    expect(levels).toHaveLength(unique.length); // no duplicates
    expect(levels).toContain(2); // PRIMARIO
  });
});
