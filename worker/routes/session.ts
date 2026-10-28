import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { NotFoundError } from '@/domain/errors';
import * as schema from '../db/schema';
import { defaultPrefs, rowToMembership, rowToOrg, rowToPrefs, rowToSettings, rowToUser } from '../db/mappers';
import type { AppEnv } from '../env';

/** Session routes. Mounted behind requireSession, requireMembership and requireActive. */
export const sessionRoutes = new Hono<AppEnv>();

/**
 * GET /api/v1/session/me: the user, membership, organization, settings and preferences the app's session hook needs,
 * in the shapes the mock returns (Repositories.session.me).
 */
sessionRoutes.get('/me', async (c) => {
  const actor = c.get('actor');
  const authUser = c.get('authUser');
  const db = drizzle(c.env.DB, { schema });

  const [membership] = await db.select().from(schema.memberships).where(eq(schema.memberships.id, actor.membershipId));
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, actor.orgId));
  const [settings] = await db.select().from(schema.orgSettings).where(eq(schema.orgSettings.orgId, actor.orgId));
  if (!membership || !org || !settings) throw new NotFoundError('Your practice is not set up yet');
  const [profile] = await db.select().from(schema.users).where(eq(schema.users.id, actor.userId));
  const [prefs] = await db.select().from(schema.userPrefs).where(eq(schema.userPrefs.userId, actor.userId));

  return c.json({
    user: profile
      ? rowToUser(profile)
      : { id: actor.userId, name: authUser.name, email: authUser.email, initials: authUser.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() },
    membership: rowToMembership(membership, actor.clientIds),
    org: rowToOrg(org),
    settings: rowToSettings(settings),
    prefs: prefs ? rowToPrefs(prefs) : defaultPrefs(actor.userId),
  });
});
