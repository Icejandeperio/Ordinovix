import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationError } from '@/domain/errors';
import { mockRepositories, mockDevControls } from './index';

/** U30: one person per address. The API's unique index made a second invite an unhandled error; the shared command now refuses it. */
describe('memberships.invite with an address that is already a member', () => {
  beforeEach(() => {
    mockDevControls.setPersona('owner');
    mockDevControls.reset();
  });

  it('refuses it as a validation error on the email field, whatever the letter case', async () => {
    await mockRepositories.memberships.invite({ email: 'twice@example.com', role: 'helper', clientIds: [] });
    for (const email of ['twice@example.com', 'Twice@Example.com']) {
      const error = await mockRepositories.memberships.invite({ email, role: 'helper', clientIds: [] }).then(() => undefined, (e) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fieldErrors.email?.[0]).toMatch(/already/i);
    }
    const members = await mockRepositories.memberships.list();
    expect(members.filter((m) => m.email.toLowerCase() === 'twice@example.com')).toHaveLength(1);
  });

  it('also refuses an address that belongs to a seeded person', async () => {
    const error = await mockRepositories.memberships.invite({ email: 'ben@example.com', role: 'helper', clientIds: [] }).then(() => undefined, (e) => e);
    expect(error).toBeInstanceOf(ValidationError);
  });
});
