import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

// The page only reads two control objects from the data layer. Importing the real one pulls in the mock store, the commands and
// the API client (about 1.5 s to transform cold, over 5 s when the whole suite runs in parallel), which is what made this file
// slow; the markup under test does not depend on any of it.
vi.mock('@/data', () => ({
  authControls: { googleSignInUrl: vi.fn() },
  devControls: { setPersona: vi.fn() },
}));

async function renderSignIn(source: string): Promise<string> {
  vi.resetModules();
  vi.stubEnv('VITE_DATA_SOURCE', source);
  const { SignInPage } = await import('./page');
  return renderToString(
    <MemoryRouter initialEntries={['/sign-in?next=%2Ftasks']}>
      <SignInPage />
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllEnvs());

describe('U39 the sign-in page on each build', () => {
  it('an API build shows the Google button and none of the mock-only block', async () => {
    const html = await renderSignIn('api');
    expect(html).toContain('Continue with Google');
    expect(html).not.toMatch(/mock mode only/i);
    expect(html).not.toContain('Continue as Ana');
    expect(html).not.toContain('Continue as Ben');
    expect(html).not.toMatch(/Simulate unauthorized/i);
  });

  it('mock mode keeps the persona buttons', async () => {
    const html = await renderSignIn('mock');
    expect(html).toContain('Continue with Google');
    expect(html).toContain('mock mode only');
    expect(html).toContain('Continue as Ana');
    expect(html).toContain('Continue as Ben');
    expect(html).toContain('Simulate unauthorized');
  });
});
