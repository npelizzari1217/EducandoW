export interface UserProfileDTO {
  id: string;
  email: string;
  name: string;
  /** Backward-compat: first role name. */
  role: string;
  /** All role names assigned via RBAC. */
  roles: string[];
  /** Module access entries (merged role + user modules). */
  modules?: { moduleCode: string; actions: string[] }[];
  institutionId?: string;
  level?: number;
  modality?: number;
  createdAt: string;
}
