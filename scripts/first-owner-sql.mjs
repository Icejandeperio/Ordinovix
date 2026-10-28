// Prints the SQL that makes one Google account the first owner of an organization.
// Usage: npm run --silent db:first-owner-sql -- --email <address> [--org <id>] [--org-name <name>]
// Nothing here talks to a database: the owner runs the output against the live database later (see docs/backend/DEPLOY.md),
// for example `npm run --silent db:first-owner-sql -- --email me@example.org > first-owner.sql`, then
// `npx wrangler d1 execute DB --remote --env preview --file first-owner.sql` from the setup script.
//
// - --org defaults to org-demo-01, the Demo organization the preview is seeded with. Any other id creates that
//   organization (and its default settings) if it does not exist yet, flagged as not a demo: use it for production.
// - The membership is an allowlist entry for the email address. The person is linked on their first Google sign-in.
// - Safe to run again: it restores a revoked or removed owner entry and changes nothing else.
// - One statement per line, no comments, so any executor can run it.
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : undefined;
};

const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const email = option('--email')?.trim().toLowerCase();
if (!email) fail('--email <address> is required (the Google account of the first owner)');
if (!/^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || email.includes("'") || email.length > 254) {
  fail('--email must be a plain email address like owner@example.org');
}
const orgId = option('--org') ?? 'org-demo-01';
if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(orgId)) fail('--org must be lowercase letters, digits and dashes, like org-demo-01');
const isDemo = orgId === 'org-demo-01';
const orgName = option('--org-name') ?? (isDemo ? 'Demo practice' : 'My practice');
if (orgName.length > 120 || /[\r\n]/.test(orgName)) fail('--org-name must be one line of at most 120 characters');

// "now" in Asia/Manila as an ISO 8601 timestamp with +08:00 (overridable so the output can be tested)
const pad = (n) => String(n).padStart(2, '0');
const manilaNow = () => {
  const d = new Date(Date.now() + 8 * 3600_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+08:00`;
};
const now = option('--now') ?? manilaNow();

const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const digest = createHash('sha256').update(`${orgId}|${email}`).digest('hex').slice(0, 10);
const membershipId = `mem-owner-${digest}`;

const statements = [
  `INSERT INTO orgs (id, name, is_demo, created_at) VALUES (${q(orgId)}, ${q(orgName)}, ${isDemo ? 1 : 0}, ${q(now)}) ON CONFLICT(id) DO NOTHING;`,
  `INSERT INTO org_settings (org_id, practice_name, operator_display_name, updated_at) VALUES (${q(orgId)}, ${q(orgName)}, 'Owner', ${q(now)}) ON CONFLICT(org_id) DO NOTHING;`,
  `INSERT INTO memberships (id, org_id, email, user_id, role, active, invited_at, created_at, created_by, updated_at, updated_by) VALUES (${q(membershipId)}, ${q(orgId)}, ${q(email)}, NULL, 'owner', 1, ${q(now)}, ${q(now)}, 'system', ${q(now)}, 'system') ON CONFLICT(org_id, email) DO UPDATE SET role = 'owner', active = 1, revoked_at = NULL, deleted_at = NULL, deleted_reason = NULL, updated_at = excluded.updated_at, updated_by = 'system', version = memberships.version + 1;`,
  `INSERT INTO activity (id, org_id, at, actor_id, entity, entity_id, action, summary) VALUES (${q(`act-first-owner-${digest}-${now}`)}, ${q(orgId)}, ${q(now)}, 'system', 'membership', ${q(membershipId)}, 'access_granted', ${q(`Owner access granted to ${email} (first owner setup)`)}) ON CONFLICT(id) DO NOTHING;`,
];

process.stdout.write(statements.join('\n') + '\n');
