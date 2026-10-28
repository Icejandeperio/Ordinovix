/**
 * Push subscription routes (BACKEND_PLAN 4.9): a person saves, removes and tests the push subscription of their own devices.
 * Asked only after a tap on "Turn on reminders" in the app. A subscription belongs to one person (own data); only an endpoint on a
 * real push service is accepted, because the Worker will POST to it.
 */
import { Hono } from 'hono';
import { ValidationError } from '@/domain/errors';
import { runWrite } from '../db/persist';
import type { AppEnv } from '../env';
import { readBody } from '../lib/body';
import { isPushEndpoint, realPushDeps, sendPush, type PushDeps } from '../push/send';

export function pushRoutes(deps: PushDeps = realPushDeps()) {
  const routes = new Hono<AppEnv>();

  /** The public half of the VAPID key, which the browser needs to subscribe. It is not a secret. */
  routes.get('/push/vapid-key', (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY }));

  routes.post('/push/subscriptions', async (c) => {
    const body = await readBody(c, ['endpoint', 'expirationTime', 'keys']);
    const { endpoint, keys } = body;
    if (typeof endpoint !== 'string' || !isPushEndpoint(endpoint)) {
      throw new ValidationError({ endpoint: ['This is not the address of a push service. Turn on reminders from the app.'] });
    }
    const b64 = /^[A-Za-z0-9_-]{16,200}$/;
    if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || !b64.test(keys.p256dh) || !b64.test(keys.auth)) {
      throw new ValidationError({ keys: ['The subscription keys are missing or not valid'] });
    }
    const actor = c.get('actor');
    return runWrite(c, {
      status: 201,
      run: async () => ({ ok: true }),
      // the endpoint is unique: subscribing again from the same device replaces the keys and moves it to this person
      extra: (_r, d1) => [
        d1
          .prepare(
            'INSERT INTO push_subscriptions (id, org_id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET org_id = excluded.org_id, user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth',
          )
          .bind(crypto.randomUUID(), actor.orgId, actor.userId, endpoint, keys.p256dh, keys.auth, new Date().toISOString()),
      ],
    });
  });

  routes.delete('/push/subscriptions', async (c) => {
    const endpoint = c.req.query('endpoint');
    if (!endpoint) throw new ValidationError({ endpoint: ['endpoint is required'] });
    const actor = c.get('actor');
    return runWrite(c, {
      run: async () => ({ ok: true }),
      // only the person's own subscription: another person's endpoint is left alone
      extra: (_r, d1) => [d1.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ? AND org_id = ?').bind(endpoint, actor.userId, actor.orgId)],
    });
  });

  routes.post('/push/test', async (c) => {
    const actor = c.get('actor');
    const { results } = await c.env.DB.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE org_id = ? AND user_id = ?').bind(actor.orgId, actor.userId).all<{ id: string; endpoint: string; p256dh: string; auth: string }>();
    let sent = 0;
    let removed = 0;
    for (const sub of results) {
      const r = await sendPush(deps, c.env, sub, { title: 'Ordinovix', body: 'Reminders are on for this device.', url: '/', tag: 'test' }, `mailto:${actor.email}`);
      if (r === 'sent') sent++;
      if (r === 'gone') {
        await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run();
        removed++;
      }
    }
    return c.json({ devices: results.length, sent, removed });
  });

  return routes;
}
