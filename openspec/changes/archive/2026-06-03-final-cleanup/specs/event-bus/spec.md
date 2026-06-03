# Event Bus Specification

## Purpose

In-memory domain event bus that decouples event publishers from handlers. Enables future domain events (user created, cycle activated) to trigger side effects without coupling modules.

## ADDED Requirements

### Requirement: Publish Domain Events

The system MUST provide a mechanism to publish domain events and deliver them to all registered handlers for that event name in FIFO order.

#### Scenario: Publish event with multiple handlers

- GIVEN two handlers subscribed to `"user.created"`
- WHEN `eventBus.publish(new UserCreatedEvent(...))` is called
- THEN both handlers receive the event
- AND handler #1 executes before handler #2

#### Scenario: Publish event with no handlers

- GIVEN no handler is subscribed to `"course.archived"`
- WHEN `eventBus.publish(new CourseArchivedEvent(...))` is called
- THEN the publish completes without error
- AND no handlers are invoked

### Requirement: Subscribe to Events

The system MUST allow registration of event handlers by event name. Handlers MAY be synchronous or asynchronous.

#### Scenario: Subscribe a handler

- GIVEN an EventBus instance
- WHEN `eventBus.subscribe("user.created", handler)` is called
- THEN the handler is registered for `"user.created"`
- AND subsequent publishes of `"user.created"` invoke that handler

#### Scenario: Subscribe multiple handlers to same event

- GIVEN an EventBus instance
- WHEN two handlers subscribe to `"user.created"`
- THEN both handlers are invoked on publish
- AND both receive the same event object

### Requirement: Handler Failure Isolation

The system MUST isolate handler failures — one handler throwing an error SHALL NOT prevent other handlers from receiving the event.

#### Scenario: One handler throws, others succeed

- GIVEN handler A and handler B subscribed to `"user.created"`
- AND handler A throws an error
- WHEN `eventBus.publish(...)` is called
- THEN handler B still receives and processes the event
- AND the error from handler A is logged (console.error)
