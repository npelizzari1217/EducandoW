import * as bcrypt from 'bcrypt';

export class BcryptPasswordHasher {
  constructor(private readonly rounds: number) {}

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
