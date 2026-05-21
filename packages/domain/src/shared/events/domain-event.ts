export abstract class DomainEvent {
  public readonly occurredAt: Date;

  constructor(
    public readonly eventName: string,
    public readonly aggregateId: string,
  ) {
    this.occurredAt = new Date();
  }
}
