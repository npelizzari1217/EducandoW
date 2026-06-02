import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '@educandow/domain';

// Map domain error codes to HTTP status
const DOMAIN_STATUS: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  USER_NOT_FOUND: 404,
  EMAIL_ALREADY_EXISTS: 409,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  FORBIDDEN: 403,
  COURSE_CYCLE_ALREADY_EXISTS: 409,
  COURSE_CYCLE_CLOSED: 409,
  ACADEMIC_CYCLE_CLOSED: 409,
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        if (Array.isArray(obj.messages)) {
          message = (obj.messages as string[]).join('; ');
        } else if (typeof obj.message === 'string') {
          message = obj.message;
        } else if (Array.isArray(obj.message)) {
          message = (obj.message as string[]).join('; ');
        }
      }
    } else if (exception instanceof DomainError) {
      status = DOMAIN_STATUS[exception.code] ?? HttpStatus.BAD_REQUEST;
      message = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      error: {
        status,
        message,
      },
    });
  }
}
