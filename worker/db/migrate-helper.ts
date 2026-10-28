import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Test helper: the migration files in migrations/ in apply order, split into single statements.
 * drizzle-kit separates statements with a "--> statement-breakpoint" comment; a hand-written migration (triggers, FTS5)
 * uses the same marker, so the same splitter reads both.
 */
export function migrationStatements(): Array<{ file: string; statement: string }> {
  const dir = fileURLToPath(new URL('../../migrations/', import.meta.url));
  const files = readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
  return files.flatMap((file) =>
    readFileSync(`${dir}${file}`, 'utf8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((statement) => ({ file, statement })),
  );
}

/** Applies every migration to a (fresh) D1, one statement at a time. */
export async function applyMigrations(db: D1Database): Promise<void> {
  for (const { statement } of migrationStatements()) await db.prepare(statement).run();
}
