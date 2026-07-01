import { z } from 'zod';

/**
 * DTO for GET /attendance-types/print (PR4, T25/T26).
 * Query params: `level` and `active`, same shape/rules as the list endpoint's
 * manual parsing in attendance-type.controller.ts (level ∈ {1,2,3,4}, active
 * boolean-like). Validated with Zod (ADD-4.2: transport validation happens
 * BEFORE evaluating scope).
 */
export const PrintAttendanceTypesQuerySchema = z.object({
  level: z.coerce
    .number({ invalid_type_error: 'level must be a number' })
    .int()
    .refine((v) => [1, 2, 3, 4].includes(v), {
      message: 'level must be 1, 2, 3 or 4 (ADMINISTRACION not allowed)',
    })
    .optional(),
  // z.preprocess (not z.enum().transform()) so the schema's Input type stays
  // `unknown` — matches the z.coerce pattern used for `level` above. A plain
  // z.enum().transform() narrows Input to the literal union "true"|"false",
  // which ZodValidationPipe<PrintAttendanceTypesDTO> then rejects at compile
  // time (Input must accept the DTO's `boolean` output type structurally).
  active: z.preprocess((v) => {
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v;
  }, z.boolean({ invalid_type_error: 'active must be "true" or "false"' }).optional()),
});

export type PrintAttendanceTypesDTO = z.infer<typeof PrintAttendanceTypesQuerySchema>;
