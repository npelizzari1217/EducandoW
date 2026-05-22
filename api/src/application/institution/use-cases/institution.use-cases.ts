import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, InstitutionRepository, Institution, Level, LevelType } from '@educandow/domain';

export interface CreateInstitutionInput {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  levels: string[];
}

@Injectable()
export class CreateInstitutionUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(input: CreateInstitutionInput): Promise<Result<Institution, ValidationError>> {
    const alreadyExists = await this.repo.existsByName(input.name);
    if (alreadyExists) return err(new ValidationError('Ya existe una institución con ese nombre'));

    if (!input.levels || input.levels.length === 0) {
      return err(new ValidationError('Debe especificar al menos un nivel educativo'));
    }

    const levels = input.levels.map((l) => Level.reconstruct(l as LevelType));

    const institution = Institution.create({
      name: input.name,
      address: input.address,
      phone: input.phone,
      email: input.email,
      levels,
    });

    await this.repo.save(institution);
    return ok(institution);
  }
}

@Injectable()
export class ListInstitutionsUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(): Promise<Institution[]> {
    return this.repo.findAll();
  }
}

@Injectable()
export class GetInstitutionUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(id: string): Promise<Institution | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class DeleteInstitutionUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
