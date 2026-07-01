import { Id } from '../../shared/value-objects/id';
import { Level } from '../../institution/value-objects/level';
import { EducationalLevelCode } from '../../shared/value-objects/educational-level';
import { CourseName } from '../value-objects/course-name';
import { PassingGrade } from '../value-objects/passing-grade';
import { BimonthPeriod } from '../value-objects/bimonth-period';
import { GradingPhase } from '../value-objects/grading-phase';
import { CourseCycleClosedError } from '../errors';
import { GradingPeriodCalculator } from '../services/grading-period-calculator';
import type { DateRange } from '../services/grading-period-calculator';

export interface CourseCycleProps {
  id: Id;
  uuid: string;
  courseId: string;
  studyPlanId: string;
  cycleId: string;
  courseName: CourseName;
  level: Level;
  active: boolean;
  passingGrade: PassingGrade;
  promotionText: string | null;
  firstBimonth: BimonthPeriod | null;
  secondBimonth: BimonthPeriod | null;
  thirdBimonth: BimonthPeriod | null;
  fourthBimonth: BimonthPeriod | null;
  activeGradingPeriod: number | null;
  /**
   * Optional for backward compatibility with existing construction sites
   * (Prisma repository, fixtures) predating this field. Normalized to
   * `null` internally when absent — getter never returns `undefined`.
   */
  gradingPhase?: GradingPhase | null;
  createdAt: Date;
  lastModifiedAt: Date;
  deletedAt?: Date | null;
}

export interface CreateCourseCycleInput {
  courseId: string;
  studyPlanId: string;
  cycleId: string;
  courseName: CourseName;
  level: Level;
  passingGrade: PassingGrade;
  promotionText?: string | null;
  firstBimonth?: BimonthPeriod | null;
  secondBimonth?: BimonthPeriod | null;
  thirdBimonth?: BimonthPeriod | null;
  fourthBimonth?: BimonthPeriod | null;
}

export interface UpdateCourseCycleInput {
  courseName?: CourseName;
  passingGrade?: PassingGrade;
  active?: boolean;
  promotionText?: string | null;
  firstBimonth?: BimonthPeriod | null;
  secondBimonth?: BimonthPeriod | null;
  thirdBimonth?: BimonthPeriod | null;
  fourthBimonth?: BimonthPeriod | null;
}

export class CourseCycle {
  private constructor(private props: CourseCycleProps) {
    if (this.props.gradingPhase === undefined) {
      this.props.gradingPhase = null;
    }
  }

  static create(input: CreateCourseCycleInput): CourseCycle {
    const now = new Date();
    return new CourseCycle({
      id: Id.create(),
      uuid: Id.create().get(),
      courseId: input.courseId,
      studyPlanId: input.studyPlanId,
      cycleId: input.cycleId,
      courseName: input.courseName,
      level: input.level,
      active: true,
      passingGrade: input.passingGrade,
      promotionText: input.promotionText ?? null,
      firstBimonth: input.firstBimonth ?? null,
      secondBimonth: input.secondBimonth ?? null,
      thirdBimonth: input.thirdBimonth ?? null,
      fourthBimonth: input.fourthBimonth ?? null,
      activeGradingPeriod: null,
      gradingPhase: null,
      createdAt: now,
      lastModifiedAt: now,
    });
  }

  static reconstruct(props: CourseCycleProps): CourseCycle {
    return new CourseCycle(props);
  }

  get id(): Id {
    return this.props.id;
  }

  get uuid(): string {
    return this.props.uuid;
  }

  get courseId(): string {
    return this.props.courseId;
  }

  get studyPlanId(): string {
    return this.props.studyPlanId;
  }

  get cycleId(): string {
    return this.props.cycleId;
  }

  get courseName(): CourseName {
    return this.props.courseName;
  }

  get level(): Level {
    return this.props.level;
  }

  get active(): boolean {
    return this.props.active;
  }

  get passingGrade(): PassingGrade {
    return this.props.passingGrade;
  }

  get promotionText(): string | null {
    return this.props.promotionText;
  }

  get firstBimonth(): BimonthPeriod | null {
    return this.props.firstBimonth;
  }

  get secondBimonth(): BimonthPeriod | null {
    return this.props.secondBimonth;
  }

  get thirdBimonth(): BimonthPeriod | null {
    return this.props.thirdBimonth;
  }

  get fourthBimonth(): BimonthPeriod | null {
    return this.props.fourthBimonth;
  }

  get activeGradingPeriod(): number | null {
    return this.props.activeGradingPeriod;
  }

  get gradingPhase(): GradingPhase | null {
    return this.props.gradingPhase ?? null;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get lastModifiedAt(): Date {
    return this.props.lastModifiedAt;
  }

  get deletedAt(): Date | null | undefined {
    return this.props.deletedAt;
  }

  ensureActive(): void {
    if (!this.props.active) {
      throw new CourseCycleClosedError(this.props.uuid);
    }
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
    this.props.lastModifiedAt = new Date();
  }

  deactivate(): void {
    this.props.active = false;
    this.props.lastModifiedAt = new Date();
  }

  activate(): void {
    this.props.active = true;
    this.props.lastModifiedAt = new Date();
  }

  update(input: UpdateCourseCycleInput): void {
    if (input.courseName !== undefined) {
      this.props.courseName = input.courseName;
    }
    if (input.passingGrade !== undefined) {
      this.props.passingGrade = input.passingGrade;
    }
    if (input.active !== undefined) {
      this.props.active = input.active;
    }
    if (input.promotionText !== undefined) {
      this.props.promotionText = input.promotionText;
    }
    if (input.firstBimonth !== undefined) {
      this.props.firstBimonth = input.firstBimonth;
    }
    if (input.secondBimonth !== undefined) {
      this.props.secondBimonth = input.secondBimonth;
    }
    if (input.thirdBimonth !== undefined) {
      this.props.thirdBimonth = input.thirdBimonth;
    }
    if (input.fourthBimonth !== undefined) {
      this.props.fourthBimonth = input.fourthBimonth;
    }
    this.props.lastModifiedAt = new Date();
  }

  /**
   * Resolves the current grading period.
   * Returns the explicit override if set, otherwise delegates to the calculator
   * using the provided effective date ranges.
   *
   * @param effectiveRanges Date ranges built from effective bimester dates
   *                        (own dates first, AcademicCycle dates as fallback).
   */
  getCurrentPeriod(effectiveRanges: DateRange[]): number | null {
    if (this.props.activeGradingPeriod !== null) {
      return this.props.activeGradingPeriod;
    }
    return GradingPeriodCalculator.currentPeriod(effectiveRanges);
  }

  setActiveGradingPeriod(value: number | null): void {
    this.props.activeGradingPeriod = value;
    this.props.lastModifiedAt = new Date();
  }

  /** Solo Primario (20-22) y Secundario (30-32) están sujetos a fase de calificación. */
  requiresGradingPhase(): boolean {
    return (
      this.props.level.belongsToLevel(EducationalLevelCode.PRIMARIO) ||
      this.props.level.belongsToLevel(EducationalLevelCode.SECUNDARIO)
    );
  }

  /** Reversible (CIERRE puede volver a un bimestre). Toca lastModifiedAt. */
  setGradingPhase(phase: GradingPhase | null): void {
    this.props.gradingPhase = phase;
    this.props.lastModifiedAt = new Date();
  }

  /**
   * ¿Se puede calificar el bimestre `ordinal` (1..4) ahora mismo?
   * false para fase NULL (cutover duro), para cualquier otro bimestre, y para CIERRE.
   */
  canGradeBimester(ordinal: number): boolean {
    const phase = this.gradingPhase;
    if (!phase || !phase.isBimester()) {
      return false;
    }
    return phase.bimesterOrdinal() === ordinal;
  }

  /** ¿Se pueden editar notas especiales (SubjectFinalGrade) ahora? Solo durante CIERRE. */
  canGradeFinal(): boolean {
    const phase = this.gradingPhase;
    return phase !== null && phase.isCierre();
  }
}
