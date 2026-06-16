/**
 * F1-T4 (UP-S3) / F1-T5 (UP-S4) — Teacher → User persona backfill (cross-DB).
 *
 * The migration copies persona fields (firstName/lastName/dni/title/phone) from
 * each tenant's Teacher to the linked master User (Teacher.userId), filling only
 * null User fields.
 *
 * UP-S3: a linked Teacher's persona is copied to a User that had none.
 * UP-S4: a Teacher with userId=null is skipped; the run proceeds without error.
 *
 * Runs the production backfillUserPersonaForTenant() against real master + tenant DBs.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { backfillUserPersonaForTenant } from '../../../scripts/backfill-user-persona';
import { masterClient, tenantI1Client, resetAll, disconnectAll } from '../setup/clients';
import { createUser, createTeacher } from '../setup/factories';

describe('F1 — Teacher → User persona backfill', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it('UP-S3: copies all persona fields from a linked Teacher to a User that had none', async () => {
    const master = masterClient();
    const i1 = tenantI1Client();

    // User u1 with no persona fields.
    const user = await createUser(master, { email: 'u1@test.local', name: 'u1' });
    expect(user.dni).toBeNull();

    // Teacher linked to u1 carrying the persona.
    await createTeacher(i1, {
      userId: user.id,
      firstName: 'Luis',
      lastName: 'Pérez',
      dni: '30000001',
      title: 'Prof.',
      phone: '351-100',
    });

    const counts = await backfillUserPersonaForTenant(master, i1);
    expect(counts.updated).toBe(1);

    const updated = await master.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.firstName).toBe('Luis');
    expect(updated.lastName).toBe('Pérez');
    expect(updated.dni).toBe('30000001');
    expect(updated.title).toBe('Prof.');
    expect(updated.phone).toBe('351-100');
  });

  it('UP-S4: a Teacher with userId=null is skipped and the run does not error', async () => {
    const master = masterClient();
    const i1 = tenantI1Client();

    await createTeacher(i1, { userId: undefined, firstName: 'Sin', lastName: 'Usuario' });

    const counts = await backfillUserPersonaForTenant(master, i1);
    expect(counts.skippedOrphan).toBe(1);
    expect(counts.updated).toBe(0);
  });
});
