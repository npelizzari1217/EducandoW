import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './presentation/auth/auth.module';
import { EventBusModule } from './infrastructure/event-bus/event-bus.module';
import { HealthController } from './presentation/shared/controllers/health.controller';
import { AppExceptionFilter } from './presentation/shared/filters/exception.filter';
import { ResponseInterceptor } from './presentation/shared/interceptors/response.interceptor';

@Module({
  imports: [AuthModule, EventBusModule],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
