import { describe, it, expect } from 'vitest';
import {
  canAccessClient,
  requireClientAccess,
  requireOwner,
  canReviewLines,
  insightsScope,
  type PolicyActor,
} from './policy';

const owner: PolicyActor = { role: 'owner', clientIds: [], active: true };
const ben: PolicyActor = { role: 'helper', clientIds: ['client-rsp', 'client-cruz'], active: true };
const revoked: PolicyActor = { role: 'helper', clientIds: ['client-rsp'], active: false };

describe('domain/policy', () => {
  describe('canAccessClient', () => {
    it('lets the owner reach every client', () => {
      expect(canAccessClient(owner, 'client-maria')).toBe(true);
      expect(canAccessClient(owner, 'anything')).toBe(true);
    });

    it('lets a helper reach assigned clients only', () => {
      expect(canAccessClient(ben, 'client-rsp')).toBe(true);
      expect(canAccessClient(ben, 'client-cruz')).toBe(true);
      expect(canAccessClient(ben, 'client-maria')).toBe(false);
    });

    it('refuses everything once access is revoked', () => {
      expect(canAccessClient(revoked, 'client-rsp')).toBe(false);
      expect(canAccessClient({ ...owner, active: false }, 'client-rsp')).toBe(false);
    });
  });

  describe('requireClientAccess', () => {
    it('does nothing when access is allowed', () => {
      expect(() => requireClientAccess(ben, 'client-rsp')).not.toThrow();
    });

    it('throws a FORBIDDEN error for an unassigned client', () => {
      expect(() => requireClientAccess(ben, 'client-maria')).toThrow();
      try {
        requireClientAccess(ben, 'client-maria');
      } catch (e) {
        expect((e as { code?: string }).code).toBe('FORBIDDEN');
      }
    });
  });

  describe('requireOwner', () => {
    it('passes for an active owner', () => {
      expect(() => requireOwner(owner)).not.toThrow();
    });

    it('throws FORBIDDEN for a helper and for a revoked owner', () => {
      for (const actor of [ben, { ...owner, active: false }]) {
        try {
          requireOwner(actor);
          throw new Error('should have thrown');
        } catch (e) {
          expect((e as { code?: string }).code).toBe('FORBIDDEN');
        }
      }
    });
  });

  describe('canReviewLines', () => {
    it('always lets the owner review', () => {
      expect(canReviewLines(owner, { helpersCanAccept: false })).toBe(true);
    });

    it('lets a helper review only while the practice allows it', () => {
      expect(canReviewLines(ben, { helpersCanAccept: true })).toBe(true);
      expect(canReviewLines(ben, { helpersCanAccept: false })).toBe(false);
      expect(canReviewLines(revoked, { helpersCanAccept: true })).toBe(false);
    });
  });

  describe('insightsScope', () => {
    it('is practice-wide for the owner', () => {
      expect(insightsScope(owner)).toEqual({ kind: 'all' });
    });

    it('is limited to assigned clients for a helper', () => {
      expect(insightsScope(ben)).toEqual({ kind: 'clients', clientIds: ['client-rsp', 'client-cruz'] });
    });

    it('is empty for a revoked helper', () => {
      expect(insightsScope(revoked)).toEqual({ kind: 'clients', clientIds: [] });
    });
  });
});
