import { Global, Module } from '@nestjs/common';
import { InMemoryEventBus } from './in-memory-event-bus';

@Global()
@Module({
  providers: [
    {
      provide: 'EventBus',
      useClass: InMemoryEventBus,
    },
    {
      provide: InMemoryEventBus,
      useExisting: 'EventBus',
    },
  ],
  exports: ['EventBus', InMemoryEventBus],
})
export class EventBusModule {}
