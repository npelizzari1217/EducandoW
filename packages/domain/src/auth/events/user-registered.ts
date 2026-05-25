import { DomainEvent } from '../../shared/events/domain-event';
import { Id } from '../../shared/value-objects/id';
import { Email } from '../../shared/value-objects/email';

export class UserRegistered extends DomainEvent {
  constructor(
    public readonly userId: Id,
    public readonly email: Email,
    public readonly name: string,
    public readonly roles: string[],
  ) {
    super('UserRegistered', userId.get());
  }
}
