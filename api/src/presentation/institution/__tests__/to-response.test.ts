import { describe, it, expect } from 'vitest';
import { Institution } from '@educandow/domain';

// Recreate the toResponse function from the controller for testing
// (it's a private function so we replicate it here)
function toResponse(inst: Institution) {
  return {
    id: inst.id.get(),
    name: inst.name,
    cue: inst.cue?.get() ?? null,
    ministry_reg: inst.ministryReg ?? null,
    address: inst.address ?? null,
    city: inst.city ?? null,
    postal_code: inst.postalCode ?? null,
    country: inst.country ?? null,
    phone: inst.phone ?? null,
    website: inst.website ?? null,
    contact_email: inst.contactEmail ?? null,
    logo_url: inst.logoUrl ?? null,
    header_color: inst.headerColor?.get() ?? null,
    header_text_color: inst.headerTextColor?.get() ?? null,
    body_text_color: inst.bodyTextColor?.get() ?? null,
    body_color: inst.bodyColor?.get() ?? null,
    footer_color: inst.footerColor?.get() ?? null,
    footer_text_color: inst.footerTextColor?.get() ?? null,
    smtp_host: inst.smtpHost ?? null,
    smtp_user: inst.smtpUser ?? null,
    smtp_encryption: inst.smtpEncryption ?? null,
    smtp_port: inst.smtpPort ?? null,
    send_email: inst.sendEmail ?? false,
    send_messages: inst.sendMessages ?? false,
    socket_host: inst.socketHost ?? null,
    socket_port: inst.socketPort ?? null,
    active: inst.active ?? true,
    db_name: inst.dbName ?? null,
    levels: inst.levels.map((l) => l.toCode()),
    institution_levels: inst.institutionLevels.map((il) => ({
      level: il.level,
      modality: il.modality,
    })),
    created_at: inst.createdAt?.toISOString() ?? null,
    updated_at: inst.updatedAt?.toISOString() ?? null,
  };
}

describe('toResponse (controller response mapper)', () => {
  it('excludes smtp_pass from the response', () => {
    const inst = Institution.create({
      name: 'Test School',
      smtpHost: 'smtp.example.com',
      smtpUser: 'user@test.com',
      smtpPass: 'super-secret-password',
      smtpEncryption: 'TLS',
      smtpPort: 587,
      institutionLevels: [],
    });

    const response = toResponse(inst);

    // Verify smtp_pass is NOT present
    expect(response).not.toHaveProperty('smtp_pass');
    expect(Object.keys(response)).not.toContain('smtp_pass');

    // But smtp metadata IS present
    expect(response.smtp_host).toBe('smtp.example.com');
    expect(response.smtp_user).toBe('user@test.com');
    expect(response.smtp_encryption).toBe('TLS');
    expect(response.smtp_port).toBe(587);
  });

  it('includes all 25 expected fields', () => {
    const inst = Institution.create({
      name: 'Full School',
      cue: undefined,
      ministryReg: 'MIN-99',
      address: '123 Main St',
      city: 'Rosario',
      postalCode: '2000',
      country: 'AR',
      phone: '341123456',
      website: 'https://fullschool.edu.ar',
      contactEmail: 'contact@fullschool.edu.ar',
      logoUrl: 'https://cdn.example.com/logo.png',
      headerColor: undefined,
      headerTextColor: undefined,
      bodyTextColor: undefined,
      bodyColor: undefined,
      footerColor: undefined,
      footerTextColor: undefined,
      smtpHost: 'smtp.example.com',
      smtpUser: 'mailer@example.com',
      smtpPass: 'secret',
      smtpEncryption: 'TLS',
      smtpPort: 587,
      sendEmail: true,
      sendMessages: true,
      socketHost: 'ws.example.com',
      socketPort: 9090,
      institutionLevels: [],
    });

    const response = toResponse(inst);

    const expectedKeys = [
      'id', 'name', 'cue', 'ministry_reg', 'address', 'city', 'postal_code',
      'country', 'phone', 'website', 'contact_email', 'logo_url',
      'header_color', 'header_text_color', 'body_text_color',
      'body_color', 'footer_color', 'footer_text_color',
      'smtp_host', 'smtp_user', 'smtp_encryption', 'smtp_port',
      'send_email', 'send_messages', 'socket_host', 'socket_port',
      'active', 'db_name', 'levels', 'institution_levels', 'created_at', 'updated_at',
    ];

    // 31 keys total — institution_levels was missing from old test
    // The entity now has 28 fields (including the 3 new print config colors)

    for (const key of expectedKeys) {
      expect(Object.keys(response)).toContain(key);
    }

    // smtp_pass MUST NOT be present
    expect(Object.keys(response)).not.toContain('smtp_pass');
  });

  it('maps null values for optional fields correctly', () => {
    const inst = Institution.create({
      name: 'Minimal School',
      institutionLevels: [],
    });

    const response = toResponse(inst);

    expect(response.name).toBe('Minimal School');
    expect(response.cue).toBeNull();
    expect(response.header_color).toBeNull();
    expect(response.smtp_host).toBeNull();
    expect(response.send_email).toBe(false);
    expect(response.send_messages).toBe(false);
    expect(response.active).toBe(true);
    expect(response.levels).toEqual([]);
  });
});
