import { z } from 'zod';

/**
 * Zod schema for POST /v1/reportes/constancia-regular/:axccId request body.
 * Satisfies: REQ-3 (destinatario non-empty, fechaEmision YYYY-MM-DD format).
 */
export const ConstanciaBodySchema = z.object({
  destinatario: z.string().trim().min(1),
  fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ConstanciaBodyDto = z.infer<typeof ConstanciaBodySchema>;
