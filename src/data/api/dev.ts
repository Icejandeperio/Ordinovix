import { PERSONA_KEY } from '../dev-state';
import { request, setBeforeFirstRequest } from './http';

/**
 * Development against a local Worker (`npm run dev` with VITE_DATA_SOURCE=api and DEV_AUTH=1 in .dev.vars). The persona the
 * dev tools chose signs in through the Worker's dev-only route, and a browser context that has never loaded the app starts
 * from a fresh Demo organization, as the mock does with its empty localStorage. This code is compiled only into development
 * builds (`import.meta.env.DEV`); a deployed build has none of it.
 */
const SEEDED = 'ox-api-dev-seeded';

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const devPersona = (): 'owner' | 'helper' => (read(PERSONA_KEY) === 'helper' ? 'helper' : 'owner');

export async function devSignIn(persona: 'owner' | 'helper'): Promise<void> {
  await request('POST', '/api/v1/dev/sign-in', { body: { persona }, bootstrap: true });
}

export async function devReset(): Promise<void> {
  await request('POST', '/api/v1/dev/reset', { body: {}, bootstrap: true });
}

/** The Demo organization back as the mock starts it; this browser then knows the database has been seeded. */
async function seed(): Promise<void> {
  await devReset();
  window.localStorage.setItem(SEEDED, '1');
}

/**
 * Runs once before the first request: seeds a database this browser has not seen (a fresh local D1 has no Demo organization, and
 * the dev sign-in refuses to run without it), then signs in as the chosen persona. A browser that remembers seeding an earlier
 * database meets "not seeded" (422) when the database was emptied since; it then seeds and tries once more.
 */
export async function devBootstrap(): Promise<void> {
  try {
    const persona = devPersona();
    if (!read(SEEDED)) await seed();
    try {
      await devSignIn(persona);
    } catch (error) {
      if ((error as { code?: string }).code !== 'VALIDATION') throw error;
      await seed();
      await devSignIn(persona);
    }
  } catch (error) {
    reportDevBootstrapFailure(error);
  }
}

/** A failed bootstrap must not look like a working app with no data: say so in the console and on the page (development builds only). */
function reportDevBootstrapFailure(error: unknown): void {
  const code = (error as { code?: string } | null)?.code;
  const hint =
    code === 'NOT_FOUND'
      ? 'This Worker has no dev sign-in: run npm run dev:vars (it sets DEV_AUTH=1) and restart, or sign in with Google.'
      : `${(error as Error | null)?.message ?? 'unknown error'}. Is the Worker running (npm run dev)?`;
  console.error('[dev bootstrap] the dev sign-in failed:', error);
  if (typeof document === 'undefined' || document.getElementById('dev-bootstrap-notice')) return;
  const notice = document.createElement('div');
  notice.id = 'dev-bootstrap-notice';
  notice.setAttribute('role', 'alert');
  notice.textContent = `Dev sign-in failed. ${hint}`;
  Object.assign(notice.style, {
    position: 'fixed',
    bottom: '12px',
    left: '12px',
    maxWidth: '420px',
    zIndex: '9999',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--critical-bd)',
    background: 'var(--critical-bg)',
    color: 'var(--critical-fg)',
    fontSize: '12px',
  });
  document.body.appendChild(notice);
}

export function installDevBootstrap(): void {
  setBeforeFirstRequest(devBootstrap);
}
