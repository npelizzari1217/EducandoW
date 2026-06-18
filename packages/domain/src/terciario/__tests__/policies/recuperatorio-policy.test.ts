import { describe, it, expect } from 'vitest';
import { RecuperatorioPolicy } from '../../policies/recuperatorio-policy';
import { NotaCursadaTerciario } from '../../entities/nota-cursada-terciario';
import { SlotCursadaTerciario } from '../../value-objects/slot-cursada-terciario';
import { CondicionCursada } from '../../value-objects/condicion-cursada';

function makeNota(slot: string, condicion: string): NotaCursadaTerciario {
  return NotaCursadaTerciario.create({
    inscripcionMateriaId: 'insc-1',
    slot: SlotCursadaTerciario.create(slot),
    condicion: CondicionCursada.create(condicion),
  });
}

describe('RecuperatorioPolicy.check()', () => {
  it('returns Err(SlotAlreadyExistsError) when slot already exists for the same inscripcion', () => {
    const slotNuevo = SlotCursadaTerciario.create('PARCIAL_1');
    const existing = [makeNota('PARCIAL_1', 'APROBADO')];

    const result = RecuperatorioPolicy.check(slotNuevo, 'insc-1', existing);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('SLOT_ALREADY_EXISTS');
  });

  it('returns Err(PrerequisiteSlotMissingError) when recuperatorio slot has no parcial base', () => {
    const slotNuevo = SlotCursadaTerciario.create('RECUPERATORIO_PARCIAL_1');
    const existing: NotaCursadaTerciario[] = [];

    const result = RecuperatorioPolicy.check(slotNuevo, 'insc-1', existing);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('PREREQUISITE_SLOT_MISSING');
  });

  it('returns Err(ParcialYaAprobadoError) when recuperatorio slot has parcial base APROBADO', () => {
    const slotNuevo = SlotCursadaTerciario.create('RECUPERATORIO_PARCIAL_1');
    const existing = [makeNota('PARCIAL_1', 'APROBADO')];

    const result = RecuperatorioPolicy.check(slotNuevo, 'insc-1', existing);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('PARCIAL_YA_APROBADO');
  });

  it('returns Ok when recuperatorio slot has parcial base DESAPROBADO', () => {
    const slotNuevo = SlotCursadaTerciario.create('RECUPERATORIO_PARCIAL_1');
    const existing = [makeNota('PARCIAL_1', 'DESAPROBADO')];

    const result = RecuperatorioPolicy.check(slotNuevo, 'insc-1', existing);

    expect(result.isOk()).toBe(true);
  });

  it('returns Ok when recuperatorio slot has parcial base AUSENTE', () => {
    const slotNuevo = SlotCursadaTerciario.create('RECUPERATORIO_PARCIAL_2');
    const existing = [makeNota('PARCIAL_2', 'AUSENTE')];

    const result = RecuperatorioPolicy.check(slotNuevo, 'insc-1', existing);

    expect(result.isOk()).toBe(true);
  });

  it('returns Ok when non-recuperatorio slot has no prior duplicate', () => {
    const slotNuevo = SlotCursadaTerciario.create('PARCIAL_1');
    const existing: NotaCursadaTerciario[] = [];

    const result = RecuperatorioPolicy.check(slotNuevo, 'insc-1', existing);

    expect(result.isOk()).toBe(true);
  });

  it('returns Err(SlotAlreadyExistsError) when TP slot already exists', () => {
    const slotNuevo = SlotCursadaTerciario.create('TP');
    const existing = [makeNota('TP', 'APROBADO')];

    const result = RecuperatorioPolicy.check(slotNuevo, 'insc-1', existing);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('SLOT_ALREADY_EXISTS');
  });
});
