import { z } from 'zod';

export class RegisterRequest {
  email!: string;
  password!: string;
  name!: string;
  role?: string;
  institutionId?: string;
}

export const RegisterSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(128),
  name: z.string().min(1, 'El nombre es requerido').max(200),
  role: z.enum(['ADMIN', 'MANAGER', 'TEACHER']).optional().default('TEACHER'),
  institutionId: z.string().uuid('ID de institución inválido').optional(),
});

export type RegisterDTO = z.infer<typeof RegisterSchema>;
