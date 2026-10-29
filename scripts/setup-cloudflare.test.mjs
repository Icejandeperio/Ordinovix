import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  ALL_SECRETS,
  BACKUP_RULE,
  BUCKETS,
  DATABASES,
  generateSecrets,
  main,
  oauthLines,
  parseArgs,
  parseJsonOutput,
  setDatabaseId,
} from './setup-cloudflare.mjs';

/**
 * U31: the owner's setup script, run here with every outside call stubbed: the command runner (wrangler, gh, node), the Cloudflare
 * API, the prompts and the file system. Nothing here reaches Cloudflare, GitHub or Google, and the real scripts/ files are only read.
 */
// The repository's wrangler.jsonc as a fresh checkout has it: once the owner has run phase 1 it holds real ids, so they are reset to
// the placeholder here and the tests do not depend on the owner's account.
const REAL_CONFIG = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(/("database_id"\s*:\s*")[^"]*(")/g, '$100000000-0000-0000-0000-000000000000$2');
const TOKEN = 'cf-test-token-ABC123-never-print-me';
const GOOGLE_ID = 'google-client-id-12345.apps.googleusercontent.com';
const GOOGLE_SECRET = 'GOCSPX-test-google-secret-never-print-me';
const uuid = (n) => `${String(n).repeat(8)}-1111-4111-8111-${String(n).repeat(12)}`;

function world(options = {}) {
  const w = {
    timeline: [], // ordered: { kind: 'log' | 'prompt' | 'run' | 'fetch' | 'write', ... }
    runs: [],
    logs: [],
    prompts: [],
    writes: {},
    files: { 'wrangler.jsonc': REAL_CONFIG },
    databases: options.databases ?? {}, // name -> uuid
    buckets: new Set(options.buckets ?? []),
    rules: options.rules ?? '',
    secrets: { preview: options.secrets?.preview, production: options.secrets?.production }, // arrays of names; undefined = no Worker
    subdomain: options.subdomain === undefined ? 'jan-santos' : options.subdomain,
    accounts: options.accounts ?? [{ id: 'acct-0001', name: 'Jan' }],
    r2Enabled: options.r2Enabled ?? true,
    ghSignedIn: options.ghSignedIn ?? true,
    answers: { token: TOKEN, googleId: GOOGLE_ID, googleSecret: GOOGLE_SECRET, subdomain: 'new-sub', account: '1', ...options.answers },
    executedSql: [],
    fetches: [],
    tempFileSeen: undefined,
  };
  let next = 1;

  const reply = (stdout = '', code = 0, stderr = '') => ({ code, stdout, stderr });
  const handleRun = (cmd, args, o) => {
    const line = args.join(' ');
    if (cmd === 'npx' && args[0] === 'wrangler') {
      const rest = args.slice(1);
      const joined = rest.join(' ');
      if (joined === 'logout') return reply('Not logged in');
      if (joined === 'd1 list --json') return reply(`⛅️ wrangler 4.151.3\n${JSON.stringify(Object.entries(w.databases).map(([name, id]) => ({ uuid: id, name })))}`);
      if (rest[0] === 'd1' && rest[1] === 'create') {
        if (w.databases[rest[2]]) return reply('', 1, 'A database with that name already exists');
        w.databases[rest[2]] = uuid(next++);
        return reply('✅ Successfully created DB');
      }
      if (joined.startsWith('r2 bucket create')) {
        if (!w.r2Enabled) return reply('', 1, 'Please enable R2 through the Cloudflare Dashboard. [code: 10042]');
        if (w.buckets.has(rest[3])) return reply('', 1, 'The bucket you tried to create already exists [code: 10004]');
        w.buckets.add(rest[3]);
        return reply('Created bucket');
      }
      if (joined.startsWith('r2 bucket lifecycle list')) return reply(w.rules);
      if (joined.startsWith('r2 bucket lifecycle add')) {
        w.rules += `${rest[4]} ${rest[5]}\n`;
        return reply('Added rule');
      }
      if (rest[0] === 'secret' && rest[1] === 'list') {
        const env = rest[rest.indexOf('--env') + 1];
        if (!w.secrets[env]) return reply('', 1, `This Worker does not exist on your account. [code: 10007]`);
        return reply(JSON.stringify(w.secrets[env].map((name) => ({ name, type: 'secret_text' }))));
      }
      if (rest[0] === 'secret' && rest[1] === 'bulk') {
        const env = rest[rest.indexOf('--env') + 1];
        const values = JSON.parse(o.input);
        w.secrets[env] = [...new Set([...(w.secrets[env] ?? []), ...Object.keys(values)])];
        (w.bulk ??= []).push({ env, values });
        return reply('Success');
      }
      if (rest[0] === 'd1' && rest[1] === 'execute') {
        const file = rest[rest.indexOf('--file') + 1];
        w.tempFileSeen = file;
        w.executedSql.push({ args: rest, sql: readFileSync(file, 'utf8') });
        return reply('Executed');
      }
    }
    if (cmd === 'gh') {
      if (line === 'auth status') return w.ghSignedIn ? reply('Logged in') : reply('', 1, 'not logged in');
      if (line.startsWith('repo view')) return reply('icejan/ordinovix\n');
      if (line === 'api user -q .id') return reply('424242\n');
      if (args[0] === 'secret' && args[1] === 'set') {
        (w.ghSecrets ??= {})[args[2]] = o.input;
        return reply('');
      }
      if (args[0] === 'api' && args.includes('PUT')) {
        w.environment = { path: args[args.indexOf('PUT') + 1], body: JSON.parse(o.input) };
        return reply('{}');
      }
    }
    if (cmd === 'node' && args[0] === 'scripts/first-owner-sql.mjs') {
      return reply(`INSERT INTO memberships (id) VALUES ('mem-owner-${args[2]}');\n`);
    }
    return reply('', 99, `unexpected command: ${cmd} ${line}`);
  };

  const deps = {
    env: { ...(options.env ?? {}) },
    log: (...lines) => lines.forEach((l) => (w.logs.push(l), w.timeline.push({ kind: 'log', text: l }))),
    prompt: async (question, { hidden }) => {
      w.prompts.push({ question, hidden });
      w.timeline.push({ kind: 'prompt', question, hidden });
      if (/token/i.test(question)) return w.answers.token;
      if (/GOOGLE_CLIENT_ID/.test(question)) return w.answers.googleId;
      if (/GOOGLE_CLIENT_SECRET/.test(question)) return w.answers.googleSecret;
      if (/Subdomain/i.test(question)) return w.answers.subdomain;
      if (/account/i.test(question)) return w.answers.account;
      throw new Error(`unexpected prompt: ${question}`);
    },
    run: async (cmd, args, o = {}) => {
      w.runs.push({ cmd, args, input: o.input, env: o.env });
      w.timeline.push({ kind: 'run', cmd, args });
      return handleRun(cmd, args, o);
    },
    fetchJson: async (path, o = {}) => {
      w.fetches.push({ path, ...o });
      w.timeline.push({ kind: 'fetch', path });
      if (path === '/accounts') return { success: true, result: w.accounts };
      if (path.endsWith('/workers/subdomain')) {
        if (o.method === 'PUT') {
          w.subdomain = o.body.subdomain;
          return { success: true, result: { subdomain: w.subdomain } };
        }
        return { success: true, result: { subdomain: w.subdomain } };
      }
      return { success: false, errors: [{ message: 'unexpected path' }] };
    },
    readText: (path) => {
      w.timeline.push({ kind: 'read', path });
      return w.files[path];
    },
    writeText: (path, text) => {
      w.timeline.push({ kind: 'write', path });
      if (path === 'wrangler.jsonc') w.files[path] = text;
      else {
        // the SQL file lives in a real temporary directory, which the script removes itself
        w.writes[path] = text;
        writeFileSync(path, text);
      }
    },
  };
  return { w, deps };
}

const wranglerCalls = (w, prefix) => w.runs.filter((r) => r.cmd === 'npx' && r.args.slice(1).join(' ').startsWith(prefix));
const everythingPrinted = (w) => JSON.stringify([w.logs, w.runs.map((r) => [r.cmd, r.args]), w.prompts, w.fetches.map((f) => [f.path, f.method])]);

describe('arguments', () => {
  it('reads each phase, and refuses what it does not know', () => {
    expect(parseArgs([]).phase).toBe('infra');
    expect(parseArgs(['--secrets'])).toMatchObject({ phase: 'secrets', env: 'preview' });
    expect(parseArgs(['--secrets', '--env', 'production', '--rotate', 'BETTER_AUTH_SECRET'])).toMatchObject({ env: 'production', rotate: ['BETTER_AUTH_SECRET'] });
    expect(parseArgs(['--first-owner', ' Jan@Example.org '])).toMatchObject({ phase: 'first-owner', email: 'jan@example.org', env: 'preview' });
    expect(() => parseArgs(['--deploy'])).toThrow(/Unknown option/);
    expect(() => parseArgs(['--env', 'staging'])).toThrow(/preview or production/);
    expect(() => parseArgs(['--first-owner'])).toThrow(/needs a value/);
    expect(() => parseArgs(['--first-owner', "o'brien@example.org"])).toThrow(/plain email/);
    expect(() => parseArgs(['--first-owner', 'jan@example.org', '--env', 'production'])).toThrow(/--org/);
    expect(() => parseArgs(['--secrets', '--rotate', 'TIN_ENCRYPTION_KEY'])).toThrow(/never rotated/);
    expect(() => parseArgs(['--secrets', '--rotate', 'NOT_A_SECRET'])).toThrow(/not a secret/);
  });

  it('exits 2 with a message on a bad argument, and calls nothing', async () => {
    const { w, deps } = world();
    expect(await main(['--nonsense'], deps)).toBe(2);
    expect(w.runs).toHaveLength(0);
    expect(w.logs.join('\n')).toMatch(/Unknown option/);
  });
});

describe('--dry-run', () => {
  for (const argv of [[], ['--secrets'], ['--secrets', '--env', 'production'], ['--first-owner', 'jan@example.org']]) {
    it(`prints the plan and calls nothing: ${argv.join(' ') || 'phase 1'}`, async () => {
      const { w, deps } = world();
      expect(await main([...argv, '--dry-run'], deps)).toBe(0);
      expect(w.runs).toHaveLength(0); // no wrangler, gh or node, not even wrangler logout
      expect(w.fetches).toHaveLength(0);
      expect(w.prompts).toHaveLength(0);
      expect(w.timeline.filter((t) => ['read', 'write'].includes(t.kind))).toHaveLength(0);
      expect(w.logs.join('\n')).toMatch(/Phase [123]/);
      expect(w.logs.join('\n')).toMatch(/Dry run: nothing was asked/);
    });
  }

  it('names what phase 1 would create', async () => {
    const { w, deps } = world();
    await main(['--dry-run'], deps);
    const plan = w.logs.join('\n');
    for (const name of [...Object.values(DATABASES), ...Object.values(BUCKETS), 'backups/db/', '84 days', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', '"production"', 'wrangler logout']) {
      expect(plan, name).toContain(name);
    }
  });
});

describe('phase 1: infrastructure', () => {
  it('creates the databases, buckets and lifecycle rule, writes the ids, sets the GitHub secrets and the production reviewer', async () => {
    const { w, deps } = world();
    expect(await main([], deps)).toBe(0);

    expect(wranglerCalls(w, 'd1 create').map((r) => r.args[3])).toEqual(['ordinovix-preview', 'ordinovix']);
    expect(wranglerCalls(w, 'r2 bucket create').map((r) => r.args[4])).toEqual(['ordinovix-preview-files', 'ordinovix-files']);
    expect(wranglerCalls(w, 'r2 bucket lifecycle add').map((r) => r.args.slice(1))).toEqual([
      ['r2', 'bucket', 'lifecycle', 'add', 'ordinovix-files', 'backups-db-84d', 'backups/db/', '--expire-days', '84', '--force'],
    ]);

    // the real ids are in wrangler.jsonc for preview and production; local keeps its placeholder; comments and layout stay
    const config = w.files['wrangler.jsonc'];
    expect(config).toContain(`"database_name": "ordinovix-preview", "database_id": "${w.databases['ordinovix-preview']}"`);
    expect(config).toContain(`"database_name": "ordinovix", "database_id": "${w.databases.ordinovix}"`);
    expect(config).toContain('"database_name": "ordinovix-local", "database_id": "00000000-0000-0000-0000-000000000000"');
    expect(config.replace(/"database_id": "[^"]*"/g, '')).toBe(REAL_CONFIG.replace(/"database_id": "[^"]*"/g, ''));

    // GitHub: the token and account id go to gh on stdin, the reviewer is the signed-in user, and may approve their own release
    expect(w.ghSecrets).toEqual({ CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: 'acct-0001' });
    expect(w.environment.path).toBe('repos/icejan/ordinovix/environments/production');
    expect(w.environment.body).toEqual({ reviewers: [{ type: 'User', id: 424242 }], prevent_self_review: false });
  });

  it('prints the Google OAuth origins and redirect URIs for local, preview and production from the account subdomain', async () => {
    const { w, deps } = world();
    await main([], deps);
    const text = w.logs.join('\n');
    for (const line of [
      'http://localhost:5173',
      'http://127.0.0.1:5173/api/auth/callback/google',
      'https://ordinovix-preview.jan-santos.workers.dev',
      'https://ordinovix-preview.jan-santos.workers.dev/api/auth/callback/google',
      'https://ordinovix.jan-santos.workers.dev',
      'https://ordinovix.jan-santos.workers.dev/api/auth/callback/google',
    ]) {
      expect(text, line).toContain(line);
    }
    expect(oauthLines('abc').join('\n')).toContain('https://ordinovix.abc.workers.dev/api/auth/callback/google');
  });

  it('registers a workers.dev subdomain when the account has none', async () => {
    const { w, deps } = world({ subdomain: null });
    expect(await main([], deps)).toBe(0);
    expect(w.fetches.find((f) => f.method === 'PUT')).toMatchObject({ body: { subdomain: 'new-sub' } });
    expect(w.logs.join('\n')).toContain('https://ordinovix-preview.new-sub.workers.dev');
  });

  it('is safe to run again: nothing is created twice and the file does not change', async () => {
    const first = world();
    await main([], first.deps);
    const again = world({ databases: first.w.databases, buckets: [...first.w.buckets], rules: first.w.rules });
    again.w.files['wrangler.jsonc'] = first.w.files['wrangler.jsonc'];
    expect(await main([], again.deps)).toBe(0);
    expect(wranglerCalls(again.w, 'd1 create')).toHaveLength(0);
    expect(wranglerCalls(again.w, 'r2 bucket lifecycle add')).toHaveLength(0);
    expect(again.w.files['wrangler.jsonc']).toBe(first.w.files['wrangler.jsonc']);
    expect(again.w.logs.join('\n')).toMatch(/D1 ordinovix: exists/);
    expect(again.w.logs.join('\n')).toMatch(/R2 ordinovix-files: exists/);
  });

  it('tells the owner to switch R2 on when the account has not', async () => {
    const { w, deps } = world({ r2Enabled: false });
    expect(await main([], deps)).toBe(1);
    expect(w.logs.join('\n')).toMatch(/R2 must be switched on first/);
    expect(w.files['wrangler.jsonc']).toBe(REAL_CONFIG); // nothing half-written
    expect(w.ghSecrets).toBeUndefined();
  });

  it('stops before changing GitHub when gh is not signed in', async () => {
    const { w, deps } = world({ ghSignedIn: false });
    expect(await main([], deps)).toBe(1);
    expect(w.logs.join('\n')).toMatch(/gh auth login/);
    expect(w.ghSecrets).toBeUndefined();
  });

  it('asks which account when the token sees several', async () => {
    const { w, deps } = world({ accounts: [{ id: 'acct-A', name: 'A' }, { id: 'acct-B', name: 'B' }], answers: { account: '2' } });
    await main([], deps);
    expect(w.ghSecrets.CLOUDFLARE_ACCOUNT_ID).toBe('acct-B');
  });

  it('uses CLOUDFLARE_API_TOKEN from the environment instead of asking', async () => {
    const { w, deps } = world({ env: { CLOUDFLARE_API_TOKEN: TOKEN } });
    await main([], deps);
    expect(w.prompts.some((p) => /token/i.test(p.question))).toBe(false);
  });
});

describe('phase 2: secrets', () => {
  it('prints the OAuth values first, then asks for the Google client id and secret hidden', async () => {
    const { w, deps } = world({ secrets: { preview: [] } });
    expect(await main(['--secrets'], deps)).toBe(0);
    const firstOrigins = w.timeline.findIndex((t) => t.kind === 'log' && t.text.includes('/api/auth/callback/google'));
    const firstGoogleAsk = w.timeline.findIndex((t) => t.kind === 'prompt' && /GOOGLE_CLIENT_ID/.test(t.question));
    expect(firstOrigins).toBeGreaterThan(-1);
    expect(firstGoogleAsk).toBeGreaterThan(firstOrigins);
    expect(w.prompts.filter((p) => /token|GOOGLE/i.test(p.question)).every((p) => p.hidden)).toBe(true);
  });

  it('generates every secret of ADR-0002 in the right shape and sets them with one wrangler call, never printing them', async () => {
    const { w, deps } = world({ secrets: { preview: [] } });
    expect(await main(['--secrets'], deps)).toBe(0);
    expect(w.bulk).toHaveLength(1);
    const { env, values } = w.bulk[0];
    expect(env).toBe('preview');
    expect(Object.keys(values).sort()).toEqual([...ALL_SECRETS].sort());
    expect(values.GOOGLE_CLIENT_ID).toBe(GOOGLE_ID);
    expect(values.GOOGLE_CLIENT_SECRET).toBe(GOOGLE_SECRET);
    expect(Buffer.from(values.TIN_ENCRYPTION_KEY, 'base64')).toHaveLength(32);
    expect(Buffer.from(values.FILE_URL_SIGNING_KEY, 'base64')).toHaveLength(32);
    expect(values.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(43);
    const pub = Buffer.from(values.VAPID_PUBLIC_KEY, 'base64url');
    expect(pub).toHaveLength(65);
    expect(pub[0]).toBe(4);
    expect(Buffer.from(values.VAPID_PRIVATE_KEY, 'base64url')).toHaveLength(32);

    // not one value appears in anything printed, passed as an argument or typed into a prompt text
    const seen = everythingPrinted(w);
    for (const value of Object.values(values)) expect(seen).not.toContain(value);
    expect(seen).not.toContain(TOKEN);
    // they travel on stdin only
    expect(w.runs.filter((r) => r.input?.includes(values.BETTER_AUTH_SECRET))).toHaveLength(1);
    expect(w.logs.join('\n')).toMatch(/Set on ordinovix-preview: .*TIN_ENCRYPTION_KEY/);
  });

  it('gives each environment its own values', async () => {
    const a = world({ secrets: { preview: [], production: [] } });
    await main(['--secrets'], a.deps);
    await main(['--secrets', '--env', 'production'], a.deps);
    const [preview, production] = a.w.bulk;
    expect(production.env).toBe('production');
    for (const name of ['BETTER_AUTH_SECRET', 'FILE_URL_SIGNING_KEY', 'TIN_ENCRYPTION_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_PUBLIC_KEY']) {
      expect(preview.values[name], name).not.toBe(production.values[name]);
    }
  });

  it('sets only what is missing, so a second run changes nothing and the TIN key is never replaced', async () => {
    const { w, deps } = world({ secrets: { preview: [...ALL_SECRETS] } });
    expect(await main(['--secrets'], deps)).toBe(0);
    expect(w.bulk).toBeUndefined();
    expect(w.prompts.filter((p) => /GOOGLE/.test(p.question))).toHaveLength(0);
    expect(w.logs.join('\n')).toMatch(/Nothing to set/);

    const partial = world({ secrets: { preview: ['TIN_ENCRYPTION_KEY', 'BETTER_AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] } });
    await main(['--secrets'], partial.deps);
    expect(Object.keys(partial.w.bulk[0].values).sort()).toEqual(['FILE_URL_SIGNING_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_PUBLIC_KEY']);
  });

  it('--rotate replaces one named secret and nothing else', async () => {
    const { w, deps } = world({ secrets: { preview: [...ALL_SECRETS] } });
    expect(await main(['--secrets', '--rotate', 'FILE_URL_SIGNING_KEY'], deps)).toBe(0);
    expect(Object.keys(w.bulk[0].values)).toEqual(['FILE_URL_SIGNING_KEY']);
    const refused = world({ secrets: { preview: [...ALL_SECRETS] } });
    expect(await main(['--secrets', '--rotate', 'TIN_ENCRYPTION_KEY'], refused.deps)).toBe(2);
    expect(refused.w.runs).toHaveLength(0);
  });

  it('explains the order when the Worker has not been deployed yet, and sets nothing', async () => {
    const { w, deps } = world({ secrets: {} });
    expect(await main(['--secrets'], deps)).toBe(1);
    expect(w.logs.join('\n')).toMatch(/ordinovix-preview does not exist yet.*deploy-preview/s);
    expect(w.bulk).toBeUndefined();
    expect(w.prompts.filter((p) => /GOOGLE/.test(p.question))).toHaveLength(0);
  });

  it('generateSecrets makes different values every time', () => {
    const a = generateSecrets();
    const b = generateSecrets();
    for (const name of Object.keys(a)) expect(a[name], name).not.toBe(b[name]);
  });
});

describe('phase 3: first owner', () => {
  it('builds the SQL for that email, runs it against the preview database from a temporary file and removes the file', async () => {
    const { w, deps } = world();
    expect(await main(['--first-owner', 'Jan@Example.org'], deps)).toBe(0);
    expect(w.runs.find((r) => r.cmd === 'node').args).toEqual(['scripts/first-owner-sql.mjs', '--email', 'jan@example.org']);
    const [executed] = w.executedSql;
    expect(executed.args.slice(0, 5)).toEqual(['d1', 'execute', 'DB', '--remote', '--env']);
    expect(executed.args[5]).toBe('preview');
    expect(executed.sql).toContain('mem-owner-jan@example.org');
    expect(existsSync(w.tempFileSeen)).toBe(false);
    expect(w.logs.join('\n')).toMatch(/jan@example.org is now the owner/);
  });

  it('for production needs an organization and passes it on', async () => {
    const { w, deps } = world();
    expect(await main(['--first-owner', 'jan@example.org', '--env', 'production'], deps)).toBe(2);
    expect(w.runs).toHaveLength(0);
    const ok = world();
    expect(await main(['--first-owner', 'jan@example.org', '--env', 'production', '--org', 'org-main', '--org-name', 'My Practice'], ok.deps)).toBe(0);
    expect(ok.w.runs.find((r) => r.cmd === 'node').args).toEqual(['scripts/first-owner-sql.mjs', '--email', 'jan@example.org', '--org', 'org-main', '--org-name', 'My Practice']);
    expect(ok.w.executedSql[0].args[ok.w.executedSql[0].args.indexOf('--env') + 1]).toBe('production');
  });
});

describe('every phase', () => {
  const phases = [[], ['--secrets'], ['--first-owner', 'jan@example.org']];
  for (const argv of phases) {
    it(`ends with wrangler logout, and passes the token only in the environment of the commands: ${argv.join(' ') || 'phase 1'}`, async () => {
      const { w, deps } = world({ secrets: { preview: [] } });
      expect(await main(argv, deps)).toBe(0);
      const last = w.runs.at(-1);
      expect([last.cmd, ...last.args]).toEqual(['npx', 'wrangler', 'logout']);
      expect(w.logs.at(-1)).toMatch(/Signed out of wrangler/);
      for (const run of w.runs) expect(JSON.stringify(run.args), `${run.cmd} ${run.args.join(' ')}`).not.toContain(TOKEN);
      expect(JSON.stringify(w.logs)).not.toContain(TOKEN);
      expect(w.runs.some((r) => r.env?.CLOUDFLARE_API_TOKEN === TOKEN)).toBe(true);
    });
  }

  it('signs out even when the phase fails, and still prints the reason', async () => {
    const { w, deps } = world({ secrets: {} });
    expect(await main(['--secrets'], deps)).toBe(1);
    expect(w.runs.at(-1).args).toEqual(['wrangler', 'logout']);
    expect(w.logs.join('\n')).toMatch(/does not exist yet/);
  });

  it('reports an API error without echoing the token', async () => {
    const { w, deps } = world();
    deps.fetchJson = async () => ({ success: false, errors: [{ message: 'Authentication error' }] });
    expect(await main([], deps)).toBe(1);
    expect(w.logs.join('\n')).toMatch(/Authentication error/);
    expect(JSON.stringify(w.logs)).not.toContain(TOKEN);
  });
});

describe('helpers', () => {
  it('setDatabaseId changes one database only, and refuses a name or id that is wrong', () => {
    const out = setDatabaseId(REAL_CONFIG, 'ordinovix-preview', uuid(7));
    expect(out).toContain(`"database_name": "ordinovix-preview", "database_id": "${uuid(7)}"`);
    expect(out.match(/0{8}-0000-0000-0000-0{12}/g)).toHaveLength(2); // local and production keep the placeholder
    expect(() => setDatabaseId(REAL_CONFIG, 'no-such-db', uuid(1))).toThrow(/no d1 database named/);
    expect(() => setDatabaseId(REAL_CONFIG, 'ordinovix', 'not-an-id')).toThrow(/not a database id/);
  });

  it('parseJsonOutput skips a banner line', () => {
    expect(parseJsonOutput(' ⛅️ wrangler 4.151.3\n[{"name":"a"}]\n')).toEqual([{ name: 'a' }]);
    expect(() => parseJsonOutput('no json here')).toThrow(/no JSON/);
  });

  it('uses the names ADR-0002 fixes, and they are the names in wrangler.jsonc', () => {
    expect(DATABASES).toEqual({ preview: 'ordinovix-preview', production: 'ordinovix' });
    expect(BUCKETS).toEqual({ preview: 'ordinovix-preview-files', production: 'ordinovix-files' });
    expect(BACKUP_RULE).toMatchObject({ bucket: 'ordinovix-files', prefix: 'backups/db/', days: 84 });
    for (const name of [...Object.values(DATABASES), ...Object.values(BUCKETS)]) expect(REAL_CONFIG).toContain(`"${name}"`);
    expect(ALL_SECRETS.sort()).toEqual(['BETTER_AUTH_SECRET', 'FILE_URL_SIGNING_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TIN_ENCRYPTION_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_PUBLIC_KEY']);
  });
});
