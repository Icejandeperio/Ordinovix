import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { devBootstrap } from './dev';

/** U33: the dev bootstrap (VITE_DATA_SOURCE=api on a local Worker) seeds an empty database before it signs in, and reports a failure. */
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const notSeeded = () => json(422, { error: { code: 'VALIDATION', message: 'The Demo organization is not seeded', fields: { persona: ['not seeded'] } } });

let store: Record<string, string>;
let calls: string[];
let notices: Array<{ id?: string; textContent?: string; role?: string }>;

function stubBrowser(answer: (path: string, nth: number) => Response) {
  store = {};
  calls = [];
  notices = [];
  const counts: Record<string, number> = {};
  vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) } });
  vi.stubGlobal('document', {
    getElementById: () => null,
    createElement: () => {
      const el: { id?: string; textContent?: string; role?: string; setAttribute: (k: string, v: string) => void; style: Record<string, string> } = {
        style: {},
        setAttribute: (k, v) => {
          if (k === 'role') el.role = v;
        },
      };
      notices.push(el);
      return el;
    },
    body: { appendChild: () => undefined },
  });
  vi.stubGlobal('fetch', async (path: string) => {
    counts[path] = (counts[path] ?? 0) + 1;
    calls.push(path);
    return answer(path, counts[path]);
  });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('U33 dev bootstrap', () => {
  it('seeds a browser that has never seen the database, and only then signs in', async () => {
    stubBrowser(() => json(200, { ok: true }));
    await devBootstrap();
    expect(calls).toEqual(['/api/v1/dev/reset', '/api/v1/dev/sign-in']);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('does not reset again for a browser that has already seeded', async () => {
    stubBrowser(() => json(200, { ok: true }));
    await devBootstrap();
    calls.length = 0;
    await devBootstrap();
    expect(calls).toEqual(['/api/v1/dev/sign-in']);
  });

  it('seeds and retries when the database was emptied after this browser last saw it', async () => {
    stubBrowser((path, nth) => (path.endsWith('/sign-in') && nth === 1 ? notSeeded() : json(200, { ok: true })));
    store['ox-api-dev-seeded'] = '1';
    await devBootstrap();
    expect(calls).toEqual(['/api/v1/dev/sign-in', '/api/v1/dev/reset', '/api/v1/dev/sign-in']);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('reports a failed sign-in: a console error and a visible notice, not an empty catch', async () => {
    stubBrowser((path) => (path.endsWith('/sign-in') ? json(500, { error: { code: 'INTERNAL', message: 'boom' } }) : json(200, { ok: true })));
    await devBootstrap();
    expect(console.error).toHaveBeenCalled();
    const notice = notices.find((n) => n.role === 'alert');
    expect(notice?.textContent).toMatch(/dev sign-in/i);
  });

  it('says what to do when the Worker has no dev sign-in at all (404)', async () => {
    stubBrowser((path) => (path.endsWith('/sign-in') ? json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }) : json(200, { ok: true })));
    await devBootstrap();
    expect(notices.find((n) => n.role === 'alert')?.textContent).toMatch(/DEV_AUTH/);
  });
});
