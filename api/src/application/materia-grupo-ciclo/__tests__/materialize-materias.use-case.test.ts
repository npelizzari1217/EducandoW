/**
 * MaterializeMateriasUseCase — unit tests (TDD, Fase 3c)
 * Covers: F3-T1 (D1 re-gen), F3-T2 (MGC-S3 independence), happy-path generation
 */
import { describe, it, expect, vi } from 'vitest';
import { MaterializeMateriasUseCase } from '../materialize-materias.use-case';
import type { MateriaXCursoXCicloRepository } from '@educandow/domain';
import { MateriaXCursoXCiclo } from '@educandow/domain';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeMateria(overrides: Partial<{ id: string; courseCycleId: string; subjectId: string; studyPlanSubjectId?: string }> = {}): MateriaXCursoXCiclo {
  return MateriaXCursoXCiclo.reconstruct({
    id: overrides.id ?? 'materia-1',
    courseCycleId: overrides.courseCycleId ?? 'cc-1',
    subjectId: overrides.subjectId ?? 'subj-1',
    studyPlanSubjectId: overrides.studyPlanSubjectId,
    esOptativa: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  });
}

function makeRepo(existing: MateriaXCursoXCiclo[] = []): MateriaXCursoXCicloRepository {
  return {
    findById: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(existing.find(m => m.id === id) ?? null)
    ),
    findByCourseCycleId: vi.fn().mockResolvedValue(existing),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    updateDescription: vi.fn().mockImplementation((id: string, data: { studyPlanSubjectId?: string }) =>
      Promise.resolve(makeMateria({ id, studyPlanSubjectId: data.studyPlanSubjectId }))
    ),
    setEsOptativa: vi.fn(),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('MaterializeMateriasUseCase', () => {
  describe('happy path — first generation', () => {
    it('creates all plan subjects via upsertMany', async () => {
      const repo = makeRepo([]);
      const uc = new MaterializeMateriasUseCase(repo);

      await uc.execute({
        courseCycleId: 'cc-1',
        planSubjects: [
          { subjectId: 'subj-1', studyPlanSubjectId: 'sps-1' },
          { subjectId: 'subj-2', studyPlanSubjectId: 'sps-2' },
        ],
      });

      expect(repo.upsertMany).toHaveBeenCalledWith([
        { courseCycleId: 'cc-1', subjectId: 'subj-1', studyPlanSubjectId: 'sps-1' },
        { courseCycleId: 'cc-1', subjectId: 'subj-2', studyPlanSubjectId: 'sps-2' },
      ]);
    });

    it('no-ops when planSubjects is empty', async () => {
      const repo = makeRepo([]);
      const uc = new MaterializeMateriasUseCase(repo);

      await uc.execute({ courseCycleId: 'cc-1', planSubjects: [] });

      expect(repo.upsertMany).not.toHaveBeenCalled();
    });
  });

  describe('F3-T1 — D1: re-generation aditiva + re-sync', () => {
    it('calls upsertMany (skipDuplicates) first — adds missing subjects only', async () => {
      const existing = [makeMateria({ subjectId: 'subj-1', studyPlanSubjectId: 'old-sps-1' })];
      const repo = makeRepo(existing);
      const uc = new MaterializeMateriasUseCase(repo);

      await uc.execute({
        courseCycleId: 'cc-1',
        planSubjects: [
          { subjectId: 'subj-1', studyPlanSubjectId: 'new-sps-1' },
          { subjectId: 'subj-2', studyPlanSubjectId: 'sps-2' },
        ],
      });

      // upsertMany was called for all subjects (creates new ones, skips existing)
      expect(repo.upsertMany).toHaveBeenCalledTimes(1);
    });

    it('re-syncs studyPlanSubjectId for existing rows (D1)', async () => {
      const existing = [makeMateria({ subjectId: 'subj-1', studyPlanSubjectId: 'old-sps-1' })];
      const repo = makeRepo(existing);
      const uc = new MaterializeMateriasUseCase(repo);

      await uc.execute({
        courseCycleId: 'cc-1',
        planSubjects: [
          { subjectId: 'subj-1', studyPlanSubjectId: 'new-sps-1' }, // updated in plan
        ],
      });

      // updateDescription called for the existing row with the new studyPlanSubjectId
      expect(repo.updateDescription).toHaveBeenCalledWith('materia-1', { studyPlanSubjectId: 'new-sps-1' });
    });

    it('does NOT call updateDescription when studyPlanSubjectId unchanged', async () => {
      const existing = [makeMateria({ subjectId: 'subj-1', studyPlanSubjectId: 'sps-1' })];
      const repo = makeRepo(existing);
      const uc = new MaterializeMateriasUseCase(repo);

      await uc.execute({
        courseCycleId: 'cc-1',
        planSubjects: [{ subjectId: 'subj-1', studyPlanSubjectId: 'sps-1' }], // same
      });

      expect(repo.updateDescription).not.toHaveBeenCalled();
    });

    it('does NOT touch groups, alumnos-x-grupo, or grades — re-sync only updates studyPlanSubjectId', async () => {
      // The use-case ONLY calls materiaRepo methods — never grupoRepo, alumnosRepo, or grade repos
      // This is verified by not having those repos at all — if it called them it would throw
      const existing = [makeMateria({ subjectId: 'subj-1', studyPlanSubjectId: 'old' })];
      const repo = makeRepo(existing);
      const uc = new MaterializeMateriasUseCase(repo);

      // Should not throw (doesn't call any other repo)
      await expect(
        uc.execute({ courseCycleId: 'cc-1', planSubjects: [{ subjectId: 'subj-1', studyPlanSubjectId: 'new' }] })
      ).resolves.not.toThrow();
    });
  });

  describe('esOptativa inheritance (T08 RED → T09 GREEN)', () => {
    it('Test A (MGC-S30/R14): esOptativa:true in planSubjects → upsertMany called with esOptativa:true', async () => {
      const repo = makeRepo([]);
      const uc = new MaterializeMateriasUseCase(repo);

      await uc.execute({
        courseCycleId: 'cc-1',
        planSubjects: [{ subjectId: 'subj-1', studyPlanSubjectId: 'sps-1', esOptativa: true }],
      });

      const call = (repo.upsertMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{ esOptativa?: boolean }>;
      expect(call[0].esOptativa).toBe(true);
    });

    it('Test B (MGC-S31): esOptativa:false in planSubjects → upsertMany called with esOptativa:false', async () => {
      const repo = makeRepo([]);
      const uc = new MaterializeMateriasUseCase(repo);

      await uc.execute({
        courseCycleId: 'cc-1',
        planSubjects: [{ subjectId: 'subj-1', studyPlanSubjectId: 'sps-1', esOptativa: false }],
      });

      const call = (repo.upsertMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{ esOptativa?: boolean }>;
      expect(call[0].esOptativa).toBe(false);
    });

    it('Test C (MGC-S32): mixed plan → each subject gets its own esOptativa value', async () => {
      const repo = makeRepo([]);
      const uc = new MaterializeMateriasUseCase(repo);

      await uc.execute({
        courseCycleId: 'cc-1',
        planSubjects: [
          { subjectId: 'subj-1', studyPlanSubjectId: 'sps-1', esOptativa: false },
          { subjectId: 'subj-2', studyPlanSubjectId: 'sps-2', esOptativa: true },
          { subjectId: 'subj-3', studyPlanSubjectId: 'sps-3', esOptativa: false },
        ],
      });

      const call = (repo.upsertMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{ subjectId: string; esOptativa?: boolean }>;
      expect(call.find(c => c.subjectId === 'subj-1')?.esOptativa).toBe(false);
      expect(call.find(c => c.subjectId === 'subj-2')?.esOptativa).toBe(true);
      expect(call.find(c => c.subjectId === 'subj-3')?.esOptativa).toBe(false);
    });

    it('Test D (D2 LOCK/MGC-R15): Step-2 updateDescription is NOT called with esOptativa', async () => {
      const existing = [makeMateria({ subjectId: 'subj-1', studyPlanSubjectId: 'old-sps-1' })];
      const repo = makeRepo(existing);
      const uc = new MaterializeMateriasUseCase(repo);

      await uc.execute({
        courseCycleId: 'cc-1',
        planSubjects: [{ subjectId: 'subj-1', studyPlanSubjectId: 'new-sps-1', esOptativa: true }],
      });

      // updateDescription should be called (re-sync studyPlanSubjectId), but without esOptativa
      const updateCalls = (repo.updateDescription as ReturnType<typeof vi.fn>).mock.calls;
      for (const [, data] of updateCalls) {
        expect((data as Record<string, unknown>)).not.toHaveProperty('esOptativa');
      }
    });
  });

  describe('F3-T2 — MGC-S3: two CCs from same plan produce independent rows', () => {
    it('two separate invocations with different courseCycleId produce independent calls', async () => {
      const repoA = makeRepo([]);
      const repoB = makeRepo([]);
      const ucA = new MaterializeMateriasUseCase(repoA);
      const ucB = new MaterializeMateriasUseCase(repoB);

      const planSubjects = [
        { subjectId: 'subj-1', studyPlanSubjectId: 'sps-1' },
        { subjectId: 'subj-2', studyPlanSubjectId: 'sps-2' },
      ];

      await ucA.execute({ courseCycleId: 'cc-A', planSubjects });
      await ucB.execute({ courseCycleId: 'cc-B', planSubjects });

      // Each has its own courseCycleId — independent rows
      const callA = (repoA.upsertMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as unknown[];
      const callB = (repoB.upsertMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as unknown[];

      expect(callA).toHaveLength(2);
      expect(callB).toHaveLength(2);
      expect((callA[0] as { courseCycleId: string }).courseCycleId).toBe('cc-A');
      expect((callB[0] as { courseCycleId: string }).courseCycleId).toBe('cc-B');
    });
  });
});
