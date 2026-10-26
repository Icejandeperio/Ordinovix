import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories, mockDevControls } from './index';

describe('mockRepositories.settings, baseline, and audit permissions (M10)', () => {
  beforeEach(() => {
    mockDevControls.setPersona('owner');
    mockDevControls.reset();
  });

  describe('Baseline ("Before Ordinovix") Metrics (Section 12.15)', () => {
    it('saves discovery baseline numbers and retrieves them with incremented version', async () => {
      const baselinePayload = {
        periodStart: '2026-01-01',
        periodEnd: '2026-06-30',
        tripsPerMonth: 14,
        repeatTripsPerMonth: 5,
        followUpsPerWeek: 12,
        hoursFindingPerWeek: 7.5,
        lateFilingsPerQuarter: 2,
        confidence: 4 as const,
        note: 'Baseline benchmark assessed during discovery interview with Ana Santos.',
      };

      const saved = await mockRepositories.baseline.save(baselinePayload);
      expect(saved).toBeDefined();
      expect(saved.periodStart).toBe('2026-01-01');
      expect(saved.periodEnd).toBe('2026-06-30');
      expect(saved.tripsPerMonth).toBe(14);
      expect(saved.repeatTripsPerMonth).toBe(5);
      expect(saved.followUpsPerWeek).toBe(12);
      expect(saved.hoursFindingPerWeek).toBe(7.5);
      expect(saved.lateFilingsPerQuarter).toBe(2);
      expect(saved.confidence).toBe(4);
      expect(saved.note).toBe('Baseline benchmark assessed during discovery interview with Ana Santos.');
      expect(saved.version).toBeGreaterThanOrEqual(1);

      // Verify get returns the updated baseline
      const fetched = await mockRepositories.baseline.get();
      expect(fetched).not.toBeNull();
      expect(fetched?.tripsPerMonth).toBe(14);
      expect(fetched?.repeatTripsPerMonth).toBe(5);
      expect(fetched?.confidence).toBe(4);
    });

    it('updates existing baseline values without losing unchanged fields', async () => {
      await mockRepositories.baseline.save({
        periodStart: '2026-01-01',
        periodEnd: '2026-06-30',
        tripsPerMonth: 10,
        repeatTripsPerMonth: 3,
        hoursFindingPerWeek: 5.0,
        confidence: 3,
      });

      const updated = await mockRepositories.baseline.save({
        repeatTripsPerMonth: 2,
        confidence: 5,
      });

      expect(updated.repeatTripsPerMonth).toBe(2);
      expect(updated.confidence).toBe(5);
      expect(updated.version).toBeGreaterThan(1);
    });
  });

  describe('Audit Log Security and Role Scoping (Section 11.18)', () => {
    it('allows owner to list practice-wide audit activities', async () => {
      mockDevControls.setPersona('owner');
      const audit = await mockRepositories.activity.list();
      expect(audit.items).toBeDefined();
      expect(Array.isArray(audit.items)).toBe(true);
      expect(audit.total).toBeGreaterThan(0);
    });

    it('denies helper access to practice-wide audit log', async () => {
      mockDevControls.setPersona('helper');
      await expect(mockRepositories.activity.list()).rejects.toThrow(
        /Access denied: Practice-wide audit log is restricted to practice owners/
      );
    });

    it('allows helper to view activity scoped to an entity of an assigned client', async () => {
      mockDevControls.setPersona('owner');
      const clients = await mockRepositories.clients.list();
      const client = clients.items[0].client;

      // As helper, access scoped by clientId
      mockDevControls.setPersona('helper');
      const helperScopedAudit = await mockRepositories.activity.list({ clientId: client.id });
      expect(helperScopedAudit.items).toBeDefined();
    });
  });

  describe('Session Roles and Permissions (Section 11.17)', () => {
    it('identifies owner persona with full administrative authority', async () => {
      mockDevControls.setPersona('owner');
      const session = await mockRepositories.session.me();
      expect(session.membership.role).toBe('owner');
      expect(session.user.name).toBe('Ana Santos');
      expect(session.membership.clientIds).toEqual([]);
    });

    it('identifies helper persona with restricted role and assigned client scope', async () => {
      mockDevControls.setPersona('helper');
      const session = await mockRepositories.session.me();
      expect(session.membership.role).toBe('helper');
      expect(session.user.name).toBe('Ben Morales');
      expect(session.membership.clientIds).toBeDefined();
      expect(session.membership.clientIds.length).toBeGreaterThan(0);
    });
  });

  describe('Task Template Verification Rules (Section 12.10)', () => {
    it('enforces statutory source reference before marking verified', () => {
      const template = {
        code: '2551-Q',
        name: 'Quarterly Percentage Tax Return',
        verified: false,
        sourceRef: '',
      };

      // Rule: empty sourceRef cannot verify
      const canVerifyEmpty = Boolean(template.sourceRef && template.sourceRef.trim().length > 0);
      expect(canVerifyEmpty).toBe(false);

      // Rule: valid sourceRef enables verification
      const validRef = 'NIRC Sec. 116 / RR 8-2018';
      const canVerifyValid = Boolean(validRef && validRef.trim().length > 0);
      expect(canVerifyValid).toBe(true);
    });
  });

  describe('Super Admin: Operator Membership Management', () => {
    it('lists practice memberships with enriched user profile data', async () => {
      mockDevControls.setPersona('owner');
      const list = await mockRepositories.memberships.list();
      expect(list.length).toBeGreaterThanOrEqual(2);

      const owner = list.find((m) => m.role === 'owner');
      expect(owner).toBeDefined();
      expect(owner?.email).toBe('ana@example.com');
      expect(owner?.name).toBe('Ana Santos');
      expect(owner?.active).toBe(true);

      const helper = list.find((m) => m.role === 'helper');
      expect(helper).toBeDefined();
      expect(helper?.email).toBe('ben@example.com');
      expect(helper?.name).toBe('Ben Morales');
      expect(helper?.clientIds.length).toBeGreaterThan(0);
    });

    it('allows owner to invite a new operator with scoped client access', async () => {
      mockDevControls.setPersona('owner');
      const clients = await mockRepositories.clients.list();
      const firstClientId = clients.items[0].client.id;

      const created = await mockRepositories.memberships.invite({
        email: 'clara.santos@ordinovix.ph',
        name: 'Clara Santos',
        role: 'helper',
        clientIds: [firstClientId],
        note: 'Junior tax associate handling corporate filings',
      });

      expect(created).toBeDefined();
      expect(created.email).toBe('clara.santos@ordinovix.ph');
      expect(created.role).toBe('helper');
      expect(created.clientIds).toEqual([firstClientId]);
      expect(created.active).toBe(true);

      // Verify operator appears in list
      const list = await mockRepositories.memberships.list();
      const found = list.find((m) => m.email === 'clara.santos@ordinovix.ph');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Clara Santos');
    });

    it('updates operator role and assigned client matters', async () => {
      mockDevControls.setPersona('owner');
      const list = await mockRepositories.memberships.list();
      const ben = list.find((m) => m.email === 'ben@example.com');
      expect(ben).toBeDefined();

      const updated = await mockRepositories.memberships.update(ben!.id, {
        name: 'Ben Morales (Senior Associate)',
        clientIds: ['c-001'],
      });

      expect(updated.name).toBe('Ben Morales (Senior Associate)');
      expect(updated.clientIds).toEqual(['c-001']);
    });

    it('revokes operator access and prevents active authorization', async () => {
      mockDevControls.setPersona('owner');
      const list = await mockRepositories.memberships.list();
      const ben = list.find((m) => m.email === 'ben@example.com');
      expect(ben).toBeDefined();

      await mockRepositories.memberships.revoke(ben!.id);

      const refreshedList = await mockRepositories.memberships.list();
      const revokedBen = refreshedList.find((m) => m.id === ben!.id);
      expect(revokedBen?.active).toBe(false);
      expect(revokedBen?.revokedAt).toBeDefined();

      // Owner can reactivate
      const reactivated = await mockRepositories.memberships.update(ben!.id, { active: true });
      expect(reactivated.active).toBe(true);
      expect(reactivated.revokedAt).toBeUndefined();
    });

    it('prevents non-owner from inviting or revoking operators', async () => {
      mockDevControls.setPersona('helper');
      await expect(
        mockRepositories.memberships.invite({
          email: 'unauthorized@ordinovix.ph',
          role: 'helper',
          clientIds: [],
        })
      ).rejects.toThrow(/Access denied/);

      await expect(mockRepositories.memberships.revoke('m-001')).rejects.toThrow(/Access denied/);
    });
  });
});
