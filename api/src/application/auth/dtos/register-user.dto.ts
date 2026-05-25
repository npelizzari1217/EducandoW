export interface RegisterUserDTO {
  email: string;
  password: string;
  name: string;
  /** @deprecated Use `roles: string[]` for RBAC. */
  role?: string;
  /** Role names to assign to the new user. */
  roles?: string[];
  institutionId?: string;
}
