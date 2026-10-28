import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/dev-vars.mjs', import.meta.url));
const SECRETS = ['BETTER_AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'FILE_URL_SIGNING_KEY', 'TIN_ENCRYPTION_KEY'];

let dir: string;
let out: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ox-dev-vars-'));
  out = join(dir, 'vars.test-output');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

// The tests always write to a temporary file through --out; the real .dev.vars is never touched or read.
const run = (...args: string[]) => spawnSync(process.execPath, [script, '--out', out, ...args], { encoding: 'utf8' });
const parse = (text: string) =>
  Object.fromEntries(text.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

describe('npm run dev:vars (scripts/dev-vars.mjs)', () => {
  it('writes a random local value for every secret named in ADR-0002, and never prints one', () => {
    const result = run();
    expect(result.status).toBe(0);
    const vars = parse(readFileSync(out, 'utf8'));
    for (const name of SECRETS) {
      expect(vars[name], name).toBeTruthy();
      expect(result.stdout + result.stderr, `${name} value must not be printed`).not.toContain(vars[name]);
    }
    expect(vars.DEV_AUTH).toBe('1');
    expect(result.stdout).toContain('BETTER_AUTH_SECRET'); // names are fine
  });

  it('generates different values every time, with usable key sizes', () => {
    run();
    const first = parse(readFileSync(out, 'utf8'));
    expect(run('--force').status).toBe(0);
    const second = parse(readFileSync(out, 'utf8'));
    for (const name of SECRETS) expect(second[name], name).not.toBe(first[name]);
    // AES-256 key and HMAC key: 32 random bytes as base64
    expect(Buffer.from(first.TIN_ENCRYPTION_KEY, 'base64')).toHaveLength(32);
    expect(Buffer.from(first.FILE_URL_SIGNING_KEY, 'base64')).toHaveLength(32);
    expect(first.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    // VAPID: uncompressed P-256 public point (65 bytes) and a 32 byte private scalar, base64url
    expect(Buffer.from(first.VAPID_PUBLIC_KEY, 'base64url')).toHaveLength(65);
    expect(Buffer.from(first.VAPID_PRIVATE_KEY, 'base64url')).toHaveLength(32);
  });

  it('refuses to overwrite an existing file without --force, and leaves it untouched', () => {
    writeFileSync(out, 'KEEP=me\n');
    const result = run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/--force/);
    expect(readFileSync(out, 'utf8')).toBe('KEEP=me\n');
    expect(run('--force').status).toBe(0);
    expect(readFileSync(out, 'utf8')).toContain('BETTER_AUTH_SECRET=');
  });

  it('creates the file when none exists', () => {
    expect(existsSync(out)).toBe(false);
    expect(run().status).toBe(0);
    expect(existsSync(out)).toBe(true);
  });
});
