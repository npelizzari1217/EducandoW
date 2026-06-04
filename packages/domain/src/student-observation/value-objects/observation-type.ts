import { Result, ok, err } from '../../shared/result';

export enum ObservationTypeValue {
  PEDAGOGICAL = 'PEDAGOGICAL',
  PSYCHOPEDAGOGICAL = 'PSYCHOPEDAGOGICAL',
}

export class ObservationType {
  private constructor(public readonly value: ObservationTypeValue) {}

  public static create(value: string): Result<ObservationType, Error> {
    const upperValue = value.toUpperCase();
    if (!Object.values(ObservationTypeValue).includes(upperValue as ObservationTypeValue)) {
      return err(new Error(`Invalid observation type: ${value}`));
    }
    return ok(new ObservationType(upperValue as ObservationTypeValue));
  }

  public static reconstruct(value: ObservationTypeValue): ObservationType {
    return new ObservationType(value);
  }
}
