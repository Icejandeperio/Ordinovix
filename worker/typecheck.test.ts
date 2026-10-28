import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** The root `tsc --noEmit` covers the app (DOM types); the Worker has its own program with the Workers runtime types. */
describe('Worker TypeScript project', () => {
  it('type-checks (worker/tsconfig.json)', { timeout: 180_000 }, () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const tsc = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
    const result = spawnSync(process.execPath, [tsc, '--noEmit', '-p', 'worker/tsconfig.json'], { cwd: root, encoding: 'utf8' });
    expect(result.stdout + result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
