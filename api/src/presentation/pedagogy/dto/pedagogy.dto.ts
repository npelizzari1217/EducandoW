// Re-export from shared DTOs
export { CreateSubjectSchema, CreateCourseSectionSchema, CreateStudyPlanSchema, UpdateStudyPlanSchema, UpdateSubjectSchema, UpdateCourseSectionSchema, AddCourseToPlanSchema, AddSubjectToPlanCourseSchema, type CreateSubjectDTO, type CreateCourseSectionDTO, type CreateStudyPlanDTO, type UpdateStudyPlanDTO, type UpdateSubjectDTO, type UpdateCourseSectionDTO, type AddCourseToPlanDTO, type AddSubjectToPlanCourseDTO } from '../../auth/dto/register.request';

// Academic Cycle DTOs
export { CreateAcademicCycleSchema, UpdateAcademicCycleSchema, type CreateAcademicCycleDTO, type UpdateAcademicCycleDTO } from './academic-cycle.dto';
