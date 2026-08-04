import { describe, it, expect } from 'vitest';
import { InfrastructureError } from '../infrastructure-error';
import { TenantClientUnavailableError, TemplateNotFoundError, InstitutionNotFoundError } from '../infrastructure-errors';

describe('TenantClientUnavailableError', () => {
  // IEM-R2.S1
  it('has fixed code, httpStatus and a default message', () => {
    const err = new TenantClientUnavailableError();
    expect(err.code).toBe('TENANT_CLIENT_UNAVAILABLE');
    expect(err.httpStatus).toBe(500);
    expect(err.message).toBe('No tenant client available');
  });
});

describe('TemplateNotFoundError', () => {
  // IEM-R2.S2
  it('has fixed code, httpStatus and a message referencing the template name', () => {
    const err = new TemplateNotFoundError('attendance-types.hbs');
    expect(err.code).toBe('TEMPLATE_NOT_FOUND');
    expect(err.httpStatus).toBe(500);
    expect(err.message).toContain('attendance-types.hbs');
  });
});

describe('InstitutionNotFoundError', () => {
  // RER-R1
  it('is an InfrastructureError with code INSTITUTION_NOT_FOUND, httpStatus 500 and a default message', () => {
    const err = new InstitutionNotFoundError();
    expect(err).toBeInstanceOf(InfrastructureError);
    expect(err.code).toBe('INSTITUTION_NOT_FOUND');
    expect(err.httpStatus).toBe(500);
    expect(err.message).toBe('Institución no encontrada');
  });
});
