import { describe, it, expect } from 'vitest';
import { SmtpConfig } from '../../value-objects/smtp-config';

describe('SmtpConfig', () => {
  it('create() returns Ok for valid TLS encryption', () => {
    const result = SmtpConfig.create({ encryption: 'TLS' });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().encryption).toBe('TLS');
  });

  it('create() returns Ok for valid SSL encryption', () => {
    const result = SmtpConfig.create({ encryption: 'SSL' });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().encryption).toBe('SSL');
  });

  it('create() returns Ok for valid NONE encryption', () => {
    const result = SmtpConfig.create({ encryption: 'NONE' });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().encryption).toBe('NONE');
  });

  it('create() returns Err for invalid STARTTLS encryption', () => {
    const result = SmtpConfig.create({ encryption: 'STARTTLS' as any });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('Invalid SMTP encryption');
  });

  it('create() returns Err for random string encryption', () => {
    const result = SmtpConfig.create({ encryption: 'WEP' as any });
    expect(result.isErr()).toBe(true);
  });

  it('create() returns Ok with all fields', () => {
    const result = SmtpConfig.create({
      host: 'smtp.gmail.com',
      user: 'user@domain.com',
      pass: 'secret123',
      encryption: 'TLS',
      port: 587,
    });
    expect(result.isOk()).toBe(true);
    const config = result.unwrap();
    expect(config.host).toBe('smtp.gmail.com');
    expect(config.user).toBe('user@domain.com');
    expect(config.pass).toBe('secret123');
    expect(config.encryption).toBe('TLS');
    expect(config.port).toBe(587);
  });

  it('create() returns Ok with no fields (all optional)', () => {
    const result = SmtpConfig.create({});
    expect(result.isOk()).toBe(true);
    const config = result.unwrap();
    expect(config.host).toBeUndefined();
    expect(config.encryption).toBeUndefined();
  });

  it('create() returns Err for port below 1', () => {
    const result = SmtpConfig.create({ port: 0 });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('Invalid SMTP port');
  });

  it('create() returns Err for port above 65535', () => {
    const result = SmtpConfig.create({ port: 70000 });
    expect(result.isErr()).toBe(true);
  });

  it('reconstruct() creates without validation', () => {
    const config = SmtpConfig.reconstruct({
      host: 'smtp.example.com',
      encryption: 'SSL',
      port: 465,
    });
    expect(config.host).toBe('smtp.example.com');
    expect(config.encryption).toBe('SSL');
    expect(config.port).toBe(465);
  });
});
