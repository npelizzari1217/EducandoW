import { Email, Result, ok, err } from '@educandow/domain';
import { PasswordHasher } from '../ports/password-hasher';
import { RegisterUserDTO } from '../dtos/register-user.dto';
import { UserProfileDTO } from '../dtos/user-profile.dto';

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: any,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(dto: RegisterUserDTO): Promise<Result<UserProfileDTO, Error>> {
    const emailResult = Email.create(dto.email);
    if (emailResult.isErr()) {
      return err(emailResult.unwrapErr());
    }
    const email = emailResult.unwrap();

    if (!dto.name || dto.name.trim().length === 0) {
      return err(new Error('Name cannot be empty'));
    }
    if (!dto.password || dto.password.length < 6) {
      return err(new Error('Password must be at least 6 characters'));
    }

    const exists = await this.userRepo.existsByEmail(email);
    if (exists) {
      return err(new Error('Email already exists'));
    }

    const hashedPassword = await this.passwordHasher.hash(dto.password);

    const user = await this.userRepo.create({
      email: email.get(),
      name: dto.name,
      password: hashedPassword,
      role: dto.role ?? 'ADMIN',
      institutionId: dto.institutionId,
    });

    return ok({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      institutionId: user.institutionId,
      level: user.level,
      createdAt: user.createdAt.toISOString(),
    });
  }
}
