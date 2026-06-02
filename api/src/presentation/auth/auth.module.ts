import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { RegisterUserUseCase } from '../../application/auth/use-cases/register-user.use-case';
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../../application/auth/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../../application/auth/use-cases/logout.use-case';
import { JwtAuthPort } from '../../infrastructure/auth/jwt-auth-port';
import { BcryptPasswordHasher } from '../../infrastructure/auth/bcrypt-password-hasher';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { PrismaUserRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-user.repository';
import { PrismaRefreshTokenRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-refresh-token.repository';
import { PrismaInstitutionRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-institution.repository';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { LevelsGuard } from '../../infrastructure/auth/guards/levels.guard';
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
      useFactory: (repo, instRepo, hasher, authPort, refreshRepo) =>
        new LoginUseCase(repo, instRepo, hasher, authPort, refreshRepo),
      inject: [
        'UserRepository',
        'InstitutionRepository',
        'PasswordHasher',
        'AuthPort',
        'RefreshTokenRepository',
      ],
    },
    {
      provide: RefreshTokenUseCase,
      useFactory: (refreshRepo, userRepo, authPort) => new RefreshTokenUseCase(refreshRepo, userRepo, authPort),
      inject: ['RefreshTokenRepository', 'UserRepository', 'AuthPort'],
    },
    {
      provide: LogoutUseCase,
      useFactory: (refreshRepo) => new LogoutUseCase(refreshRepo),
      inject: ['RefreshTokenRepository'],
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
    RolesGuard,
    LevelsGuard,
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
    {
      provide: PrismaRefreshTokenRepository,
      useFactory: (prisma) => new PrismaRefreshTokenRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'RefreshTokenRepository',
      useExisting: PrismaRefreshTokenRepository,
    },
    {
      provide: PrismaInstitutionRepository,
      useFactory: (prisma) => new PrismaInstitutionRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'InstitutionRepository',
      useExisting: PrismaInstitutionRepository,
    },
    // ── Event Handlers ─────────────────────────────────────────────────
    UserRegisteredHandler,
  ],
  exports: [
    AuthGuard,
    RolesGuard,
    LevelsGuard,
    JwtAuthPort,
    'AuthPort',
    PrismaUserRepository,
    'UserRepository',
    'RefreshTokenRepository',
    'InstitutionRepository',
    PrismaInstitutionRepository,
    PrismaService,
  ],
})
export class AuthModule {}
