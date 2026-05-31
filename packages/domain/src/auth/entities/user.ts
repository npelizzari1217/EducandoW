import { Id } from '../../shared/value-objects/id';
import { Email } from '../../shared/value-objects/email';
import { EducationalLevelCode } from '../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../shared/value-objects/educational-modality';

/**
 * Known system role names — used for static type-checking in the Roles decorator.
 */
export type UserRole = 'ROOT' | 'ADMIN' | 'DIRECTOR' | 'SECRETARIO' | 'PRECEPTOR' | 'MANAGER' | 'TEACHER' | 'TUTOR' | 'STUDENT';

/**
 * Module access entry: what actions this user has on a specific module.
 */
export interface ModuleAccess {
  moduleCode: string;
  actions: string[];
}

/**
 * Educational level entry for a user — mirrors InstitutionLevelEntry.
 */
export interface UserLevelEntry {
  level: EducationalLevelCode;
  modality: EducationalModalityCode;
}

export interface UserProps {
  id: Id;
  email: Email;
  name: string;
  passwordHash: string;
  /** Role names loaded from userRoles → role relation (M:N RBAC). */
  roles?: string[];
  /** Module access entries loaded from userRoles → roleModules and userModules. */
  modules?: ModuleAccess[];
  institutionId?: string;
  /**
   * @deprecated Use `levels: UserLevelEntry[]` instead. Kept for backward compat
   * during migration. Will be removed next release.
   */
  level?: EducationalLevelCode;
  /**
   * @deprecated Use `levels: UserLevelEntry[]` instead. Kept for backward compat
   * during migration. Will be removed next release.
   */
  modality?: EducationalModalityCode;
  /** Educational levels assigned to this user — replaces scalar level/modality. */
  levels?: UserLevelEntry[];
  failedAttempts?: number;
  lockedUntil?: Date;
  active?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private props: UserProps) {}

  /**
   * Creates a new user. Accepts an optional `role` string for backward compat;
   * converts it to the `roles` array used by the RBAC model.
   */
  static create(
    props: Omit<UserProps, 'id' | 'failedAttempts' | 'lockedUntil' | 'active' | 'deletedAt' | 'createdAt' | 'updatedAt'> & {
      /** @deprecated Use `roles: string[]` instead. Provided for backward compat. */
      role?: string;
      /** @deprecated Use `modules: ModuleAccess[]` instead. */
      permissions?: string[];
    },
  ): User {
    const roles = props.roles ?? (props.role ? [props.role] : []);
    const modules = props.modules ?? [];
    const levels = props.levels ?? [];
    return new User({
      id: Id.create(),
      email: props.email,
      name: props.name,
      passwordHash: props.passwordHash,
      roles,
      modules,
      institutionId: props.institutionId,
      level: props.level,
      modality: props.modality,
      levels,
      failedAttempts: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstruct(props: UserProps): User {
    return new User(props);
  }

  get id(): Id { return this.props.id; }
  get email(): Email { return this.props.email; }
  get name(): string { return this.props.name; }
  get passwordHash(): string { return this.props.passwordHash; }

  /** All role names assigned to this user via userRoles. */
  get roles(): string[] { return this.props.roles ?? []; }

  /** Module access entries from roles + user overrides. */
  get modules(): ModuleAccess[] { return this.props.modules ?? []; }

  /**
   * Backward-compat accessor: returns the first role name, or 'TEACHER' if none.
   * @deprecated Use `roles` array and `hasRole()` for RBAC queries.
   */
  get role(): string { return this.props.roles?.[0] ?? 'TEACHER'; }

  get institutionId(): string | undefined { return this.props.institutionId; }

  /**
   * Backward-compat accessor: returns the first entry's level code, or undefined.
   * @deprecated Use `levels` array and `hasEducationalLevel()` instead.
   */
  get level(): EducationalLevelCode | undefined {
    return this.props.levels?.[0]?.level ?? this.props.level;
  }

  /**
   * Backward-compat accessor: returns the first entry's modality code, or undefined.
   * @deprecated Use `levels` array instead.
   */
  get modality(): EducationalModalityCode | undefined {
    return this.props.levels?.[0]?.modality ?? this.props.modality;
  }

  /** Educational levels assigned to this user. Returns a defensive copy. */
  get levels(): UserLevelEntry[] {
    return [...(this.props.levels ?? [])];
  }
  get failedAttempts(): number { return this.props.failedAttempts ?? 0; }
  get lockedUntil(): Date | undefined { return this.props.lockedUntil; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  get isLocked(): boolean {
    if (!this.props.lockedUntil) return false;
    return this.props.lockedUntil > new Date();
  }

  /** Checks whether the user has a specific role (by name). */
  hasRole(name: string): boolean {
    return this.roles.includes(name);
  }

  /**
   * Checks whether the user has a specific action on a module.
   * ROOT always returns true.
   *
   * @param moduleCode - e.g. 'GRADES', 'USERS', 'INSTITUTIONS'
   * @param action     - e.g. 'READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'
   *
   * Merges role_modules + user_modules; user_modules override role_modules for the same module.
   */
  hasPermission(moduleCode: string, action?: string): boolean {
    if (this.hasRole('ROOT')) return true;

    const modules = this.props.modules ?? [];
    if (modules.length === 0) return false;

    // Build effective access map (user overrides role)
    const effective = new Map<string, Set<string>>();

    for (const entry of modules) {
      if (!effective.has(entry.moduleCode)) {
        effective.set(entry.moduleCode, new Set());
      }
      for (const act of entry.actions) {
        effective.get(entry.moduleCode)!.add(act);
      }
    }

    // If called with a legacy single-string code (e.g. "GRADES_CREATE"),
    // parse it as MODULE_ACTION
    if (!action) {
      const parts = moduleCode.split('_');
      if (parts.length >= 2) {
        const possibleAction = parts.pop()!;
        const possibleModule = parts.join('_');
        const moduleActions = effective.get(possibleModule);
        if (moduleActions?.has(possibleAction)) return true;
      }
      // Try exact match in old permission format
      for (const [mod, actions] of effective) {
        for (const act of actions) {
          if (`${mod}_${act}` === moduleCode) return true;
        }
      }
      return false;
    }

    const moduleActions = effective.get(moduleCode);
    return moduleActions ? moduleActions.has(action) : false;
  }

  /** Returns the effective actions for a module (role + user merged). */
  getModuleActions(moduleCode: string): string[] {
    const modules = this.props.modules ?? [];
    const effective = new Set<string>();

    for (const entry of modules) {
      if (entry.moduleCode === moduleCode) {
        for (const act of entry.actions) {
          effective.add(act);
        }
      }
    }

    return [...effective];
  }

  setPasswordHash(hash: string): void {
    this.props.passwordHash = hash;
    this.props.updatedAt = new Date();
  }

  assignToInstitution(institutionId: string): void {
    this.props.institutionId = institutionId;
    this.props.updatedAt = new Date();
  }

  /**
   * Adds a level entry if not already present (deduplication by level+modality).
   */
  addLevel(level: EducationalLevelCode, modality: EducationalModalityCode): void {
    if (!this.props.levels) {
      this.props.levels = [];
    }
    if (!this.props.levels.some((l) => l.level === level && l.modality === modality)) {
      this.props.levels.push({ level, modality });
      this.props.updatedAt = new Date();
    }
  }

  /**
   * Checks whether the user has a specific level entry.
   * When modality is omitted, matches any modality for the given level.
   */
  hasLevel(target: { level: EducationalLevelCode; modality?: EducationalModalityCode }): boolean {
    const entries = this.props.levels ?? [];
    if (target.modality !== undefined) {
      return entries.some((l) => l.level === target.level && l.modality === target.modality);
    }
    return entries.some((l) => l.level === target.level);
  }

  /**
   * Checks whether the user has any entry for the given base educational level
   * (regardless of modality).
   */
  hasEducationalLevel(code: EducationalLevelCode): boolean {
    return (this.props.levels ?? []).some((l) => l.level === code);
  }

  /**
   * @deprecated Use `addLevel()` instead. This is a no-op for backward compat.
   */
  assignLevel(_level: EducationalLevelCode): void {
    // no-op — levels are now managed via addLevel() and the levels array
  }

  /**
   * @deprecated Use `addLevel()` instead. This is a no-op for backward compat.
   */
  assignModality(_modality: EducationalModalityCode): void {
    // no-op — levels are now managed via addLevel() and the levels array
  }

  incrementFailedAttempts(): void {
    this.props.failedAttempts = (this.props.failedAttempts ?? 0) + 1;
  }

  resetFailedAttempts(): void {
    this.props.failedAttempts = 0;
    this.props.lockedUntil = undefined;
  }

  lock(durationMinutes: number): void {
    this.props.lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }
}
