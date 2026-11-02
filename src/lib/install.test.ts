import { describe, it, expect } from 'vitest';
import { installMode, type InstallEnv } from './install';

const base: InstallEnv = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130', platform: 'Linux armv8l', maxTouchPoints: 5, standalone: false, hasPrompt: false };
const iphone = { ...base, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1', platform: 'iPhone' };
const ipadAsMac = { ...base, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1', platform: 'MacIntel', maxTouchPoints: 5 };

describe('U37 install app', () => {
  it('Android and desktop with the browser offer: the Install app button', () => {
    expect(installMode({ ...base, hasPrompt: true })).toBe('prompt');
  });
  it('iPhone and iPad get the Share, Add to Home Screen card', () => {
    expect(installMode(iphone)).toBe('ios');
    expect(installMode(ipadAsMac)).toBe('ios');
  });
  it('shows neither once the app runs installed', () => {
    expect(installMode({ ...base, hasPrompt: true, standalone: true })).toBe('installed');
    expect(installMode({ ...iphone, standalone: true })).toBe('installed');
  });
  it('shows nothing where the browser makes no offer and it is not an Apple device', () => {
    expect(installMode(base)).toBe('none');
    expect(installMode({ ...base, platform: 'MacIntel', maxTouchPoints: 0, userAgent: 'Macintosh Chrome' })).toBe('none');
  });
});
