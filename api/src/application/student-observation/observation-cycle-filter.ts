import { StudentObservation, ObservationTypeValue } from '@educandow/domain';

/**
 * Filters observations for a cycle scope and rank visibility.
 *
 * - PSYCHOPEDAGOGICAL (EOE): always included (student lifecycle visibility)
 * - PEDAGOGICAL: only if linked to an enrollment that belongs to this cycle
 *   (null/undefined enrollmentId is always excluded — legacy records)
 * - callerRank < 50: hides PSYCHOPEDAGOGICAL from non-DIRECTOR callers
 */
export function filterCycleObservations(
  observations: StudentObservation[],
  cycleEnrollmentIds: Set<string>,
  callerRank: number,
): StudentObservation[] {
  const scoped = observations.filter((obs) => {
    if (obs.type.value === ObservationTypeValue.PSYCHOPEDAGOGICAL) {
      return true;
    }
    return obs.enrollmentId !== undefined && cycleEnrollmentIds.has(obs.enrollmentId.get());
  });

  if (callerRank < 50) {
    return scoped.filter((o) => o.type.value !== ObservationTypeValue.PSYCHOPEDAGOGICAL);
  }

  return scoped;
}
