import { describe, it, expect } from 'vitest';
import {
  CreateSlotSchema,
  UpdateSlotSchema,
  ConfirmarNotaCursadaSchema,
  RegistrarNotaFinalSchema,
} from '../nota-cursada-terciario.controller';

describe('CreateSlotSchema', () => {
  it('parses valid slot with nota and fecha', () => {
    const result = CreateSlotSchema.safeParse({
      slot: 'PARCIAL_1',
      nota: 7.5,
      condicion: 'APROBADO',
      fecha: '2026-06-10',
    });
    expect(result.success).toBe(true);
  });

  it('parses valid slot with null optionals', () => {
    const result = CreateSlotSchema.safeParse({
      slot: 'TP',
      nota: null,
      condicion: 'APROBADO',
      fecha: null,
    });
    expect(result.success).toBe(true);
  });

  it('fails when slot is missing', () => {
    const result = CreateSlotSchema.safeParse({ condicion: 'APROBADO' });
    expect(result.success).toBe(false);
  });

  it('fails when slot value is unknown', () => {
    const result = CreateSlotSchema.safeParse({ slot: 'PARCIAL_3', condicion: 'APROBADO' });
    expect(result.success).toBe(false);
  });
});

describe('UpdateSlotSchema', () => {
  it('parses valid update with nota and condicion', () => {
    const result = UpdateSlotSchema.safeParse({ nota: 8.0, condicion: 'APROBADO' });
    expect(result.success).toBe(true);
  });

  it('parses empty object (all optional)', () => {
    const result = UpdateSlotSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('fails when condicion is unknown', () => {
    const result = UpdateSlotSchema.safeParse({ condicion: 'PROMOCIONAL' });
    expect(result.success).toBe(false);
  });
});

describe('ConfirmarNotaCursadaSchema', () => {
  it('parses REGULAR with notaCursada', () => {
    const result = ConfirmarNotaCursadaSchema.safeParse({ notaCursada: 7.0, condicion: 'REGULAR' });
    expect(result.success).toBe(true);
  });

  it('parses PROMOCIONAL [SUPUESTO]', () => {
    const result = ConfirmarNotaCursadaSchema.safeParse({ notaCursada: 9.0, condicion: 'PROMOCIONAL' });
    expect(result.success).toBe(true);
  });

  it('fails when condicion = APROBADO', () => {
    const result = ConfirmarNotaCursadaSchema.safeParse({ condicion: 'APROBADO' });
    expect(result.success).toBe(false);
  });

  it('parses LIBRE', () => {
    const result = ConfirmarNotaCursadaSchema.safeParse({ condicion: 'LIBRE' });
    expect(result.success).toBe(true);
  });
});

describe('RegistrarNotaFinalSchema', () => {
  it('parses valid input with all fields including intento', () => {
    const result = RegistrarNotaFinalSchema.safeParse({
      studentId: 'abc',
      nota: 5.0,
      condicion: 'DESAPROBADO',
      intento: 2,
    });
    expect(result.success).toBe(true);
  });

  it('fails when studentId is missing', () => {
    const result = RegistrarNotaFinalSchema.safeParse({ nota: 5.0, condicion: 'DESAPROBADO', intento: 1 });
    expect(result.success).toBe(false);
  });

  it('fails when condicion is invalid', () => {
    const result = RegistrarNotaFinalSchema.safeParse({
      studentId: 'abc',
      nota: 5.0,
      condicion: 'INVALIDO',
      intento: 1,
    });
    expect(result.success).toBe(false);
  });

  // T32 — intento range validation
  it('fails when intento = 0', () => {
    const result = RegistrarNotaFinalSchema.safeParse({
      studentId: 'abc',
      nota: 5.0,
      condicion: 'DESAPROBADO',
      intento: 0,
    });
    expect(result.success).toBe(false);
  });

  it('fails when intento = 4', () => {
    const result = RegistrarNotaFinalSchema.safeParse({
      studentId: 'abc',
      nota: 5.0,
      condicion: 'DESAPROBADO',
      intento: 4,
    });
    expect(result.success).toBe(false);
  });
});
