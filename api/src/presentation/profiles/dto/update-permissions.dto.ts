import { z } from 'zod';

export const UpdatePermissionsSchema = z.object({
  permissions: z.array(z.object({
    moduleId: z.string().uuid(),
    canRead: z.boolean(),
    canCreate: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    canPrint: z.boolean(),
  })),
});

export type UpdatePermissionsDTO = z.infer<typeof UpdatePermissionsSchema>;
