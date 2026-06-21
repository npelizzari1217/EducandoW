import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
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
  ATTENDANCE_TYPE_CODE_DUPLICATE: 409,
  ATTENDANCE_TYPE_SYSTEM_PROTECTED: 409,
  ATTENDANCE_TYPE_NOT_FOUND: 404,
  // Grading scales
  SCALE_NAME_DUPLICATE: 409,
  SCALE_NOT_FOUND: 404,
  SCALE_HAS_ACTIVE_VALUES: 409,
  VALUE_CODE_DUPLICATE: 409,
  VALUE_NOT_FOUND: 404,
  INVALID_INTERNAL_STATUS: 422,
  // Terciario — llamados-examen-terciario
  INVALID_LLAMADO_RANGE: 422,
  LLAMADO_OVERLAP: 409,
  // Terciario — evaluacion-terciario (T31)
  SLOT_ALREADY_EXISTS: 409,
  PREREQUISITE_SLOT_MISSING: 422,
  PARCIAL_YA_APROBADO: 422,
  INVALID_INTENTO: 422,
  ALUMNO_LIBRE_NO_PUEDE_RENDIR: 422,
  CURSADA_NO_CONFIRMADA: 422,
  TP_OBLIGATORIO_FALTANTE: 422,
  MAX_INTENTOS_ALCANZADO: 422,
  CONDICION_INVALIDA: 422,
  REGULARIDAD_VENCIDA: 422,
  // Terciario — docente-grade-entry (Fase D)
  DOCENTE_ALREADY_ASSIGNED: 409,
  ASSIGNMENT_ALREADY_INACTIVE: 409,
  // Materia-grupo-ciclo — Fase 3 (exclusión estricta: un alumno = un grupo por materia)
  ALUMNO_ALREADY_IN_GRUPO: 409,
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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

    // Errores 5xx inesperados (Prisma, bugs, etc.): logueá el stack completo.
    // Sin esto, un 500 deja el log mudo y quedás ciego para debuggear.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled ${status} en ${request.method} ${request.url}: ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      error: {
        status,
        message,
      },
    });
  }
}
