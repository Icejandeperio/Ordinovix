import { Hono } from 'hono';
import { createAuth, originOf } from './auth/auth';
import { devRoutes } from './dev/sign-in';
import type { AppEnv } from './env';
import { handleError, handleNotFound } from './errors';
import { requireActive, requireMembership, requireSession } from './middleware/auth';
import { readRoutes } from './routes/reads';
import { sessionRoutes } from './routes/session';
import { writeRoutes } from './routes/writes';
import { SECURITY_HEADERS } from './security-headers';

export interface CreateAppOptions {
  /** Test seam: routes registered here are reached before the signed-in group, so a test can add a route that throws. */
  before?: (app: Hono<AppEnv>) => void;
}

/**
 * The API. /api/auth/* is Better Auth (Google only); /api/v1/health is open; the dev sign-in exists only for APP_ENV=local
 * with DEV_AUTH=1; every other /api/v1 route needs a session, an allowlisted membership and an active one.
 */
export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<AppEnv>();

  // Security headers on every response this Worker produces, errors and 404s included
  app.use('*', async (c, next) => {
    await next();
    try {
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.res.headers.set(name, value);
    } catch {
      // headers of a response from elsewhere can be immutable: copy it and set them on the copy
      const copy = new Response(c.res.body, c.res);
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) copy.headers.set(name, value);
      c.res = copy;
    }
  });

  app.onError(handleError);
  app.notFound(handleNotFound);

  // Better Auth: sign-in with Google, the callback, sign-out, session
  app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env, originOf(c.req.raw)).handler(c.req.raw));

  app.get('/api/v1/health', (c) => c.json({ ok: true, env: c.env.APP_ENV }));
  app.route('/api/v1/dev', devRoutes);

  options.before?.(app);

  // Everything else under /api/v1: signed in, allowlisted, active. An unknown path is a 401 until signed in, never a hint.
  const signedIn = new Hono<AppEnv>();
  signedIn.use('*', requireSession, requireMembership, requireActive);
  signedIn.route('/session', sessionRoutes);
  signedIn.route('/', readRoutes);
  signedIn.route('/', writeRoutes);
  app.route('/api/v1', signedIn);

  return app;
}

export type App = ReturnType<typeof createApp>;
