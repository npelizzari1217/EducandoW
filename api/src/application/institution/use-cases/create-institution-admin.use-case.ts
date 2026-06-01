import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import type { PrismaClient as MasterPrismaClient } from '@prisma/client';

export interface CreateInstitutionAdminInput {
  adminEmail: string;
  dbName: string;
  institutionId: string;
}

export interface CreateInstitutionAdminOutput {
  email: string;
  password: string;
}

/**
 * Creates an admin user in the master database for a newly created institution.
 *
 * - Generates a random 16-character temporary password
 * - Hashes it with bcrypt (12 rounds)
 * - Inserts the user into `master.users` with role='ADMIN'
 * - Returns the plaintext credentials for one-time display
 */
export class CreateInstitutionAdminUseCase {
  private readonly bcryptRounds: number;

  constructor(
    private readonly masterClient: MasterPrismaClient,
  ) {
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
  }

  async execute(input: CreateInstitutionAdminInput): Promise<CreateInstitutionAdminOutput> {
    // Generate temporary password (16 random hex characters → 32 hex chars output,
    // but since toString('hex') gives 2 chars per byte, use 8 bytes for 16 hex chars)
    const password = randomBytes(8).toString('hex');

    // Hash the password
    const passwordHash = await bcrypt.hash(password, this.bcryptRounds);

    // Insert admin user into master DB
    const user = await this.masterClient.user.create({
      data: {
        email: input.adminEmail,
        passwordHash,
        name: 'Administrador',
        institutionId: input.institutionId,
        active: true,
      },
    });

    // Assign ADMIN role
    await this.masterClient.userRole.create({
      data: {
        user: {
          connect: { id: user.id },
        },
        role: {
          connect: { name: 'ADMIN' },
        },
      },
    });

    return {
      email: input.adminEmail,
      password,
    };
  }
}
