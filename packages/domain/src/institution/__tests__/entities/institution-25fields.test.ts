import { describe, it, expect } from 'vitest';
import { Institution, type InstitutionLevelEntry } from '../../entities/institution';
import { HexColor } from '../../value-objects/hex-color';
import { Cue } from '../../value-objects/cue';
import { EducationalLevelCode } from '../../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../../shared/value-objects/educational-modality';

const IL = (level: EducationalLevelCode, modality: EducationalModalityCode = EducationalModalityCode.COMUN): InstitutionLevelEntry => ({ level, modality });

describe('Institution (28 fields)', () => {
  it('create() applies correct defaults', () => {
    const inst = Institution.create({
      name: 'Escuela 123',
      institutionLevels: [
        { level: EducationalLevelCode.INICIAL, modality: EducationalModalityCode.COMUN },
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
      ],
    });

    expect(inst.id).toBeDefined();
    expect(inst.name).toBe('Escuela 123');
    expect(inst.levels).toHaveLength(2);
    expect(inst.institutionLevels).toHaveLength(2);

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
    expect(inst.bodyColor).toBeUndefined();
    expect(inst.footerColor).toBeUndefined();
    expect(inst.footerTextColor).toBeUndefined();
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
      institutionLevels: [IL(EducationalLevelCode.TERCIARIO)],
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

  it('reconstruct() restores all 28 fields from persistence', () => {
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
      bodyColor: HexColor.reconstruct('#f8fafc'),
      footerColor: HexColor.reconstruct('#1e293b'),
      footerTextColor: HexColor.reconstruct('#ffffff'),
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
      institutionLevels: [
        IL(EducationalLevelCode.INICIAL),
        IL(EducationalLevelCode.PRIMARIO),
        IL(EducationalLevelCode.SECUNDARIO),
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
    expect(inst.bodyColor?.get()).toBe('#f8fafc');
    expect(inst.footerColor?.get()).toBe('#1e293b');
    expect(inst.footerTextColor?.get()).toBe('#ffffff');

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
    expect(inst.institutionLevels).toHaveLength(3);
    expect(inst.hasLevel(EducationalLevelCode.INICIAL, EducationalModalityCode.COMUN)).toBe(true);
    expect(inst.hasLevel(EducationalLevelCode.PRIMARIO, EducationalModalityCode.COMUN)).toBe(true);
    expect(inst.hasLevel(EducationalLevelCode.SECUNDARIO, EducationalModalityCode.COMUN)).toBe(true);
  });

  it('hasLevel() checks if level+modality pair exists', () => {
    const inst = Institution.create({
      name: 'Test',
      institutionLevels: [IL(EducationalLevelCode.SECUNDARIO, EducationalModalityCode.COMUN)],
    });
    expect(inst.hasLevel(EducationalLevelCode.SECUNDARIO, EducationalModalityCode.COMUN)).toBe(true);
    expect(inst.hasLevel(EducationalLevelCode.INICIAL, EducationalModalityCode.COMUN)).toBe(false);
    expect(inst.hasLevel(EducationalLevelCode.SECUNDARIO, EducationalModalityCode.TALLERES)).toBe(false);
  });

  it('addLevel() appends a new level+modality if not present', () => {
    const inst = Institution.create({ name: 'Test', institutionLevels: [] });
    inst.addLevel(EducationalLevelCode.TERCIARIO, EducationalModalityCode.COMUN);
    expect(inst.institutionLevels).toHaveLength(1);
    expect(inst.hasLevel(EducationalLevelCode.TERCIARIO, EducationalModalityCode.COMUN)).toBe(true);
  });

  it('addLevel() does not duplicate an existing pair', () => {
    const inst = Institution.create({
      name: 'Test',
      institutionLevels: [IL(EducationalLevelCode.PRIMARIO, EducationalModalityCode.COMUN)],
    });
    inst.addLevel(EducationalLevelCode.PRIMARIO, EducationalModalityCode.COMUN);
    expect(inst.institutionLevels).toHaveLength(1);
  });

  it('dbName auto-generates with correct format', () => {
    const inst = Institution.create({
      name: 'Test',
      institutionLevels: [IL(EducationalLevelCode.INICIAL)],
    });
    const expectedDbName = `educandow_${inst.id.get()}`;
    expect(inst.dbName).toBe(expectedDbName);
  });
});
