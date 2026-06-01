export interface EnvConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  masterDatabaseUrl: string;
  encryptionKey: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  corsOrigin: string;
  bcryptRounds: number;
}

export function loadEnvConfig(): EnvConfig {
  const encryptionKey = process.env.ENCRYPTION_KEY ?? '';

  // ENCRYPTION_KEY is required in ALL environments (32 bytes for AES-256)
  if (!encryptionKey || Buffer.byteLength(encryptionKey, 'utf8') !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes');
  }

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/educandow',
    masterDatabaseUrl: process.env.MASTER_DATABASE_URL ?? process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/educandow',
    encryptionKey: encryptionKey ?? '',
    jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  };
}
