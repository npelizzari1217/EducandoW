import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { ListUsersUseCase, CreateUserUseCase, UpdateUserUseCase, DeleteUserUseCase } from '../../application/users/use-cases/users.use-cases';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';

@Module({
  controllers: [UsersController],
  providers: [
    PrismaService,
    AuthGuard,
    RolesGuard,
    {
      provide: ListUsersUseCase,
      useFactory: (prisma) => new ListUsersUseCase(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateUserUseCase,
      useFactory: (prisma) => new CreateUserUseCase(prisma),
      inject: [PrismaService],
    },
    {
      provide: UpdateUserUseCase,
      useFactory: (prisma) => new UpdateUserUseCase(prisma),
      inject: [PrismaService],
    },
    {
      provide: DeleteUserUseCase,
      useFactory: (prisma) => new DeleteUserUseCase(prisma),
      inject: [PrismaService],
    },
  ],
})
export class UsersModule {}
