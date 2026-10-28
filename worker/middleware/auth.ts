import type { MiddlewareHandler } from 'hono';
import { AccessPendingError, ForbiddenError, UnauthenticatedError } from '@/domain/errors';
import { requireOwner } from '@/domain/policy';
import { createAuth, originOf } from '../auth/auth';
import { resolveActor } from '../auth/membership';
import type { AppEnv } from '../env';

/** 401 unless the request carries a valid Better Auth session cookie. */
export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = createAuth(c.env, originOf(c.req.raw));
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new UnauthenticatedError();
  c.set('auth', auth);
  c.set('authUser', {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
  });
  await next();
};

/**
 * Loads the membership of the signed-in person on every request and leaves it on the context as `actor` (organization,
 * role, assigned clients, active). 403 ACCESS_PENDING when no allowlisted membership exists for them.
 */
export const requireMembership: MiddlewareHandler<AppEnv> = async (c, next) => {
  const actor = await resolveActor(c.env, c.get('authUser'));
  if (!actor) throw new AccessPendingError();
  c.set('actor', actor);
  await next();
};

/** A revoked membership reaches nothing: 403 for every route behind this one. */
export const requireActive: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('actor').active) throw new ForbiddenError('Your access has been revoked. Ask the practice owner if this is a mistake.');
  await next();
};

/** Owner-only routes check the role here, in middleware, not in the handler body. */
export const ownerOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  requireOwner(c.get('actor'));
  await next();
};
