import { describe, it, expect } from 'vitest';
import { CreateInstitutionFullSchema } from '../dto/create-institution-full.dto';

describe('CreateInstitutionFullSchema — Branding & SMTP validation', () => {
  const validInput = {
    name: 'Escuela Test',
    levels: ['INICIAL'],
  };

  // ── logo_url ─────────────────────────────────────────────

  it('accepts valid png URL', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      logo_url: 'https://cdn.example.com/logo.png',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid jpg URL', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      logo_url: 'https://example.com/images/logo.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid svg URL', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      logo_url: 'https://example.com/icon.svg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts relative path starting with /', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      logo_url: '/uploads/logo.png',
    });
    expect(result.success).toBe(true);
  });

  it('accepts no logo_url (optional)', () => {
    const result = CreateInstitutionFullSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects non-image URL (pdf)', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      logo_url: 'https://example.com/doc.pdf',
    });
    expect(result.success).toBe(false);
  });

  it('rejects url without image extension', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      logo_url: 'https://example.com/logo',
    });
    expect(result.success).toBe(false);
  });

  // ── hex colors ───────────────────────────────────────────

  it('rejects invalid hex color (color name)', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      header_color: 'red',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid hex color', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      header_color: '#1a56db',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty hex colors (optional)', () => {
    const result = CreateInstitutionFullSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  // ── smtp_encryption ──────────────────────────────────────

  it('rejects invalid SMTP encryption (STARTTLS)', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      smtp_encryption: 'STARTTLS',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid SMTP encryption TLS', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      smtp_encryption: 'TLS',
    });
    expect(result.success).toBe(true);
  });

  // ── smtp_port ────────────────────────────────────────────

  it('rejects smtp_port below 1', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      smtp_port: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects smtp_port above 65535', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      smtp_port: 70000,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid smtp_port in range', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      ...validInput,
      smtp_port: 587,
    });
    expect(result.success).toBe(true);
  });

  // ── levels validation ────────────────────────────────────

  it('rejects institution without any educational level', () => {
    const result = CreateInstitutionFullSchema.safeParse({
      name: 'Escuela Test',
      institution_levels: [],
      levels: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message);
      expect(issues.some((m) => m.includes('Sin niveles'))).toBe(true);
    }
  });
});
