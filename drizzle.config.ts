import { defineConfig } from 'drizzle-kit';

/**
 * Migrations are generated from the schema with `npx drizzle-kit generate` and applied with
 * `npx wrangler d1 migrations apply DB --local` (CI applies them to the live databases). drizzle-kit never connects to a
 * database here: no `push`, no `migrate`, no credentials.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './worker/db/schema.ts',
  out: './migrations',
});
