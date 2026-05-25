export interface RefreshTokenData {
  userId: string;
  expiresAt: Date;
}

export interface RefreshTokenRepository {
  create(userId: string, token: string, expiresAt: Date): Promise<void>;
  findByToken(token: string): Promise<RefreshTokenData | null>;
  deleteByToken(token: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}
