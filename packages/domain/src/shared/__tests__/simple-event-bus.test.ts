import { describe, it, expect, vi } from 'vitest';
import { SimpleEventBus } from '../simple-event-bus';
import { DomainEvent } from '../events/domain-event';

class UserCreatedEvent extends DomainEvent {
  constructor(aggregateId: string, public readonly email: string) {
    super('user.created', aggregateId);
  }
}

class OrderShippedEvent extends DomainEvent {
  constructor(aggregateId: string) {
    super('order.shipped', aggregateId);
  }
}

describe('SimpleEventBus', () => {
  describe('publish and subscribe', () => {
    it('invokes a single handler when an event is published', () => {
      const bus = new SimpleEventBus();
      const handler = vi.fn();
      const event = new UserCreatedEvent('user-1', 'test@example.com');

      bus.subscribe('user.created', { handle: handler });
      bus.publish(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('invokes all handlers subscribed to the same event', () => {
      const bus = new SimpleEventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const event = new UserCreatedEvent('user-2', 'a@b.com');

      bus.subscribe('user.created', { handle: handler1 });
      bus.subscribe('user.created', { handle: handler2 });
      bus.publish(event);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('publishes without error when no handlers are subscribed', () => {
      const bus = new SimpleEventBus();
      const event = new OrderShippedEvent('order-1');

      expect(() => bus.publish(event)).not.toThrow();
    });
  });

  describe('handler isolation', () => {
    it('allows remaining handlers to run when one handler throws', () => {
      const bus = new SimpleEventBus();
      const failingHandler = vi.fn().mockImplementation(() => {
        throw new Error('boom');
      });
      const succeedingHandler = vi.fn();
      const event = new UserCreatedEvent('user-3', 'fail@test.com');

      // Suppress console.error during test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      bus.subscribe('user.created', { handle: failingHandler });
      bus.subscribe('user.created', { handle: succeedingHandler });
      bus.publish(event);

      expect(failingHandler).toHaveBeenCalled();
      expect(succeedingHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('event routing', () => {
    it('routes events to handlers by event name', () => {
      const bus = new SimpleEventBus();
      const userHandler = vi.fn();
      const orderHandler = vi.fn();
      const userEvent = new UserCreatedEvent('user-4', 'x@y.com');
      const orderEvent = new OrderShippedEvent('order-2');

      bus.subscribe('user.created', { handle: userHandler });
      bus.subscribe('order.shipped', { handle: orderHandler });

      bus.publish(userEvent);
      expect(userHandler).toHaveBeenCalledTimes(1);
      expect(orderHandler).not.toHaveBeenCalled();

      bus.publish(orderEvent);
      expect(orderHandler).toHaveBeenCalledTimes(1);
    });
  });
});
