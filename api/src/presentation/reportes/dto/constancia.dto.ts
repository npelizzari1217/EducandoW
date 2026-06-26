import { z } from 'zod';

/**
 * Zod schema for POST /v1/reportes/constancia-regular/:axccId request body.
 * Satisfies: REQ-3 (destinatario non-empty, fechaEmision YYYY-MM-DD real calendar date).
 */
export const ConstanciaBodySchema = z.object({
  destinatario: z.string().trim().min(1),
  fechaEmision: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (val) => {
        const [yyyy, mm, dd] = val.split('-').map(Number);
        // Use new Date(y, m-1, d) in local time — no UTC shift — then round-trip check.
        // If any component is out of calendar range, Date normalises and the check fails.
        const date = new Date(yyyy, mm - 1, dd);
        return (
          date.getFullYear() === yyyy &&
          date.getMonth() === mm - 1 &&
          date.getDate() === dd
        );
      },
      { message: 'Fecha inválida' },
    ),
});

export type ConstanciaBodyDto = z.infer<typeof ConstanciaBodySchema>;
