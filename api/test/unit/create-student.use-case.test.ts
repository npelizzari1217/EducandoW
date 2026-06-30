import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateStudentUseCase } from '../../src/application/student/use-cases/student.use-cases';
import { StudentRepository } from '@educandow/domain';

describe('CreateStudentUseCase', () => {
  let useCase: CreateStudentUseCase;
  let studentRepo: StudentRepository;

  beforeEach(() => {
    studentRepo = {
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findByGuardianUserId: vi.fn(),
      findByInstitution: vi.fn(),
      findByDni: vi.fn().mockResolvedValue(null),
      search: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      setFechaDePase: vi.fn().mockResolvedValue(undefined),
    };
    useCase = new CreateStudentUseCase(studentRepo);
  });

  // Bug 3 RED: fatherEmail passed in input must be persisted on the created student
  it('(Bug3) creates student with fatherEmail persisted', async () => {
    const result = await useCase.execute({
      firstName: 'Juan',
      lastName: 'Pérez',
      dni: '12345678',
      fatherEmail: 'padre@example.com',
      institutionId: '11111111-1111-1111-1111-111111111111',
    });

    expect(result.isOk()).toBe(true);
    const student = result.unwrap();
    expect(student.fatherEmail?.get()).toBe('padre@example.com');
    expect(studentRepo.save).toHaveBeenCalledWith(student);
  });

  // Bug 3 RED: motherEmail passed in input must be persisted on the created student
  it('(Bug3) creates student with motherEmail persisted', async () => {
    const result = await useCase.execute({
      firstName: 'Juan',
      lastName: 'Pérez',
      dni: '12345678',
      motherEmail: 'madre@example.com',
      institutionId: '11111111-1111-1111-1111-111111111111',
    });

    expect(result.isOk()).toBe(true);
    const student = result.unwrap();
    expect(student.motherEmail?.get()).toBe('madre@example.com');
  });

  // Bug 3: invalid fatherEmail format → validation error returned
  it('(Bug3) invalid fatherEmail format returns validation error', async () => {
    const result = await useCase.execute({
      firstName: 'Juan',
      lastName: 'Pérez',
      dni: '12345678',
      fatherEmail: 'not-an-email',
      institutionId: '11111111-1111-1111-1111-111111111111',
    });

    expect(result.isErr()).toBe(true);
    expect(studentRepo.save).not.toHaveBeenCalled();
  });

  // Baseline: no email → student created without fatherEmail
  it('creates student without fatherEmail when not provided', async () => {
    const result = await useCase.execute({
      firstName: 'Juan',
      lastName: 'Pérez',
      dni: '12345678',
      institutionId: '11111111-1111-1111-1111-111111111111',
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().fatherEmail).toBeUndefined();
  });
});
