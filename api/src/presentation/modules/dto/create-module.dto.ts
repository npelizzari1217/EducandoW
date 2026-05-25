import { z } from 'zod';

export const CreateModuleSchema = z.object({
  code: z.string().min(1, 'Code es requerido').max(50, 'Code máximo 50 caracteres'),
  name: z.string().min(1, 'Name es requerido').max(100, 'Name máximo 100 caracteres'),
});

export type CreateModuleDTO = z.infer<typeof CreateModuleSchema>;
