import { DomainEvent } from './events/domain-event';
import { EventBus, EventHandler } from './event-bus';

export class SimpleEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  publish(event: DomainEvent): void {
    const subs = this.handlers.get(event.eventName);
    if (!subs) return;

    for (const handler of subs) {
      try {
        handler.handle(event);
      } catch (error) {
        console.error(`[EventBus] Error handling event "${event.eventName}":`, error);
      }
    }
  }

  subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    const subs = this.handlers.get(eventName) ?? new Set<EventHandler>();
    subs.add(handler as EventHandler);
    this.handlers.set(eventName, subs);
  }
}
