/**
 * Per-worker env defaults for integration tests.
 *
 * Some use-cases (e.g. CreateGrupoUseCase) construct PrismaService, whose
 * constructor runs loadEnvConfig() — that REQUIRES a 32-byte ENCRYPTION_KEY and
 * a master DB URL. We point the master client at the dedicated test master DB so
 * `validateTeacherLevel`'s user lookup resolves to null (random userId) and
 * bypasses the level check, instead of failing on a bad connection.
 */
import { MASTER_URL } from './test-db';

// FORCE the master URL to the dedicated test DB. api/.env is loaded into
// process.env by Vitest BEFORE setupFiles, so a conditional (??=) would leave
// the real master URL in place and the booted app would hit production. This
// unconditional assignment guarantees the app routes to the test databases.
process.env.MASTER_DATABASE_URL = MASTER_URL;
process.env.DATABASE_URL = MASTER_URL;
process.env.ENCRYPTION_KEY ??= 'x'.repeat(32);
process.env.JWT_SECRET ??= 'test-secret';
