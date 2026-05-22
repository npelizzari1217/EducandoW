export interface RefreshTokenData {
  userId: string;
  role: string;
  expiresAt: Date;
}

export interface RefreshTokenRepository {
  create(userId: string, role: string, token: string, expiresAt: Date): Promise<void>;
  findByToken(token: string): Promise<RefreshTokenData | null>;
  deleteByToken(token: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}
