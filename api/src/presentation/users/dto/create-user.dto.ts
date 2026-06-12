import { z } from 'zod';

export const ModuleAccessSchema = z.object({
  moduleCode: z.string().min(1),
  actions: z.array(z.string()).min(1, 'Al menos una acción requerida'),
});

export const CreateUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Password mínimo 6 caracteres'),
  name: z.string().min(1, 'Name es requerido'),
  institutionId: z.string().uuid('Institution ID inválido').optional(),
  roles: z.array(z.string()).min(1, 'Al menos un rol requerido').optional(),
  role: z.string().optional(), // Legacy: single role string
  moduleAccess: z.array(ModuleAccessSchema).optional(),
  levels: z.array(z.object({
    level: z.number().int().min(1).max(9),
    modality: z.number().int().min(0).max(9),
  })).optional(),
  profileId: z.string().min(1, 'profileId es requerido').optional(),
  // Persona fields (Fase 1 — UP-R1) — all optional
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dni: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
});

export type CreateUserDTO = z.infer<typeof CreateUserSchema>;
