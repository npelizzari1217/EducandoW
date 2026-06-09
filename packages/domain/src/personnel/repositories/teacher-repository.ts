import type { Teacher } from '../entities';

export interface TeacherRepository {
  findById(id: string): Promise<Teacher | null>;
  findByInstitution(institutionId: string): Promise<Teacher[]>;
  findByDni(dni: string): Promise<Teacher | null>;
  /**
   * Resolves a Teacher by their master-DB userId link (AD-6).
   * Returns null when no Teacher has that userId — caller returns empty result, never 404.
   * Tenant scoping is via TenantContext (no institutionId param — same as other methods).
   */
  findByUserId(userId: string): Promise<Teacher | null>;
  search(institutionId: string, query: string): Promise<Teacher[]>;
  save(teacher: Teacher): Promise<void>;
  delete(id: string): Promise<void>;
}
