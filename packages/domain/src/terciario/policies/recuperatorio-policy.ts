import { ok, err, Result } from '../../shared/result';
import { SlotCursadaTerciario } from '../value-objects/slot-cursada-terciario';
import { NotaCursadaTerciario } from '../entities/nota-cursada-terciario';
import { SlotAlreadyExistsError } from '../errors/slot-already-exists.error';
import { PrerequisiteSlotMissingError } from '../errors/prerequisite-slot-missing.error';
import { ParcialYaAprobadoError } from '../errors/parcial-ya-aprobado.error';

export class RecuperatorioPolicy {
  /**
   * Pure guard — no I/O. Returns Ok when the new slot can be created.
   *
   * Guard evaluation order (ADR-3):
   * 1. Duplicate check (applies to all slots including TP)
   * 2. Prerequisite check (applies only to recuperatorio slots)
   */
  static check(
    slotNuevo: SlotCursadaTerciario,
    inscripcionMateriaId: string,
    existing: NotaCursadaTerciario[],
  ): Result<void, SlotAlreadyExistsError | PrerequisiteSlotMissingError | ParcialYaAprobadoError> {
    // 1. Duplicate check
    const duplicate = existing.find((n) => n.slot.get() === slotNuevo.get());
    if (duplicate) {
      return err(new SlotAlreadyExistsError(slotNuevo.get(), inscripcionMateriaId));
    }

    // 2. Prerequisite check (only for recuperatorio slots)
    if (slotNuevo.esRecuperatorio()) {
      const parcialBase = slotNuevo.parcialBase();
      const parcialBaseNota = existing.find((n) => n.slot.get() === parcialBase);

      if (!parcialBaseNota) {
        return err(new PrerequisiteSlotMissingError(parcialBase));
      }

      if (parcialBaseNota.condicion.get() === 'APROBADO') {
        return err(new ParcialYaAprobadoError(parcialBase));
      }
    }

    return ok(undefined);
  }
}
