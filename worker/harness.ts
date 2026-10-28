import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';

/**
 * Local D1 and R2 for Worker tests, from wrangler's getPlatformProxy() (Miniflare underneath; ADR-0002 section 2).
 * `persist: false` keeps each proxy in memory, so test files never share state or touch .wrangler/.
 * Secrets are not read here: a test passes the values it needs through the env it hands to `app.request()`.
 */
export interface LocalBindings {
  DB: D1Database;
  FILES: R2Bucket;
  APP_ENV: string;
}

export async function openLocalBindings(): Promise<{ env: LocalBindings; dispose: () => Promise<void> }> {
  const configPath = fileURLToPath(new URL('../wrangler.jsonc', import.meta.url));
  const proxy = await getPlatformProxy<LocalBindings>({ configPath, persist: false });
  return { env: proxy.env, dispose: () => proxy.dispose() };
}
