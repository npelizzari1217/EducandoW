import {
  Controller, Post, Get, Delete, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RankGuard } from '../../infrastructure/auth/guards/rank.guard';
import { Rank } from '../../infrastructure/auth/decorators/rank.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/guards/auth.guard';
import { CreateObservationUseCase } from '../../application/student-observation/create-observation.use-case';
import { ListObservationsByStudentUseCase } from '../../application/student-observation/list-by-student.use-case';
import { ListObservationsByCourseUseCase } from '../../application/student-observation/list-by-course.use-case';
import { DeleteObservationUseCase } from '../../application/student-observation/delete-observation.use-case';

// ── Create + Delete (flat endpoints) ──────────────────────

@Controller('v1/student-observations')
@UseGuards(AuthGuard, RankGuard)
export class StudentObservationWriteController {
  constructor(
    private readonly createUC: CreateObservationUseCase,
    private readonly deleteUC: DeleteObservationUseCase,
  ) {}

  @Post()
  @Rank(20) // TEACHER+
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: { studentId: string; type: string; content: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.createUC.execute({
      studentId: body.studentId,
      authorId: user.userId,
      type: body.type,
      content: body.content,
      authorRoles: user.roles,
    });
    if (result.isErr()) throw result.unwrapErr();
    const obs = result.unwrap();
    return { data: this.mapObservation(obs) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.deleteUC.execute({
      observationId: id,
      callerId: user.userId,
      callerRoles: user.roles,
    });
    if (result.isErr()) throw result.unwrapErr();
  }

  private mapObservation(obs: { id: { get: () => string }; studentId: { get: () => string }; authorId: { get: () => string }; type: { value: string }; content: string; createdAt?: Date; deletedAt?: Date }) {
    return {
      id: obs.id.get(),
      studentId: obs.studentId.get(),
      authorId: obs.authorId.get(),
      type: obs.type.value,
      content: obs.content,
      createdAt: obs.createdAt?.toISOString(),
      deletedAt: obs.deletedAt?.toISOString() ?? null,
    };
  }
}

// ── Read endpoints (nested under students/courses) ────────

@Controller('v1')
@UseGuards(AuthGuard, RankGuard)
export class StudentObservationReadController {
  constructor(
    private readonly listByStudentUC: ListObservationsByStudentUseCase,
    private readonly listByCourseUC: ListObservationsByCourseUseCase,
  ) {}

  @Get('students/:studentId/observations')
  @Rank(20) // TEACHER+
  async findByStudent(
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.listByStudentUC.execute({
      studentId,
      callerRoles: user.roles,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap().map((obs) => this.mapObservation(obs)) };
  }

  @Get('courses/:cycleId/observations')
  @Rank(20) // TEACHER+
  async findByCourse(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.listByCourseUC.execute({
      cycleId,
      callerRoles: user.roles,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap().map((obs) => this.mapObservation(obs)) };
  }

  private mapObservation(obs: { id: { get: () => string }; studentId: { get: () => string }; authorId: { get: () => string }; type: { value: string }; content: string; createdAt?: Date; deletedAt?: Date }) {
    return {
      id: obs.id.get(),
      studentId: obs.studentId.get(),
      authorId: obs.authorId.get(),
      type: obs.type.value,
      content: obs.content,
      createdAt: obs.createdAt?.toISOString(),
      deletedAt: obs.deletedAt?.toISOString() ?? null,
    };
  }
}
