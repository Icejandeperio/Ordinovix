import { createApp } from './app';
import { runNotifications } from './cron/notify';
import { runRetention } from './cron/retention';
import type { AppBindings } from './env';

/** Worker entry (wrangler.jsonc `main`). Only /api/* reaches `fetch`; everything else is served from the static assets. */
const app = createApp();

/** Cron expressions, in UTC (wrangler.jsonc `triggers.crons`). */
export const CRON = {
  retention: '0 19 * * *', // 03:00 Manila
  morning: '0 23 * * *', // 07:00 Manila
  evening: '0 9 * * *', // 17:00 Manila
} as const;

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: AppBindings, ctx: ExecutionContext) {
    if (event.cron === CRON.retention) {
      ctx.waitUntil(runRetention(env).then((r) => console.log(`retention: ${r.keysPurged} idempotency keys, ${r.filesPurged} files purged`)));
    } else if (event.cron === CRON.morning || event.cron === CRON.evening) {
      const job = event.cron === CRON.morning ? 'morning' : 'evening';
      ctx.waitUntil(runNotifications(env, job).then((r) => console.log(`${job}: ${r.created} notifications, ${r.pushed} pushed, ${r.removedSubscriptions} subscriptions removed`)));
    }
  },
} satisfies ExportedHandler<AppBindings>;
