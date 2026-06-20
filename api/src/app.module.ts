import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './presentation/auth/auth.module';
import { EventBusModule } from './infrastructure/event-bus/event-bus.module';
import { InstitutionModule } from './presentation/institution/institution.module';
import { StudentModule } from './presentation/student/student.module';
import { IngresanteModule } from './presentation/ingresante/ingresante.module';
import { PedagogyModule } from './presentation/pedagogy/pedagogy.module';
import { ModulesModule } from './presentation/modules/modules.module';
import { UsersModule } from './presentation/users/users.module';
import { NivelInicialModule } from './presentation/nivel-inicial/nivel-inicial.module';
import { NivelPrimarioModule } from './presentation/nivel-primario/nivel-primario.module';
import { NivelSecundarioModule } from './presentation/nivel-secundario/nivel-secundario.module';
import { NivelTerciarioModule } from './presentation/nivel-terciario/nivel-terciario.module';
import { ProfilesModule } from './presentation/profiles/profiles.module';
import { CourseCycleModule } from './presentation/course-cycle/course-cycle.module';
import { StudentObservationModule } from './presentation/student-observation/student-observation.module';
import { ReportesModule } from './presentation/reportes/reportes.module';
import { AttendanceTypeModule } from './presentation/attendance-type/attendance-type.module';
import { GradingModule } from './presentation/grading/grading.module';
import { DocenteCicloModule } from './presentation/docente-ciclo/docente-ciclo.module';
import { MateriasGruposModule } from './presentation/materia-grupo-ciclo/materia-grupo-ciclo.module';
import { AsignacionCursoModule } from './presentation/asignacion-curso/asignacion-curso.module';
import { AsistenciaModule } from './presentation/asistencia/asistencia.module';
import { AlumnosXCursoXCicloModule } from './presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.module';
import { HealthController } from './presentation/shared/controllers/health.controller';
import { CatalogController } from './presentation/shared/controllers/catalog.controller';
import { AppExceptionFilter } from './presentation/shared/filters/exception.filter';
import { ResponseInterceptor } from './presentation/shared/interceptors/response.interceptor';
import { TenantMiddleware } from './infrastructure/auth/tenant.middleware';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { PostgresAdminService } from './infrastructure/persistence/postgres-admin.service';

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
    IngresanteModule,
    PedagogyModule,
    ModulesModule,
    UsersModule,
    NivelInicialModule,
    NivelPrimarioModule,
    NivelSecundarioModule,
    NivelTerciarioModule,
    ProfilesModule,
    CourseCycleModule,
    StudentObservationModule,
    ReportesModule,
    AttendanceTypeModule,
    GradingModule,
    DocenteCicloModule,
    MateriasGruposModule,
    AsignacionCursoModule,
    AsistenciaModule,
    AlumnosXCursoXCicloModule,
  ],
  controllers: [HealthController, CatalogController],
  providers: [
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    PrismaService,
    PostgresAdminService,
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
