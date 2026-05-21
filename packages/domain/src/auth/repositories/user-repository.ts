import { Result } from '../../shared/result';
import { Email } from '../../shared/value-objects/email';
import { User } from '../entities/user';

export interface UserRepository {
  existsByEmail(email: Email): Promise<boolean>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<Result<User, Error>>;
}
