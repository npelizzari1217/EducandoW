import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Password mínimo 6 caracteres'),
  name: z.string().min(1, 'Name es requerido'),
  institutionId: z.string().uuid('Institution ID inválido').optional(),
  level: z.number().int().min(1).max(9).optional(),
  modality: z.number().int().min(0).max(9).optional(),
  roles: z.array(z.string()).min(1, 'Al menos un rol requerido').optional(),
  role: z.string().optional(), // Legacy: single role string
});

export type CreateUserDTO = z.infer<typeof CreateUserSchema>;
