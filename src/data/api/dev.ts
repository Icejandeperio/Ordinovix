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
  // `vite dev` drops the connection of a request that follows within a few milliseconds of this slow answer ("fetch failed" on
  // about one request in five, and Vite then paints its error overlay over the page), so the next request waits a moment.
  await new Promise((resolve) => setTimeout(resolve, 500));
}

export function installDevBootstrap(): void {
  setBeforeFirstRequest(async () => {
    try {
      await devSignIn(devPersona());
      if (!read(SEEDED)) {
        await devReset();
        window.localStorage.setItem(SEEDED, '1');
      }
    } catch {
      // not a dev Worker (no DEV_AUTH): the person signs in the usual way
    }
  });
}
