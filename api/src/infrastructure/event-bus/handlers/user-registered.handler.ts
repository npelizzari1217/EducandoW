import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { UserRegistered, EventBus } from '@educandow/domain';

@Injectable()
export class UserRegisteredHandler implements OnModuleInit {
  private readonly logger = new Logger(UserRegisteredHandler.name);

  constructor(@Inject('EventBus') private readonly eventBus: EventBus) {}

  onModuleInit() {
    this.eventBus.subscribe('UserRegistered', this);
  }

  async handle(event: UserRegistered): Promise<void> {
    this.logger.log(
      `[UserRegistered] Bienvenido ${event.name} (${event.email.get()}) — roles: ${event.roles.join(', ')}`,
    );
    // En producción: enviar email de bienvenida, crear preferencias por defecto, etc.
  }
}
