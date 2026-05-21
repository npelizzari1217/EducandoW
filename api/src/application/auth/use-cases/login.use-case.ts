import { Email, Result, ok, err } from '@educandow/domain';
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
    private readonly userRepo: any,
    private readonly passwordHasher: PasswordHasher,
    private readonly authPort: any,
  ) {}

  async execute(dto: LoginDTO): Promise<Result<LoginResult, Error>> {
    const emailResult = Email.create(dto.email);
    if (emailResult.isErr()) {
      return err(emailResult.unwrapErr());
    }
    const email = emailResult.unwrap();

    const user = await this.userRepo.findByEmail(email.get());
    if (!user) {
      return err(new Error('Invalid credentials'));
    }

    const valid = await this.passwordHasher.compare(dto.password, user.password);
    if (!valid) {
      return err(new Error('Invalid credentials'));
    }

    const accessToken = this.authPort.sign({
      sub: user.id,
      role: user.role,
      institutionId: user.institutionId,
      level: user.level,
    });

    return ok({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        institutionId: user.institutionId,
        level: user.level,
      },
    });
  }
}
