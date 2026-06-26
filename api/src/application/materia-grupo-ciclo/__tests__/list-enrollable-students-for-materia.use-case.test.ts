/**
 * ListEnrollableStudentsForMateriaUseCase — unit tests (TDD, T2.7)
 * Spec: D5, enables MGC-R9 for empty optativas
 * Design: D5
 */
import { describe, it, expect, vi } from 'vitest';
import { ListEnrollableStudentsForMateriaUseCase } from '../list-enrollable-students-for-materia.use-case';
import type {
  MateriaXCursoXCicloRepository,
  AlumnosXMateriaRepository,
  AlumnosXCursoXCicloRepository,
  AlumnoCursoCicloEnriched,
} from '@educandow/domain';
import { MateriaXCursoXCiclo, MateriasXAlumnoXCursoXCiclo, NotFoundError } from '@educandow/domain';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeMateria(id = 'mxcc-1', courseCycleId = 'cc-1'): MateriaXCursoXCiclo {
  return MateriaXCursoXCiclo.reconstruct({
    id,
    courseCycleId,
    subjectId: 'sub-1',
    esOptativa: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeCCStudent(id: string, studentId: string, studentName: string): AlumnoCursoCicloEnriched {
  return { id, studentId, studentName, printable: false, fechaDePase: null };
}

function makeEnrolledRow(id: string, materiaId: string, studentId: string): MateriasXAlumnoXCursoXCiclo {
  return MateriasXAlumnoXCursoXCiclo.reconstruct({
    id,
    materiaXCursoXCicloId: materiaId,
    studentId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeMateriaRepo(materia: MateriaXCursoXCiclo | null): MateriaXCursoXCicloRepository {
  return {
    findById: vi.fn().mockResolvedValue(materia),
    findByCourseCycleId: vi.fn().mockResolvedValue([]),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    updateDescription: vi.fn(),
    setEsOptativa: vi.fn(),
  };
}

function makeAlumnosXMateriaRepo(enrolled: MateriasXAlumnoXCursoXCiclo[] = []): AlumnosXMateriaRepository {
  return {
    findByMateria: vi.fn().mockResolvedValue(enrolled),
    findById: vi.fn().mockResolvedValue(null),
    addStudent: vi.fn(),
    isMember: vi.fn().mockResolvedValue(false),
    upsertMany: vi.fn().mockResolvedValue({ count: 0 }),
    findByMateriaEnriched: vi.fn().mockResolvedValue([]),
    removeStudent: vi.fn().mockResolvedValue(undefined),
  };
}

function makeAlumnosCCRepo(ccStudents: AlumnoCursoCicloEnriched[] = []): AlumnosXCursoXCicloRepository {
  return {
    findByCourseCycle: vi.fn().mockResolvedValue([]),
    findByCourseCycleEnriched: vi.fn().mockResolvedValue(ccStudents),
    findById: vi.fn().mockResolvedValue(null),
    addStudent: vi.fn(),
    isMember: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(undefined),
    setPrintable: vi.fn(),
    setPrintableBulk: vi.fn().mockResolvedValue(undefined),
    findByStudentEnriched: vi.fn().mockResolvedValue([]),
  };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('ListEnrollableStudentsForMateriaUseCase', () => {
  it('materia not found → throws NotFoundError', async () => {
    const uc = new ListEnrollableStudentsForMateriaUseCase(
      makeMateriaRepo(null),
      makeAlumnosXMateriaRepo(),
      makeAlumnosCCRepo(),
    );

    await expect(
      uc.execute({ materiaXCursoXCicloId: 'non-existent' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns CC students minus already-enrolled (set diff on studentId)', async () => {
    const materia = makeMateria('mxcc-1', 'cc-1');
    const ccStudents = [
      makeCCStudent('axcc-1', 's-1', 'Ana García'),
      makeCCStudent('axcc-2', 's-2', 'Carlos López'),
      makeCCStudent('axcc-3', 's-3', 'María Rodríguez'),
    ];
    const enrolled = [makeEnrolledRow('axm-1', 'mxcc-1', 's-2')]; // s-2 already enrolled

    const uc = new ListEnrollableStudentsForMateriaUseCase(
      makeMateriaRepo(materia),
      makeAlumnosXMateriaRepo(enrolled),
      makeAlumnosCCRepo(ccStudents),
    );

    const result = await uc.execute({ materiaXCursoXCicloId: 'mxcc-1' });

    // s-2 is already enrolled → excluded
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.studentId)).not.toContain('s-2');
    expect(result.map((r) => r.studentId)).toContain('s-1');
    expect(result.map((r) => r.studentId)).toContain('s-3');
  });

  it('all CC students already enrolled → returns empty array', async () => {
    const materia = makeMateria('mxcc-1', 'cc-1');
    const ccStudents = [
      makeCCStudent('axcc-1', 's-1', 'Ana García'),
      makeCCStudent('axcc-2', 's-2', 'Carlos López'),
    ];
    const enrolled = [
      makeEnrolledRow('axm-1', 'mxcc-1', 's-1'),
      makeEnrolledRow('axm-2', 'mxcc-1', 's-2'),
    ];

    const uc = new ListEnrollableStudentsForMateriaUseCase(
      makeMateriaRepo(materia),
      makeAlumnosXMateriaRepo(enrolled),
      makeAlumnosCCRepo(ccStudents),
    );

    const result = await uc.execute({ materiaXCursoXCicloId: 'mxcc-1' });

    expect(result).toEqual([]);
  });

  it('empty optativa (0 enrolled) → returns all CC students as candidates', async () => {
    const materia = makeMateria('mxcc-1', 'cc-1');
    const ccStudents = [
      makeCCStudent('axcc-1', 's-1', 'Ana García'),
      makeCCStudent('axcc-2', 's-2', 'Carlos López'),
    ];

    const uc = new ListEnrollableStudentsForMateriaUseCase(
      makeMateriaRepo(materia),
      makeAlumnosXMateriaRepo([]), // empty universe
      makeAlumnosCCRepo(ccStudents),
    );

    const result = await uc.execute({ materiaXCursoXCicloId: 'mxcc-1' });

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.studentId)).toEqual(['s-1', 's-2']);
  });

  it('uses materia.courseCycleId to call findByCourseCycleEnriched', async () => {
    const materia = makeMateria('mxcc-1', 'cc-42');
    const alumnosCCRepo = makeAlumnosCCRepo([]);

    const uc = new ListEnrollableStudentsForMateriaUseCase(
      makeMateriaRepo(materia),
      makeAlumnosXMateriaRepo(),
      alumnosCCRepo,
    );

    await uc.execute({ materiaXCursoXCicloId: 'mxcc-1' });

    expect(alumnosCCRepo.findByCourseCycleEnriched).toHaveBeenCalledWith('cc-42');
  });
});
