import { Injectable } from '@nestjs/common';
import { DomainEvent, EventBus, EventHandler } from '@educandow/domain';

@Injectable()
export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  publish(event: DomainEvent): void {
    const eventHandlers = this.handlers.get(event.eventName);
    if (!eventHandlers) return;

    for (const handler of eventHandlers) {
      Promise.resolve(handler.handle(event)).catch((err) => {
        console.error(`[EventBus] Handler error for ${event.eventName}:`, err);
      });
    }
  }

  subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler);
  }
}
