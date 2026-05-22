import { z } from 'zod';

export class LoginRequest {
  email!: string;
  password!: string;
}

export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export type LoginDTO = z.infer<typeof LoginSchema>;
