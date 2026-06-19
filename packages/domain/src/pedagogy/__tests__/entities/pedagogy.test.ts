import { describe, it, expect } from 'vitest';
import { Id } from '../../../shared/value-objects/id';
import { EducationalLevelCode } from '../../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../../shared/value-objects/educational-modality';
import { Level, LevelType } from '../../../institution/value-objects/level';

// Test entities from pedagogy context
import { StudyPlan } from '../../../pedagogy/entities/study-plan';
import { Subject } from '../../../pedagogy/entities/subject';
import { CourseSection } from '../../../pedagogy/entities/course-section';
import { Attendance } from '../../../pedagogy/entities/attendance';
// GradeScale and GradeScaleValue moved to grading/__tests__/entities/ — grading-foundations

describe('StudyPlan', () => {
  it('creates with name, level, modality and optional cycleUuid', () => {
    const p = StudyPlan.create({
      name: 'Plan Primario',
      level: EducationalLevelCode.PRIMARIO,
      modality: EducationalModalityCode.COMUN,
      cycleUuid: 'cycle-uuid-1',
    });
    expect(p.name).toBe('Plan Primario');
    expect(p.level).toBe(EducationalLevelCode.PRIMARIO);
    expect(p.modality).toBe(EducationalModalityCode.COMUN);
    expect(p.cycleUuid).toBe('cycle-uuid-1');
    expect(p.active).toBe(true);
    expect(p.id.get()).toBeDefined();
  });

  it('creates without cycleUuid (nullable)', () => {
    const p = StudyPlan.create({
      name: 'Plan Sin Ciclo',
      level: EducationalLevelCode.PRIMARIO,
      modality: EducationalModalityCode.COMUN,
    });
    expect(p.cycleUuid).toBeUndefined();
    expect(p.active).toBe(true);
  });

  it('reconstruct preserves all fields', () => {
    const id = Id.reconstruct('plan-1');
    const now = new Date('2026-01-01');
    const p = StudyPlan.reconstruct({
      id,
      name: 'Plan Secundario',
      level: EducationalLevelCode.SECUNDARIO,
      modality: EducationalModalityCode.TALLERES,
      cycleUuid: 'cycle-abc',
      active: false,
      createdAt: now,
      updatedAt: now,
    });
    expect(p.id.get()).toBe('plan-1');
    expect(p.level).toBe(EducationalLevelCode.SECUNDARIO);
    expect(p.modality).toBe(EducationalModalityCode.TALLERES);
    expect(p.cycleUuid).toBe('cycle-abc');
    expect(p.active).toBe(false);
  });

  it('changeLevel updates level and modality', () => {
    const p = StudyPlan.create({
      name: 'Plan Inicial',
      level: EducationalLevelCode.INICIAL,
      modality: EducationalModalityCode.COMUN,
    });
    const prevUpdatedAt = p.updatedAt;

    p.changeLevel(EducationalLevelCode.PRIMARIO, EducationalModalityCode.TALLERES);

    expect(p.level).toBe(EducationalLevelCode.PRIMARIO);
    expect(p.modality).toBe(EducationalModalityCode.TALLERES);
    expect(p.updatedAt.getTime()).toBeGreaterThanOrEqual(prevUpdatedAt.getTime());
  });
});

describe('Subject', () => {
  it('creates with name, level, institutionId', () => {
    const s = Subject.create({
      name: 'Matemática',
      level: Level.reconstruct(LevelType.SECUNDARIO),
      institutionId: Id.reconstruct('inst-1'),
    });
    expect(s.name).toBe('Matemática');
    expect(s.level.get()).toBe(LevelType.SECUNDARIO);
    expect(s.institutionId.get()).toBe('inst-1');
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
      institutionId: Id.reconstruct('inst-1'),
    });
    expect(c.name).toBe('3° A');
    expect(c.academicYear).toBe('2025');
    expect(c.grade).toBe('3°');
    expect(c.division).toBe('A');
  });
});

describe('Attendance', () => {
  it('creates with status and optional note', () => {
    const now = new Date();
    const a = Attendance.create({ studentId: 's-1', courseSectionId: 'cs-1', date: now, statusId: 'PRE' });
    expect(a.status).toBe('PRE');
    expect(a.date).toEqual(now);
    expect(a.note).toBeUndefined();
  });

  it('creates with note for justified', () => {
    const a = Attendance.create({ studentId: 's-1', courseSectionId: 'cs-1', date: new Date(), statusId: 'JUS', note: 'Certificado médico' });
    expect(a.note).toBe('Certificado médico');
  });

  it('reconstruct preserves all fields', () => {
    const id = Id.create();
    const date = new Date('2025-06-15');
    const a = Attendance.reconstruct({ id, studentId: 's-1', courseSectionId: 'cs-1', date, statusId: 'AUS', note: 'Sin aviso' });
    expect(a.status).toBe('AUS');
    expect(a.id.get()).toBe(id.get());
  });

  it('stores attendance snapshot fields', () => {
    const a = Attendance.reconstruct({
      id: Id.create(),
      studentId: 's-1',
      courseSectionId: 'cs-1',
      date: new Date('2025-06-15'),
      statusId: 'AUS',
      statusCode: 'AUS',
      statusDescription: 'Ausente',
      absenceValue: 1,
      isPresent: false,
    });
    expect(a.statusCode).toBe('AUS');
    expect(a.statusDescription).toBe('Ausente');
    expect(a.absenceValue).toBe(1);
    expect(a.isPresent).toBe(false);
  });
});

// GradeScale tests moved to grading/__tests__/entities/grade-scale.test.ts — grading-foundations
// GradeScaleValue tests moved to grading/__tests__/entities/grade-scale-value.test.ts — grading-foundations
