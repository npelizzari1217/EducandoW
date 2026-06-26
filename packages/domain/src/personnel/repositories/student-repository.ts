import type { Student } from '../entities';

export interface StudentRepository {
  findById(id: string): Promise<Student | null>;
  findByInstitution(institutionId: string): Promise<Student[]>;
  findByDni(dni: string): Promise<Student | null>;
  search(institutionId: string, query: string): Promise<Student[]>;
  save(student: Student): Promise<void>;
  delete(id: string): Promise<void>;
  findByUserId(userId: string): Promise<Student | null>;
  findByGuardianUserId(guardianUserId: string): Promise<Student[]>;
  /** Mutación puntual: setea fecha_de_pase en el Student (pass null para revertir). */
  setFechaDePase(studentId: string, fechaDePase: Date | null): Promise<void>;
}
