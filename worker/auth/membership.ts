import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { PolicyActor } from '@/domain/policy';
import * as schema from '../db/schema';
import type { AppBindings } from '../env';

/** A person with an allowlisted membership: what every /api/v1 request is decided on. */
export interface Actor extends PolicyActor {
  /** The app profile id (users.id) that records point at: not necessarily the Better Auth user id. */
  userId: string;
  membershipId: string;
  orgId: string;
  email: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'OP';

/**
 * The membership for a signed-in person, or null when none is allowlisted for them.
 *
 * A membership is the owner's allowlist entry: an email address. The person it belongs to is found, in this order:
 *  1. their app profile (users.auth_user_id = their Better Auth id, or, for the seed personas, the same id) and the
 *     membership that points at it;
 *  2. otherwise, with a verified email, an entry for that address that nobody has claimed yet:
 *     a. no profile yet (the first owner's entry): a profile is created with their Better Auth id and linked;
 *     b. an invitation: the owner's invite created the profile (its id is what tasks and assignments already point at); it is
 *        claimed now by setting auth_user_id, provided no one has signed into it before.
 * An entry that was claimed is never taken over by another account. A revoked membership is still returned (active=false) so
 * the app can say so; it reaches no client data (src/domain/policy.ts).
 */
export async function resolveActor(env: AppBindings, user: AuthUser): Promise<Actor | null> {
  const db = drizzle(env.DB, { schema });
  const email = user.email.trim().toLowerCase();
  const m = schema.memberships;
  const now = new Date().toISOString();

  const [profile] = await db
    .select()
    .from(schema.users)
    .where(or(eq(schema.users.authUserId, user.id), eq(schema.users.id, user.id)));

  let profileId = profile?.id;
  let row = profileId
    ? (await db.select().from(m).where(and(isNull(m.deletedAt), eq(m.userId, profileId))).orderBy(asc(m.createdAt)))[0]
    : undefined;

  if (!row && user.emailVerified) {
    const candidates = await db.select().from(m).where(and(isNull(m.deletedAt), sql`lower(${m.email}) = ${email}`)).orderBy(asc(m.createdAt));
    const open = candidates.find((c) => c.userId === null);
    if (open) {
      // the first owner: create their profile and link the entry
      await env.DB.batch([
        env.DB
          .prepare('INSERT INTO users (id, name, email, initials, last_sign_in_at, auth_user_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_sign_in_at = excluded.last_sign_in_at, auth_user_id = excluded.auth_user_id')
          .bind(user.id, user.name, email, initialsOf(user.name), now, user.id),
        env.DB
          .prepare('UPDATE memberships SET user_id = ?, accepted_at = COALESCE(accepted_at, ?), updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ? AND user_id IS NULL')
          .bind(user.id, now, now, user.id, open.id),
      ]);
      row = open;
      profileId = user.id;
    } else {
      for (const candidate of candidates) {
        if (!candidate.userId) continue;
        const [invited] = await db.select().from(schema.users).where(eq(schema.users.id, candidate.userId));
        if (!invited || invited.authUserId !== null || invited.email.toLowerCase() !== email) continue;
        // an invitation nobody has signed into: no Better Auth user may already carry this profile's id
        const taken = await env.DB.prepare('SELECT 1 AS one FROM user WHERE id = ?').bind(invited.id).first();
        if (taken) continue;
        const [claimed] = await env.DB.batch([
          env.DB.prepare('UPDATE users SET auth_user_id = ?, last_sign_in_at = ? WHERE id = ? AND auth_user_id IS NULL').bind(user.id, now, invited.id),
          env.DB
            .prepare('UPDATE memberships SET accepted_at = COALESCE(accepted_at, ?), updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ? AND accepted_at IS NULL')
            .bind(now, now, invited.id, candidate.id),
        ]);
        if ((claimed.meta?.changes ?? 0) === 0) continue; // somebody else claimed it a moment ago
        row = candidate;
        profileId = invited.id;
        break;
      }
    }
  }
  if (!row || !profileId) return null;

  const assigned =
    row.role === 'helper'
      ? (await db.select({ clientId: schema.membershipClients.clientId }).from(schema.membershipClients).where(eq(schema.membershipClients.membershipId, row.id))).map((r) => r.clientId)
      : [];

  return {
    userId: profileId,
    membershipId: row.id,
    orgId: row.orgId,
    email: row.email,
    role: row.role as Actor['role'],
    clientIds: assigned,
    active: row.active && !row.revokedAt,
  };
}
