import { Hono } from 'hono';
import type { AppEnv } from './env';
import { handleError, handleNotFound } from './errors';
import { SECURITY_HEADERS } from './security-headers';

/**
 * The API. Later units add the route groups under /api/v1 and Better Auth under /api/auth; this shell has the error
 * mapper, the security headers and the unauthenticated health route that deploy checks use.
 */
export function createApp() {
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

  app.get('/api/v1/health', (c) => c.json({ ok: true, env: c.env.APP_ENV }));

  return app;
}

export type App = ReturnType<typeof createApp>;
