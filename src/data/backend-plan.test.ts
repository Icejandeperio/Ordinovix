import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mockRepositories } from './mock';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('backend plan (spec 21, no cloud actions)', () => {
  const plan = read('../../docs/backend/BACKEND_PLAN.md');
  const sql = read('../../docs/backend/schema-draft.sql');

  it('maps every Repositories method to a route, a permission rule and tables', () => {
    const methods = [
      ...Object.entries(mockRepositories).flatMap(([group, m]) => Object.keys(m as object).map((name) => `${group}.${name}`)),
      'deadlineMoves.unreadCount', // in the Repositories interface; the mock does not implement it yet
    ];
    const rows = plan.split('\n').filter((line) => line.startsWith('|'));
    const missing = methods.filter((name) => !rows.some((row) => row.includes(`\`${name}\``)));
    expect(missing, 'methods with no row in BACKEND_PLAN.md').toEqual([]);
    for (const name of methods) {
      const row = rows.find((r) => r.includes(`\`${name}\``))!;
      const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
      expect(cells.length, `${name} needs a method, route, permission and tables column`).toBeGreaterThanOrEqual(5);
      expect(cells[1], `${name} route`).toMatch(/^(GET|POST|PUT|PATCH|DELETE) `?\/api\//);
    }
  });

  it('drafts a D1 table for every entity, with the indexes of spec 21.6', () => {
    const tables = [
      'orgs', 'org_settings', 'users', 'user_prefs', 'memberships', 'membership_clients', 'offices', 'clients', 'client_assigned_users',
      'contacts', 'authorizations', 'task_templates', 'requirement_templates', 'deadline_moves', 'holidays', 'message_templates', 'tasks',
      'task_lines', 'line_documents', 'documents', 'follow_ups', 'follow_up_lines', 'follow_up_attempts', 'visits', 'visit_items',
      'visit_item_evidence', 'visit_packed', 'visit_kit_items', 'payments', 'payment_proofs', 'notes', 'saved_views', 'notifications',
      'push_subscriptions', 'baselines', 'pulses', 'activity', 'idempotency_keys', 'import_batches',
    ];
    for (const t of tables) expect(sql, `table ${t}`).toMatch(new RegExp(`CREATE TABLE ${t} \\(`));
    for (const idx of [
      'tasks (org_id, client_id, status)', 'tasks (org_id, due_date)', 'tasks (org_id, owner_user_id)', 'task_lines (org_id, task_id)',
      'task_lines (org_id, status)', 'follow_ups (org_id, status, expected_by)', 'visits (org_id, planned_date)',
      'activity (org_id, entity, entity_id, at)', 'activity (org_id, at)', 'documents (org_id, client_id)', 'documents (org_id, sha256)',
    ]) {
      expect(sql, `index on ${idx}`).toContain(idx);
    }
    expect(sql).toContain('CREATE VIRTUAL TABLE search_index USING fts5');
  });

  it('keeps secrets and full TINs out of plain columns', () => {
    expect(sql).toMatch(/tin_encrypted/);
    expect(sql).toMatch(/tin_masked/);
    expect(sql).not.toMatch(/\btin_full\b/);
    expect(sql).not.toMatch(/password|client_secret|private_key/i);
  });

  it('is a draft: nothing in it applies itself or touches an account', () => {
    expect(sql).toMatch(/not applied/i);
    expect(sql).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|DROP|ATTACH)\b/im);
  });

  it('records the owner decisions and accounts the backend needs in QUEUE.md (open, or decided by the owner)', () => {
    const queue = read('../../docs/state/QUEUE.md');
    // The U19 item starts in "Open"; once the owner answers it, it moves to "Decided" (ADR-0002, 2026-10-28).
    const open = queue.slice(queue.indexOf('## Open'), queue.indexOf('## Proposals'));
    const decided = queue.slice(queue.indexOf('## Decided'));
    const section = open.includes('U19 Backend') ? open : decided;
    expect(section, 'the U19 backend item is in Open or Decided').toContain('U19 Backend');
    for (const need of ['Cloudflare account', 'Google OAuth client', 'BETTER_AUTH_SECRET', 'VAPID', 'FILE_URL_SIGNING_KEY', 'first owner']) {
      expect(section, need).toContain(need);
    }
  });
});
