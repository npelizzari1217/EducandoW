import { Injectable } from '@nestjs/common';
import {
  Result, ok, err,
  CourseCycle,
  CourseCycleRepository,
  CourseCycleNotFoundError,
  GradingPeriod,
} from '@educandow/domain';
import type { AcademicCycleRepository, EnrollmentRepository, DateRange } from '@educandow/domain';

// ── Types ──────────────────────────────────────────────────

export interface GradingPeriodResult {
  activeGradingPeriod: number | null;
  source: 'explicit' | 'calculated' | 'none';
}

export interface SetGradingPeriodInput {
  activeGradingPeriod: number | null;
}

// ── Helpers ────────────────────────────────────────────────

function buildEffectiveRanges(cc: CourseCycle, academicCycle?: {
  firstBimonth: { start: Date; end: Date } | null;
  secondBimonth: { start: Date; end: Date } | null;
  thirdBimonth: { start: Date; end: Date } | null;
  fourthBimonth: { start: Date; end: Date } | null;
}): DateRange[] {
  const ranges: DateRange[] = [];

  const pairs: Array<{
    own: { start: Date; end: Date } | null;
    fallback: { start: Date; end: Date } | null;
  }> = [
    { own: cc.firstBimonth, fallback: academicCycle?.firstBimonth ?? null },
    { own: cc.secondBimonth, fallback: academicCycle?.secondBimonth ?? null },
    { own: cc.thirdBimonth, fallback: academicCycle?.thirdBimonth ?? null },
    { own: cc.fourthBimonth, fallback: academicCycle?.fourthBimonth ?? null },
  ];

  for (const pair of pairs) {
    const source = pair.own ?? pair.fallback;
    if (source) {
      ranges.push({ start: source.start, end: source.end });
    }
  }

  return ranges;
}

// ── Use Cases ──────────────────────────────────────────────

@Injectable()
export class GetActivePeriodUseCase {
  constructor(
    private readonly courseCycleRepo: CourseCycleRepository,
    private readonly academicCycleRepo: AcademicCycleRepository,
  ) {}

  async execute(uuid: string): Promise<Result<GradingPeriodResult, Error>> {
    const cc = await this.courseCycleRepo.findByUuid(uuid);
    if (!cc) {
      return err(new CourseCycleNotFoundError(uuid));
    }

    // Fetch AcademicCycle for effective date fallback
    const cycle = await this.academicCycleRepo.findByUuid(cc.cycleId);
    const effectiveRanges = buildEffectiveRanges(cc, cycle ?? undefined);

    const period = cc.getCurrentPeriod(effectiveRanges);

    // Determine source
    let source: GradingPeriodResult['source'];
    if (cc.activeGradingPeriod !== null) {
      source = 'explicit';
    } else if (period !== null) {
      source = 'calculated';
    } else {
      source = 'none';
    }

    return ok({
      activeGradingPeriod: period,
      source,
    });
  }
}

@Injectable()
export class SetActivePeriodUseCase {
  constructor(
    private readonly courseCycleRepo: CourseCycleRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
  ) {}

  async execute(uuid: string, input: SetGradingPeriodInput): Promise<Result<GradingPeriodResult, Error>> {
    const cc = await this.courseCycleRepo.findByUuid(uuid);
    if (!cc) {
      return err(new CourseCycleNotFoundError(uuid));
    }

    // Validate the grading period value if not null
    if (input.activeGradingPeriod !== null) {
      const gpResult = GradingPeriod.create(input.activeGradingPeriod);
      if (gpResult.isErr()) {
        return err(gpResult.unwrapErr());
      }
    }

    cc.setActiveGradingPeriod(input.activeGradingPeriod);
    await this.courseCycleRepo.save(cc);

    // Denormalize activeGradingPeriod to all enrollments for this AcademicCycle
    const enrollments = await this.enrollmentRepo.findByCycleId(cc.cycleId);
    for (const enrollment of enrollments) {
      enrollment.setActiveGradingPeriod(input.activeGradingPeriod);
      await this.enrollmentRepo.save(enrollment);
    }

    return ok({
      activeGradingPeriod: input.activeGradingPeriod,
      source: input.activeGradingPeriod !== null ? 'explicit' : 'none',
    });
  }
}
