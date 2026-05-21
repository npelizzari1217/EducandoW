import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { RegisterUserUseCase } from '../../application/auth/use-cases/register-user.use-case';
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case';
import { JwtAuthPort } from '../../infrastructure/auth/jwt-auth-port';
import { BcryptPasswordHasher } from '../../infrastructure/auth/bcrypt-password-hasher';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { PrismaUserRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-user.repository';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { UserRegisteredHandler } from '../../infrastructure/event-bus/handlers/user-registered.handler';
import { loadEnvConfig } from '../../infrastructure/config/env.config';

const env = loadEnvConfig();

@Module({
  controllers: [AuthController],
  providers: [
    // ── Use Cases ──────────────────────────────────────────────────────
    {
      provide: RegisterUserUseCase,
      useFactory: (repo, hasher, eventBus) => new RegisterUserUseCase(repo, hasher, eventBus),
      inject: ['UserRepository', 'PasswordHasher', 'EventBus'],
    },
    {
      provide: LoginUseCase,
      useFactory: (repo, hasher, authPort) => new LoginUseCase(repo, hasher, authPort),
      inject: ['UserRepository', 'PasswordHasher', 'AuthPort'],
    },
    // ── Auth Infrastructure ────────────────────────────────────────────
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
    AuthGuard,
    // ── Persistence ────────────────────────────────────────────────────
    PrismaService,
    {
      provide: PrismaUserRepository,
      useFactory: (prisma) => new PrismaUserRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'UserRepository',
      useExisting: PrismaUserRepository,
    },
    // ── Event Handlers ─────────────────────────────────────────────────
    UserRegisteredHandler,
  ],
  exports: [AuthGuard, JwtAuthPort, 'AuthPort', PrismaUserRepository, 'UserRepository', PrismaService],
})
export class AuthModule {}
