import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** U22: wrangler.jsonc follows ADR-0002 section 3 exactly. CI deploys against these names, bindings and environments. */
const PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000000';

function readJsonc(rel: string): Record<string, any> {
  const text = readFileSync(new URL(rel, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(text);
}

const config = readJsonc('../wrangler.jsonc');

describe('wrangler.jsonc (ADR-0002 section 3)', () => {
  it('has the Worker entry and runs the Worker first only for /api/*, serving the app as a single-page app', () => {
    expect(config.main).toBe('worker/index.ts');
    for (const scope of [config, config.env.preview, config.env.production]) {
      expect(scope.assets.not_found_handling).toBe('single-page-application');
      expect(scope.assets.run_worker_first).toEqual(['/api/*']);
    }
  });

  it('has exactly the top level (local), preview and production environments', () => {
    expect(Object.keys(config.env).sort()).toEqual(['preview', 'production']);
  });

  it('names the Workers ordinovix-preview and ordinovix, with no custom domain or route', () => {
    expect(config.env.preview.name).toBe('ordinovix-preview');
    expect(config.env.production.name).toBe('ordinovix');
    for (const scope of [config, config.env.preview, config.env.production]) {
      expect(scope.routes).toBeUndefined();
      expect(scope.route).toBeUndefined();
      expect(scope.workers_dev).not.toBe(false);
    }
  });

  it('binds D1 as DB with the fixed database names, placeholder ids and the migrations folder', () => {
    const expected: Array<[Record<string, any>, string]> = [
      [config.env.preview, 'ordinovix-preview'],
      [config.env.production, 'ordinovix'],
    ];
    for (const [scope, name] of expected) {
      expect(scope.d1_databases).toHaveLength(1);
      expect(scope.d1_databases[0]).toMatchObject({ binding: 'DB', database_name: name, database_id: PLACEHOLDER_ID, migrations_dir: 'migrations' });
    }
    expect(config.d1_databases).toHaveLength(1);
    expect(config.d1_databases[0]).toMatchObject({ binding: 'DB', database_id: PLACEHOLDER_ID, migrations_dir: 'migrations' });
  });

  it('binds R2 as FILES with the fixed bucket names', () => {
    expect(config.env.preview.r2_buckets).toEqual([{ binding: 'FILES', bucket_name: 'ordinovix-preview-files' }]);
    expect(config.env.production.r2_buckets).toEqual([{ binding: 'FILES', bucket_name: 'ordinovix-files' }]);
    expect(config.r2_buckets).toHaveLength(1);
    expect(config.r2_buckets[0].binding).toBe('FILES');
  });

  it('sets APP_ENV to local, preview and production', () => {
    expect(config.vars.APP_ENV).toBe('local');
    expect(config.env.preview.vars.APP_ENV).toBe('preview');
    expect(config.env.production.vars.APP_ENV).toBe('production');
  });

  it('never carries a secret value: the secret names are not variables', () => {
    const secrets = ['BETTER_AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'FILE_URL_SIGNING_KEY', 'TIN_ENCRYPTION_KEY'];
    for (const scope of [config, config.env.preview, config.env.production]) {
      for (const name of secrets) expect(Object.keys(scope.vars)).not.toContain(name);
    }
    expect(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')).not.toMatch(/DEV_AUTH/);
  });

  it('enables nodejs_compat and a compatibility date', () => {
    expect(config.compatibility_flags).toContain('nodejs_compat');
    expect(config.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
