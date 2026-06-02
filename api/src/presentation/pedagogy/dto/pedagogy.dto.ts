// Re-export from shared DTOs
export { CreateSubjectSchema, CreateCourseSectionSchema, CreateSubjectAssignmentSchema, CreateEvaluacionSchema, CreateNotaSchema, CreatePeriodoSchema, CreateNotaTrimestralSchema, CreateAttendanceSchema, CreateStudyPlanSchema, UpdateStudyPlanSchema, UpdateSubjectSchema, UpdateCourseSectionSchema, AddCourseToPlanSchema, AddSubjectToPlanCourseSchema, type CreateSubjectDTO, type CreateCourseSectionDTO, type CreateSubjectAssignmentDTO, type CreateEvaluacionDTO, type CreateNotaDTO, type CreatePeriodoDTO, type CreateNotaTrimestralDTO, type CreateAttendanceDTO, type CreateStudyPlanDTO, type UpdateStudyPlanDTO, type UpdateSubjectDTO, type UpdateCourseSectionDTO, type AddCourseToPlanDTO, type AddSubjectToPlanCourseDTO } from '../../auth/dto/register.request';

// Academic Cycle DTOs
export { CreateAcademicCycleSchema, UpdateAcademicCycleSchema, type CreateAcademicCycleDTO, type UpdateAcademicCycleDTO } from './academic-cycle.dto';
