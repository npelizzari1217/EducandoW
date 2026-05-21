import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { RegisterUserUseCase } from '../../application/auth/use-cases/register-user.use-case';
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case';
import { RegisterRequest } from './dto/register.request';
import { LoginRequest } from './dto/login.request';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterRequest) {
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
  async login(@Body() body: LoginRequest, @Req() req: Request) {
    const result = await this.loginUseCase.execute({
      email: body.email,
      password: body.password,
    });

    if (result.isErr()) {
      throw result.unwrapErr();
    }

    const authResponse = result.unwrap();

    const response = req.res!;
    response.cookie('refreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      data: {
        accessToken: authResponse.accessToken,
        user: authResponse.user,
      },
    };
  }
}
