import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Pipe that validates request bodies against a zod schema.
 *
 * Usage:
 *   @Post('register')
 *   async register(@Body(new ZodValidationPipe(RegisterSchema)) body: RegisterDTO) { ... }
 */
export class ZodValidationPipe<T = unknown> implements PipeTransform {
  constructor(private schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const messages = formatZodErrors(result.error);
      throw new BadRequestException({
        statusCode: 400,
        error: 'Validation Failed',
        messages,
      });
    }

    return result.data;
  }
}

function formatZodErrors(error: ZodError): string[] {
  return error.errors.map((e) => {
    const path = e.path.join('.');
    return path ? `${path}: ${e.message}` : e.message;
  });
}
