import {
  Id,
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
      passwordHash: '',
      roles: dto.roles ?? (dto.role ? [dto.role] : ['TEACHER']),
      institutionId: dto.institutionId ? Id.create(dto.institutionId) : undefined,
    });

    const hashed = await this.passwordHasher.hash(plainPassword.get());
    user.setPasswordHash(hashed);

    const saveResult = await this.userRepo.save(user);
    if (saveResult.isErr()) return err(saveResult.unwrapErr());
    const saved = saveResult.unwrap();

    this.eventBus.publish(
      new UserRegistered(saved.id, saved.email, saved.name, saved.roles),
    );

    const userLevels = saved.levels;
    const levels = userLevels.map((l) => l.level * 10 + l.modality);

    return ok({
      id: saved.id.get(),
      email: saved.email.get(),
      name: saved.name,
      role: saved.role,
      roles: saved.roles,
      modules: saved.modules,
      institutionId: saved.institutionId?.get(),
      levels,
      userLevels: userLevels.map((l) => ({ level: l.level, modality: l.modality })),
      createdAt: saved.createdAt.toISOString(),
    });
  }
}
