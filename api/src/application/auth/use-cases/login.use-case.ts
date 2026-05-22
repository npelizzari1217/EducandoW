import {
  Email,
  UserRepository,
  InvalidCredentialsError,
  Result,
  ok,
  err,
} from '@educandow/domain';
import type { RefreshTokenRepository } from '@educandow/domain';
import { PasswordHasher } from '../ports/password-hasher';
import { LoginDTO } from '../dtos/login.dto';
import { JwtAuthPort } from '../../../infrastructure/auth/jwt-auth-port';
import crypto from 'crypto';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    institutionId?: string;
    level?: string;
  };
}

export class LoginUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly authPort: JwtAuthPort,
    private readonly refreshTokenRepo: RefreshTokenRepository,
  ) {}

  async execute(dto: LoginDTO): Promise<Result<LoginResult, Error>> {
    const emailResult = Email.create(dto.email);
    if (emailResult.isErr()) return err(emailResult.unwrapErr());
    const email = emailResult.unwrap();

    const user = await this.userRepo.findByEmail(email.get());
    if (!user) return err(new InvalidCredentialsError());

    const valid = await this.passwordHasher.compare(dto.password, user.hashedPassword);
    if (!valid) return err(new InvalidCredentialsError());

    const userId = user.id.get();

    const accessToken = this.authPort.sign({
      sub: userId,
      role: user.role,
      institutionId: user.institutionId,
      level: user.level,
    });

    // Generate and store refresh token (cleanup old sessions first)
    const refreshToken = crypto.randomUUID();
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepo.deleteAllForUser(userId);
    await this.refreshTokenRepo.create(userId, user.role, refreshToken, refreshExpiresAt);

    return ok({
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email: user.email.get(),
        name: user.name,
        role: user.role,
        institutionId: user.institutionId,
        level: user.level,
      },
    });
  }
}
