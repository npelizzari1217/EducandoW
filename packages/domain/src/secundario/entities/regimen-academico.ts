import { Id } from '../../shared/value-objects/id';

export interface RegimenAcademicoProps {
  id: Id;
  cursoId: string;
  subjectId: string;
  promocionDirecta: boolean;
  requiereExamenFinal: boolean;
  notaMinimaAprobacion: number;
}

export type CreateRegimenAcademicoInput = Omit<RegimenAcademicoProps, 'id'>;

export class RegimenAcademico {
  private constructor(private props: RegimenAcademicoProps) {}

  static create(input: CreateRegimenAcademicoInput): RegimenAcademico {
    return new RegimenAcademico({
      ...input,
      id: Id.create(),
    });
  }

  static reconstruct(props: RegimenAcademicoProps): RegimenAcademico {
    return new RegimenAcademico(props);
  }

  get id(): Id {
    return this.props.id;
  }

  get cursoId(): string {
    return this.props.cursoId;
  }

  get subjectId(): string {
    return this.props.subjectId;
  }

  get promocionDirecta(): boolean {
    return this.props.promocionDirecta;
  }

  get requiereExamenFinal(): boolean {
    return this.props.requiereExamenFinal;
  }

  get notaMinimaAprobacion(): number {
    return this.props.notaMinimaAprobacion;
  }

  update(input: Partial<Omit<CreateRegimenAcademicoInput, 'cursoId' | 'subjectId'>>): void {
    if (input.promocionDirecta !== undefined) this.props.promocionDirecta = input.promocionDirecta;
    if (input.requiereExamenFinal !== undefined) this.props.requiereExamenFinal = input.requiereExamenFinal;
    if (input.notaMinimaAprobacion !== undefined) this.props.notaMinimaAprobacion = input.notaMinimaAprobacion;
  }
}
