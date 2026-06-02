import { z } from 'zod';
import { ModuleAccessSchema } from './create-user.dto';

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  institutionId: z.string().uuid().optional().nullable(),
  roles: z.array(z.string()).min(1).optional(),
  active: z.boolean().optional(),
  moduleAccess: z.array(ModuleAccessSchema).optional(),
  levels: z.array(z.object({
    level: z.number().int().min(1).max(9),
    modality: z.number().int().min(0).max(9),
  })).optional(),
  profileId: z.string().min(1, 'profileId es requerido').optional().nullable(),
});

export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>;
