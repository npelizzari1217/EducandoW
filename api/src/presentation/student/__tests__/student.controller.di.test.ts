import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { StudentController } from '../student.controller';
import { AuthGuard } from '../../../infrastructure/auth/guards/auth.guard';
import {
  CreateStudentUseCase, ListStudentsUseCase, GetStudentUseCase, DeleteStudentUseCase,
  PatchStudentUseCase, GetMyStudentDataUseCase, GetMyChildrenUseCase,
  AssignGuardianUseCase, RemoveGuardianUseCase, ListGuardiansUseCase,
  CreateStudyTutorUseCase, UpdateStudyTutorUseCase,
} from '../../../application/student/use-cases/student.use-cases';

// Los 12 UC tipados-por-clase (el orden no importa para providers).
const CLASS_UCS = [
  CreateStudentUseCase, ListStudentsUseCase, GetStudentUseCase, DeleteStudentUseCase,
  PatchStudentUseCase, GetMyStudentDataUseCase, GetMyChildrenUseCase,
  AssignGuardianUseCase, RemoveGuardianUseCase, ListGuardiansUseCase,
  CreateStudyTutorUseCase, UpdateStudyTutorUseCase,
] as const;

// Nombres de campo en el constructor, para afirmar que ninguno quedó undefined.
const FIELDS = [
  'createUC', 'listUC', 'getUC', 'deleteUC', 'patchUC', 'myDataUC', 'myChildrenUC',
  'assignGuardianUC', 'removeGuardianUC', 'listGuardiansUC', 'createStudyTutorUC', 'updateStudyTutorUC',
] as const;

describe('StudentController — DI implícita (guard VSM-R5)', () => {
  it('resuelve los 12 use-cases tipados-por-clase, ninguno undefined', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [StudentController],
      providers: [
        ...CLASS_UCS.map((UC) => ({ provide: UC, useValue: { execute: () => {} } })),
        { provide: 'StudentRepository', useValue: { search: () => [] } },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const ctrl = moduleRef.get(StudentController);
    for (const field of FIELDS) {
      expect((ctrl as any)[field], `${field} debe resolver`).toBeDefined();
    }
  });
});
