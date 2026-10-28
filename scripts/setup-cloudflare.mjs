// The owner's setup script for the live Cloudflare and GitHub accounts (ADR-0002 section 4). Only the owner runs it, on their own
// machine; Claude Code writes and tests it with every outside call stubbed, and never runs it.
//
//   node scripts/setup-cloudflare.mjs                       phase 1, infrastructure: D1, R2, lifecycle rule, ids into wrangler.jsonc, GitHub
//   node scripts/setup-cloudflare.mjs --secrets             phase 2, secrets of the preview Worker (it must have been deployed once)
//   node scripts/setup-cloudflare.mjs --first-owner <email> phase 3, the first owner of the preview Demo organization
//   add --env production to phases 2 and 3 for the production Worker (after its first release); --dry-run prints the plan and calls nothing
//
// Every phase asks for the Cloudflare API token with hidden input (or reads CLOUDFLARE_API_TOKEN), passes it only to the commands it
// starts, and ends with `wrangler logout`: the laptop keeps no Cloudflare credentials. Secret values are generated here or typed
// hidden, travel on stdin to wrangler, and are never printed, logged or written to a file. Safe to run again: it creates what is
// missing and leaves the rest alone.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---- the names ADR-0002 fixes -----------------------------------------------------------------------------------------
export const DATABASES = { preview: 'ordinovix-preview', production: 'ordinovix' };
export const BUCKETS = { preview: 'ordinovix-preview-files', production: 'ordinovix-files' };
export const WORKERS = { preview: 'ordinovix-preview', production: 'ordinovix' };
export const BACKUP_RULE = { bucket: BUCKETS.production, id: 'backups-db-84d', prefix: 'backups/db/', days: 84 };
export const GENERATED_SECRETS = ['BETTER_AUTH_SECRET', 'FILE_URL_SIGNING_KEY', 'TIN_ENCRYPTION_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
export const TYPED_SECRETS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
export const ALL_SECRETS = [...GENERATED_SECRETS, ...TYPED_SECRETS];
const CALLBACK = '/api/auth/callback/google';

export class SetupError extends Error {}

// ---- arguments --------------------------------------------------------------------------------------------------------
export function parseArgs(argv) {
  const o = { phase: 'infra', env: 'preview', dryRun: false, rotate: [], help: false, wranglerConfig: 'wrangler.jsonc' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new SetupError(`${a} needs a value`);
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--secrets') o.phase = 'secrets';
    else if (a === '--first-owner') {
      o.phase = 'first-owner';
      o.email = value().trim().toLowerCase();
    } else if (a === '--env') o.env = value();
    else if (a === '--org') o.org = value();
    else if (a === '--org-name') o.orgName = value();
    else if (a === '--rotate') o.rotate.push(value());
    else if (a === '--config') o.wranglerConfig = value();
    else throw new SetupError(`Unknown option ${a}. Run with --help.`);
  }
  if (!['preview', 'production'].includes(o.env)) throw new SetupError('--env must be preview or production');
  for (const name of o.rotate) {
    if (!ALL_SECRETS.includes(name)) throw new SetupError(`--rotate ${name}: not a secret of this app (${ALL_SECRETS.join(', ')})`);
    if (name === 'TIN_ENCRYPTION_KEY') throw new SetupError('TIN_ENCRYPTION_KEY is never rotated here: every stored TIN would become unreadable.');
  }
  if (o.phase === 'first-owner') {
    const email = o.email;
    if (!email || !/^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || email.includes("'") || email.length > 254) {
      throw new SetupError('--first-owner needs a plain email address, the Google account of the first owner');
    }
    if (o.env === 'production' && !o.org) throw new SetupError('For production give the organization with --org <id> (and --org-name); the Demo organization is preview only');
  }
  return o;
}

export const USAGE = `Ordinovix Cloudflare setup (run by the owner)

  node scripts/setup-cloudflare.mjs                          phase 1: D1 databases, R2 buckets, backup lifecycle rule, database ids into
                                                             wrangler.jsonc, GitHub secrets and the production environment
  node scripts/setup-cloudflare.mjs --secrets                phase 2: generate and set the Worker secrets (preview Worker must exist)
  node scripts/setup-cloudflare.mjs --first-owner <email>    phase 3: make that Google account the first owner of the preview Demo organization
  options: --env preview|production (phases 2 and 3), --org <id> --org-name <name> (phase 3, production),
           --rotate <SECRET> (phase 2, replaces one secret; never TIN_ENCRYPTION_KEY), --dry-run (print the plan, call nothing)
Steps and order: docs/backend/DEPLOY.md`;

// ---- pure helpers -----------------------------------------------------------------------------------------------------
/** The origins and redirect URIs to register in the Google OAuth client, per environment. */
export function oauthOrigins(subdomain) {
  const hosts = {
    local: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    preview: [`https://${WORKERS.preview}.${subdomain}.workers.dev`],
    production: [`https://${WORKERS.production}.${subdomain}.workers.dev`],
  };
  return Object.entries(hosts).map(([name, origins]) => ({ name, origins, redirects: origins.map((o) => `${o}${CALLBACK}`) }));
}

export function oauthLines(subdomain) {
  const lines = ['Register these in your Google OAuth client (type: Web application):'];
  for (const { name, origins, redirects } of oauthOrigins(subdomain)) {
    lines.push(`  ${name}:`, ...origins.map((o) => `    Authorized JavaScript origin: ${o}`), ...redirects.map((r) => `    Authorized redirect URI:      ${r}`));
  }
  return lines;
}

/** Replaces the placeholder id of one database in wrangler.jsonc, keeping its comments and layout. */
export function setDatabaseId(text, databaseName, id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new SetupError(`"${id}" is not a database id`);
  const pattern = new RegExp(`("database_name"\\s*:\\s*"${databaseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*,\\s*"database_id"\\s*:\\s*")[^"]*(")`);
  if (!pattern.test(text)) throw new SetupError(`wrangler.jsonc has no d1 database named ${databaseName}`);
  return text.replace(pattern, `$1${id}$2`);
}

/** The first JSON array or object in command output that may have a banner line before it. */
export function parseJsonOutput(text) {
  const starts = ['[', '{'].map((c) => text.indexOf(c)).filter((i) => i > -1);
  if (starts.length === 0) throw new SetupError('The command printed no JSON');
  const from = Math.min(...starts);
  const open = text[from];
  const to = text.lastIndexOf(open === '[' ? ']' : '}');
  try {
    return JSON.parse(text.slice(from, to + 1));
  } catch {
    throw new SetupError('The command printed JSON that could not be read');
  }
}

/** Fresh values for the secrets the app generates itself; distinct on every call, so distinct per environment. */
export function generateSecrets(names = GENERATED_SECRETS) {
  const out = {};
  const b64 = (n) => randomBytes(n).toString('base64');
  if (names.includes('BETTER_AUTH_SECRET')) out.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');
  if (names.includes('FILE_URL_SIGNING_KEY')) out.FILE_URL_SIGNING_KEY = b64(32);
  if (names.includes('TIN_ENCRYPTION_KEY')) out.TIN_ENCRYPTION_KEY = b64(32);
  if (names.includes('VAPID_PUBLIC_KEY') || names.includes('VAPID_PRIVATE_KEY')) {
    // an ECDSA P-256 pair: public = uncompressed point (0x04 || x || y), private = the scalar d, both base64url
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const priv = privateKey.export({ format: 'jwk' });
    const pub = publicKey.export({ format: 'jwk' });
    out.VAPID_PUBLIC_KEY = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]).toString('base64url');
    out.VAPID_PRIVATE_KEY = priv.d;
  }
  return out;
}

// ---- the plan (what --dry-run prints) -----------------------------------------------------------------------------------
export function describePlan(o) {
  if (o.phase === 'infra') {
    return [
      'Phase 1, infrastructure. It would:',
      '  1. ask for your Cloudflare API token (hidden) and find the account id',
      '  2. read the account\'s workers.dev subdomain (and ask for one to register if there is none) and print the Google OAuth origins and redirect URIs',
      `  3. create the D1 databases ${DATABASES.preview} and ${DATABASES.production} if missing`,
      `  4. create the R2 buckets ${BUCKETS.preview} and ${BUCKETS.production} if missing`,
      `  5. add a lifecycle rule to ${BACKUP_RULE.bucket}: objects under ${BACKUP_RULE.prefix} expire after ${BACKUP_RULE.days} days`,
      `  6. write the real database ids into ${o.wranglerConfig}`,
      '  7. set the GitHub secrets CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID with gh',
      '  8. create the GitHub environment "production" with you as the required reviewer',
      '  9. run wrangler logout',
    ];
  }
  if (o.phase === 'secrets') {
    return [
      `Phase 2, secrets of the ${o.env} Worker (${WORKERS[o.env]}). It would:`,
      '  1. ask for your Cloudflare API token (hidden) and find the account id',
      '  2. print the Google OAuth origins and redirect URIs',
      `  3. list the secrets already on ${WORKERS[o.env]} (names only) and stop if the Worker has not been deployed yet`,
      `  4. generate ${GENERATED_SECRETS.join(', ')} with node:crypto, only the ones that are missing${o.rotate.length ? ` (and replace: ${o.rotate.join(', ')})` : ''}`,
      `  5. ask for ${TYPED_SECRETS.join(' and ')} (hidden), if missing`,
      '  6. send them to wrangler on stdin in one `wrangler secret bulk` call; nothing is printed or written',
      '  7. run wrangler logout',
    ];
  }
  return [
    `Phase 3, first owner of the ${o.env} ${o.env === 'preview' && !o.org ? 'Demo organization' : `organization ${o.org}`}. It would:`,
    '  1. ask for your Cloudflare API token (hidden) and find the account id',
    `  2. build the SQL with scripts/first-owner-sql.mjs for ${o.email}`,
    `  3. run it with wrangler d1 execute DB --remote --env ${o.env} from a temporary file, then delete the file`,
    '  4. run wrangler logout',
  ];
}

// ---- the phases ---------------------------------------------------------------------------------------------------------
const say = (ctx, ...lines) => lines.forEach((l) => ctx.deps.log(l));

async function getToken(ctx) {
  const given = ctx.deps.env.CLOUDFLARE_API_TOKEN;
  ctx.token = given || (await ctx.deps.prompt('Cloudflare API token (typing is hidden): ', { hidden: true }));
  if (!ctx.token) throw new SetupError('A Cloudflare API token is needed. Create one as described in docs/backend/DEPLOY.md.');
  return ctx.token;
}

async function api(ctx, path, init) {
  const res = await ctx.deps.fetchJson(path, { token: ctx.token, ...init });
  if (!res || res.success === false) {
    const message = res?.errors?.map((e) => e.message).join('; ') || 'the Cloudflare API refused the request';
    throw new SetupError(`${message} (${path}). Check the token's permissions in docs/backend/DEPLOY.md.`);
  }
  return res.result;
}

async function getAccount(ctx) {
  if (ctx.deps.env.CLOUDFLARE_ACCOUNT_ID) return (ctx.accountId = ctx.deps.env.CLOUDFLARE_ACCOUNT_ID);
  const accounts = await api(ctx, '/accounts');
  if (!Array.isArray(accounts) || accounts.length === 0) throw new SetupError('This token can see no Cloudflare account. It needs the account permissions listed in docs/backend/DEPLOY.md.');
  if (accounts.length === 1) return (ctx.accountId = accounts[0].id);
  say(ctx, 'This token can see several accounts:', ...accounts.map((a, i) => `  ${i + 1}. ${a.name}`));
  const pick = Number(await ctx.deps.prompt('Which account? (number) ', { hidden: false }));
  if (!accounts[pick - 1]) throw new SetupError('That is not one of the numbers above');
  return (ctx.accountId = accounts[pick - 1].id);
}

/** wrangler and gh commands. The Cloudflare token reaches only the commands that need it, through the environment. */
const wrangler = (ctx, args, o = {}) =>
  ctx.deps.run('npx', ['wrangler', ...args], { env: { CLOUDFLARE_API_TOKEN: ctx.token, CLOUDFLARE_ACCOUNT_ID: ctx.accountId }, capture: true, ...o });
const gh = (ctx, args, o = {}) => ctx.deps.run('gh', args, { capture: true, ...o });

const fail = (what, r) => new SetupError(`${what} failed (exit ${r.code}). ${String(r.stderr || r.stdout || '').trim().split('\n').slice(-4).join(' | ').slice(0, 500)}`);
const r2Hint = (r) => (/enable R2|10042|payment|subscribe/i.test(`${r.stderr}${r.stdout}`) ? ' R2 must be switched on first in the Cloudflare dashboard (R2 may ask for a card; see docs/backend/DEPLOY.md).' : '');

async function getSubdomain(ctx, { mayCreate }) {
  const path = `/accounts/${ctx.accountId}/workers/subdomain`;
  let sub;
  try {
    sub = (await api(ctx, path))?.subdomain;
  } catch (e) {
    if (!mayCreate) throw e;
  }
  if (sub) return sub;
  if (!mayCreate) throw new SetupError('The account has no workers.dev subdomain yet. Run phase 1 first.');
  say(ctx, 'The account has no workers.dev subdomain yet. Your sites will be https://<worker>.<subdomain>.workers.dev.');
  const wanted = (await ctx.deps.prompt('Subdomain to register (letters, digits, dashes): ', { hidden: false })).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,60}[a-z0-9]$/.test(wanted)) throw new SetupError('A subdomain is letters, digits and dashes, like jan-santos');
  return (await api(ctx, path, { method: 'PUT', body: { subdomain: wanted } }))?.subdomain ?? wanted;
}

async function databaseIds(ctx) {
  const r = await wrangler(ctx, ['d1', 'list', '--json']);
  if (r.code !== 0) throw fail('Listing the D1 databases', r);
  const ids = {};
  for (const d of parseJsonOutput(r.stdout)) ids[d.name] = d.uuid ?? d.id;
  return ids;
}

export async function runInfra(ctx) {
  const o = ctx.opts;
  await getToken(ctx);
  await getAccount(ctx);
  say(ctx, `Account ${ctx.accountId}.`);

  const sub = await getSubdomain(ctx, { mayCreate: true });
  say(ctx, '', `Your workers.dev subdomain is "${sub}".`, ...oauthLines(sub), '');

  // D1
  let ids = await databaseIds(ctx);
  for (const name of Object.values(DATABASES)) {
    if (ids[name]) {
      say(ctx, `D1 ${name}: exists`);
      continue;
    }
    const r = await wrangler(ctx, ['d1', 'create', name]);
    if (r.code !== 0 && !/already exists/i.test(`${r.stderr}${r.stdout}`)) throw fail(`Creating the D1 database ${name}`, r);
    say(ctx, `D1 ${name}: created`);
    ids = await databaseIds(ctx);
  }

  // R2
  for (const name of Object.values(BUCKETS)) {
    const r = await wrangler(ctx, ['r2', 'bucket', 'create', name]);
    if (r.code === 0) say(ctx, `R2 ${name}: created`);
    else if (/already exists|10004/i.test(`${r.stderr}${r.stdout}`)) say(ctx, `R2 ${name}: exists`);
    else throw new SetupError(`${fail(`Creating the R2 bucket ${name}`, r).message}${r2Hint(r)}`);
  }
  const rules = await wrangler(ctx, ['r2', 'bucket', 'lifecycle', 'list', BACKUP_RULE.bucket]);
  if (rules.code === 0 && `${rules.stdout}`.includes(BACKUP_RULE.id)) {
    say(ctx, `R2 lifecycle rule ${BACKUP_RULE.id}: exists`);
  } else {
    const r = await wrangler(ctx, ['r2', 'bucket', 'lifecycle', 'add', BACKUP_RULE.bucket, BACKUP_RULE.id, BACKUP_RULE.prefix, '--expire-days', String(BACKUP_RULE.days), '--force']);
    if (r.code !== 0) throw fail('Adding the backup lifecycle rule', r);
    say(ctx, `R2 lifecycle rule ${BACKUP_RULE.id}: ${BACKUP_RULE.prefix} expires after ${BACKUP_RULE.days} days`);
  }

  // wrangler.jsonc
  let text = ctx.deps.readText(o.wranglerConfig);
  for (const name of Object.values(DATABASES)) text = setDatabaseId(text, name, ids[name]);
  ctx.deps.writeText(o.wranglerConfig, text);
  say(ctx, `${o.wranglerConfig}: database ids written (they are identifiers, not secrets)`);

  // GitHub
  const auth = await gh(ctx, ['auth', 'status']);
  if (auth.code !== 0) throw new SetupError('gh is not signed in. Run `gh auth login`, then run this phase again.');
  const repo = String((await gh(ctx, ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'])).stdout).trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new SetupError('Run this from a clone of the GitHub repository (gh could not tell which one it is)');
  for (const [name, value] of [['CLOUDFLARE_API_TOKEN', ctx.token], ['CLOUDFLARE_ACCOUNT_ID', ctx.accountId]]) {
    const r = await gh(ctx, ['secret', 'set', name, '--repo', repo], { input: value });
    if (r.code !== 0) throw fail(`Setting the GitHub secret ${name}`, r);
    say(ctx, `GitHub secret ${name}: set on ${repo}`);
  }
  const me = String((await gh(ctx, ['api', 'user', '-q', '.id'])).stdout).trim();
  if (!/^\d+$/.test(me)) throw new SetupError('gh could not tell who you are');
  const env = await gh(ctx, ['api', '--method', 'PUT', `repos/${repo}/environments/production`, '--input', '-'], {
    // the owner is the only reviewer, so approving their own release must be allowed
    input: JSON.stringify({ reviewers: [{ type: 'User', id: Number(me) }], prevent_self_review: false }),
  });
  if (env.code !== 0) throw fail('Creating the GitHub environment "production"', env);
  say(ctx, 'GitHub environment "production": you are the required reviewer');

  say(
    ctx,
    '',
    'Phase 1 is done. Next (docs/backend/DEPLOY.md):',
    `  1. commit ${o.wranglerConfig} on a branch, open a pull request and merge it; deploy-preview then creates the preview Worker`,
    '  2. create the Google OAuth client with the values printed above',
    '  3. node scripts/setup-cloudflare.mjs --secrets',
    '  4. node scripts/setup-cloudflare.mjs --first-owner <your Google email>',
  );
}

export async function runSecrets(ctx) {
  const o = ctx.opts;
  const worker = WORKERS[o.env];
  await getToken(ctx);
  await getAccount(ctx);
  const sub = await getSubdomain(ctx, { mayCreate: false });
  say(ctx, ...oauthLines(sub), '');

  const listed = await wrangler(ctx, ['secret', 'list', '--env', o.env]);
  if (listed.code !== 0) {
    if (/not found|does not exist|doesn't exist|10007/i.test(`${listed.stderr}${listed.stdout}`)) {
      throw new SetupError(`The Worker ${worker} does not exist yet. Secrets can only be set on a deployed Worker: ${o.env === 'preview' ? 'merge the pull request with the database ids and let deploy-preview finish' : 'release production once (docs/backend/DEPLOY.md)'}, then run this again.`);
    }
    throw fail('Listing the secrets', listed);
  }
  const have = new Set(parseJsonOutput(listed.stdout).map((s) => s.name));
  const rotate = new Set(o.rotate);
  const needed = (name) => !have.has(name) || rotate.has(name);

  const values = {};
  const vapidPair = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
  const wanted = GENERATED_SECRETS.filter((n) => (vapidPair.includes(n) ? vapidPair.some(needed) : needed(n)));
  Object.assign(values, generateSecrets(wanted));
  for (const name of TYPED_SECRETS.filter(needed)) {
    const typed = (await ctx.deps.prompt(`${name} (typing is hidden): `, { hidden: true })).trim();
    if (!typed) throw new SetupError(`${name} is needed`);
    values[name] = typed;
  }

  const set = Object.keys(values);
  if (set.length > 0) {
    const r = await wrangler(ctx, ['secret', 'bulk', '--env', o.env], { input: JSON.stringify(values) });
    if (r.code !== 0) throw fail('Setting the secrets', r);
  }
  say(
    ctx,
    set.length ? `Set on ${worker}: ${set.join(', ')}` : `Nothing to set on ${worker}: all ${ALL_SECRETS.length} secrets are there.`,
    ...(ALL_SECRETS.filter((n) => !set.includes(n)).length ? [`Left alone (already set): ${ALL_SECRETS.filter((n) => !set.includes(n)).join(', ')}`] : []),
    'The values were not printed. Cloudflare cannot show them again; TIN_ENCRYPTION_KEY must never be lost or replaced.',
  );
}

export async function runFirstOwner(ctx) {
  const o = ctx.opts;
  await getToken(ctx);
  await getAccount(ctx);
  const sqlArgs = ['scripts/first-owner-sql.mjs', '--email', o.email, ...(o.org ? ['--org', o.org] : []), ...(o.orgName ? ['--org-name', o.orgName] : [])];
  const built = await ctx.deps.run('node', sqlArgs, { capture: true });
  if (built.code !== 0) throw fail('Building the first-owner SQL', built);
  const dir = mkdtempSync(join(tmpdir(), 'ordinovix-first-owner-'));
  const file = join(dir, 'first-owner.sql');
  try {
    ctx.deps.writeText(file, built.stdout);
    const r = await wrangler(ctx, ['d1', 'execute', 'DB', '--remote', '--env', o.env, '--file', file]);
    if (r.code !== 0) throw fail(`Running the first-owner SQL on ${DATABASES[o.env]}`, r);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  say(ctx, `${o.email} is now the owner of ${o.org ?? 'the Demo organization'} on ${DATABASES[o.env]}. They are linked at their first Google sign-in.`);
}

// ---- main ---------------------------------------------------------------------------------------------------------------
export async function main(argv, deps = defaultDeps()) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    deps.log(e.message);
    return 2;
  }
  if (opts.help) {
    deps.log(USAGE);
    return 0;
  }
  if (opts.dryRun) {
    describePlan(opts).forEach((l) => deps.log(l));
    deps.log('', 'Dry run: nothing was asked, called, written or changed.');
    return 0;
  }
  const ctx = { deps, opts };
  let code = 0;
  try {
    await { infra: runInfra, secrets: runSecrets, 'first-owner': runFirstOwner }[opts.phase](ctx);
  } catch (e) {
    deps.log(e instanceof SetupError ? e.message : `Unexpected error: ${e.message}`);
    code = 1;
  } finally {
    // the laptop keeps no Cloudflare credentials, whether or not the phase worked
    try {
      await deps.run('npx', ['wrangler', 'logout'], { capture: true });
      deps.log('Signed out of wrangler on this machine.');
    } catch {
      deps.log('Could not run wrangler logout. Run `npx wrangler logout` yourself.');
    }
  }
  return code;
}

// ---- the real world (replaced by stubs in the tests) ----------------------------------------------------------------------
const quote = (a) => (process.platform === 'win32' && /[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

function runCommand(cmd, args, { env = {}, input, capture = false } = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(cmd, args.map(quote), {
      env: { ...process.env, ...env },
      shell: process.platform === 'win32', // npx and gh are .cmd/.exe shims on Windows
      stdio: [input === undefined ? 'inherit' : 'pipe', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d));
    child.stderr?.on('data', (d) => (stderr += d));
    child.on('error', (e) => resolveRun({ code: 127, stdout, stderr: `${stderr}${e.message}` }));
    child.on('close', (code) => resolveRun({ code: code ?? 1, stdout, stderr }));
    if (input !== undefined) child.stdin.end(input);
  });
}

function promptLine(question, { hidden }) {
  return new Promise((resolvePrompt, reject) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    if (!hidden || !stdin.isTTY) {
      stdin.setEncoding('utf8');
      stdin.resume();
      let buffer = '';
      const onData = (chunk) => {
        buffer += chunk;
        const nl = buffer.indexOf('\n');
        if (nl > -1) {
          stdin.off('data', onData);
          stdin.pause();
          resolvePrompt(buffer.slice(0, nl).replace(/\r$/, ''));
        }
      };
      stdin.on('data', onData);
      return;
    }
    // hidden: read key by key and echo nothing
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let typed = '';
    const onKey = (key) => {
      for (const ch of key) {
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          stdin.off('data', onKey);
          reject(new SetupError('Cancelled'));
          return;
        }
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.off('data', onKey);
          stdin.pause();
          stdout.write('\n');
          resolvePrompt(typed);
          return;
        }
        if (ch === '\u007f' || ch === '\b') typed = typed.slice(0, -1);
        else typed += ch;
      }
    };
    stdin.on('data', onKey);
  });
}

async function fetchCloudflare(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json();
}

export function defaultDeps() {
  return {
    run: runCommand,
    fetchJson: fetchCloudflare,
    prompt: promptLine,
    readText: (path) => readFileSync(path, 'utf8'),
    writeText: (path, text) => writeFileSync(path, text, { mode: 0o600 }),
    log: (...lines) => lines.forEach((l) => console.log(l)),
    env: process.env,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
