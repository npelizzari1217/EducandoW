import { InfrastructureError } from './infrastructure-error';

/**
 * TenantClientUnavailableError — the tenant Prisma client is not present on the
 * async TenantContext. Reused by pilot 1 (update-grupo) and pilot 2 (competency);
 * same infra failure, not duplicated per call site.
 */
export class TenantClientUnavailableError extends InfrastructureError {
  constructor(context?: string) {
    super(
      context ? `No tenant client available (${context})` : 'No tenant client available',
      'TENANT_CLIENT_UNAVAILABLE',
    );
  }
}

/**
 * TemplateNotFoundError — an HTML/Handlebars report template could not be resolved.
 * `code` deliberately aligns with the legacy `TEMPLATE_NOT_FOUND` string so the
 * `reporting-errors-reclassification` follow-up can reuse it verbatim.
 */
export class TemplateNotFoundError extends InfrastructureError {
  constructor(templateName: string) {
    super(`Template ${templateName} no encontrado`, 'TEMPLATE_NOT_FOUND');
  }
}

/**
 * InstitutionNotFoundError — the institution row is absent in the MASTER DB although
 * an institutionId is present on the TenantContext. A master/tenant data-integrity
 * fault (dangling reference), not a client-visible domain outcome → HTTP 500 (preserved).
 */
export class InstitutionNotFoundError extends InfrastructureError {
  constructor(message = 'Institución no encontrada') {
    super(message, 'INSTITUTION_NOT_FOUND');
  }
}
