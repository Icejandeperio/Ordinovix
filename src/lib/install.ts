/**
 * Install the app (spec 19.3). Android and desktop browsers offer `beforeinstallprompt`, which an "Install app" button
 * triggers; iPhone and iPad have no such event, so they get the Share, Add to Home Screen steps. Once the app runs installed
 * (standalone), neither shows.
 */
export interface InstallEnv {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** Opened from the Home Screen or as an installed app. */
  standalone: boolean;
  /** The browser has offered `beforeinstallprompt` and it has not been used yet. */
  hasPrompt: boolean;
}

export type InstallMode = 'installed' | 'prompt' | 'ios' | 'none';

export function isApple(env: Pick<InstallEnv, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  return /iPhone|iPad|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1);
}

export function installMode(env: InstallEnv): InstallMode {
  if (env.standalone) return 'installed';
  if (env.hasPrompt) return 'prompt';
  if (isApple(env)) return 'ios';
  return 'none';
}

/** The browser's current answer to "is this running as an installed app". */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}
