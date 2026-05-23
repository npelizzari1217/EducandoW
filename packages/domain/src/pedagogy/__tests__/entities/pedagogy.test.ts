import { describe, it, expect } from 'vitest';
import { Id } from '../../../shared/value-objects/id';
import { Level, LevelType } from '../../../institution/value-objects/level';

// Test entities from pedagogy context
import { Subject } from '../../../pedagogy/entities/subject';
import { CourseSection } from '../../../pedagogy/entities/course-section';
import { SubjectAssignment } from '../../../pedagogy/entities/subject-assignment';
import { Grade } from '../../../pedagogy/entities/grade';
import { Attendance } from '../../../pedagogy/entities/attendance';

describe('Subject', () => {
  it('creates with name, level, institutionId', () => {
    const s = Subject.create({
      name: 'Matemática',
      level: Level.reconstruct(LevelType.SECUNDARIO),
      institutionId: 'inst-1',
    });
    expect(s.name).toBe('Matemática');
    expect(s.level.get()).toBe(LevelType.SECUNDARIO);
    expect(s.institutionId).toBe('inst-1');
  });
});

describe('CourseSection', () => {
  it('creates with academic year and optional grade/division', () => {
    const c = CourseSection.create({
      name: '3° A',
      grade: '3°',
      division: 'A',
      level: Level.reconstruct(LevelType.PRIMARIO),
      academicYear: '2025',
      institutionId: 'inst-1',
    });
    expect(c.name).toBe('3° A');
    expect(c.academicYear).toBe('2025');
    expect(c.grade).toBe('3°');
    expect(c.division).toBe('A');
  });
});

describe('SubjectAssignment', () => {
  it('links subject, teacher and course section', () => {
    const a = SubjectAssignment.create({ subjectId: 'subj-1', teacherId: 't-1', courseSectionId: 'cs-1' });
    expect(a.subjectId).toBe('subj-1');
    expect(a.teacherId).toBe('t-1');
    expect(a.courseSectionId).toBe('cs-1');
  });
});

describe('Grade', () => {
  it('creates with numeric and qualitative values', () => {
    const g = Grade.create({ studentId: 's-1', subjectId: 'subj-1', courseSectionId: 'cs-1', period: '1T', numericValue: 8, qualitativeValue: 'Muy Bueno', status: 'APROBADO' });
    expect(g.numericValue).toBe(8);
    expect(g.qualitativeValue).toBe('Muy Bueno');
    expect(g.status).toBe('APROBADO');
    expect(g.period).toBe('1T');
  });

  it('evaluatedAt is set automatically', () => {
    const g = Grade.create({ studentId: 's-1', subjectId: 'subj-1', courseSectionId: 'cs-1', period: '2T' });
    expect(g.evaluatedAt).toBeInstanceOf(Date);
  });

  it('optional fields default to undefined', () => {
    const g = Grade.create({ studentId: 's-1', subjectId: 'subj-1', courseSectionId: 'cs-1', period: '1T' });
    expect(g.numericValue).toBeUndefined();
    expect(g.status).toBeUndefined();
  });
});

describe('Attendance', () => {
  it('creates with status and optional note', () => {
    const now = new Date();
    const a = Attendance.create({ studentId: 's-1', courseSectionId: 'cs-1', date: now, status: 'PRESENT' });
    expect(a.status).toBe('PRESENT');
    expect(a.date).toEqual(now);
    expect(a.note).toBeUndefined();
  });

  it('creates with note for justified', () => {
    const a = Attendance.create({ studentId: 's-1', courseSectionId: 'cs-1', date: new Date(), status: 'JUSTIFIED', note: 'Certificado médico' });
    expect(a.note).toBe('Certificado médico');
  });

  it('reconstruct preserves all fields', () => {
    const id = Id.create();
    const date = new Date('2025-06-15');
    const a = Attendance.reconstruct({ id, studentId: 's-1', courseSectionId: 'cs-1', date, status: 'ABSENT', note: 'Sin aviso' });
    expect(a.status).toBe('ABSENT');
    expect(a.id.get()).toBe(id.get());
  });
});
