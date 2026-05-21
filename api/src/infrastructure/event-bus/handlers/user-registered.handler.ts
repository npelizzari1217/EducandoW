import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { UserRegistered, EventBus } from '@educandow/domain';

@Injectable()
export class UserRegisteredHandler implements OnModuleInit {
  constructor(@Inject('EventBus') private readonly eventBus: EventBus) {}

  onModuleInit() {
    this.eventBus.subscribe('UserRegistered', this);
  }

  async handle(event: UserRegistered): Promise<void> {
    console.log(
      `[UserRegistered] Bienvenido ${event.name} (${event.email.get()}) — rol: ${event.role}`,
    );
    // En producción: enviar email de bienvenida, crear preferencias por defecto, etc.
  }
}
