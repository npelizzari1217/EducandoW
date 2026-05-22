import { z } from 'zod';
import { CreateInstitutionFullSchema } from './create-institution-full.dto';

export const UpdateInstitutionSchema = CreateInstitutionFullSchema.partial();
export type UpdateInstitutionDTO = z.infer<typeof UpdateInstitutionSchema>;
