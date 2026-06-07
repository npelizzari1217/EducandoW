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
  /** Cascade a level/modality change to all child rows of the plan. */
  cascadeChildrenLevel(planId: string, level: number, modality: number): Promise<void>;
}
