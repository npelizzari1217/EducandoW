import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { RegisterUserUseCase } from '../../application/auth/use-cases/register-user.use-case';
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../../application/auth/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../../application/auth/use-cases/logout.use-case';
import { RegisterSchema, RegisterDTO } from './dto/register.request';
import { LoginSchema, LoginDTO } from './dto/login.request';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_PATH = '/v1/auth/refresh';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_PATH,
    maxAge: REFRESH_MAX_AGE,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_PATH,
  });
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body(new ZodValidationPipe(RegisterSchema)) body: RegisterDTO) {
    const result = await this.registerUserUseCase.execute({
      email: body.email,
      password: body.password,
      name: body.name,
      role: body.role,
      institutionId: body.institutionId,
    });

    if (result.isErr()) {
      throw result.unwrapErr();
    }

    return { data: result.unwrap() };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.loginUseCase.execute({
      email: body.email,
      password: body.password,
    });

    if (result.isErr()) {
      throw result.unwrapErr();
    }

    const authResponse = result.unwrap();
    setRefreshCookie(res, authResponse.refreshToken);

    return {
      data: {
        accessToken: authResponse.accessToken,
        user: authResponse.user,
      },
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: {
    userId: string;
    roles: string[];
    institutionId?: string;
    level?: number;
    levels?: number[];
    userLevels?: { level: number; modality: number }[];
    dbName?: string | null;
  }) {
    return { data: user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.refreshTokenUseCase.execute(token);

    if (result.isErr()) {
      clearRefreshCookie(res);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokens = result.unwrap();
    setRefreshCookie(res, tokens.refreshToken);

    return {
      data: {
        accessToken: tokens.accessToken,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await this.logoutUseCase.execute(token);
    }

    clearRefreshCookie(res);

    return { data: { message: 'Logged out successfully' } };
  }
}
