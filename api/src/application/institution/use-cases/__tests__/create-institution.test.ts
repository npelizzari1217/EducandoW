import { describe, it, expect, beforeEach, vi } from 'vitest';
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

// ── Helpers ──────────────────────────────────────────────────

const validInput: CreateInstitutionInput = {
  name: 'Escuela Nueva',
  levels: ['INICIAL', 'PRIMARIO'],
  country: 'AR',
  header_color: '#1a56db',
  header_text_color: '#ffffff',
  body_text_color: '#333333',
  body_color: '#f8fafc',
  footer_color: '#1e293b',
  footer_text_color: '#ffffff',
};

const validInputWithEmail: CreateInstitutionInput = {
  ...validInput,
  admin_email: 'admin@school.edu',
};

// ── Tests ────────────────────────────────────────────────────

describe('CreateInstitutionUseCase — multi-tenant flow', () => {
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
    mockAdminUseCase.execute.mockResolvedValue({
      email: 'admin@school.edu',
      password: 'temp-pass-12345678',
    });

    useCase = new CreateInstitutionUseCase(
      mockRepo as any,
      mockAdminService as any,
      mockAdminUseCase as any,
    );
  });

  describe('happy path', () => {
    it('executes the full 4-step creation flow and returns admin credentials', async () => {
      const result = await useCase.execute(validInputWithEmail);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const output = result.unwrap();
        expect(output.institution.name).toBe('Escuela Nueva');
        expect(output.institution.dbName).toContain('educandow_');
        expect(output.admin).toBeDefined();
        expect(output.admin!.email).toBe('admin@school.edu');
      }

      // Verify step order: 1) save → 2) createDatabase → 3) runMigrations → 4) createAdmin
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockAdminService.createDatabase).toHaveBeenCalledTimes(1);
      expect(mockAdminService.runTenantMigrations).toHaveBeenCalledTimes(1);

      // Admin should be created only if admin_email was provided
      expect(mockAdminUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('skips admin creation when admin_email is not provided', async () => {
      const result = await useCase.execute(validInput);

      expect(result.isOk()).toBe(true);
      expect(mockAdminUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('rollback on DB creation failure', () => {
    it('drops nothing and deletes the master record', async () => {
      mockAdminService.createDatabase.mockRejectedValue(new Error('DB creation failed'));

      const result = await useCase.execute(validInputWithEmail);

      expect(result.isErr()).toBe(true);
      // Master record should be deleted
      expect(mockRepo.delete).toHaveBeenCalled();
      // No database was created, so nothing to drop
      expect(mockAdminService.dropDatabase).not.toHaveBeenCalled();
    });
  });

  describe('rollback on migration failure', () => {
    it('drops the tenant DB and deletes the master record', async () => {
      mockAdminService.runTenantMigrations.mockRejectedValue(new Error('Migration failed'));

      const result = await useCase.execute(validInputWithEmail);

      expect(result.isErr()).toBe(true);
      // DB was created, so it must be dropped
      expect(mockAdminService.dropDatabase).toHaveBeenCalled();
      // Master record must be deleted
      expect(mockRepo.delete).toHaveBeenCalled();
    });
  });

  describe('rollback on admin creation failure', () => {
    it('drops the tenant DB and deletes the master record', async () => {
      mockAdminUseCase.execute.mockRejectedValue(new Error('Admin creation failed'));

      const result = await useCase.execute(validInputWithEmail);

      expect(result.isErr()).toBe(true);
      // DB was created and migrations ran, so drop it
      expect(mockAdminService.dropDatabase).toHaveBeenCalled();
      // Master record must be deleted
      expect(mockRepo.delete).toHaveBeenCalled();
    });
  });

  describe('duplicate CUE rejection', () => {
    it('returns error without touching the database', async () => {
      mockRepo.findByCue.mockResolvedValue({ id: { get: () => 'existing' } });

      const result = await useCase.execute({
        ...validInput,
        cue: 'ABC123',
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('CUE');
      // No DB operations should happen
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(mockAdminService.createDatabase).not.toHaveBeenCalled();
    });
  });
});
