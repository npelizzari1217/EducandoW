import { z } from 'zod';

export const AssignGuardianSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  relationship: z.enum(['mother', 'father', 'legal_guardian', 'other'], {
    errorMap: () => ({ message: 'relationship must be one of: mother, father, legal_guardian, other' }),
  }),
  isFinancialResponsible: z.boolean().optional().default(false),
  isAuthorizedToPickUp: z.boolean().optional().default(false),
});

export type AssignGuardianDTO = z.infer<typeof AssignGuardianSchema>;
