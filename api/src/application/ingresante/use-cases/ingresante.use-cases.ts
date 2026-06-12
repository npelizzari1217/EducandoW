import { Injectable } from '@nestjs/common';
import {
  ok,
  err,
  Result,
  ValidationError,
  NotFoundError,
  Ingresante,
  IngresanteRepository,
  IngresanteStatus,
  Id,
  Level,
  EducationalLevelCode,
  EducationalModalityCode,
  AcademicCycleRepository,
} from '@educandow/domain';
import { CreateStudentUseCase } from '../../student/use-cases/student.use-cases';
import { CreateEnrollmentUseCase } from '../../enrollment/use-cases/enrollment.use-cases';
import type { TenantTransactionRunner } from '../../shared/ports/tenant-transaction-runner';

// ── Shared helpers ────────────────────────────────────────────────────────────

function buildLevel(level: string, modality?: string): Level {
  const parsed = Level.create(level);
  if (parsed.isOk()) return parsed.unwrap();
  const numeric = parseInt(level, 10);
  if (isNaN(numeric)) {
    throw new ValidationError(`Invalid level: "${level}". Cannot parse as a valid level code.`);
  }
  return Level.fromParts(
    numeric as EducationalLevelCode,
    modality && parseInt(modality, 10) >= 0
      ? (parseInt(modality, 10) as EducationalModalityCode)
      : EducationalModalityCode.COMUN,
  );
}

// ── CreateIngresanteUseCase ───────────────────────────────────────────────────

export interface CreateIngresanteInput {
  firstName: string;
  lastName: string;
  dni: string;
  birthDate?: string;
  address?: string;
  phone?: string;
  email?: string;
  cycleId: string;
  level: string;
  modality?: string;
}

@Injectable()
export class CreateIngresanteUseCase {
  constructor(
    private readonly repo: IngresanteRepository,
    private readonly cycleRepo: AcademicCycleRepository,
  ) {}

  async execute(input: CreateIngresanteInput): Promise<Result<Ingresante, ValidationError>> {
    // SC-CYC-01: cycleId is required
    if (!input.cycleId?.trim()) {
      return err(new ValidationError('cycleId es requerido'));
    }

    // Validate cycle exists and level matches
    const cycle = await this.cycleRepo.findByUuid(input.cycleId);
    if (!cycle) {
      return err(new ValidationError(`Ciclo lectivo no encontrado: ${input.cycleId}`));
    }

    const level = buildLevel(input.level, input.modality);

    // SC-CYC-05: cycle level must match requested level
    if (cycle.level.code !== level.levelCode) {
      return err(
        new ValidationError(
          `El ciclo lectivo no corresponde al nivel seleccionado`,
        ),
      );
    }

    const result = Ingresante.create({
      firstName: input.firstName,
      lastName: input.lastName,
      dni: input.dni,
      birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
      address: input.address,
      phone: input.phone,
      email: input.email,
      cycleId: Id.reconstruct(input.cycleId),
      level,
    });

    if (result.isErr()) return err(result.unwrapErr());

    const ingresante = result.unwrap();
    await this.repo.save(ingresante);
    return ok(ingresante);
  }
}

// ── UpdateIngresanteStatusUseCase ─────────────────────────────────────────────

export interface UpdateIngresanteStatusInput {
  ingresanteId: string;
  status: string;
}

@Injectable()
export class UpdateIngresanteStatusUseCase {
  constructor(private readonly repo: IngresanteRepository) {}

  async execute(
    input: UpdateIngresanteStatusInput,
  ): Promise<Result<Ingresante, ValidationError | NotFoundError>> {
    // INGRESO is reserved for the promote flow only
    if (input.status?.toUpperCase() === 'INGRESO') {
      return err(
        new ValidationError(
          'El estado INGRESO solo se puede asignar mediante el proceso de alta (promote)',
        ),
      );
    }

    const statusResult = IngresanteStatus.create(input.status);
    if (statusResult.isErr()) return err(statusResult.unwrapErr());

    const ingresante = await this.repo.findById(Id.reconstruct(input.ingresanteId));
    if (!ingresante) return err(new NotFoundError('Ingresante', input.ingresanteId));

    const transition = ingresante.transitionTo(statusResult.unwrap());
    if (transition.isErr()) return err(transition.unwrapErr());

    await this.repo.save(ingresante);
    return ok(ingresante);
  }
}

// ── ListIngresantesUseCase ────────────────────────────────────────────────────

@Injectable()
export class ListIngresantesUseCase {
  constructor(private readonly repo: IngresanteRepository) {}

  async execute(): Promise<Ingresante[]> {
    return this.repo.findAll();
  }

  async executeByStatus(status: string): Promise<Ingresante[]> {
    return this.repo.findByStatus(status);
  }
}

// ── PromoteIngresanteUseCase ──────────────────────────────────────────────────

export interface PromoteIngresanteInput {
  ingresanteId: string;
  institutionId: string;
  academicYear?: string;
}

export interface PromoteIngresanteOutput {
  studentId: string;
  enrollmentId: string;
}

@Injectable()
export class PromoteIngresanteUseCase {
  constructor(
    private readonly ingresanteRepo: IngresanteRepository,
    private readonly createStudentUC: CreateStudentUseCase,
    private readonly createEnrollmentUC: CreateEnrollmentUseCase,
    private readonly academicCycleRepo: AcademicCycleRepository,
    private readonly runner: TenantTransactionRunner,
  ) {}

  async execute(
    input: PromoteIngresanteInput,
  ): Promise<Result<PromoteIngresanteOutput, ValidationError | NotFoundError>> {
    // 1. Load ingresante (outside transaction — read-only)
    const ingresante = await this.ingresanteRepo.findById(Id.reconstruct(input.ingresanteId));
    if (!ingresante) return err(new NotFoundError('Ingresante', input.ingresanteId));

    // 2. Must be ACEPTADO
    if (ingresante.status.value !== 'ACEPTADO') {
      return err(new ValidationError('Solo se puede dar de alta un ingresante ACEPTADO'));
    }

    // 3. Derive academicYear from the linked AcademicCycle, or fall back to current year
    let academicYear = input.academicYear ?? String(new Date().getFullYear());
    if (ingresante.cycleId) {
      const cycle = await this.academicCycleRepo.findByUuid(ingresante.cycleId.get());
      if (cycle) {
        academicYear = String(cycle.startDate.getFullYear());
      }
    }

    // 4–6. Run atomically: any err inside throws → Prisma rolls back
    try {
      const output = await this.runner.run(async () => {
        // 4. Create student
        const studentResult = await this.createStudentUC.execute({
          firstName: ingresante.firstName,
          lastName: ingresante.lastName,
          dni: ingresante.dni,
          birthDate: ingresante.birthDate
            ? ingresante.birthDate.toISOString().substring(0, 10)
            : undefined,
          email: ingresante.email,
          institutionId: input.institutionId,
        });
        if (studentResult.isErr()) throw studentResult.unwrapErr();
        const student = studentResult.unwrap();

        // 5. Create enrollment
        const enrollmentResult = await this.createEnrollmentUC.execute({
          studentId: student.id.get(),
          institutionId: input.institutionId,
          level: ingresante.level.toString(),
          academicYear,
          cycleId: ingresante.cycleId?.get(),
        });
        if (enrollmentResult.isErr()) throw enrollmentResult.unwrapErr();
        const enrollment = enrollmentResult.unwrap();

        // 6. Mark ingresante INGRESO and persist
        const markResult = ingresante.markIngreso();
        if (markResult.isErr()) throw markResult.unwrapErr();
        await this.ingresanteRepo.save(ingresante);

        return { studentId: student.id.get(), enrollmentId: enrollment.id.get() };
      });

      return ok(output);
    } catch (e) {
      return err(e as ValidationError);
    }
  }
}
