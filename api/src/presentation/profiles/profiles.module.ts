import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import {
  ListProfilesUseCase,
  GetProfileUseCase,
  CreateProfileUseCase,
  UpdateProfileUseCase,
  DeleteProfileUseCase,
  GetProfilePermissionsUseCase,
  UpsertPermissionsUseCase,
} from '../../application/profiles/use-cases/profiles.use-cases';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProfilesController],
  providers: [
    PrismaService,
    {
      provide: ListProfilesUseCase,
      useFactory: (prisma: PrismaService) => new ListProfilesUseCase(prisma),
      inject: [PrismaService],
    },
    {
      provide: GetProfileUseCase,
      useFactory: (prisma: PrismaService) => new GetProfileUseCase(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateProfileUseCase,
      useFactory: (prisma: PrismaService) => new CreateProfileUseCase(prisma),
      inject: [PrismaService],
    },
    {
      provide: UpdateProfileUseCase,
      useFactory: (prisma: PrismaService) => new UpdateProfileUseCase(prisma),
      inject: [PrismaService],
    },
    {
      provide: DeleteProfileUseCase,
      useFactory: (prisma: PrismaService) => new DeleteProfileUseCase(prisma),
      inject: [PrismaService],
    },
    {
      provide: GetProfilePermissionsUseCase,
      useFactory: (prisma: PrismaService) => new GetProfilePermissionsUseCase(prisma),
      inject: [PrismaService],
    },
    {
      provide: UpsertPermissionsUseCase,
      useFactory: (prisma: PrismaService) => new UpsertPermissionsUseCase(prisma),
      inject: [PrismaService],
    },
  ],
})
export class ProfilesModule {}
