import { DomainEvent } from './events/domain-event';

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): void | Promise<void>;
}

export interface EventBus {
  publish(event: DomainEvent): void;
  subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void;
}
