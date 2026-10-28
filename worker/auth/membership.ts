import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { PolicyActor } from '@/domain/policy';
import * as schema from '../db/schema';
import type { AppBindings } from '../env';

/** A person with an allowlisted membership: what every /api/v1 request is decided on. */
export interface Actor extends PolicyActor {
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
 * A membership is the owner's allowlist entry: an email address. The first time that Google account signs in, the entry is
 * linked to the person (user_id, accepted_at) and their app profile row is created. Linking by email needs a verified
 * address (Google verifies it), and an entry already linked to somebody else is never taken over. A revoked membership is
 * still returned, with active=false, so the app can say so; it reaches no client data (src/domain/policy.ts).
 */
export async function resolveActor(env: AppBindings, user: AuthUser): Promise<Actor | null> {
  const db = drizzle(env.DB, { schema });
  const email = user.email.trim().toLowerCase();
  const m = schema.memberships;

  const rows = await db
    .select()
    .from(m)
    .where(and(isNull(m.deletedAt), or(eq(m.userId, user.id), user.emailVerified ? sql`lower(${m.email}) = ${email}` : sql`0`)))
    .orderBy(asc(m.createdAt));

  const own = rows.find((r) => r.userId === user.id);
  const claim = own ? undefined : rows.find((r) => r.userId === null);
  const row = own ?? claim;
  if (!row) return null;

  if (claim) {
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB
        .prepare(
          'INSERT INTO users (id, name, email, initials, last_sign_in_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_sign_in_at = excluded.last_sign_in_at',
        )
        .bind(user.id, user.name, email, initialsOf(user.name), now),
      env.DB
        .prepare('UPDATE memberships SET user_id = ?, accepted_at = COALESCE(accepted_at, ?), updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ? AND user_id IS NULL')
        .bind(user.id, now, now, user.id, claim.id),
    ]);
  }

  const assigned =
    row.role === 'helper'
      ? (await db.select({ clientId: schema.membershipClients.clientId }).from(schema.membershipClients).where(eq(schema.membershipClients.membershipId, row.id))).map((r) => r.clientId)
      : [];

  return {
    userId: user.id,
    membershipId: row.id,
    orgId: row.orgId,
    email: row.email,
    role: row.role as Actor['role'],
    clientIds: assigned,
    active: row.active && !row.revokedAt,
  };
}
