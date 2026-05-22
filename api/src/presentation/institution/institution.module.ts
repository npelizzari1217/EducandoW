import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionController } from './institution.controller';
import {
  CreateInstitutionUseCase, ListInstitutionsUseCase, GetInstitutionUseCase,
  DeleteInstitutionUseCase, GetMeUseCase, UpdateInstitutionUseCase,
} from '../../application/institution/use-cases/institution.use-cases';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { PrismaInstitutionRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-institution.repository';

@Module({
  imports: [AuthModule],
  controllers: [InstitutionController],
  providers: [
    PrismaService,
    {
      provide: PrismaInstitutionRepository,
      useFactory: (prisma) => new PrismaInstitutionRepository(prisma),
      inject: [PrismaService],
    },
    { provide: 'InstitutionRepository', useExisting: PrismaInstitutionRepository },
    {
      provide: CreateInstitutionUseCase,
      useFactory: (r) => new CreateInstitutionUseCase(r),
      inject: ['InstitutionRepository'],
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
  ],
  exports: ['InstitutionRepository', PrismaInstitutionRepository],
})
export class InstitutionModule {}
