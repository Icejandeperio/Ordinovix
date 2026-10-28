/// <reference types="vite/client" />
import { buildInitialStore } from '@/data/mock';
import { buildSeedSql } from '../db/seed';
import { encryptTin, hashTin, normalizeTin } from '../lib/tin';

/**
 * Development only (see sign-in.ts): puts the Demo organization back as the mock starts. The seed SQL deletes only that organization's
 * own rows and keeps memberships it does not own (a real owner's, in preview); in a local database those are people a test invited,
 * so they go too, or inviting the same address again would collide.
 * The preview seed keeps only masked TINs (it has no key). Here the Worker has its local key, so every sample client gets a sample
 * TIN encrypted too (the mock's own, or the placeholder its reveal falls back to), and "reveal TIN" works the same in both modes.
 */
const MOCK_PLACEHOLDER_TIN = '000-000-000-00000';

export async function resetDemoData(db: D1Database, today: string, tinKey: string): Promise<void> {
  await db.exec(buildSeedSql(today));
  const store = buildInitialStore(today);
  const org = store.org.id;
  const seedMemberships = store.memberships.map((m) => m.id);
  const seedUsers = store.users.map((u) => u.id);
  const marks = (n: number) => Array(n).fill('?').join(', ');
  const demo = 'EXISTS (SELECT 1 FROM orgs WHERE id = ? AND is_demo = 1)';
  const strangers = `SELECT id FROM memberships WHERE org_id = ? AND id NOT IN (${marks(seedMemberships.length)}) AND ${demo}`;
  const strangerArgs = [org, ...seedMemberships, org];
  const statements: D1PreparedStatement[] = [
    // people invited by a test: their user rows, preferences and client links go with their memberships
    db.prepare(`DELETE FROM user_prefs WHERE user_id IN (SELECT user_id FROM memberships WHERE id IN (${strangers})) AND user_id NOT IN (${marks(seedUsers.length)})`).bind(...strangerArgs, ...seedUsers),
    db.prepare(`DELETE FROM membership_clients WHERE membership_id IN (${strangers})`).bind(...strangerArgs),
  ];
  // the users of those memberships are read before the memberships are deleted
  const { results } = await db.prepare(`SELECT user_id FROM memberships WHERE id IN (${strangers})`).bind(...strangerArgs).all<{ user_id: string }>();
  const strangerUsers = results.map((r) => r.user_id).filter((id) => !seedUsers.includes(id));
  statements.push(db.prepare(`DELETE FROM memberships WHERE id IN (${strangers})`).bind(...strangerArgs));
  for (const id of strangerUsers) statements.push(db.prepare('DELETE FROM users WHERE id = ? AND id NOT IN (SELECT user_id FROM memberships)').bind(id));

  for (const client of store.clients) {
    const tin = normalizeTin(client.tinFull || MOCK_PLACEHOLDER_TIN);
    if (!tin) continue;
    statements.push(
      db
        .prepare('UPDATE clients SET tin_encrypted = ?, tin_hash = ? WHERE id = ? AND org_id = ?')
        .bind(await encryptTin(tinKey, tin), await hashTin(tinKey, tin), client.id, client.orgId),
    );
  }
  await db.batch(statements);
}
