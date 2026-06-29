import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, StudentRepository, Student, Id, Dni, StudentGuardian, StudentGuardianRepository, NotFoundError, ForbiddenError, Email, Mobile, DomainError } from '@educandow/domain';

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  dni: string;
  email?: string;
  birthDate?: string;
  guardianName?: string;
  guardianPhone?: string;
  motherName?: string;
  fatherDni?: string;
  motherDni?: string;
  institutionId: string;
}

// Fields that TUTOR and STUDENT roles are allowed to edit
const ALLOWED_TUTOR_FIELDS = ['phone', 'address', 'photoUrl', 'email', 'birthDate', 'guardianPhone'];

// Roles that can edit ALL fields (full access, no field-level restriction)
const FULL_ACCESS_ROLES = ['ADMIN', 'DIRECTOR', 'SECRETARIO', 'TEACHER', 'PRECEPTOR'];

const RESTRICTED_ROLES = ['STUDENT', 'TUTOR'];

@Injectable()
export class CreateStudentUseCase {
  constructor(private readonly repo: StudentRepository) {}

  async execute(input: CreateStudentInput): Promise<Result<Student, ValidationError>> {
    const dniResult = Dni.create(input.dni);
    if (dniResult.isErr()) return err(dniResult.unwrapErr());

    const existing = await this.repo.findByDni(input.dni);
    if (existing) return err(new ValidationError('Ya existe un estudiante con ese DNI'));

    const student = Student.create({
      firstName: input.firstName,
      lastName: input.lastName,
      dni: dniResult.unwrap(),
      birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
      guardianName: input.guardianName,
      guardianPhone: input.guardianPhone,
      motherName: input.motherName,
      fatherDni: input.fatherDni,
      motherDni: input.motherDni,
      institutionId: Id.create(input.institutionId),
    });

    await this.repo.save(student);
    return ok(student);
  }
}

@Injectable()
export class ListStudentsUseCase {
  constructor(private readonly repo: StudentRepository) {}

  async execute(institutionId: string, caller: CallerInfo): Promise<Student[]> {
    // STUDENT role: only see themselves
    if (caller.roles.includes('STUDENT')) {
      const student = await this.repo.findByUserId(caller.userId);
      return student ? [student] : [];
    }

    // TUTOR role: only see linked children
    if (caller.roles.includes('TUTOR')) {
      return this.repo.findByGuardianUserId(caller.userId);
    }

    // ADMIN / DIRECTOR / SECRETARIO / TEACHER / PRECEPTOR: see all
    return this.repo.findByInstitution(institutionId);
  }
}

@Injectable()
export class GetStudentUseCase {
  constructor(private readonly repo: StudentRepository) {}

  async execute(id: string): Promise<Student | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class DeleteStudentUseCase {
  constructor(private readonly repo: StudentRepository) {}

  async execute(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}

// ── Caller info passed from the controller ──────────────────

export interface CallerInfo {
  userId: string;
  roles: string[];
}

// ── PatchStudentUseCase (field-level permissions) ───────────

export interface PatchStudentInput {
  firstName?: string;
  lastName?: string;
  dni?: string;
  email?: string;
  birthDate?: string;
  guardianName?: string;
  guardianPhone?: string;
  motherName?: string;
  fatherDni?: string;
  motherDni?: string;
  fatherEmail?: string;
  motherEmail?: string;
  address?: string;
  phone?: string;
  photoUrl?: string;
}

@Injectable()
export class PatchStudentUseCase {
  constructor(
    private readonly studentRepo: StudentRepository,
    private readonly guardianRepo: StudentGuardianRepository,
  ) {}

  async execute(
    studentId: string,
    body: Record<string, unknown>,
    caller: CallerInfo,
  ): Promise<Student> {
    // 1. Validate student exists
    const student = await this.studentRepo.findById(studentId);
    if (!student) throw new NotFoundError('Student', studentId);

    // 2. Determine if caller has restricted roles
    const isRestricted = caller.roles.some((r) => RESTRICTED_ROLES.includes(r));
    const isFullAccess = caller.roles.some((r) => FULL_ACCESS_ROLES.includes(r));

    // 3. Check ownership
    if (isRestricted) {
      await this.checkOwnership(student, caller);
    }

    // 4. Field-level validation for restricted roles
    if (isRestricted && !isFullAccess) {
      this.validateAllowedFields(body, caller.roles);
    }

    // 5. Apply changes and save
    const updated = this.applyChanges(student, body);
    await this.studentRepo.save(updated);
    return updated;
  }

  private async checkOwnership(student: Student, caller: CallerInfo): Promise<void> {
    // STUDENT: must match userId
    if (caller.roles.includes('STUDENT')) {
      if (student.userId !== caller.userId) {
        throw new ForbiddenError('You can only edit your own profile');
      }
      return;
    }

    // TUTOR: must be linked via StudentGuardian
    if (caller.roles.includes('TUTOR')) {
      const guardians = await this.guardianRepo.findByGuardianUserId(caller.userId);
      const isLinked = guardians.some((g) => g.studentId === student.id.get());
      if (!isLinked) {
        throw new ForbiddenError('You can only edit students linked to you as guardian');
      }
    }
  }

  private validateAllowedFields(body: Record<string, unknown>, _roles: string[]): void {
    const fieldKeys = Object.keys(body);
    for (const key of fieldKeys) {
      if (!ALLOWED_TUTOR_FIELDS.includes(key)) {
        throw new ForbiddenError(
          `Field "${key}" is not editable by your role. Allowed fields: ${ALLOWED_TUTOR_FIELDS.join(', ')}`,
        );
      }
    }
  }

  private applyChanges(student: Student, body: Record<string, unknown>): Student {
    const emailVo = body.email !== undefined
      ? (body.email as string ? Email.reconstruct(body.email as string) : undefined)
      : student.email;

    const dniVo = body.dni !== undefined
      ? Dni.reconstruct(body.dni as string)
      : student.dni;

    // fatherEmail / motherEmail — ADMIN-only; NOT in ALLOWED_TUTOR_FIELDS
    let fatherEmailVo = student.fatherEmail;
    if (body.fatherEmail !== undefined) {
      const raw = body.fatherEmail as string;
      if (raw) {
        const result = Email.create(raw);
        if (result.isErr()) throw result.unwrapErr();
        fatherEmailVo = result.unwrap();
      } else {
        fatherEmailVo = undefined;
      }
    }

    let motherEmailVo = student.motherEmail;
    if (body.motherEmail !== undefined) {
      const raw = body.motherEmail as string;
      if (raw) {
        const result = Email.create(raw);
        if (result.isErr()) throw result.unwrapErr();
        motherEmailVo = result.unwrap();
      } else {
        motherEmailVo = undefined;
      }
    }

    return Student.reconstruct({
      id: student.id,
      firstName: body.firstName !== undefined ? (body.firstName as string) : student.firstName,
      lastName: body.lastName !== undefined ? (body.lastName as string) : student.lastName,
      dni: dniVo,
      email: emailVo,
      birthDate: body.birthDate !== undefined ? new Date(body.birthDate as string) : student.birthDate,
      guardianName: body.guardianName !== undefined ? (body.guardianName as string) : student.guardianName,
      guardianPhone: body.guardianPhone !== undefined ? (body.guardianPhone as string) : student.guardianPhone,
      motherName: body.motherName !== undefined ? (body.motherName as string) : student.motherName,
      fatherDni: body.fatherDni !== undefined ? (body.fatherDni as string) : student.fatherDni,
      motherDni: body.motherDni !== undefined ? (body.motherDni as string) : student.motherDni,
      fatherEmail: fatherEmailVo,
      motherEmail: motherEmailVo,
      address: body.address !== undefined ? (body.address as string) : student.address,
      phone: body.phone !== undefined ? (body.phone as string) : student.phone,
      photoUrl: body.photoUrl !== undefined ? (body.photoUrl as string) : student.photoUrl,
      userId: body.userId !== undefined ? (body.userId as string) : student.userId,
      institutionId: student.institutionId,
      active: student.active,
      deletedAt: student.deletedAt,
    });
  }
}

// ── GetMyStudentDataUseCase ─────────────────────────────────

@Injectable()
export class GetMyStudentDataUseCase {
  constructor(private readonly studentRepo: StudentRepository) {}

  async execute(userId: string): Promise<Student> {
    const student = await this.studentRepo.findByUserId(userId);
    if (!student) throw new NotFoundError('Student', userId);
    return student;
  }
}

// ── GetMyChildrenUseCase ────────────────────────────────────

@Injectable()
export class GetMyChildrenUseCase {
  constructor(
    private readonly guardianRepo: StudentGuardianRepository,
    private readonly studentRepo: StudentRepository,
  ) {}

  async execute(userId: string): Promise<Student[]> {
    const guardians = await this.guardianRepo.findByGuardianUserId(userId);
    const students: Student[] = [];

    for (const guardian of guardians) {
      const student = await this.studentRepo.findById(guardian.studentId);
      if (student) students.push(student);
    }

    return students;
  }
}

// ── AssignGuardianUseCase ───────────────────────────────────

export interface AssignGuardianInput {
  userId: string;
  relationship: string;
  isFinancialResponsible?: boolean;
  isAuthorizedToPickUp?: boolean;
}

@Injectable()
export class AssignGuardianUseCase {
  constructor(
    private readonly studentRepo: StudentRepository,
    private readonly guardianRepo: StudentGuardianRepository,
  ) {}

  async execute(studentId: string, input: AssignGuardianInput): Promise<Result<StudentGuardian, DomainError>> {
    // Guard: userId required for portal-link path (REQ-RYT-07-B)
    if (!input.userId) {
      return err(new ValidationError('USER_ID_REQUIRED'));
    }

    // Validate student exists
    const student = await this.studentRepo.findById(studentId);
    if (!student) return err(new NotFoundError('Student', studentId));

    // Check for duplicate
    const existing = await this.guardianRepo.findByComposite(studentId, input.userId);
    if (existing) {
      return err(new ValidationError('GUARDIAN_ALREADY_ASSIGNED'));
    }

    // Create and save — propagate entity validation errors
    const createResult = StudentGuardian.create({
      studentId,
      userId: input.userId,
      relationship: input.relationship,
      isFinancialResponsible: input.isFinancialResponsible ?? false,
      isAuthorizedToPickUp: input.isAuthorizedToPickUp ?? false,
    });
    if (createResult.isErr()) return err(createResult.unwrapErr());
    const guardian = createResult.unwrap();

    await this.guardianRepo.save(guardian);
    return ok(guardian);
  }
}

// ── CreateStudyTutorUseCase ─────────────────────────────────

export interface CreateStudyTutorInput {
  studentId: string;
  fullName: string;
  mobile: string;
  relationship?: string;
  email?: string;
  isFinancialResponsible?: boolean;
  isAuthorizedToPickUp?: boolean;
  allowDuplicate?: boolean;
}

@Injectable()
export class CreateStudyTutorUseCase {
  constructor(
    private readonly studentRepo: StudentRepository,
    private readonly guardianRepo: StudentGuardianRepository,
  ) {}

  async execute(input: CreateStudyTutorInput): Promise<Result<StudentGuardian, DomainError>> {
    // 1. Student must exist
    const student = await this.studentRepo.findById(input.studentId);
    if (!student) return err(new NotFoundError('Student', input.studentId));

    // 2. fullName required at application layer (REQ-RYT-05-B)
    if (!input.fullName?.trim()) {
      return err(new ValidationError('FULL_NAME_REQUIRED'));
    }

    // 3. mobile required at application layer (REQ-RYT-05-C)
    if (!input.mobile?.trim()) {
      return err(new ValidationError('MOBILE_REQUIRED'));
    }

    // 3b. relationship required at application layer (user decision: no default)
    if (!input.relationship?.trim()) {
      return err(new ValidationError('RELATIONSHIP_REQUIRED'));
    }

    // 4. Validate mobile VO (REQ-RYT-05-D)
    const mobileResult = Mobile.create(input.mobile);
    if (mobileResult.isErr()) return err(mobileResult.unwrapErr());
    const mobileVO = mobileResult.unwrap();

    // 5. Validate email VO if provided (REQ-RYT-05-F)
    let emailVO: Email | undefined;
    if (input.email) {
      const emailResult = Email.create(input.email);
      if (emailResult.isErr()) return err(emailResult.unwrapErr());
      emailVO = emailResult.unwrap();
    }

    // 6. Uniqueness check on (studentId, fullName) unless allowDuplicate (REQ-RYT-08-B/C)
    if (!input.allowDuplicate) {
      const dup = await this.guardianRepo.findStudyTutor(input.studentId, input.fullName);
      if (dup) return err(new ValidationError('TUTOR_DUPLICATE_NAME'));
    }

    // 7. Create entity (no userId — study-tutor path)
    // relationship is guaranteed non-empty by step 3b above
    const createResult = StudentGuardian.create({
      studentId: input.studentId,
      relationship: input.relationship,
      fullName: input.fullName,
      mobile: mobileVO,
      email: emailVO,
      isFinancialResponsible: input.isFinancialResponsible ?? false,
      isAuthorizedToPickUp: input.isAuthorizedToPickUp ?? false,
    });
    if (createResult.isErr()) return err(createResult.unwrapErr());
    const guardian = createResult.unwrap();

    await this.guardianRepo.save(guardian);
    return ok(guardian);
  }
}

// ── UpdateStudyTutorUseCase ─────────────────────────────────

export interface UpdateStudyTutorInput {
  guardianId: string;
  fullName?: string;
  mobile?: string;
  email?: string | null;
  relationship?: string;
  active?: boolean;
}

@Injectable()
export class UpdateStudyTutorUseCase {
  constructor(private readonly guardianRepo: StudentGuardianRepository) {}

  async execute(input: UpdateStudyTutorInput): Promise<Result<StudentGuardian, DomainError>> {
    // 1. Load guardian (REQ-RYT-06-C)
    const guardian = await this.guardianRepo.findById(input.guardianId);
    if (!guardian) return err(new NotFoundError('GUARDIAN_NOT_FOUND', input.guardianId));

    // 2. Validate mobile if provided
    let mobileVO: Mobile | undefined;
    if (input.mobile !== undefined) {
      const mobileResult = Mobile.create(input.mobile);
      if (mobileResult.isErr()) return err(mobileResult.unwrapErr());
      mobileVO = mobileResult.unwrap();
    }

    // 3. Validate email if provided as non-null string (REQ-RYT-06-D)
    let emailVO: Email | null | undefined;
    if (input.email === null) {
      emailVO = null; // explicit clear
    } else if (input.email !== undefined) {
      const emailResult = Email.create(input.email);
      if (emailResult.isErr()) return err(emailResult.unwrapErr());
      emailVO = emailResult.unwrap();
    }

    // 4. Re-check uniqueness if fullName changes
    if (input.fullName !== undefined && input.fullName !== guardian.fullName) {
      const dup = await this.guardianRepo.findStudyTutor(guardian.studentId, input.fullName);
      if (dup) return err(new ValidationError('TUTOR_DUPLICATE_NAME'));
    }

    // 5. Apply mutation via entity method (bumps updatedAt)
    guardian.update({
      fullName: input.fullName,
      mobile: mobileVO,
      email: emailVO,
      relationship: input.relationship,
      active: input.active,
    });

    await this.guardianRepo.save(guardian);
    return ok(guardian);
  }
}

// ── RemoveGuardianUseCase ───────────────────────────────────

@Injectable()
export class RemoveGuardianUseCase {
  constructor(private readonly guardianRepo: StudentGuardianRepository) {}

  async execute(guardianId: string): Promise<void> {
    const guardian = await this.guardianRepo.findById(guardianId);
    if (!guardian) throw new NotFoundError('StudentGuardian', guardianId);

    await this.guardianRepo.delete(guardianId);
  }
}

// ── ListGuardiansUseCase ─────────────────────────────────────

export interface GuardianOutput {
  id: string;
  userId?: string;
  fullName?: string;
  mobile?: string;
  email?: string;
  relationship: string;
  isFinancialResponsible: boolean;
  isAuthorizedToPickUp: boolean;
  active: boolean;
  updatedAt: Date;
}

@Injectable()
export class ListGuardiansUseCase {
  constructor(
    private readonly studentRepo: StudentRepository,
    private readonly guardianRepo: StudentGuardianRepository,
  ) {}

  async execute(studentId: string): Promise<GuardianOutput[]> {
    const student = await this.studentRepo.findById(studentId);
    if (!student) throw new NotFoundError('Student', studentId);

    const guardians = await this.guardianRepo.findByStudentId(studentId);
    return guardians.map((g) => ({
      id: g.id.get(),
      userId: g.userId,
      fullName: g.fullName,
      mobile: g.mobile?.get(),
      email: g.email?.get(),
      relationship: g.relationship,
      isFinancialResponsible: g.isFinancialResponsible,
      isAuthorizedToPickUp: g.isAuthorizedToPickUp,
      active: g.active,
      updatedAt: g.updatedAt,
    }));
  }
}
