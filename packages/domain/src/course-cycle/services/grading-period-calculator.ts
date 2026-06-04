export interface DateRange {
  start: Date;
  end: Date;
}

export class GradingPeriodCalculator {
  /**
   * Determines the current grading period (1-indexed) based on a list of date ranges.
   * Returns the position of the range containing `new Date()`, or null if none match.
   *
   * Ranges are sorted by start date before evaluation.
   */
  static currentPeriod(ranges: DateRange[]): number | null {
    if (!ranges || ranges.length === 0) {
      return null;
    }

    const now = new Date();
    const valid = ranges.filter((r) => r.start && r.end && r.start <= r.end);
    const sorted = [...valid].sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let i = 0; i < sorted.length; i++) {
      if (now >= sorted[i].start && now <= sorted[i].end) {
        return i + 1; // 1-indexed period number
      }
    }

    return null;
  }
}
