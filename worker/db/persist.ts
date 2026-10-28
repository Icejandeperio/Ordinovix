/**
 * The write path. A write route loads the organization's records, runs the shared command (src/data/commands.ts: the same
 * rules, permission checks, validation, version checks and activity events the mock runs), and then writes exactly what the
 * command changed: new rows, changed columns, removed rows. The change, its activity row and the idempotency record go to D1
 * in ONE batch, which is atomic: a failure leaves nothing partial.
 *
 * - Idempotency-Key is required. A key seen before (within 7 days) returns the first response and applies nothing.
 * - An update carries the loaded `version` (If-Match); a stale one is VERSION_CONFLICT with the current record, raised by the
 *   command; a concurrent write that lands between the load and the batch trips a guard statement in the batch.
 * - Inserts are grouped into multi-row statements of at most 100 bound values, D1's limit per statement.
 */
import { getTableColumns, getTableName } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Context } from 'hono';
import { createCommands, type Commands } from '@/data/commands';
import type { QueryData } from '@/data/queries';
import { ValidationError, VersionConflictError } from '@/domain/errors';
import { scrubTin } from '../lib/tin';
import type { AppEnv } from '../env';
import { ALL_TABLES, loadQueryData } from './load';
import { rowsOf, type Row } from './rows';

const MAX_BOUND = 100;
const KEY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Bound = string | number | null;
type Params = Record<string, Bound>;

/** A row as bound values, by column name: booleans 0/1, JSON as text, absent as null. */
function toParams(table: SQLiteTable, row: Row): Params {
  const out: Params = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    const raw = row[key];
    if (raw === undefined || raw === null) out[column.name] = null;
    else if (column.columnType === 'SQLiteTextJson') out[column.name] = JSON.stringify(raw);
    else if (column.columnType === 'SQLiteTimestamp') out[column.name] = raw instanceof Date ? raw.getTime() : (raw as number);
    else if (typeof raw === 'boolean') out[column.name] = raw ? 1 : 0;
    else out[column.name] = raw as Bound;
  }
  return out;
}

/** The primary key column names: `id`, or the declared primary column, or (a join table) every column. */
function keyColumns(table: SQLiteTable): string[] {
  const columns = Object.values(getTableColumns(table));
  const primary = columns.filter((c) => c.primary).map((c) => c.name);
  if (primary.length > 0) return primary;
  return columns.map((c) => c.name);
}

interface Snapshot {
  table: SQLiteTable;
  name: string;
  keys: string[];
  rows: Map<string, Params>;
}

function snapshot(store: QueryData): Snapshot[] {
  return rowsOf(store).map(({ table, rows }) => {
    const keys = keyColumns(table);
    const map = new Map<string, Params>();
    for (const row of rows) {
      const params = toParams(table, row);
      map.set(JSON.stringify(keys.map((k) => params[k])), params);
    }
    return { table, name: getTableName(table), keys, rows: map };
  });
}

interface Plan {
  statements: D1PreparedStatement[];
  guards: Array<{ table: string; id: string }>;
  changed: number;
}

function plan(d1: D1Database, before: Snapshot[], after: Snapshot[]): Plan {
  const statements: D1PreparedStatement[] = [];
  const guards: Plan['guards'] = [];
  const guardStatements: D1PreparedStatement[] = [];
  const updates: D1PreparedStatement[] = [];
  const deletes: D1PreparedStatement[] = [];
  let changed = 0;

  for (const post of after) {
    const pre = before.find((b) => b.name === post.name)!;
    const columns = Object.keys(post.rows.values().next().value ?? pre.rows.values().next().value ?? {});
    const hasVersion = Object.values(getTableColumns(post.table)).some((c) => c.name === 'version');
    const where = post.keys.map((k) => `${k} = ?`).join(' AND ');

    // inserts: parents first (the order of rowsOf), several rows per statement within the bound-value limit
    const inserted = [...post.rows].filter(([key]) => !pre.rows.has(key)).map(([, p]) => p);
    if (inserted.length > 0) {
      const names = Object.keys(inserted[0]);
      const perStatement = Math.max(1, Math.floor(MAX_BOUND / names.length));
      for (let i = 0; i < inserted.length; i += perStatement) {
        const chunk = inserted.slice(i, i + perStatement);
        const marks = `(${names.map(() => '?').join(', ')})`;
        statements.push(d1.prepare(`INSERT INTO ${post.name} (${names.join(', ')}) VALUES ${chunk.map(() => marks).join(', ')}`).bind(...chunk.flatMap((p) => names.map((n) => p[n]))));
      }
      changed += inserted.length;
    }

    // updates: only the columns that changed, guarded by the version the command started from
    for (const [key, p] of post.rows) {
      const old = pre.rows.get(key);
      if (!old) continue;
      const diff = columns.filter((n) => p[n] !== old[n] && !post.keys.includes(n));
      if (diff.length === 0) continue;
      const keyValues = JSON.parse(key) as Bound[];
      updates.push(d1.prepare(`UPDATE ${post.name} SET ${diff.map((n) => `${n} = ?`).join(', ')} WHERE ${where}`).bind(...diff.map((n) => p[n]), ...keyValues));
      if (hasVersion && post.keys.length === 1 && post.keys[0] === 'id') {
        // a write that landed since the load makes this raise (malformed JSON) and the whole batch rolls back
        guardStatements.push(d1.prepare(`SELECT json(CASE WHEN version = ? THEN '1' ELSE 'x' END) AS ok FROM ${post.name} WHERE id = ?`).bind(old.version, keyValues[0]));
        guards.push({ table: post.name, id: String(keyValues[0]) });
      }
      changed++;
    }

    // removals (the write side only hard-deletes join rows and a few reference rows)
    for (const [key] of pre.rows) {
      if (post.rows.has(key)) continue;
      deletes.push(d1.prepare(`DELETE FROM ${post.name} WHERE ${where}`).bind(...(JSON.parse(key) as Bound[])));
      changed++;
    }
  }
  // guards first so a stale write fails before anything else runs; deletes last, children first
  return { statements: [...guardStatements, ...statements, ...updates, ...deletes.reverse()], guards, changed };
}

export function ifMatchVersion(c: Context<AppEnv>): number {
  const raw = c.req.header('If-Match');
  const m = raw ? /^(?:W\/)?"?(\d+)"?$/.exec(raw.trim()) : null;
  if (!m) throw new ValidationError({ 'If-Match': ['Send the record version you loaded in If-Match, for example "3"'] });
  return Number(m[1]);
}

export interface WriteOptions<T> {
  /** 201 for a create. */
  status?: 200 | 201;
  /** Runs on the loaded records before the command (for example puts a decrypted TIN on the in-memory client). */
  prepare?: (store: QueryData) => Promise<void> | void;
  run: (cmd: Commands, store: QueryData) => Promise<T>;
  /** Extra statements for the same batch, given the result (for example the TIN ciphertext). */
  extra?: (result: T, d1: D1Database) => D1PreparedStatement[] | Promise<D1PreparedStatement[]>;
  /** The response body; default is the result, or {ok:true} when the command returns nothing. */
  respond?: (result: T) => unknown;
  /** What the idempotency record keeps and a replay returns, when the response holds something that must not be stored. */
  persisted?: (result: T) => unknown;
  /** false for a POST that writes nothing (a preview, a duplicate check): no key is needed and none is recorded. */
  idempotent?: boolean;
}

const idempotencyKeyOf = (c: Context<AppEnv>): string => {
  const key = c.req.header('Idempotency-Key')?.trim();
  if (!key || key.length < 8 || key.length > 100 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new ValidationError({ 'Idempotency-Key': ['Send an Idempotency-Key header: 8 to 100 letters, digits, dots, dashes or colons (a UUID is fine)'] });
  }
  return key;
};

export async function runWrite<T>(c: Context<AppEnv>, o: WriteOptions<T>): Promise<Response> {
  const actor = c.get('actor');
  const d1 = c.env.DB;
  const idempotent = o.idempotent !== false;
  const key = idempotent ? idempotencyKeyOf(c) : '';
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;

  // a key seen before returns the first response and applies nothing
  const seen = !idempotent ? null : await d1
    .prepare('SELECT method, path, status, response_json, created_at FROM idempotency_keys WHERE org_id = ? AND user_id = ? AND key = ?')
    .bind(actor.orgId, actor.userId, key)
    .first<{ method: string; path: string; status: number; response_json: string; created_at: string }>();
  const expired = seen ? Date.now() - Date.parse(seen.created_at) > KEY_TTL_MS : false;
  if (seen && !expired) {
    if (seen.method !== method || seen.path !== path) {
      throw new ValidationError({ 'Idempotency-Key': ['This key was already used for a different request. Use a new key.'] });
    }
    return new Response(seen.response_json, { status: seen.status, headers: { 'content-type': 'application/json', 'Idempotent-Replay': 'true' } });
  }

  const store = await loadQueryData(d1, actor.orgId, ALL_TABLES);
  const authUser = c.get('authUser');
  const user = store.users.find((u) => u.id === actor.userId) ?? { id: actor.userId, name: authUser.name, email: authUser.email, initials: 'OP' };
  const membership = store.memberships.find((m) => m.id === actor.membershipId)!;
  await o.prepare?.(store);

  const before = snapshot(store);
  const cmd = createCommands({ store, user, membership, userAgent: c.req.header('user-agent') });
  const result = await o.run(cmd, store);
  const after = snapshot(store);

  const p = plan(d1, before, after);
  const extra = o.extra ? await o.extra(result, d1) : [];
  const body = scrubTin(o.respond ? o.respond(result) : result === undefined ? { ok: true } : result);
  const status = o.status ?? 200;
  const responseJson = JSON.stringify(body);
  const kept = o.persisted ? JSON.stringify(scrubTin(o.persisted(result))) : responseJson;
  if (!idempotent) return new Response(responseJson, { status, headers: { 'content-type': 'application/json' } });
  const record = d1
    .prepare('INSERT INTO idempotency_keys (org_id, user_id, key, method, path, status, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(actor.orgId, actor.userId, key, method, path, status, kept, new Date().toISOString());
  const clear = expired ? [d1.prepare('DELETE FROM idempotency_keys WHERE org_id = ? AND user_id = ? AND key = ?').bind(actor.orgId, actor.userId, key)] : [];

  try {
    await d1.batch([...clear, ...p.statements, ...extra, record]);
  } catch (error) {
    const message = error instanceof Error ? `${error.message} ${(error as { cause?: Error }).cause?.message ?? ''}` : '';
    // the same key arrived twice at once: the other request won, answer with its response
    if (/UNIQUE constraint failed: idempotency_keys/i.test(message)) {
      const won = await d1
        .prepare('SELECT status, response_json FROM idempotency_keys WHERE org_id = ? AND user_id = ? AND key = ?')
        .bind(actor.orgId, actor.userId, key)
        .first<{ status: number; response_json: string }>();
      if (won) return new Response(won.response_json, { status: won.status, headers: { 'content-type': 'application/json', 'Idempotent-Replay': 'true' } });
    }
    // somebody else changed a record between our load and the batch
    if (/malformed JSON/i.test(message) && p.guards.length > 0) {
      const fresh = await loadQueryData(d1, actor.orgId, ALL_TABLES);
      const ids = new Set(p.guards.map((g) => g.id));
      const current = Object.values(fresh).flatMap((v) => (Array.isArray(v) ? v : [])).find((e) => ids.has((e as { id?: string }).id ?? ''));
      throw new VersionConflictError(scrubTin(current));
    }
    throw error;
  }
  return new Response(responseJson, { status, headers: { 'content-type': 'application/json' } });
}
