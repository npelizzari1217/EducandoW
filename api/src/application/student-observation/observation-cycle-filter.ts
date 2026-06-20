import { StudentObservation, ObservationTypeValue } from '@educandow/domain';

/**
 * Filters observations for a cycle scope and rank visibility.
 *
 * - PSYCHOPEDAGOGICAL (EOE): always included (student lifecycle visibility)
 * - PEDAGOGICAL: only if obs.academicCycleId === cycleId (ADR-3 equality filter)
 *   (null/undefined academicCycleId is excluded — legacy records)
 * - callerRank < 50: hides PSYCHOPEDAGOGICAL from non-DIRECTOR callers
 */
export function filterCycleObservations(
  observations: StudentObservation[],
  cycleId: string,
  callerRank: number,
): StudentObservation[] {
  const scoped = observations.filter((obs) => {
    if (obs.type.value === ObservationTypeValue.PSYCHOPEDAGOGICAL) {
      return true;
    }
    return obs.academicCycleId !== undefined && obs.academicCycleId.get() === cycleId;
  });

  if (callerRank < 50) {
    return scoped.filter((o) => o.type.value !== ObservationTypeValue.PSYCHOPEDAGOGICAL);
  }

  return scoped;
}
