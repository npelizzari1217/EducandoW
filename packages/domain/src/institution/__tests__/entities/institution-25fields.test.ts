import { describe, it, expect } from 'vitest';
import { Institution } from '../../entities/institution';
import { Level, LevelType } from '../../value-objects/level';
import { HexColor } from '../../value-objects/hex-color';
import { Cue } from '../../value-objects/cue';

describe('Institution (25 fields)', () => {
  it('create() applies correct defaults', () => {
    const inst = Institution.create({
      name: 'Escuela 123',
      levels: [Level.reconstruct(LevelType.INICIAL), Level.reconstruct(LevelType.PRIMARIO)],
    });

    expect(inst.id).toBeDefined();
    expect(inst.name).toBe('Escuela 123');
    expect(inst.levels).toHaveLength(2);

    // Defaults
    expect(inst.active).toBe(true);
    expect(inst.country).toBe('AR');
    expect(inst.sendEmail).toBe(false);
    expect(inst.sendMessages).toBe(false);

    // dbName auto-generated
    expect(inst.dbName).toBe(`educandow_${inst.id.get()}`);

    // createdAt and updatedAt set
    expect(inst.createdAt).toBeInstanceOf(Date);
    expect(inst.updatedAt).toBeInstanceOf(Date);

    // Optional fields are undefined by default
    expect(inst.cue).toBeUndefined();
    expect(inst.ministryReg).toBeUndefined();
    expect(inst.address).toBeUndefined();
    expect(inst.city).toBeUndefined();
    expect(inst.postalCode).toBeUndefined();
    expect(inst.phone).toBeUndefined();
    expect(inst.website).toBeUndefined();
    expect(inst.contactEmail).toBeUndefined();
    expect(inst.logoUrl).toBeUndefined();
    expect(inst.headerColor).toBeUndefined();
    expect(inst.headerTextColor).toBeUndefined();
    expect(inst.bodyTextColor).toBeUndefined();
    expect(inst.smtpHost).toBeUndefined();
    expect(inst.smtpUser).toBeUndefined();
    expect(inst.smtpPass).toBeUndefined();
    expect(inst.smtpEncryption).toBeUndefined();
    expect(inst.smtpPort).toBeUndefined();
    expect(inst.socketHost).toBeUndefined();
    expect(inst.socketPort).toBeUndefined();
  });

  it('create() accepts optional fields with overridden defaults', () => {
    const cue = Cue.reconstruct('ABC123');
    const hc = HexColor.reconstruct('#1a56db');

    const inst = Institution.create({
      name: 'Instituto Tech',
      levels: [Level.reconstruct(LevelType.TERCIARIO)],
      country: 'UY',
      active: false,
      sendEmail: true,
      sendMessages: true,
      cue,
      website: 'https://example.com',
      contactEmail: 'info@test.com',
      headerColor: hc,
      smtpEncryption: 'TLS',
      smtpPort: 587,
    });

    expect(inst.country).toBe('UY');
    expect(inst.active).toBe(false);
    expect(inst.sendEmail).toBe(true);
    expect(inst.sendMessages).toBe(true);
    expect(inst.cue?.get()).toBe('ABC123');
    expect(inst.website).toBe('https://example.com');
    expect(inst.contactEmail).toBe('info@test.com');
    expect(inst.headerColor?.get()).toBe('#1a56db');
    expect(inst.smtpEncryption).toBe('TLS');
    expect(inst.smtpPort).toBe(587);
  });

  it('reconstruct() restores all 25 fields from persistence', () => {
    const now = new Date();
    const inst = Institution.reconstruct({
      id: { get: () => 'inst-1', equals: () => false } as any,
      name: 'Colegio Nacional',
      cue: Cue.reconstruct('ABC123'),
      ministryReg: 'REG-001',
      address: 'Av. Principal 123',
      city: 'Buenos Aires',
      postalCode: '1406',
      country: 'AR',
      phone: '11223344',
      website: 'https://colegio.edu.ar',
      contactEmail: 'info@colegio.edu.ar',
      logoUrl: 'https://cdn.example.com/logo.png',
      headerColor: HexColor.reconstruct('#1a56db'),
      headerTextColor: HexColor.reconstruct('#ffffff'),
      bodyTextColor: HexColor.reconstruct('#333333'),
      smtpHost: 'smtp.gmail.com',
      smtpUser: 'notifications@colegio.edu.ar',
      smtpPass: 'encrypted-pass',
      smtpEncryption: 'TLS',
      smtpPort: 587,
      sendEmail: true,
      sendMessages: false,
      socketHost: 'ws.colegio.edu.ar',
      socketPort: 8080,
      active: true,
      dbName: 'educandow_inst-1',
      levels: [
        Level.reconstruct(LevelType.INICIAL),
        Level.reconstruct(LevelType.PRIMARIO),
        Level.reconstruct(LevelType.SECUNDARIO),
      ],
      createdAt: now,
      updatedAt: now,
    });

    // Identity
    expect(inst.id.get()).toBe('inst-1');
    expect(inst.name).toBe('Colegio Nacional');
    expect(inst.cue?.get()).toBe('ABC123');
    expect(inst.ministryReg).toBe('REG-001');

    // Contact
    expect(inst.address).toBe('Av. Principal 123');
    expect(inst.city).toBe('Buenos Aires');
    expect(inst.postalCode).toBe('1406');
    expect(inst.country).toBe('AR');
    expect(inst.phone).toBe('11223344');
    expect(inst.website).toBe('https://colegio.edu.ar');
    expect(inst.contactEmail).toBe('info@colegio.edu.ar');

    // Branding
    expect(inst.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(inst.headerColor?.get()).toBe('#1a56db');
    expect(inst.headerTextColor?.get()).toBe('#ffffff');
    expect(inst.bodyTextColor?.get()).toBe('#333333');

    // SMTP
    expect(inst.smtpHost).toBe('smtp.gmail.com');
    expect(inst.smtpUser).toBe('notifications@colegio.edu.ar');
    expect(inst.smtpPass).toBe('encrypted-pass');
    expect(inst.smtpEncryption).toBe('TLS');
    expect(inst.smtpPort).toBe(587);

    // Flags
    expect(inst.sendEmail).toBe(true);
    expect(inst.sendMessages).toBe(false);

    // Socket
    expect(inst.socketHost).toBe('ws.colegio.edu.ar');
    expect(inst.socketPort).toBe(8080);

    // Config
    expect(inst.active).toBe(true);
    expect(inst.dbName).toBe('educandow_inst-1');
    expect(inst.createdAt).toBe(now);
    expect(inst.updatedAt).toBe(now);

    // Levels
    expect(inst.levels).toHaveLength(3);
    expect(inst.hasLevel(LevelType.INICIAL)).toBe(true);
    expect(inst.hasLevel(LevelType.PRIMARIO)).toBe(true);
    expect(inst.hasLevel(LevelType.SECUNDARIO)).toBe(true);
  });

  it('hasLevel() checks if level exists', () => {
    const inst = Institution.create({
      name: 'Test',
      levels: [Level.reconstruct(LevelType.SECUNDARIO)],
    });
    expect(inst.hasLevel(LevelType.SECUNDARIO)).toBe(true);
    expect(inst.hasLevel(LevelType.INICIAL)).toBe(false);
  });

  it('addLevel() appends a new level if not present', () => {
    const inst = Institution.create({ name: 'Test', levels: [] });
    inst.addLevel(Level.reconstruct(LevelType.TERCIARIO));
    expect(inst.levels).toHaveLength(1);
    expect(inst.hasLevel(LevelType.TERCIARIO)).toBe(true);
  });

  it('addLevel() does not duplicate an existing level', () => {
    const inst = Institution.create({
      name: 'Test',
      levels: [Level.reconstruct(LevelType.PRIMARIO)],
    });
    inst.addLevel(Level.reconstruct(LevelType.PRIMARIO));
    expect(inst.levels).toHaveLength(1);
  });

  it('dbName auto-generates with correct format', () => {
    const inst = Institution.create({
      name: 'Test',
      levels: [Level.reconstruct(LevelType.INICIAL)],
    });
    const expectedDbName = `educandow_${inst.id.get()}`;
    expect(inst.dbName).toBe(expectedDbName);
  });
});
