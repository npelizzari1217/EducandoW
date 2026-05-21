import {
  Email,
  UserRepository,
  InvalidCredentialsError,
  Result,
  ok,
  err,
} from '@educandow/domain';
import { PasswordHasher } from '../ports/password-hasher';
import { LoginDTO } from '../dtos/login.dto';

export interface LoginResult {
  accessToken: string;
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
    private readonly authPort: any,
  ) {}

  async execute(dto: LoginDTO): Promise<Result<LoginResult, Error>> {
    const emailResult = Email.create(dto.email);
    if (emailResult.isErr()) return err(emailResult.unwrapErr());
    const email = emailResult.unwrap();

    const user = await this.userRepo.findByEmail(email.get());
    if (!user) return err(new InvalidCredentialsError());

    const valid = await this.passwordHasher.compare(dto.password, user.hashedPassword);
    if (!valid) return err(new InvalidCredentialsError());

    const accessToken = this.authPort.sign({
      sub: user.id.get(),
      role: user.role,
      institutionId: user.institutionId,
      level: user.level,
    });

    return ok({
      accessToken,
      user: {
        id: user.id.get(),
        email: user.email.get(),
        name: user.name,
        role: user.role,
        institutionId: user.institutionId,
        level: user.level,
      },
    });
  }
}
