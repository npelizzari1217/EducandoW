/**
 * InfrastructureError — 3rd tier of the layered error model (ADR: layered errors).
 *
 * Models failures whose cause is the INFRASTRUCTURE ITSELF (a dependency unavailable,
 * an artifact missing) — not a domain invariant (`DomainError`) and not the caller's
 * context (`ApplicationError`). Always an unexpected server condition → HTTP 500.
 *
 * Co-located with `ApplicationError` in `application/shared/errors/` (no new dir).
 * `httpStatus` is a FIXED field (not a ctor param) so no subclass can override it.
 * `code` is REQUIRED (no default): the structural bound of `unwrapResultOrThrow` needs it.
 */
export abstract class InfrastructureError extends Error {
  public readonly httpStatus = 500;

  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
