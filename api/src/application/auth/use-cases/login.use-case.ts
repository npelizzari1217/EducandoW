import {
  Email,
  UserRepository,
  InvalidCredentialsError,
  InstitutionRepository,
  ValidationError,
  Result,
  ok,
  err,
} from '@educandow/domain';
import type { RefreshTokenRepository } from '@educandow/domain';
import { PasswordHasher } from '../ports/password-hasher';
import { LoginDTO } from '../dtos/login.dto';
import type { AuthPort } from '../ports/auth-port';
import crypto from 'crypto';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    roles: string[];
    modules?: { moduleCode: string; actions: string[] }[];
    institutionId?: string;
    level?: number;
    dbName?: string | null;
  };
}

export class LoginUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly institutionRepo: InstitutionRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly authPort: AuthPort,
    private readonly refreshTokenRepo: RefreshTokenRepository,
  ) {}

  async execute(dto: LoginDTO): Promise<Result<LoginResult, Error>> {
    const emailResult = Email.create(dto.email);
    if (emailResult.isErr()) return err(emailResult.unwrapErr());
    const email = emailResult.unwrap();

    const user = await this.userRepo.findByEmail(email.get());
    if (!user) return err(new InvalidCredentialsError());

    const valid = await this.passwordHasher.compare(dto.password, user.passwordHash);
    if (!valid) return err(new InvalidCredentialsError());

    const userId = user.id.get();

    // Resolve dbName and check institution active status
    let dbName: string | null = null;
    if (user.institutionId) {
      const institution = await this.institutionRepo.findById(user.institutionId);
      if (!institution) {
        return err(new ValidationError('Institución no encontrada'));
      }
      if (institution.active === false) {
        return err(new ValidationError('La institución se encuentra inactiva'));
      }
      dbName = institution.dbName ?? `educandow_${user.institutionId}`;
    }

    const accessToken = this.authPort.sign({
      sub: userId,
      roles: user.roles,
      modules: user.modules,
      institutionId: user.institutionId,
      level: user.level,
      dbName,
    });

    // Generate and store refresh token (cleanup old sessions first)
    const refreshToken = crypto.randomUUID();
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepo.deleteAllForUser(userId);
    await this.refreshTokenRepo.create(userId, refreshToken, refreshExpiresAt);

    return ok({
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email: user.email.get(),
        name: user.name,
        role: user.role,
        roles: user.roles,
        modules: user.modules,
        institutionId: user.institutionId,
        level: user.level,
        dbName,
      },
    });
  }
}
