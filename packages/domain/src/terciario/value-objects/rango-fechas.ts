import { ok, err, Result } from '../../shared/result';
import { InvalidLlamadoRangeError } from '../errors/invalid-llamado-range.error';

export class RangoFechas {
  private constructor(
    public readonly inicio: Date,
    public readonly fin: Date,
  ) {}

  static create(inicio: Date, fin: Date): Result<RangoFechas, InvalidLlamadoRangeError> {
    if (inicio.getTime() > fin.getTime()) {
      return err(new InvalidLlamadoRangeError(inicio, fin));
    }
    return ok(new RangoFechas(inicio, fin));
  }

  overlaps(other: { inicio: Date; fin: Date }): boolean {
    return (
      this.inicio.getTime() <= other.fin.getTime() &&
      this.fin.getTime() >= other.inicio.getTime()
    );
  }
}
