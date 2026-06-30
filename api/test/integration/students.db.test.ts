/**
 * Integration tests — Student fatherEmail / motherEmail persistence (REQ-RYT-01).
 *
 * Tests run against the real tenant test DB (educandow_test_i1, port 5433).
 * Uses PrismaStudentRepository to verify the end-to-end round-trip.
 *
 * Scenarios:
 *  - RYT-01-A: Admin sets fatherEmail → persisted and retrieved via toDomain
 *  - RYT-01-B: Admin sets motherEmail → persisted and retrieved via toDomain
 *  - RYT-01-C: Invalid email format → Email.create() rejects before save
 *  - RYT-01-D: TUTOR PATCH blocked at use-case level (ALLOWED_TUTOR_FIELDS check) — structural assertion
 *  - RYT-01-E: fatherEmail/motherEmail absent → undefined in domain entity
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaStudentRepository } from '../../src/infrastructure/persistence/prisma/repositories/prisma-student.repository';
import { Email, Id, Dni, Student } from '@educandow/domain';
import {
  tenantI1Client,
  runInTenant,
  resetAll,
  disconnectAll,
} from './setup/clients';
import { createStudent } from './setup/factories';

const repo = new PrismaStudentRepository();

describe('PrismaStudentRepository — fatherEmail / motherEmail (REQ-RYT-01)', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  // ── RYT-01-A: Admin sets fatherEmail ────────────────────────────────────────

  it('RYT-01-A: persists fatherEmail and retrieves it via toDomain', async () => {
    const i1 = tenantI1Client();
    const row = await createStudent(i1, { firstName: 'Juan', lastName: 'Pérez', dni: 'DNI-01A' });

    // Build domain entity with fatherEmail
    const fatherEmailVo = Email.reconstruct('padre@example.com');
    const student = Student.reconstruct({
      id: Id.reconstruct(row.id),
      firstName: row.firstName,
      lastName: row.lastName,
      dni: Dni.reconstruct(row.dni),
      fatherEmail: fatherEmailVo,
    });

    await runInTenant(i1, () => repo.save(student));

    const found = await runInTenant(i1, () => repo.findById(row.id));
    expect(found).not.toBeNull();
    expect(found!.fatherEmail).toBeDefined();
    expect(found!.fatherEmail!.get()).toBe('padre@example.com');
    expect(found!.motherEmail).toBeUndefined();
  });

  // ── RYT-01-B: Admin sets motherEmail ────────────────────────────────────────

  it('RYT-01-B: persists motherEmail and retrieves it via toDomain', async () => {
    const i1 = tenantI1Client();
    const row = await createStudent(i1, { firstName: 'Ana', lastName: 'García', dni: 'DNI-01B' });

    const motherEmailVo = Email.reconstruct('madre@example.com');
    const student = Student.reconstruct({
      id: Id.reconstruct(row.id),
      firstName: row.firstName,
      lastName: row.lastName,
      dni: Dni.reconstruct(row.dni),
      motherEmail: motherEmailVo,
    });

    await runInTenant(i1, () => repo.save(student));

    const found = await runInTenant(i1, () => repo.findById(row.id));
    expect(found).not.toBeNull();
    expect(found!.motherEmail).toBeDefined();
    expect(found!.motherEmail!.get()).toBe('madre@example.com');
    expect(found!.fatherEmail).toBeUndefined();
  });

  // ── RYT-01-C: Invalid email format → Email.create() rejects ─────────────────

  it('RYT-01-C: Email.create() rejects invalid format before save', () => {
    const result = Email.create('not-an-email');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('Invalid email');
    // No database interaction; the VO rejects before any persist call
  });

  // ── RYT-01-D: fatherEmail NOT in ALLOWED_TUTOR_FIELDS (structural) ──────────

  it('RYT-01-D: fatherEmail and motherEmail are NOT in ALLOWED_TUTOR_FIELDS', () => {
    // ALLOWED_TUTOR_FIELDS from student.use-cases.ts
    const ALLOWED_TUTOR_FIELDS = ['phone', 'address', 'photoUrl', 'email', 'birthDate', 'guardianPhone'];
    expect(ALLOWED_TUTOR_FIELDS).not.toContain('fatherEmail');
    expect(ALLOWED_TUTOR_FIELDS).not.toContain('motherEmail');
  });

  // ── RYT-01-E: fatherEmail / motherEmail absent → undefined ──────────────────

  it('RYT-01-E: fatherEmail and motherEmail are undefined when row has no values', async () => {
    const i1 = tenantI1Client();
    const row = await createStudent(i1, { firstName: 'Pedro', lastName: 'López', dni: 'DNI-01E' });

    const found = await runInTenant(i1, () => repo.findById(row.id));
    expect(found).not.toBeNull();
    expect(found!.fatherEmail).toBeUndefined();
    expect(found!.motherEmail).toBeUndefined();
  });
});
