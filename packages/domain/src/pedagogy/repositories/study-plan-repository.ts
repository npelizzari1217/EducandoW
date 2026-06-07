import type { StudyPlan } from '../entities/study-plan';

export interface StudyPlanCourseDto {
  id: string;
  studyPlanId: string;
  courseSectionId: string;
  courseSectionName?: string;
  courseGrade?: string | null;
  courseDivision?: string | null;
  subjects?: { id: string; subjectId: string; subjectName?: string; hoursPerWeek?: number }[];
}

export interface StudyPlanRepository {
  findById(id: string): Promise<StudyPlan | null>;
  findAll(level?: number): Promise<StudyPlan[]>;
  save(plan: StudyPlan): Promise<void>;
  softDelete(id: string): Promise<void>;
  addCourse(planId: string, courseSectionId: string): Promise<void>;
  removeCourse(planId: string, courseSectionId: string): Promise<void>;
  addSubject(planCourseId: string, subjectId: string, hoursPerWeek?: number): Promise<void>;
  removeSubject(planCourseId: string, subjectId: string): Promise<void>;
  findPlanCourseById(id: string): Promise<StudyPlanCourseDto | null>;
  findPlanCoursesByPlan(planId: string): Promise<StudyPlanCourseDto[]>;
  /** Atomically save the plan row and cascade level/modality to all child rows in a single transaction. */
  saveWithLevelCascade(plan: StudyPlan, level: number, modality: number): Promise<void>;
  /** Returns the count of dependent records that would block a soft-delete. */
  getDependencies(planId: string): Promise<{ courseCount: number; courseCycleCount: number }>;
}
