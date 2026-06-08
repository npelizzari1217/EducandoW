/**
 * T1.1 [RED] → T1.2 [GREEN]
 * Tests for CompetencyPeriodValuation entity.
 * Specs: MVM-4 (lazy create defaults), MVM-6 (ungraded null fields), GPE-4 (lock guard).
 */
import { describe, it, expect } from 'vitest';
import { CompetencyPeriodValuation } from '../../entities/competency-period-valuation';
import { PeriodLockedError } from '../../errors/competency-valuation.errors';

const VALUATION_ID = 'valuation-uuid-1';
const PERIOD_ITEM_ID = 'period-item-uuid-1';

// ── create (MVM-4, MVM-6) ─────────────────────────────────────

describe('CompetencyPeriodValuation.create', () => {
  it('creates with ungraded defaults: grade fields null, modificable=true, imprimible=false', () => {
    const child = CompetencyPeriodValuation.create({ valuationId: VALUATION_ID, periodItemId: PERIOD_ITEM_ID });

    expect(child.valuationId).toBe(VALUATION_ID);
    expect(child.periodItemId).toBe(PERIOD_ITEM_ID);
    expect(child.gradeScaleValueId).toBeNull();
    expect(child.gradeCode).toBeNull();
    expect(child.internalStatus).toBeNull();
    expect(child.modificable).toBe(true);
    expect(child.imprimible).toBe(false);
  });

  it('assigns a UUID id on creation', () => {
    const child = CompetencyPeriodValuation.create({ valuationId: VALUATION_ID, periodItemId: PERIOD_ITEM_ID });
    expect(child.id).toHaveLength(36);
  });
});

// ── reconstruct ───────────────────────────────────────────────

describe('CompetencyPeriodValuation.reconstruct', () => {
  it('preserves all props', () => {
    const child = CompetencyPeriodValuation.reconstruct({
      id: 'child-uuid-1',
      valuationId: VALUATION_ID,
      periodItemId: PERIOD_ITEM_ID,
      gradeScaleValueId: 'scale-value-uuid',
      gradeCode: 'A',
      internalStatus: 'APROBADO',
      modificable: false,
      imprimible: true,
    });

    expect(child.id).toBe('child-uuid-1');
    expect(child.gradeScaleValueId).toBe('scale-value-uuid');
    expect(child.gradeCode).toBe('A');
    expect(child.internalStatus).toBe('APROBADO');
    expect(child.modificable).toBe(false);
    expect(child.imprimible).toBe(true);
  });
});

// ── assignGrade (GPE-4) ───────────────────────────────────────

describe('CompetencyPeriodValuation.assignGrade', () => {
  it('snapshots all three grade fields and returns ok when modificable=true', () => {
    const child = CompetencyPeriodValuation.create({ valuationId: VALUATION_ID, periodItemId: PERIOD_ITEM_ID });

    const result = child.assignGrade({
      gradeScaleValueId: 'sv-uuid',
      gradeCode: 'B',
      internalStatus: 'EN_PROCESO',
    });

    expect(result.isOk()).toBe(true);
    expect(child.gradeScaleValueId).toBe('sv-uuid');
    expect(child.gradeCode).toBe('B');
    expect(child.internalStatus).toBe('EN_PROCESO');
  });

  it('returns err(PeriodLockedError) when modificable=false (GPE-4)', () => {
    const child = CompetencyPeriodValuation.reconstruct({
      id: 'child-uuid-1',
      valuationId: VALUATION_ID,
      periodItemId: PERIOD_ITEM_ID,
      gradeScaleValueId: null,
      gradeCode: null,
      internalStatus: null,
      modificable: false,
      imprimible: false,
    });

    const result = child.assignGrade({ gradeScaleValueId: 'sv-uuid', gradeCode: 'A', internalStatus: 'APROBADO' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodLockedError);
    expect((result.unwrapErr() as PeriodLockedError).code).toBe('PERIOD_LOCKED');
  });

  it('does NOT mutate grade fields when locked', () => {
    const child = CompetencyPeriodValuation.reconstruct({
      id: 'child-uuid-1',
      valuationId: VALUATION_ID,
      periodItemId: PERIOD_ITEM_ID,
      gradeScaleValueId: 'old-sv',
      gradeCode: 'OLD',
      internalStatus: 'APROBADO',
      modificable: false,
      imprimible: false,
    });

    child.assignGrade({ gradeScaleValueId: 'new-sv', gradeCode: 'NEW', internalStatus: 'NO_APROBADO' });

    expect(child.gradeScaleValueId).toBe('old-sv');
    expect(child.gradeCode).toBe('OLD');
    expect(child.internalStatus).toBe('APROBADO');
  });
});

// ── clearGrade ────────────────────────────────────────────────

describe('CompetencyPeriodValuation.clearGrade', () => {
  it('nulls all three grade fields when modificable=true', () => {
    const child = CompetencyPeriodValuation.reconstruct({
      id: 'child-uuid-1',
      valuationId: VALUATION_ID,
      periodItemId: PERIOD_ITEM_ID,
      gradeScaleValueId: 'sv-uuid',
      gradeCode: 'A',
      internalStatus: 'APROBADO',
      modificable: true,
      imprimible: false,
    });

    const result = child.clearGrade();

    expect(result.isOk()).toBe(true);
    expect(child.gradeScaleValueId).toBeNull();
    expect(child.gradeCode).toBeNull();
    expect(child.internalStatus).toBeNull();
  });

  it('returns err(PeriodLockedError) when modificable=false', () => {
    const child = CompetencyPeriodValuation.reconstruct({
      id: 'child-uuid-1',
      valuationId: VALUATION_ID,
      periodItemId: PERIOD_ITEM_ID,
      gradeScaleValueId: 'sv-uuid',
      gradeCode: 'A',
      internalStatus: 'APROBADO',
      modificable: false,
      imprimible: false,
    });

    const result = child.clearGrade();

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodLockedError);
  });
});

// ── setModificable / setImprimible ────────────────────────────

describe('CompetencyPeriodValuation.setModificable / setImprimible', () => {
  it('setModificable(false) changes the flag', () => {
    const child = CompetencyPeriodValuation.create({ valuationId: VALUATION_ID, periodItemId: PERIOD_ITEM_ID });
    expect(child.modificable).toBe(true);

    child.setModificable(false);

    expect(child.modificable).toBe(false);
  });

  it('setImprimible(true) changes the flag', () => {
    const child = CompetencyPeriodValuation.create({ valuationId: VALUATION_ID, periodItemId: PERIOD_ITEM_ID });
    expect(child.imprimible).toBe(false);

    child.setImprimible(true);

    expect(child.imprimible).toBe(true);
  });
});
