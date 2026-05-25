import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './presentation/auth/auth.module';
import { EventBusModule } from './infrastructure/event-bus/event-bus.module';
import { InstitutionModule } from './presentation/institution/institution.module';
import { StudentModule } from './presentation/student/student.module';
import { TeacherModule } from './presentation/teacher/teacher.module';
import { EnrollmentModule } from './presentation/enrollment/enrollment.module';
import { PedagogyModule } from './presentation/pedagogy/pedagogy.module';
import { ModulesModule } from './presentation/modules/modules.module';
import { UsersModule } from './presentation/users/users.module';
import { HealthController } from './presentation/shared/controllers/health.controller';
import { CatalogController } from './presentation/shared/controllers/catalog.controller';
import { AppExceptionFilter } from './presentation/shared/filters/exception.filter';
import { ResponseInterceptor } from './presentation/shared/interceptors/response.interceptor';
import { TenantMiddleware } from './infrastructure/auth/tenant.middleware';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    AuthModule,
    EventBusModule,
    InstitutionModule,
    StudentModule,
    TeacherModule,
    EnrollmentModule,
    PedagogyModule,
    ModulesModule,
    UsersModule,
  ],
  controllers: [HealthController, CatalogController],
  providers: [
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    PrismaService,
    TenantMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude('/health')
      .forRoutes('*');
  }
}
