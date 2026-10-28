import { createApp } from './app';
import { runRetention } from './cron/retention';
import type { AppBindings } from './env';

/** Worker entry (wrangler.jsonc `main`). Only /api/* reaches `fetch`; everything else is served from the static assets. */
const app = createApp();

export default {
  fetch: app.fetch,
  /** Cron triggers (wrangler.jsonc `triggers.crons`). */
  async scheduled(_event: ScheduledController, env: AppBindings, ctx: ExecutionContext) {
    ctx.waitUntil(runRetention(env).then((r) => console.log(`retention: ${r.keysPurged} idempotency keys, ${r.filesPurged} files purged`)));
  },
} satisfies ExportedHandler<AppBindings>;
