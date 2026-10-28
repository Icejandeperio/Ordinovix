import { Hono } from 'hono';
import { ValidationError } from '@/domain/errors';
import { setDevToday, todayInManila } from '@/lib/dates';
import { createAuth, originOf } from '../auth/auth';
import { setSessionCookieHeader } from '../auth/session-cookie';
import { errorResponse } from '../errors';
import type { AppEnv } from '../env';

/**
 * Dev sign-in: signs in as a seed persona so the app and the acceptance tests can run against the Worker without Google.
 * It exists only when APP_ENV is "local" AND DEV_AUTH is "1" (the latter is set in .dev.vars by `npm run dev:vars`). In
 * preview and production it answers 404 exactly like any unknown path, whatever else is configured.
 */
export const devRoutes = new Hono<AppEnv>();

const PERSONAS = {
  owner: { membershipId: 'mem-ana' },
  helper: { membershipId: 'mem-ben' },
} as const;

export const devAuthEnabled = (env: { APP_ENV: string; DEV_AUTH?: string }) => env.APP_ENV === 'local' && env.DEV_AUTH === '1';

devRoutes.use('*', async (c, next) => {
  if (!devAuthEnabled(c.env)) return errorResponse(c, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  await next();
});

devRoutes.post('/sign-in', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { persona?: string };
  if (body.persona !== 'owner' && body.persona !== 'helper') throw new ValidationError({ persona: ['Persona must be "owner" or "helper"'] });

  const row = await c.env.DB
    .prepare('SELECT u.id, u.name, u.email FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.id = ?')
    .bind(PERSONAS[body.persona].membershipId)
    .first<{ id: string; name: string; email: string }>();
  if (!row) throw new ValidationError({ persona: ['The Demo organization is not seeded in this database (npm run db:seed-sql)'] });

  // The Better Auth user shares its id with the app profile row, so one id names the person everywhere
  const now = Date.now();
  const auth = createAuth(c.env, originOf(c.req.raw));
  const ctx = await auth.$context;
  await c.env.DB
    .prepare('INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING')
    .bind(row.id, row.name, row.email, now, now)
    .run();
  const session = await ctx.internalAdapter.createSession(row.id);

  c.header('Set-Cookie', await setSessionCookieHeader(c.env.BETTER_AUTH_SECRET, session.token));
  return c.json({ ok: true, persona: body.persona, userId: row.id });
});

/**
 * Dev reset: replaces the Demo organization with fresh sample data dated from today (or the X-Dev-Today day), so each new browser
 * session of the acceptance suite starts from the seed, as it does in mock mode. It is compiled only into development builds
 * (`import.meta.env.DEV`): a production or preview build has no code for it at all, besides being 404 outside APP_ENV=local.
 */
devRoutes.post('/reset', async (c) => {
  if (!import.meta.env.DEV) return errorResponse(c, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  const { resetDemoData } = await import('./reset');
  await resetDemoData(c.env.DB, todayInManila(), c.env.TIN_ENCRYPTION_KEY);
  return c.json({ ok: true });
});

/** With the dev gate open, a request may carry X-Dev-Today (the dev menu's "set today"); every other request has the real day. */
export const devToday: import('hono').MiddlewareHandler<AppEnv> = async (c, next) => {
  if (devAuthEnabled(c.env)) {
    const day = c.req.header('x-dev-today');
    setDevToday(day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null);
  }
  await next();
};
