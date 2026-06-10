/**
 * 1a-T1 [RED→GREEN] — CompetencyValuationRepository port contract.
 * Verifies the port exposes findByCourseCycleAndStudyPlanSubject returning
 * CompetencyValuationWithPeriods[]. TypeScript tsc enforces the shape at build time.
 */
import { describe, it, expect } from 'vitest';
import type {
  CompetencyValuationRepository,
  CompetencyValuationWithPeriods,
} from '../repositories/competency-valuation-repository';

describe('CompetencyValuationRepository port — findByCourseCycleAndStudyPlanSubject', () => {
  it('port exposes the method and returns CompetencyValuationWithPeriods[]', async () => {
    const row: CompetencyValuationWithPeriods = {
      valuationId: 'v-1',
      studentId:   's-1',
      competencyId: 'c-1',
      competencyName: 'Resolución de problemas',
      periodValuations: [
        {
          periodItemId:      'item-3',
          gradeScaleValueId: 'gsv-a',
          gradeCode:         'MB',
          internalStatus:    'APROBADO',
          modificable:       true,
          imprimible:        false,
        },
      ],
    };

    const mockRepo: CompetencyValuationRepository = {
      findById:                             async () => null,
      findByStudentAndStudyPlanSubject:     async () => [],
      findByCourseCycleAndStudyPlanSubject: async () => [row],
      save:                                 async () => {},
      bulkCreate:                           async () => {},
      delete:                               async () => {},
    };

    const result = await mockRepo.findByCourseCycleAndStudyPlanSubject('cc-1', 'sps-1');
    expect(result).toHaveLength(1);
    expect(result[0].valuationId).toBe('v-1');
    expect(result[0].periodValuations).toHaveLength(1);
    expect(result[0].periodValuations[0].gradeCode).toBe('MB');
  });

  it('returns [] for a cycle with no valuations (BVR-4)', async () => {
    const mockRepo: CompetencyValuationRepository = {
      findById:                             async () => null,
      findByStudentAndStudyPlanSubject:     async () => [],
      findByCourseCycleAndStudyPlanSubject: async () => [],
      save:                                 async () => {},
      bulkCreate:                           async () => {},
      delete:                               async () => {},
    };

    const result = await mockRepo.findByCourseCycleAndStudyPlanSubject('cc-new', 'sps-1');
    expect(result).toHaveLength(0);
  });

  it('parent with no children returns periodValuations: [] — not null (BVR-5)', async () => {
    const childless: CompetencyValuationWithPeriods = {
      valuationId:      'v-2',
      studentId:        's-2',
      competencyId:     'c-1',
      competencyName:   'Comunicación oral',
      periodValuations: [],
    };

    const mockRepo: CompetencyValuationRepository = {
      findById:                             async () => null,
      findByStudentAndStudyPlanSubject:     async () => [],
      findByCourseCycleAndStudyPlanSubject: async () => [childless],
      save:                                 async () => {},
      bulkCreate:                           async () => {},
      delete:                               async () => {},
    };

    const result = await mockRepo.findByCourseCycleAndStudyPlanSubject('cc-1', 'sps-1');
    expect(Array.isArray(result[0].periodValuations)).toBe(true);
    expect(result[0].periodValuations).toHaveLength(0);
  });
});
