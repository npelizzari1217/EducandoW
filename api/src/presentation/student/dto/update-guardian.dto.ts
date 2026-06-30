import { z } from 'zod';

export const UpdateGuardianSchema = z.object({
  fullName: z.string().min(1).optional(),
  mobile: z.string().min(1).nullable().optional(),  // Round4-Bug5: null = explicit clear
  email: z.string().email().nullable().optional(),
  relationship: z.string().min(1).max(15, 'relationship must be at most 15 characters').optional(),
  active: z.boolean().optional(),
  isFinancialResponsible: z.boolean().optional(),
  isAuthorizedToPickUp: z.boolean().optional(),
  allowDuplicate: z.boolean().optional(),  // Round4-Bug2: passed when reactivating with confirmed duplicate
});

export type UpdateGuardianDTO = z.infer<typeof UpdateGuardianSchema>;
