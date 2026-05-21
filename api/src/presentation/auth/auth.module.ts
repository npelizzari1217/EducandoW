import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { RegisterUserUseCase } from '../../application/auth/use-cases/register-user.use-case';
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case';
import { JwtAuthPort } from '../../infrastructure/auth/jwt-auth-port';
import { BcryptPasswordHasher } from '../../infrastructure/auth/bcrypt-password-hasher';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { loadEnvConfig } from '../../infrastructure/config/env.config';

const env = loadEnvConfig();

@Module({
  controllers: [AuthController],
  providers: [
    // Use Cases
    {
      provide: RegisterUserUseCase,
      useFactory: (repo, hasher) => new RegisterUserUseCase(repo, hasher),
      inject: ['UserRepository', 'PasswordHasher'],
    },
    {
      provide: LoginUseCase,
      useFactory: (repo, hasher, authPort) => new LoginUseCase(repo, hasher, authPort),
      inject: ['UserRepository', 'PasswordHasher', 'AuthPort'],
    },
    // Infrastructure
    {
      provide: JwtAuthPort,
      useFactory: () => new JwtAuthPort(env.jwtSecret, env.jwtExpiresIn),
    },
    {
      provide: 'AuthPort',
      useExisting: JwtAuthPort,
    },
    {
      provide: BcryptPasswordHasher,
      useFactory: () => new BcryptPasswordHasher(env.bcryptRounds),
    },
    {
      provide: 'PasswordHasher',
      useExisting: BcryptPasswordHasher,
    },
    PrismaService,
    {
      provide: 'UserRepository',
      useFactory: (prisma: PrismaService) => ({
        existsByEmail: async (email: any) => {
          const user = await prisma.user.findUnique({ where: { email: email.get() } });
          return !!user;
        },
        findByEmail: async (email: string) => {
          return prisma.user.findUnique({ where: { email } });
        },
        create: async (data: any) => {
          return prisma.user.create({ data });
        },
      }),
      inject: [PrismaService],
    },
    AuthGuard,
  ],
  exports: [AuthGuard, JwtAuthPort, PrismaService],
})
export class AuthModule {}
