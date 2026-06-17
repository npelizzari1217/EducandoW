/**
 * ListTeacherCourseCyclesUseCase — modelo NUEVO (DocenteXCiclo + grupos + AsignacionCursoXCiclo).
 *
 * mode='subject': resolver CCs vía DocenteXCiclo → GrupoXCursoXMateriaXCiclo
 *   → MateriaXCursoXCiclo.courseCycleId.
 *   Includes Primario (decade=2) AND Secundario (decade=3). Terciario (4) and Inicial (1) excluded.
 *
 * mode='homeroom': modelo NUEVO — userId → AsignacionCursoXCiclo(rol=TITULAR) → courseCycleId[].
 *   Teacher table NOT read (REQ-02). Primario only (decade=2). Homeroom mode is Primario-specific.
 *
 * userId sin DocenteXCiclo (subject mode) → empty array, never an error.
 * Specs: TIA-R2, TIA-R3, TIA-R5, TIA-R6, TIA-R9, ESS-R1, ESS-R2, AD-6, D3, REQ-01, REQ-02
 */
import { Injectable } from '@nestjs/common';
import type {
  CourseCycle,
  CourseCycleRepository,
  AsignacionCursoXCicloRepository,
  DocenteXCicloRepository,
  GrupoRepository,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

/** Decades allowed for subject-mode entry screens: Primario (2x) + Secundario (3x). */
const SUBJECT_ALLOWED_DECADES = [2, 3];
/** Homeroom mode remains Primario-only — not extended to Secundario. */
const HOMEROOM_DECADE = 2;

@Injectable()
export class ListTeacherCourseCyclesUseCase {
  constructor(
    private readonly asignacionRepo: AsignacionCursoXCicloRepository, // homeroom mode (new model)
    private readonly docenteRepo: DocenteXCicloRepository,             // subject mode (new model)
    private readonly grupoRepo: GrupoRepository,                       // subject mode (new model)
    private readonly courseCycleRepo: CourseCycleRepository,
  ) {}

  async execute(input: {
    userId: string;
    mode: 'subject' | 'homeroom';
  }): Promise<Array<{ cycle: CourseCycle; modality: number | null }>> {
    let courseCycles: CourseCycle[];

    if (input.mode === 'homeroom') {
      // AD-6 "por curso" path — modelo NUEVO: userId → AsignacionCursoXCiclo(TITULAR)
      const ccUuids = await this.asignacionRepo.findTitularCourseIdsByUser(input.userId);
      if (ccUuids.length === 0) return [];
      courseCycles = await this.courseCycleRepo.findByUuids(ccUuids);
    } else {
      // AD-6 "por materia" path — modelo NUEVO:
      // userId → DocenteXCiclo[] → GrupoXCursoXMateriaXCiclo[] → MateriaXCursoXCiclo.courseCycleId

      // Step 1: Resolve all DocenteXCiclo records for this user (may span multiple cycles)
      const docentes = await this.docenteRepo.findByUserId(input.userId);
      if (docentes.length === 0) return [];

      // Step 2: Collect all grupos for each DocenteXCiclo record
      const gruposByDxc = await Promise.all(
        docentes.map((dxc) => this.grupoRepo.findByDocente(dxc.id)),
      );
      const allGrupos = gruposByDxc.flat();
      if (allGrupos.length === 0) return [];

      // Step 3: Deduplicate materiaXCursoXCicloIds
      const materiaIds = [...new Set(allGrupos.map((g) => g.materiaXCursoXCicloId))];

      // Step 4: Batch-lookup courseCycleIds for those materias (raw Prisma — same pattern as AssignmentAuthorizer)
      const client = TenantContext.getClient();
      if (!client) return [];

      const materias = await client.materiaXCursoXCiclo.findMany({
        where: { id: { in: materiaIds } },
        select: { courseCycleId: true },
      });
      if (materias.length === 0) return [];

      // Step 5: Deduplicate courseCycleIds (UUID)
      const ccUuids = [...new Set(materias.map((m) => m.courseCycleId))];

      // Step 6: Fetch CourseCycle entities
      courseCycles = await this.courseCycleRepo.findByUuids(ccUuids);
    }

    // Filter by allowed decades per mode:
    //   subject  → Primario (2x) + Secundario (3x)  [ESS-R1, D3 predicate expansion]
    //   homeroom → Primario (2x) only               [homeroom unchanged, TIA-R9]
    const allowedDecades =
      input.mode === 'subject' ? SUBJECT_ALLOWED_DECADES : [HOMEROOM_DECADE];

    const filtered = courseCycles.filter((cc) =>
      allowedDecades.includes(Math.floor(cc.level.toCode() / 10)),
    );

    if (filtered.length === 0) return [];

    // W3: resolve modality from StudyPlan (authoritative source) via a single bulk query.
    const uuids = filtered.map((cc) => cc.uuid);
    const gradingContexts = await this.courseCycleRepo.findGradingContextsByUuids(uuids);

    return filtered.map((cc) => ({
      cycle: cc,
      modality: gradingContexts.get(cc.uuid)?.modality ?? null,
    }));
  }
}
