import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, NotFoundError, Sala } from '@educandow/domain';
import type { SalaRepository, SalaFilters } from '@educandow/domain';

export interface CreateSalaInput {
  name: string;
  ageGroup: number;
  turno: string;
  capacity: number;
  academicYear: string;
}

export interface UpdateSalaInput {
  name?: string;
  ageGroup?: number;
  turno?: string;
  capacity?: number;
  academicYear?: string;
}

@Injectable()
export class CreateSalaUseCase {
  constructor(private readonly repo: SalaRepository) {}

  async execute(input: CreateSalaInput): Promise<Result<Sala, ValidationError>> {
    const result = Sala.create(input);
    if (result.isErr()) return err(result.unwrapErr());

    const sala = result.unwrap();
    await this.repo.save(sala);
    return ok(sala);
  }
}

@Injectable()
export class ListSalasUseCase {
  constructor(private readonly repo: SalaRepository) {}

  async execute(filters?: SalaFilters): Promise<Result<Sala[], never>> {
    const salas = await this.repo.findAll(filters);
    return ok(salas);
  }
}

@Injectable()
export class GetSalaUseCase {
  constructor(private readonly repo: SalaRepository) {}

  async execute(id: string): Promise<Result<Sala, NotFoundError>> {
    const sala = await this.repo.findById(id);
    if (!sala) return err(new NotFoundError('Sala', id));
    return ok(sala);
  }
}

@Injectable()
export class UpdateSalaUseCase {
  constructor(private readonly repo: SalaRepository) {}

  async execute(id: string, input: UpdateSalaInput): Promise<Result<Sala, ValidationError | NotFoundError>> {
    const existing = await this.repo.findById(id);
    if (!existing) return err(new NotFoundError('Sala', id));

    const ageGroupVal = input.ageGroup ?? existing.ageGroup.get();
    const turnoVal = input.turno ?? existing.turno.get();
    const nameVal = input.name ?? existing.name;
    const capacityVal = input.capacity ?? existing.capacity;
    const academicYearVal = input.academicYear ?? existing.academicYear;

    const result = Sala.create({
      name: nameVal,
      ageGroup: ageGroupVal,
      turno: turnoVal,
      capacity: capacityVal,
      academicYear: academicYearVal,
    });

    if (result.isErr()) return err(result.unwrapErr());

    const updated = Sala.reconstruct({
      id: existing.id,
      name: result.unwrap().name,
      ageGroup: result.unwrap().ageGroup,
      turno: result.unwrap().turno,
      capacity: result.unwrap().capacity,
      academicYear: result.unwrap().academicYear,
      active: existing.active,
      deletedAt: existing.deletedAt,
    });

    await this.repo.save(updated);
    return ok(updated);
  }
}

@Injectable()
export class DeleteSalaUseCase {
  constructor(private readonly repo: SalaRepository) {}

  async execute(id: string): Promise<Result<void, NotFoundError>> {
    const existing = await this.repo.findById(id);
    if (!existing) return err(new NotFoundError('Sala', id));

    await this.repo.softDelete(id);
    return ok(undefined);
  }
}
