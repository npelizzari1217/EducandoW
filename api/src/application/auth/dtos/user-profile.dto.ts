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
  /** @deprecated Use `levels` array instead. Kept for backward compat one release. */
  level?: number;
  /** @deprecated Use `levels` array instead. Kept for backward compat one release. */
  modality?: number;
  levels?: number[];
  userLevels?: { level: number; modality: number }[];
  createdAt: string;
}
