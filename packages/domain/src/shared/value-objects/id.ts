import { ok, err, Result } from '../result';

export class Id {
  private constructor(private readonly value: string) {}

  static create(value?: string): Id {
    const id = value ?? crypto.randomUUID();
    return new Id(id);
  }

  static reconstruct(value: string): Id {
    return new Id(value);
  }

  get(): string {
    return this.value;
  }

  equals(other: Id): boolean {
    return this.value === other.value;
  }
}
