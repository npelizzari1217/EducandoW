import { Injectable } from '@nestjs/common';
import {
  RegimenAcademico,
  RegimenAcademicoRepository,
  Result,
  ok,
  err,
  ValidationError,
  NotFoundError,
} from '@educandow/domain';

export interface CreateRegimenAcademicoInput {
  cursoId: string;
  subjectId: string;
  promocionDirecta: boolean;
  requiereExamenFinal: boolean;
  notaMinimaAprobacion?: number;
}

export interface UpdateRegimenAcademicoInput {
  promocionDirecta?: boolean;
  requiereExamenFinal?: boolean;
  notaMinimaAprobacion?: number;
}

@Injectable()
export class CreateRegimenAcademicoUseCase {
  constructor(private readonly repo: RegimenAcademicoRepository) {}

  async execute(input: CreateRegimenAcademicoInput): Promise<Result<RegimenAcademico, ValidationError>> {
    const existing = await this.repo.findByCursoAndSubject(input.cursoId, input.subjectId);
    if (existing) {
      return err(new ValidationError('Ya existe un régimen académico para este curso y materia'));
    }

    const notaMinima = input.notaMinimaAprobacion ?? 6;
    if (notaMinima < 1 || notaMinima > 10) {
      return err(new ValidationError('La nota mínima de aprobación debe estar entre 1 y 10'));
    }

    const regimen = RegimenAcademico.create({
      cursoId: input.cursoId,
      subjectId: input.subjectId,
      promocionDirecta: input.promocionDirecta,
      requiereExamenFinal: input.requiereExamenFinal,
      notaMinimaAprobacion: notaMinima,
    });

    await this.repo.save(regimen);
    return ok(regimen);
  }
}

@Injectable()
export class GetRegimenAcademicoUseCase {
  constructor(private readonly repo: RegimenAcademicoRepository) {}

  async executeByCursoAndSubject(cursoId: string, subjectId: string): Promise<Result<RegimenAcademico, NotFoundError>> {
    const regimen = await this.repo.findByCursoAndSubject(cursoId, subjectId);
    if (!regimen) return err(new NotFoundError('RegimenAcademico', `${cursoId}/${subjectId}`));
    return ok(regimen);
  }

  async executeById(id: string): Promise<Result<RegimenAcademico, NotFoundError>> {
    const regimen = await this.repo.findById(id);
    if (!regimen) return err(new NotFoundError('RegimenAcademico', id));
    return ok(regimen);
  }
}

@Injectable()
export class UpdateRegimenAcademicoUseCase {
  constructor(private readonly repo: RegimenAcademicoRepository) {}

  async execute(id: string, input: UpdateRegimenAcademicoInput): Promise<Result<RegimenAcademico, ValidationError | NotFoundError>> {
    const regimen = await this.repo.findById(id);
    if (!regimen) return err(new NotFoundError('RegimenAcademico', id));

    if (input.notaMinimaAprobacion !== undefined && (input.notaMinimaAprobacion < 1 || input.notaMinimaAprobacion > 10)) {
      return err(new ValidationError('La nota mínima de aprobación debe estar entre 1 y 10'));
    }

    regimen.update(input);
    await this.repo.save(regimen);
    return ok(regimen);
  }
}
