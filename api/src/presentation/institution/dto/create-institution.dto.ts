import { z } from 'zod';

export const CreateInstitutionSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  address: z.string().max(300).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  levels: z.array(z.enum(['INICIAL', 'PRIMARIO', 'SECUNDARIO', 'TERCIARIO'])).min(1, 'Al menos un nivel'),
});

export type CreateInstitutionDTO = z.infer<typeof CreateInstitutionSchema>;
