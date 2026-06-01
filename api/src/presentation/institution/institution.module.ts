import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionController } from './institution.controller';
import {
  CreateInstitutionUseCase, ListInstitutionsUseCase, GetInstitutionUseCase,
  DeleteInstitutionUseCase, GetMeUseCase, UpdateInstitutionUseCase,
  PrintInstitutionUseCase,
} from '../../application/institution/use-cases/institution.use-cases';
import { CreateInstitutionAdminUseCase } from '../../application/institution/use-cases/create-institution-admin.use-case';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { PrismaInstitutionRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-institution.repository';
import { PostgresAdminService } from '../../infrastructure/persistence/postgres-admin.service';
import { LocalDiskStorageAdapter } from '../../infrastructure/file-storage/local-disk-storage.adapter';

@Module({
  imports: [AuthModule],
  controllers: [InstitutionController],
  providers: [
    PrismaService,
    PostgresAdminService,
    LocalDiskStorageAdapter,
    {
      provide: CreateInstitutionAdminUseCase,
      useFactory: (prisma: PrismaService) =>
        new CreateInstitutionAdminUseCase(prisma.getMasterClient()),
      inject: [PrismaService],
    },
    {
      provide: PrismaInstitutionRepository,
      useFactory: (prisma) => new PrismaInstitutionRepository(prisma),
      inject: [PrismaService],
    },
    { provide: 'InstitutionRepository', useExisting: PrismaInstitutionRepository },
    {
      provide: CreateInstitutionUseCase,
      useFactory: (r, adminSvc, adminUC) =>
        new CreateInstitutionUseCase(r, adminSvc, adminUC),
      inject: ['InstitutionRepository', PostgresAdminService, CreateInstitutionAdminUseCase],
    },
    {
      provide: ListInstitutionsUseCase,
      useFactory: (r) => new ListInstitutionsUseCase(r),
      inject: ['InstitutionRepository'],
    },
    {
      provide: GetInstitutionUseCase,
      useFactory: (r) => new GetInstitutionUseCase(r),
      inject: ['InstitutionRepository'],
    },
    {
      provide: DeleteInstitutionUseCase,
      useFactory: (r) => new DeleteInstitutionUseCase(r),
      inject: ['InstitutionRepository'],
    },
    {
      provide: GetMeUseCase,
      useFactory: (r) => new GetMeUseCase(r),
      inject: ['InstitutionRepository'],
    },
    {
      provide: UpdateInstitutionUseCase,
      useFactory: (r) => new UpdateInstitutionUseCase(r),
      inject: ['InstitutionRepository'],
    },
    {
      provide: PrintInstitutionUseCase,
      useFactory: (r) => new PrintInstitutionUseCase(r),
      inject: ['InstitutionRepository'],
    },
  ],
  exports: ['InstitutionRepository', PrismaInstitutionRepository],
})
export class InstitutionModule {}
