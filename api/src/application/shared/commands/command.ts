import { Result } from '@educandow/domain';

/**
 * Command — escritura: crea, modifica o elimina.
 * Cada command es una clase con execute().
 * Usado para: registrar alumno, cargar nota, modificar inscripción.
 */
export interface Command<TInput = unknown, TOutput = unknown> {
  execute(input: TInput): Promise<Result<TOutput, Error>>;
}

/**
 * Query — lectura: consulta sin efectos secundarios.
 * Cada query es una clase con execute().
 * Usado para: obtener boletín, reporte de asistencia, listado de alumnos.
 */
export interface Query<TInput = unknown, TOutput = unknown> {
  execute(input: TInput): Promise<Result<TOutput, Error>>;
}
