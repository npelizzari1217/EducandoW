import { z } from 'zod';

export const InscribirAlumnoSchema = z.object({
  studentId: z.string().uuid(),
});

export type InscribirAlumnoDTO = z.infer<typeof InscribirAlumnoSchema>;
