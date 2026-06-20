import { describe, it, expect } from 'vitest';
import { StudentObservation } from '../../entities/observation';
import { ObservationType, ObservationTypeValue } from '../../value-objects/observation-type';
import { Id } from '../../../shared/value-objects/id';

function makeType(value: ObservationTypeValue = ObservationTypeValue.PEDAGOGICAL): ObservationType {
  return ObservationType.reconstruct(value);
}

function validProps() {
  return {
    studentId: Id.create(),
    authorId: Id.create(),
    type: makeType(),
    content: 'Valid observation content',
    academicCycleId: Id.create(), // replaces enrollmentId (ADR-3)
  };
}

describe('StudentObservation.create()', () => {
  // ── Valid content ────────────────────────────────────────────────────────────

  it('creates successfully with valid content', () => {
    const result = StudentObservation.create(validProps());
    expect(result.isOk()).toBe(true);
    const obs = result.unwrap();
    expect(obs.content).toBe('Valid observation content');
  });

  it('creates with content of exactly 1 character', () => {
    const result = StudentObservation.create({ ...validProps(), content: 'x' });
    expect(result.isOk()).toBe(true);
  });

  it('creates with content of exactly 2000 characters', () => {
    const result = StudentObservation.create({ ...validProps(), content: 'a'.repeat(2000) });
    expect(result.isOk()).toBe(true);
  });

  it('assigns a new id on create', () => {
    const result = StudentObservation.create(validProps());
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().id).toBeDefined();
  });

  // ── Invalid content ──────────────────────────────────────────────────────────

  it('returns err for empty content', () => {
    const result = StudentObservation.create({ ...validProps(), content: '' });
    expect(result.isErr()).toBe(true);
  });

  it('returns err for content exceeding 2000 characters', () => {
    const result = StudentObservation.create({ ...validProps(), content: 'a'.repeat(2001) });
    expect(result.isErr()).toBe(true);
  });

  // ── reconstruct (no validation, used for DB hydration) ──────────────────────

  it('reconstruct bypasses validation — allows any content length', () => {
    const id = Id.create();
    const obs = StudentObservation.reconstruct({
      id,
      studentId: Id.create(),
      authorId: Id.create(),
      type: makeType(),
      content: '',
      createdAt: new Date(),
    });
    expect(obs.id).toBe(id);
  });

  // ── isAuthoredBy ─────────────────────────────────────────────────────────────

  it('isAuthoredBy returns true when authorId matches', () => {
    const authorId = Id.create();
    const obs = StudentObservation.reconstruct({
      id: Id.create(),
      studentId: Id.create(),
      authorId,
      type: makeType(),
      content: 'test',
    });
    expect(obs.isAuthoredBy(authorId)).toBe(true);
  });

  it('isAuthoredBy returns false for a different userId', () => {
    const authorId = Id.create();
    const differentId = Id.create();
    const obs = StudentObservation.reconstruct({
      id: Id.create(),
      studentId: Id.create(),
      authorId,
      type: makeType(),
      content: 'test',
    });
    expect(obs.isAuthoredBy(differentId)).toBe(false);
  });
});

// ── academicCycleId invariant (ADR-3: replaces enrollmentId) ─────────────────

describe('StudentObservation — academicCycleId invariant', () => {
  it('returns err when PEDAGOGICAL and no academicCycleId', () => {
    const result = StudentObservation.create({
      studentId: Id.create(),
      authorId: Id.create(),
      type: makeType(ObservationTypeValue.PEDAGOGICAL),
      content: 'Some pedagogical note',
      // no academicCycleId
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('Pedagogical observations require an academic cycle');
  });

  it('succeeds when PEDAGOGICAL and academicCycleId is present', () => {
    const result = StudentObservation.create({
      studentId: Id.create(),
      authorId: Id.create(),
      type: makeType(ObservationTypeValue.PEDAGOGICAL),
      content: 'Some pedagogical note',
      academicCycleId: Id.create(),
    });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().academicCycleId).toBeDefined();
  });

  it('returns err when PSYCHOPEDAGOGICAL and academicCycleId is present', () => {
    const result = StudentObservation.create({
      studentId: Id.create(),
      authorId: Id.create(),
      type: makeType(ObservationTypeValue.PSYCHOPEDAGOGICAL),
      content: 'EOE note',
      academicCycleId: Id.create(),
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('Psychopedagogical observations cannot be linked to an academic cycle');
  });

  it('succeeds when PSYCHOPEDAGOGICAL and no academicCycleId', () => {
    const result = StudentObservation.create({
      studentId: Id.create(),
      authorId: Id.create(),
      type: makeType(ObservationTypeValue.PSYCHOPEDAGOGICAL),
      content: 'EOE note',
      // no academicCycleId
    });
    expect(result.isOk()).toBe(true);
  });

  it('reconstruct passes academicCycleId through without validation', () => {
    const academicCycleId = Id.create();
    const obs = StudentObservation.reconstruct({
      id: Id.create(),
      studentId: Id.create(),
      authorId: Id.create(),
      type: makeType(ObservationTypeValue.PEDAGOGICAL),
      content: 'legacy',
      academicCycleId,
    });
    expect(obs.academicCycleId?.get()).toBe(academicCycleId.get());
  });
});
