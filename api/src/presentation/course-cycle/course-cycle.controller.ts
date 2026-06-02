import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  CreateCourseCycleSchema,
  CreateCourseCycleDto,
  UpdateCourseCycleSchema,
  UpdateCourseCycleDto,
  GenerateCourseCyclesSchema,
  GenerateCourseCyclesDto,
  CourseCycleListQuerySchema,
  CourseCycleListQueryDto,
} from './dto/course-cycle.dto';
import {
  CreateCourseCycleUseCase,
  UpdateCourseCycleUseCase,
  DeleteCourseCycleUseCase,
  ToggleCourseCycleActiveUseCase,
  GetCourseCycleUseCase,
  ListCourseCyclesUseCase,
  GenerateCourseCyclesUseCase,
} from '../../application/course-cycle/use-cases/course-cycle.use-cases';

@Controller('v1/course-cycles')
@UseGuards(AuthGuard, RolesGuard)
export class CourseCycleController {
  constructor(
    private readonly createUC: CreateCourseCycleUseCase,
    private readonly updateUC: UpdateCourseCycleUseCase,
    private readonly deleteUC: DeleteCourseCycleUseCase,
    private readonly toggleUC: ToggleCourseCycleActiveUseCase,
    private readonly getUC: GetCourseCycleUseCase,
    private readonly listUC: ListCourseCyclesUseCase,
    private readonly generateUC: GenerateCourseCyclesUseCase,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateCourseCycleSchema)) body: CreateCourseCycleDto) {
    const result = await this.createUC.execute({
      courseId: body.courseId,
      studyPlanId: body.studyPlanId,
      cycleId: body.cycleId,
      courseName: body.courseName,
      level: body.level,
      passingGrade: body.passingGrade,
      promotionText: body.promotionText ?? null,
      firstBimonthStart: body.firstBimonthStart,
      firstBimonthEnd: body.firstBimonthEnd,
      secondBimonthStart: body.secondBimonthStart,
      secondBimonthEnd: body.secondBimonthEnd,
      thirdBimonthStart: body.thirdBimonthStart,
      thirdBimonthEnd: body.thirdBimonthEnd,
      fourthBimonthStart: body.fourthBimonthStart,
      fourthBimonthEnd: body.fourthBimonthEnd,
    });
    if (result.isErr()) throw result.unwrapErr();
    const cc = result.unwrap();
    return { data: this.toResponse(cc) };
  }

  @Get()
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async list(@Query(new ZodValidationPipe(CourseCycleListQuerySchema)) query: CourseCycleListQueryDto) {
    const result = await this.listUC.execute({
      level: query.level,
      cycleId: query.cycleId,
      active: query.active,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      data: result.data.map(this.toResponse),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  @Get(':uuid')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async get(@Param('uuid') uuid: string) {
    const result = await this.getUC.execute(uuid);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.toResponse(result.unwrap()) };
  }

  @Patch(':uuid')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
  async update(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(UpdateCourseCycleSchema)) body: UpdateCourseCycleDto,
  ) {
    const result = await this.updateUC.execute(uuid, {
      courseName: body.courseName,
      passingGrade: body.passingGrade,
      promotionText: body.promotionText,
      firstBimonthStart: body.firstBimonthStart,
      firstBimonthEnd: body.firstBimonthEnd,
      secondBimonthStart: body.secondBimonthStart,
      secondBimonthEnd: body.secondBimonthEnd,
      thirdBimonthStart: body.thirdBimonthStart,
      thirdBimonthEnd: body.thirdBimonthEnd,
      fourthBimonthStart: body.fourthBimonthStart,
      fourthBimonthEnd: body.fourthBimonthEnd,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.toResponse(result.unwrap()) };
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'DELETE' })
  async delete(@Param('uuid') uuid: string) {
    await this.deleteUC.execute(uuid);
  }

  @Patch(':uuid/deactivate')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
  async deactivate(@Param('uuid') uuid: string) {
    const result = await this.toggleUC.execute(uuid, false);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.toResponse(result.unwrap()) };
  }

  @Patch(':uuid/activate')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
  async activate(@Param('uuid') uuid: string) {
    const result = await this.toggleUC.execute(uuid, true);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.toResponse(result.unwrap()) };
  }

  @Post('generate')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'CREATE' })
  async generate(@Body(new ZodValidationPipe(GenerateCourseCyclesSchema)) body: GenerateCourseCyclesDto) {
    const result = await this.generateUC.execute({
      studyPlanId: body.studyPlanId,
      cycleId: body.cycleId,
    });
    return { data: result };
  }

  private toResponse(cc: {
    uuid: string;
    courseId: string;
    studyPlanId: string;
    cycleId: string;
    courseName: { get(): string };
    level: { get(): number };
    active: boolean;
    passingGrade: { get(): number };
    promotionText: string | null;
    firstBimonth: { start: Date; end: Date };
    secondBimonth: { start: Date; end: Date };
    thirdBimonth: { start: Date; end: Date };
    fourthBimonth: { start: Date; end: Date };
    lastModifiedAt: Date;
    deletedAt?: Date | null;
  }) {
    return {
      uuid: cc.uuid,
      courseId: cc.courseId,
      studyPlanId: cc.studyPlanId,
      cycleId: cc.cycleId,
      courseName: cc.courseName.get(),
      level: cc.level.get(),
      active: cc.active,
      passingGrade: cc.passingGrade.get(),
      promotionText: cc.promotionText,
      firstBimonthStart: cc.firstBimonth.start.toISOString(),
      firstBimonthEnd: cc.firstBimonth.end.toISOString(),
      secondBimonthStart: cc.secondBimonth.start.toISOString(),
      secondBimonthEnd: cc.secondBimonth.end.toISOString(),
      thirdBimonthStart: cc.thirdBimonth.start.toISOString(),
      thirdBimonthEnd: cc.thirdBimonth.end.toISOString(),
      fourthBimonthStart: cc.fourthBimonth.start.toISOString(),
      fourthBimonthEnd: cc.fourthBimonth.end.toISOString(),
      lastModifiedAt: cc.lastModifiedAt.toISOString(),
    };
  }
}
