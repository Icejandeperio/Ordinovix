import { createApp, type App } from '../app';
import { sessionCookieHeader } from '../auth/session-cookie';
import { applyMigrations } from '../db/migrate-helper';
import { buildSeedSql } from '../db/seed';
import type { AppBindings } from '../env';
import { openLocalBindings } from '../harness';

/**
 * Worker test fixture: a fresh in-memory local D1 and R2 (getPlatformProxy), all migrations applied, the Demo organization
 * seeded, and an app that runs against them with made-up secrets. No network: Google is never contacted.
 */
export const TEST_SEED_DAY = '2026-10-27';
export const TEST_ORIGIN = 'https://ordinovix.test';

export const TEST_SECRETS = {
  BETTER_AUTH_SECRET: 'test-only-secret-0123456789abcdef0123456789abcdef',
  GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.invalid',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  VAPID_PUBLIC_KEY: 'test-vapid-public',
  VAPID_PRIVATE_KEY: 'test-vapid-private',
  FILE_URL_SIGNING_KEY: 'dGVzdC1maWxlLXVybC1zaWduaW5nLWtleS0wMTIzNDU2Nzg5',
  TIN_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=', // 32 bytes
} as const;

export interface TestPerson {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
}

export interface World {
  env: AppBindings;
  app: App;
  dispose: () => Promise<void>;
  /** A Cookie header for a signed-in person: a Better Auth user and session row are created for them. */
  cookieFor: (person: TestPerson) => Promise<string>;
  /** Requests the app as a person (or as nobody) with the same origin every time. */
  request: (path: string, init?: RequestInit & { cookie?: string; env?: Partial<AppBindings> }) => Promise<Response>;
}

export const PERSONAS = {
  owner: { id: 'user-ana', name: 'Ana Santos', email: 'ana@example.com' },
  helper: { id: 'user-ben', name: 'Ben Morales', email: 'ben@example.com' },
} satisfies Record<string, TestPerson>;

export async function openWorld(options: { appEnv?: AppBindings['APP_ENV']; devAuth?: boolean; seed?: boolean } = {}): Promise<World> {
  const { env: bindings, dispose } = await openLocalBindings();
  await applyMigrations(bindings.DB);
  if (options.seed !== false) await bindings.DB.exec(buildSeedSql(TEST_SEED_DAY));

  const env = {
    DB: bindings.DB,
    FILES: bindings.FILES,
    APP_ENV: options.appEnv ?? 'local',
    ...(options.devAuth ? { DEV_AUTH: '1' } : {}),
    ...TEST_SECRETS,
  } as AppBindings;
  const app = createApp();

  const cookieFor = async (person: TestPerson) => {
    const now = Date.now();
    await env.DB
      .prepare('INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
      .bind(person.id, person.name, person.email, person.emailVerified === false ? 0 : 1, now, now)
      .run();
    const token = `tok-${person.id}-${crypto.randomUUID()}`;
    await env.DB
      .prepare('INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), now + 30 * 86400_000, token, now, now, person.id)
      .run();
    return sessionCookieHeader(env.BETTER_AUTH_SECRET, token);
  };

  const request: World['request'] = (path, init = {}) => {
    const { cookie, env: override, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (cookie) headers.set('Cookie', cookie);
    return Promise.resolve(app.request(`${TEST_ORIGIN}${path}`, { ...rest, headers }, { ...env, ...override }));
  };

  return { env, app, dispose, cookieFor, request };
}

/** Adds a membership (and the app profile row it links to) to the Demo organization. */
export async function addMembership(
  world: World,
  m: { id: string; email: string; role: 'owner' | 'helper'; userId?: string | null; active?: boolean; revoked?: boolean; clientIds?: string[]; name?: string },
): Promise<void> {
  const { DB } = world.env;
  const stamp = '2026-10-01T08:00:00+08:00';
  if (m.userId) {
    await DB.prepare('INSERT OR IGNORE INTO users (id, name, email, initials) VALUES (?, ?, ?, ?)').bind(m.userId, m.name ?? m.email, m.email, 'XX').run();
  }
  await DB
    .prepare(
      'INSERT INTO memberships (id, org_id, email, user_id, role, active, invited_at, revoked_at, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(m.id, 'org-demo-01', m.email, m.userId ?? null, m.role, m.active === false ? 0 : 1, stamp, m.revoked ? stamp : null, stamp, 'user-ana', stamp, 'user-ana')
    .run();
  for (const clientId of m.clientIds ?? []) {
    await DB.prepare('INSERT INTO membership_clients (membership_id, client_id) VALUES (?, ?)').bind(m.id, clientId).run();
  }
}
