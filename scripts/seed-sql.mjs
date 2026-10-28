// Prints idempotent SQL for the Demo organization (same ids as the mock seed) to stdout.
// Usage: npm run --silent db:seed-sql [-- --today YYYY-MM-DD]
// The CI deploy-preview job pipes this into `wrangler d1 execute --env preview` on a reseed; nothing here talks to a database.
// The seed is TypeScript built from the mock's data, so it is loaded through Vite's SSR loader (aliases like "@/..." work).
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const todayIndex = args.indexOf('--today');
const today = todayIndex > -1 ? args[todayIndex + 1] : undefined;
if (today !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error('--today needs a date like 2026-10-27');
  process.exit(2);
}

// A bare server: no config file (so no Cloudflare plugin, no workerd), no port, no file watching
const server = await createServer({
  root,
  configFile: false,
  logLevel: 'silent',
  appType: 'custom',
  resolve: { alias: { '@': path.join(root, 'src') } },
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { buildSeedSql } = await server.ssrLoadModule('/worker/db/seed.ts');
  // "today" in Asia/Manila unless given, the same day the mock would start on
  const day = today ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  process.stdout.write(buildSeedSql(day));
} finally {
  await server.close();
}
