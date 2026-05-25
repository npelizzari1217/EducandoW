/**
 * Application-layer port for authentication token operations.
 * Implementations live in infrastructure (e.g., JwtAuthPort).
 */
export interface AuthPort {
  sign(payload: {
    sub: string;
    roles: string[];
    modules?: { moduleCode: string; actions: string[] }[];
    institutionId?: string;
    level?: number;
    dbName?: string | null;
  }): string;
  verify(token: string): {
    sub: string;
    roles: string[];
    modules?: { moduleCode: string; actions: string[] }[];
    institutionId?: string;
    level?: number;
    dbName?: string | null;
  };
}
