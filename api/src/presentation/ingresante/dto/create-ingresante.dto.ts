import { z } from 'zod';

export const CreateIngresanteSchema = z.object({
  firstName: z.string().min(1, 'firstName es requerido').max(100),
  lastName: z.string().min(1, 'lastName es requerido').max(100),
  dni: z
    .string()
    .min(6)
    .max(12)
    .regex(/^[A-Z0-9]+$/, 'El DNI debe ser alfanumérico en mayúscula sin símbolos')
    .transform((s) => s.toUpperCase()),
  birthDate: z.string().optional(),
  address: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cycleId: z.string().uuid('cycleId debe ser un UUID válido'),
  level: z.string().min(1, 'level es requerido'),
  modality: z.string().optional(),
});

export type CreateIngresanteDTO = z.infer<typeof CreateIngresanteSchema>;

export const UpdateIngresanteStatusSchema = z.object({
  status: z.string().min(1, 'status es requerido'),
});

export type UpdateIngresanteStatusDTO = z.infer<typeof UpdateIngresanteStatusSchema>;
