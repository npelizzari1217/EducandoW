import type { NotaTrimestral } from '../entities/nota-trimestral';

export interface NotaTrimestralRepository {
  findById(id: string): Promise<NotaTrimestral | null>;
  findByStudentAndPeriod(studentId: string, periodId: string): Promise<NotaTrimestral[]>;
  save(notaTrimestral: NotaTrimestral): Promise<void>;
  delete(id: string): Promise<void>;
}
