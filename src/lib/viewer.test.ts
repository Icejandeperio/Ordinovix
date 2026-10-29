import { describe, expect, it } from 'vitest';
import { deriveViewer } from './viewer';

const session = (role: 'owner' | 'helper') => ({ user: { name: 'Pat Reyes', initials: 'PR' }, membership: { role } });

describe('U39 who the shell says is signed in', () => {
  it('mock mode follows the persona the dev tools chose', () => {
    expect(deriveViewer({ mock: true, persona: 'owner' })).toMatchObject({ role: 'owner', name: 'Ana Santos', initials: 'AS' });
    expect(deriveViewer({ mock: true, persona: 'helper' })).toMatchObject({ role: 'helper', name: 'Ben Morales', initials: 'BM' });
  });

  it('API mode takes the person and role from the server session and ignores the saved persona', () => {
    expect(deriveViewer({ mock: false, persona: 'helper', session: session('owner') })).toMatchObject({ role: 'owner', name: 'Pat Reyes', initials: 'PR' });
    expect(deriveViewer({ mock: false, persona: 'owner', session: session('helper') })).toMatchObject({ role: 'helper', name: 'Pat Reyes' });
  });

  it('API mode without a session shows the least access and no sample name', () => {
    const v = deriveViewer({ mock: false, persona: 'owner' });
    expect(v.role).toBe('helper');
    expect(v.name).toBe('');
  });
});
