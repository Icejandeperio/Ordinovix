import type { ID, Membership, OrgSettings } from './types';
import { ForbiddenError } from './errors';

/**
 * Who is asking. Permission checks are pure functions of the actor, so the mock and the future API
 * enforce exactly the same rules (spec section 5; audit B11).
 */
export type PolicyActor = Pick<Membership, 'role' | 'clientIds' | 'active'>;

/** The owner reaches every client; a helper reaches assigned clients only; a revoked membership reaches nothing. */
export function canAccessClient(actor: PolicyActor, clientId: ID): boolean {
  if (!actor.active) return false;
  if (actor.role === 'owner') return true;
  return actor.clientIds.includes(clientId);
}

export function requireClientAccess(actor: PolicyActor, clientId: ID): void {
  if (!canAccessClient(actor, clientId)) {
    throw new ForbiddenError("You don't have access to this client");
  }
}

/** Owner-only actions: memberships, templates, deadline moves, holidays, settings, overrides, backups. */
export function requireOwner(actor: PolicyActor): void {
  if (!actor.active || actor.role !== 'owner') {
    throw new ForbiddenError('Only the practice owner can do this');
  }
}

/** Reviewing lines (accept, flag, send back): the owner always; a helper only while the practice allows it. */
export function canReviewLines(actor: PolicyActor, settings: Pick<OrgSettings, 'helpersCanAccept'>): boolean {
  if (!actor.active) return false;
  if (actor.role === 'owner') return true;
  return settings.helpersCanAccept;
}

/** Cancelling a visit: the owner always; a helper only when every item on it belongs to a client they are assigned to. */
export function canCancelVisit(actor: PolicyActor, itemClientIds: ID[]): boolean {
  if (!actor.active) return false;
  if (actor.role === 'owner') return true;
  return itemClientIds.every((clientId) => actor.clientIds.includes(clientId));
}

export type InsightsScope = { kind: 'all' } | { kind: 'clients'; clientIds: ID[] };

/** Insights are practice-wide for the owner and limited to assigned clients for a helper. */
export function insightsScope(actor: PolicyActor): InsightsScope {
  if (actor.active && actor.role === 'owner') return { kind: 'all' };
  return { kind: 'clients', clientIds: actor.active ? actor.clientIds : [] };
}
