import {
  Email,
  Password,
  User,
  UserRepository,
  EmailAlreadyExistsError,
  UserRegistered,
  EventBus,
  Result,
  ok,
  err,
} from '@educandow/domain';
import { PasswordHasher } from '../ports/password-hasher';
import { RegisterUserDTO } from '../dtos/register-user.dto';
import { UserProfileDTO } from '../dtos/user-profile.dto';

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly eventBus: EventBus,
  ) {}

  async execute(dto: RegisterUserDTO): Promise<Result<UserProfileDTO, Error>> {
    const emailResult = Email.create(dto.email);
    if (emailResult.isErr()) return err(emailResult.unwrapErr());
    const email = emailResult.unwrap();

    if (!dto.name?.trim()) return err(new Error('Name cannot be empty'));

    const passwordResult = Password.create(dto.password);
    if (passwordResult.isErr()) return err(passwordResult.unwrapErr());
    const plainPassword = passwordResult.unwrap();

    const exists = await this.userRepo.existsByEmail(email);
    if (exists) return err(new EmailAlreadyExistsError(email.get()));

    const user = User.create({
      email,
      name: dto.name.trim(),
      hashedPassword: '',
      role: (dto.role as any) ?? 'ADMIN',
      institutionId: dto.institutionId,
    });

    const hashed = await this.passwordHasher.hash(plainPassword.get());
    user.setHashedPassword(hashed);

    const saveResult = await this.userRepo.save(user);
    if (saveResult.isErr()) return err(saveResult.unwrapErr());
    const saved = saveResult.unwrap();

    this.eventBus.publish(
      new UserRegistered(saved.id, saved.email, saved.name, saved.role),
    );

    return ok({
      id: saved.id.get(),
      email: saved.email.get(),
      name: saved.name,
      role: saved.role,
      institutionId: saved.institutionId,
      level: saved.level,
      createdAt: saved.createdAt.toISOString(),
    });
  }
}
