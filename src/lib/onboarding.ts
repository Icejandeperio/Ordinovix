import type { OnboardingProgress, OnboardingStep } from '@/domain/types';

/** The five first-run steps of spec 11.2, in wizard order. */
export const ONBOARDING_STEPS: ReadonlyArray<{ key: OnboardingStep; title: string }> = [
  { key: 'details', title: 'Your practice details' },
  { key: 'clients', title: 'Add your clients' },
  { key: 'templates', title: 'Choose obligation templates' },
  { key: 'helper', title: 'Invite a helper' },
  { key: 'phone', title: 'Put Ordinovix on your phone' },
];

const ORDER = ONBOARDING_STEPS.map((s) => s.key);

export const doneSteps = (p?: OnboardingProgress): OnboardingStep[] => p?.done ?? [];

/** Progress with `step` added once, kept in wizard order. A dismissal is preserved. */
export function withStepDone(p: OnboardingProgress | undefined, step: OnboardingStep): OnboardingProgress {
  const done = ORDER.filter((k) => k === step || doneSteps(p).includes(k));
  return { ...p, done };
}

/** The 1-based wizard step to open on: the first one not done, or 1 when everything is. */
export function firstOpenStep(p?: OnboardingProgress): number {
  const idx = ORDER.findIndex((k) => !doneSteps(p).includes(k));
  return idx === -1 ? 1 : idx + 1;
}

export const isOnboardingFinished = (p?: OnboardingProgress): boolean => ORDER.every((k) => doneSteps(p).includes(k));

/** The Today "Getting started" card shows until the setup is finished or the owner dismisses it. */
export const showGettingStarted = (p?: OnboardingProgress): boolean => !p?.dismissed && !isOnboardingFinished(p);

/** "+63 917 555 0101", "0917-555-0101" or "9175550101" as "+639175550101"; null when it is not a Philippine mobile number. */
export function toE164(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  const m = /^(?:\+63|63|0)?(9\d{9})$/.exec(digits);
  return m ? `+63${m[1]}` : null;
}
