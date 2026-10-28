import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { createApp } from './app';
import {
  AccessPendingError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  ValidationError,
  VersionConflictError,
} from '@/domain/errors';
import { RuleViolationError } from '@/domain/rules';
import { SECURITY_HEADERS } from './security-headers';
import type { AppBindings } from './env';

const env = { APP_ENV: 'local' } as unknown as AppBindings;

/** An app with one extra route per error, so the mapper can be driven without any real route. */
function appThatThrows(error: unknown) {
  const app = createApp();
  const extra = new Hono<{ Bindings: AppBindings }>();
  extra.get('/boom', () => {
    throw error;
  });
  app.route('/api/v1/_test', extra);
  return app;
}

async function call(error: unknown) {
  const res = await appThatThrows(error).request('/api/v1/_test/boom', {}, env);
  return { res, body: (await res.json()) as { error: { code: string; message: string; fields?: unknown; current?: unknown; errorId?: string } } };
}

afterEach(() => vi.restoreAllMocks());

describe('GET /api/v1/health', () => {
  it('answers {ok:true, env} with no sign-in', async () => {
    const res = await createApp().request('/api/v1/health', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, env: 'local' });
  });

  it('reports the environment it runs in', async () => {
    const res = await createApp().request('/api/v1/health', {}, { APP_ENV: 'preview' } as unknown as AppBindings);
    expect(await res.json()).toEqual({ ok: true, env: 'preview' });
  });
});

describe('error mapper (BACKEND_PLAN section 2)', () => {
  const table: Array<[string, unknown, number, string]> = [
    ['ValidationError', new ValidationError({ displayName: ['Name must be at least 2 characters'] }), 422, 'VALIDATION'],
    ['ForbiddenError', new ForbiddenError("You don't have access to this client"), 403, 'FORBIDDEN'],
    ['NotFoundError', new NotFoundError('Task not found'), 404, 'NOT_FOUND'],
    ['RuleViolationError', new RuleViolationError('Cannot transition task to done'), 409, 'RULE_VIOLATION'],
    ['VersionConflictError', new VersionConflictError({ id: 'task-1', version: 4 }), 409, 'VERSION_CONFLICT'],
    ['AccessPendingError', new AccessPendingError(), 403, 'ACCESS_PENDING'],
    ['RateLimitedError', new RateLimitedError(), 429, 'RATE_LIMITED'],
  ];

  for (const [name, error, status, code] of table) {
    it(`${name} becomes ${status} ${code} in the JSON error shape`, async () => {
      const { res, body } = await call(error);
      expect(res.status).toBe(status);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(body.error.code).toBe(code);
      expect(body.error.message).toBe((error as Error).message);
    });
  }

  it('carries the field errors of a ValidationError', async () => {
    const { body } = await call(new ValidationError({ displayName: ['Too short'], code: ['Required'] }));
    expect(body.error.fields).toEqual({ displayName: ['Too short'], code: ['Required'] });
  });

  it('carries the current record of a VersionConflictError', async () => {
    const { body } = await call(new VersionConflictError({ id: 'task-1', version: 4 }));
    expect(body.error.current).toEqual({ id: 'task-1', version: 4 });
  });

  it('turns an unknown error into a plain 500 with no message, stack or cause', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const secretish = new Error('connect ECONNREFUSED tin=123-456-789-000 at /srv/worker/db.ts:12');
    const { res, body } = await call(secretish);
    expect(res.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL');
    const text = JSON.stringify(body);
    expect(text).not.toContain('ECONNREFUSED');
    expect(text).not.toContain('123-456-789');
    expect(text).not.toMatch(/\bat \S+:\d+/);
    expect(typeof body.error.errorId).toBe('string');
    // the log line names the error id and the error type, never the message
    const logged = spy.mock.calls.flat().join(' ');
    expect(logged).toContain(body.error.errorId!);
    expect(logged).not.toContain('123-456-789');
  });

  it('answers an unknown /api path with a JSON 404, not HTML', async () => {
    const res = await createApp().request('/api/v1/nope', {}, env);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });
});

describe('security headers (BACKEND_PLAN section 8)', () => {
  it('are on a success, an error and a not-found response', async () => {
    const app = appThatThrows(new ForbiddenError());
    for (const path of ['/api/v1/health', '/api/v1/_test/boom', '/api/v1/missing']) {
      const res = await app.request(path, {}, env);
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        expect(res.headers.get(name), `${name} on ${path}`).toBe(value);
      }
    }
  });

  it('forbid framing, referrers, sniffing and indexing', () => {
    expect(SECURITY_HEADERS['Content-Security-Policy']).toContain("default-src 'self'");
    expect(SECURITY_HEADERS['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(SECURITY_HEADERS['Content-Security-Policy']).toContain("connect-src 'self'");
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('no-referrer');
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(SECURITY_HEADERS['X-Robots-Tag']).toBe('noindex, nofollow');
    expect(SECURITY_HEADERS['Permissions-Policy']).toBe('camera=(self), geolocation=()');
  });
});
