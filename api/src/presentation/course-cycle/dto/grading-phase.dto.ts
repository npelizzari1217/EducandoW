import { z } from 'zod';

/** PATCH /course-cycles/:uuid/grading-phase — sets (or clears) the active grading phase. */
export const SetGradingPhaseSchema = z.object({
  gradingPhase: z.enum(['BIM_1', 'BIM_2', 'BIM_3', 'BIM_4', 'CIERRE']).nullable(),
});

export type SetGradingPhaseDto = z.infer<typeof SetGradingPhaseSchema>;
