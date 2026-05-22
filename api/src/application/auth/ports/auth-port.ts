/**
 * Application-layer port for authentication token operations.
 * Implementations live in infrastructure (e.g., JwtAuthPort).
 */
export interface AuthPort {
  sign(payload: {
    sub: string;
    role: string;
    institutionId?: string;
    level?: string;
    dbName?: string | null;
  }): string;
  verify(token: string): {
    sub: string;
    role: string;
    institutionId?: string;
    level?: string;
    dbName?: string | null;
  };
}
