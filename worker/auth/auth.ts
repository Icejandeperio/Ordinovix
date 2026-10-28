import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import type { AppBindings } from '../env';

/** A session lasts 30 days from the last use (rolling): it is renewed once a day while the app is in use. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_RENEW_AFTER_SECONDS = 60 * 60 * 24;

/**
 * Better Auth for one request. Google is the only way in; there is no password, no email link and no other provider.
 * The cookie is HttpOnly, Secure and SameSite=Lax on the same origin as the app. Signing in with Google proves who the
 * person is, nothing more: whether they may see anything is decided by their membership (worker/middleware), so a stranger
 * who signs in lands on "access pending" and sees no data.
 *
 * Built per request because the bindings (database, secrets) arrive with the request; `origin` is the origin the request
 * came to, which is where Google sends the person back (/api/auth/callback/google).
 */
export function createAuth(env: AppBindings, origin: string) {
  return betterAuth({
    appName: 'Ordinovix',
    baseURL: origin,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(drizzle(env.DB, { schema }), {
      provider: 'sqlite',
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    },
    session: { expiresIn: SESSION_MAX_AGE_SECONDS, updateAge: SESSION_RENEW_AFTER_SECONDS },
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
    },
    // The built-in limiter keeps counts in one isolate's memory, which means nothing on Workers; the API has its own limit
    rateLimit: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

export function originOf(request: Request): string {
  return new URL(request.url).origin;
}
