export type CondicionAlumnoCode = 'APROBADO' | 'PREVIA' | 'LIBRE';

const VALID: ReadonlySet<CondicionAlumnoCode> = new Set(['APROBADO', 'PREVIA', 'LIBRE']);

export class CondicionAlumno {
  private constructor(private readonly value: CondicionAlumnoCode) {}

  static create(value: string): CondicionAlumno | null {
    if (!VALID.has(value as CondicionAlumnoCode)) return null;
    return new CondicionAlumno(value as CondicionAlumnoCode);
  }

  static reconstruct(value: CondicionAlumnoCode): CondicionAlumno {
    return new CondicionAlumno(value);
  }

  get(): CondicionAlumnoCode {
    return this.value;
  }

  equals(other: CondicionAlumno): boolean {
    return this.value === other.value;
  }
}
