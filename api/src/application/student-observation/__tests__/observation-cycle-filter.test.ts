import { describe, it, expect } from 'vitest';
import { filterCycleObservations } from '../observation-cycle-filter';
import { StudentObservation, ObservationType, ObservationTypeValue, Id } from '@educandow/domain';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeObs(
  type: ObservationTypeValue,
  studentId: Id,
  academicCycleId?: Id,
): StudentObservation {
  return StudentObservation.reconstruct({
    id: Id.create(),
    studentId,
    authorId: Id.create(),
    type: ObservationType.reconstruct(type),
    content: 'Test content',
    academicCycleId,
    createdAt: new Date(),
  });
}

const CYCLE_UUID = 'academic-cycle-uuid';
const OTHER_CYCLE_UUID = 'other-cycle-uuid';
const DIRECTOR_RANK = 50;
const TEACHER_RANK = 20;

const studentId = Id.reconstruct('student-1');

// ── Tests ────────────────────────────────────────────────────────────────────

describe('filterCycleObservations — academicCycleId equality (ADR-3)', () => {
  // ── PEDAGOGICAL scoping ───────────────────────────────────────────────────

  it('includes PEDAGOGICAL obs when academicCycleId matches cycleId', () => {
    const obs = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId,
      Id.reconstruct(CYCLE_UUID),
    );

    const result = filterCycleObservations([obs], CYCLE_UUID, DIRECTOR_RANK);

    expect(result).toHaveLength(1);
    expect(result[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  it('excludes PEDAGOGICAL obs when academicCycleId does not match cycleId', () => {
    const obs = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId,
      Id.reconstruct(OTHER_CYCLE_UUID),
    );

    const result = filterCycleObservations([obs], CYCLE_UUID, DIRECTOR_RANK);

    expect(result).toHaveLength(0);
  });

  it('excludes PEDAGOGICAL obs when academicCycleId is undefined (legacy record)', () => {
    const obs = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId,
      undefined, // no academicCycleId — legacy
    );

    const result = filterCycleObservations([obs], CYCLE_UUID, DIRECTOR_RANK);

    expect(result).toHaveLength(0);
  });

  // ── PSYCHOPEDAGOGICAL always included ────────────────────────────────────

  it('always includes PSYCHOPEDAGOGICAL obs regardless of academicCycleId', () => {
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId, undefined);

    const result = filterCycleObservations([eoeObs], CYCLE_UUID, DIRECTOR_RANK);

    expect(result).toHaveLength(1);
    expect(result[0].type.value).toBe(ObservationTypeValue.PSYCHOPEDAGOGICAL);
  });

  // ── Mixed set ────────────────────────────────────────────────────────────

  it('correctly handles mixed set: this-cycle PEDAGOGICAL + EOE + other-cycle PEDAGOGICAL', () => {
    const thisCyclePedagogical = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId,
      Id.reconstruct(CYCLE_UUID),
    );
    const otherCyclePedagogical = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId,
      Id.reconstruct(OTHER_CYCLE_UUID),
    );
    const legacyPedagogical = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId,
      undefined,
    );
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId, undefined);

    const result = filterCycleObservations(
      [thisCyclePedagogical, otherCyclePedagogical, legacyPedagogical, eoeObs],
      CYCLE_UUID,
      DIRECTOR_RANK,
    );

    expect(result).toHaveLength(2);
    expect(result.some((o) => o.type.value === ObservationTypeValue.PEDAGOGICAL)).toBe(true);
    expect(result.some((o) => o.type.value === ObservationTypeValue.PSYCHOPEDAGOGICAL)).toBe(true);
  });

  // ── Rank visibility ───────────────────────────────────────────────────────

  it('hides PSYCHOPEDAGOGICAL from callers with rank < 50', () => {
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId, undefined);
    const pedagogicalObs = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId,
      Id.reconstruct(CYCLE_UUID),
    );

    const result = filterCycleObservations([eoeObs, pedagogicalObs], CYCLE_UUID, TEACHER_RANK);

    expect(result).toHaveLength(1);
    expect(result[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  it('shows PSYCHOPEDAGOGICAL to callers with rank >= 50 (DIRECTOR+)', () => {
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId, undefined);

    const result = filterCycleObservations([eoeObs], CYCLE_UUID, DIRECTOR_RANK);

    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    const result = filterCycleObservations([], CYCLE_UUID, DIRECTOR_RANK);
    expect(result).toHaveLength(0);
  });
});
