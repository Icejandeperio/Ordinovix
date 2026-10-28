import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { is, getTableName } from 'drizzle-orm';
import { SQLiteTable as SQLiteTableClass } from 'drizzle-orm/sqlite-core';
import * as schema from './schema';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const tables = Object.values(schema).filter((x) => is(x, SQLiteTableClass)) as unknown as SQLiteTable[];
const byName = new Map<string, SQLiteTable>(tables.map((t) => [getTableName(t), t]));

/** Tables and columns written in the U19 draft (docs/backend/schema-draft.sql), which this schema must cover. */
function draftTables(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const sql = read('../../docs/backend/schema-draft.sql');
  for (const m of sql.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g)) {
    const columns: string[] = [];
    for (const raw of m[2].split('\n')) {
      const line = raw.replace(/--.*$/, '').trim();
      if (!line || /^(PRIMARY KEY|UNIQUE|CHECK)\b/.test(line)) continue;
      // a line may carry several columns: "created_at TEXT NOT NULL, created_by TEXT NOT NULL, ..."
      for (const part of line.split(/,(?![^(]*\))/)) {
        const col = /^(\w+)\s+(TEXT|INTEGER|REAL)\b/.exec(part.trim());
        if (col) columns.push(col[1]);
      }
    }
    out.set(m[1], columns);
  }
  return out;
}

describe('Drizzle schema covers the U19 draft', () => {
  const draft = draftTables();

  it('reads the draft: it lists the tables of the plan', () => {
    expect(draft.size).toBeGreaterThanOrEqual(39);
  });

  for (const [name, columns] of draft) {
    it(`table ${name} exists with every draft column`, () => {
      const table = byName.get(name);
      expect(table, `table ${name} in worker/db/schema.ts`).toBeDefined();
      const have = getTableConfig(table!).columns.map((c) => c.name);
      expect(columns.filter((c) => !have.includes(c)), `columns of ${name} missing`).toEqual([]);
    });
  }

  it('has the Better Auth tables and the API bookkeeping table', () => {
    for (const name of ['user', 'session', 'account', 'verification', 'idempotency_keys']) {
      expect(byName.has(name), name).toBe(true);
    }
  });

  it('has every index the draft names, with the same columns', () => {
    const sql = read('../../docs/backend/schema-draft.sql');
    const wanted = [...sql.matchAll(/CREATE (UNIQUE )?INDEX (\w+) ON (\w+) \(([^)]*)\)/g)].map((m) => ({ unique: Boolean(m[1]), name: m[2], table: m[3], columns: m[4].split(',').map((c) => c.trim()) }));
    expect(wanted.length).toBeGreaterThanOrEqual(35);
    for (const w of wanted) {
      const table = byName.get(w.table);
      expect(table, `table ${w.table}`).toBeDefined();
      const found = getTableConfig(table!).indexes.find((i) => i.config.name === w.name);
      expect(found, `index ${w.name}`).toBeDefined();
      expect(found!.config.unique).toBe(w.unique);
      const cols = found!.config.columns.map((c) => ('name' in c ? c.name : String(c)));
      expect(cols, `columns of ${w.name}`).toEqual(w.columns);
    }
  });
});

describe('version column and TIN storage', () => {
  it('every table whose draft has a version column has one with default 1', () => {
    const sql = read('../../docs/backend/schema-draft.sql');
    const versioned = [...sql.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g)].filter((m) => /\bversion INTEGER NOT NULL DEFAULT 1/.test(m[2])).map((m) => m[1]);
    expect(versioned.length).toBeGreaterThanOrEqual(25);
    for (const name of versioned) {
      const col = getTableConfig(byName.get(name)!).columns.find((c) => c.name === 'version');
      expect(col, `${name}.version`).toBeDefined();
      expect(col!.notNull).toBe(true);
      expect(col!.default).toBe(1);
    }
  });

  it('stores a TIN only as ciphertext, a masked display value and a hash: no plain TIN column anywhere', () => {
    const clients = getTableConfig(byName.get('clients')!).columns.map((c) => c.name);
    expect(clients).toEqual(expect.arrayContaining(['tin_encrypted', 'tin_masked', 'tin_hash', 'has_tin']));
    for (const [name, table] of byName) {
      for (const col of getTableConfig(table).columns) {
        expect(col.name, `${name}.${col.name}`).not.toMatch(/^(tin|tin_full|tin_plain|tin_raw)$/);
      }
    }
  });
});
