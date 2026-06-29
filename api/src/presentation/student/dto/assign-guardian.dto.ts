import { z } from 'zod';

// Unified POST body for both portal-link (userId present) and study-tutor (userId absent) paths.
// Controller dispatches based on userId presence:
//   userId present  → AssignGuardianUseCase (portal link)
//   userId absent   → CreateStudyTutorUseCase (study tutor)
// When both userId and fullName are present, userId takes precedence (portal path).
export const AssignGuardianSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID').optional(),
  relationship: z.string().min(1, 'relationship is required').max(15, 'relationship must be at most 15 characters'),
  fullName: z.string().min(1).optional(),
  mobile: z.string().min(1).optional(),
  email: z.string().email().optional(),
  isFinancialResponsible: z.boolean().optional().default(false),
  isAuthorizedToPickUp: z.boolean().optional().default(false),
  allowDuplicate: z.boolean().optional().default(false),
});

export type AssignGuardianDTO = z.infer<typeof AssignGuardianSchema>;
