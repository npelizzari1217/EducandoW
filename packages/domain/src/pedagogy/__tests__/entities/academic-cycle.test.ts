import { describe, it, expect } from 'vitest';
import { AcademicCycle } from '../../entities/academic-cycle';
import { CycleCode } from '../../value-objects/cycle-code';
import { BimonthPeriod } from '../../../course-cycle/value-objects/bimonth-period';
import { EducationalLevel, EducationalLevelCode } from '../../../shared/value-objects/educational-level';
import { EducationalModality, EducationalModalityCode } from '../../../shared/value-objects/educational-modality';

describe('AcademicCycle', () => {
  const level = EducationalLevel.fromCode(EducationalLevelCode.PRIMARIO); // code 2
  const modality = EducationalModality.fromCode(EducationalModalityCode.COMUN); // code 0
  const validCreateInput = {
    name: 'Ciclo 2026',
    level,
    modality,
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-12-20'),
    code: CycleCode.create('2026').unwrap(),
  };

  // ── create() ──────────────────────────────────────────

  it('creates with minimum required fields', () => {
    const cycle = AcademicCycle.create(validCreateInput);
    expect(cycle.name).toBe('Ciclo 2026');
    expect(cycle.uuid).toBeDefined();
    expect(cycle.uuid).toHaveLength(36); // UUID format
    expect(cycle.code.get()).toBe('2026');
    expect(cycle.level).toBeInstanceOf(EducationalLevel);
    expect(cycle.level.code).toBe(EducationalLevelCode.PRIMARIO);
    expect(cycle.modality).toBeInstanceOf(EducationalModality);
    expect(cycle.modality.code).toBe(EducationalModalityCode.COMUN);
    expect(cycle.active).toBe(true);
    expect(cycle.deletedAt).toBeNull();
    expect(cycle.createdAt).toBeInstanceOf(Date);
    expect(cycle.updatedAt).toBeInstanceOf(Date);
  });

  it('creates with all optional fields including bimonths', () => {
    const firstBim = BimonthPeriod.create(new Date('2026-03-01'), new Date('2026-04-30')).unwrap();
    const secondBim = BimonthPeriod.create(new Date('2026-05-01'), new Date('2026-06-30')).unwrap();
    const thirdBim = BimonthPeriod.create(new Date('2026-07-01'), new Date('2026-08-31')).unwrap();
    const fourthBim = BimonthPeriod.create(new Date('2026-09-01'), new Date('2026-10-31')).unwrap();

    const cycle = AcademicCycle.create({
      ...validCreateInput,
      firstBimonth: firstBim,
      secondBimonth: secondBim,
      thirdBimonth: thirdBim,
      fourthBimonth: fourthBim,
    });

    expect(cycle.firstBimonth).toBeDefined();
    expect(cycle.firstBimonth!.start).toEqual(new Date('2026-03-01'));
    expect(cycle.firstBimonth!.end).toEqual(new Date('2026-04-30'));
    expect(cycle.secondBimonth).toBeDefined();
    expect(cycle.thirdBimonth).toBeDefined();
    expect(cycle.fourthBimonth).toBeDefined();
  });

  it('creates with bimonths as null when not provided', () => {
    const cycle = AcademicCycle.create(validCreateInput);
    expect(cycle.firstBimonth).toBeNull();
    expect(cycle.secondBimonth).toBeNull();
    expect(cycle.thirdBimonth).toBeNull();
    expect(cycle.fourthBimonth).toBeNull();
  });

  it('creates without modality — defaults to COMUN', () => {
    const cycle = AcademicCycle.create({
      name: 'Ciclo sin modalidad',
      level,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-12-20'),
      code: CycleCode.create('2027').unwrap(),
    });
    expect(cycle.modality).toBeInstanceOf(EducationalModality);
    expect(cycle.modality.code).toBe(EducationalModalityCode.COMUN);
  });

  it('generates unique uuid per instance', () => {
    const a = AcademicCycle.create(validCreateInput);
    const b = AcademicCycle.create(validCreateInput);
    expect(a.uuid).not.toBe(b.uuid);
  });

  it('generates numericId', () => {
    const cycle = AcademicCycle.create(validCreateInput);
    expect(cycle.numericId).toBe(0);
  });

  // ── softDelete() ──────────────────────────────────────

  it('softDelete sets active to false and records deletedAt', () => {
    const cycle = AcademicCycle.create(validCreateInput);
    expect(cycle.active).toBe(true);
    expect(cycle.deletedAt).toBeNull();

    cycle.softDelete();
    expect(cycle.active).toBe(false);
    expect(cycle.deletedAt).toBeInstanceOf(Date);
    expect(cycle.updatedAt).toBeInstanceOf(Date);
  });

  // ── toggleActive() ────────────────────────────────────

  it('toggleActive switches active from true to false', () => {
    const cycle = AcademicCycle.create(validCreateInput);
    cycle.toggleActive();
    expect(cycle.active).toBe(false);
    cycle.toggleActive();
    expect(cycle.active).toBe(true);
  });

  // ── update() ──────────────────────────────────────────

  it('update changes name', () => {
    const cycle = AcademicCycle.create(validCreateInput);
    cycle.update({ name: 'Nuevo Nombre' });
    expect(cycle.name).toBe('Nuevo Nombre');
  });

  it('update changes code', () => {
    const cycle = AcademicCycle.create(validCreateInput);
    const newCode = CycleCode.create('CICLO-2027-A').unwrap();
    cycle.update({ code: newCode });
    expect(cycle.code.get()).toBe('CICLO-2027-A');
  });

  it('update changes bimester dates', () => {
    const cycle = AcademicCycle.create(validCreateInput);
    const bim = BimonthPeriod.create(new Date('2026-04-01'), new Date('2026-05-31')).unwrap();
    cycle.update({ firstBimonth: bim });
    expect(cycle.firstBimonth!.start).toEqual(new Date('2026-04-01'));
    expect(cycle.firstBimonth!.end).toEqual(new Date('2026-05-31'));
  });

  it('update sets bimester to null when not provided', () => {
    const cycle = AcademicCycle.create(validCreateInput);
    cycle.update({ name: 'Updated' });
    expect(cycle.firstBimonth).toBeNull(); // unchanged
  });

  it('update changes dates', () => {
    const cycle = AcademicCycle.create(validCreateInput);
    const newStart = new Date('2026-02-01');
    const newEnd = new Date('2026-11-30');
    cycle.update({ startDate: newStart, endDate: newEnd });
    expect(cycle.startDate).toEqual(newStart);
    expect(cycle.endDate).toEqual(newEnd);
  });

  it('update changes active flag', () => {
    const cycle = AcademicCycle.create(validCreateInput);
    cycle.update({ active: false });
    expect(cycle.active).toBe(false);
  });

  it('update sets updatedAt to current time', () => {
    const cycle = AcademicCycle.create(validCreateInput);
    const before = cycle.updatedAt.getTime();
    const start = Date.now();
    while (Date.now() === start); // busy-wait for next ms
    cycle.update({ name: 'Changed' });
    expect(cycle.updatedAt.getTime()).toBeGreaterThan(before);
  });

  // ── reconstruct() ─────────────────────────────────────

  it('reconstruct preserves all fields', () => {
    const firstBim = BimonthPeriod.reconstruct(new Date('2026-03-01'), new Date('2026-04-30'));
    const created = new Date('2025-01-15');
    const updated = new Date('2025-06-20');
    const secLevel = EducationalLevel.fromCode(EducationalLevelCode.SECUNDARIO);
    const tallModality = EducationalModality.fromCode(EducationalModalityCode.TALLERES);

    const cycle = AcademicCycle.reconstruct({
      numericId: 1,
      uuid: 'abc-123',
      code: CycleCode.reconstruct('2026'),
      name: 'Reconstructed Cycle',
      level: secLevel,
      modality: tallModality,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-12-20'),
      active: true,
      deletedAt: null,
      firstBimonth: firstBim,
      secondBimonth: null,
      thirdBimonth: null,
      fourthBimonth: null,
      createdAt: created,
      updatedAt: updated,
    });

    expect(cycle.numericId).toBe(1);
    expect(cycle.uuid).toBe('abc-123');
    expect(cycle.code.get()).toBe('2026');
    expect(cycle.name).toBe('Reconstructed Cycle');
    expect(cycle.level).toBeInstanceOf(EducationalLevel);
    expect(cycle.level.code).toBe(EducationalLevelCode.SECUNDARIO);
    expect(cycle.modality).toBeInstanceOf(EducationalModality);
    expect(cycle.modality.code).toBe(EducationalModalityCode.TALLERES);
    expect(cycle.active).toBe(true);
    expect(cycle.deletedAt).toBeNull();
    expect(cycle.firstBimonth!.start).toEqual(new Date('2026-03-01'));
    expect(cycle.createdAt).toEqual(created);
    expect(cycle.updatedAt).toEqual(updated);
  });

  // ── isCurrent() ───────────────────────────────────────

  it('isCurrent returns true when active and within date range', () => {
    const now = new Date();
    const start = new Date(now.getTime() - 86400000); // yesterday
    const end = new Date(now.getTime() + 86400000); // tomorrow

    const cycle = AcademicCycle.create({
      ...validCreateInput,
      startDate: start,
      endDate: end,
    });
    expect(cycle.isCurrent()).toBe(true);
  });

  it('isCurrent returns false when not active', () => {
    const now = new Date();
    const start = new Date(now.getTime() - 86400000);
    const end = new Date(now.getTime() + 86400000);

    const cycle = AcademicCycle.create({
      ...validCreateInput,
      startDate: start,
      endDate: end,
      active: false,
    });
    expect(cycle.isCurrent()).toBe(false);
  });

  it('isCurrent returns false when outside date range', () => {
    const past = new Date('2020-01-01');
    const cycle = AcademicCycle.create({
      ...validCreateInput,
      startDate: past,
      endDate: new Date('2020-12-31'),
    });
    expect(cycle.isCurrent()).toBe(false);
  });
});
