import { describe, it, expect } from 'vitest';
import { ONBOARDING_STEPS, doneSteps, withStepDone, firstOpenStep, isOnboardingFinished, toE164, showGettingStarted } from './onboarding';
import { SettingsWriteSchema } from '@/domain/schemas';

describe('lib/onboarding (spec 11.2 first-run setup)', () => {
  it('has the five setup steps in wizard order', () => {
    expect(ONBOARDING_STEPS.map((s) => s.key)).toEqual(['details', 'clients', 'templates', 'helper', 'phone']);
  });

  it('adds a finished step once and keeps the order of the others', () => {
    const a = withStepDone(undefined, 'templates');
    expect(a).toEqual({ done: ['templates'] });
    const b = withStepDone(a, 'details');
    expect(doneSteps(b)).toEqual(['details', 'templates']);
    expect(withStepDone(b, 'details')).toEqual(b);
  });

  it('keeps a dismissal when a step is added', () => {
    expect(withStepDone({ done: ['details'], dismissed: true }, 'clients')).toEqual({ done: ['details', 'clients'], dismissed: true });
  });

  it('opens on the first step that is not done, as a 1-based number', () => {
    expect(firstOpenStep(undefined)).toBe(1);
    expect(firstOpenStep({ done: ['details', 'clients'] })).toBe(3);
    expect(firstOpenStep({ done: ['details', 'templates'] })).toBe(2);
    expect(firstOpenStep({ done: ['details', 'clients', 'templates', 'helper', 'phone'] })).toBe(1);
  });

  it('is finished only when all five are done', () => {
    expect(isOnboardingFinished({ done: ['details', 'clients', 'templates', 'helper'] })).toBe(false);
    expect(isOnboardingFinished({ done: ['details', 'clients', 'templates', 'helper', 'phone'] })).toBe(true);
    expect(isOnboardingFinished(undefined)).toBe(false);
  });

  it('shows the Getting started card until finished or dismissed', () => {
    expect(showGettingStarted(undefined)).toBe(true);
    expect(showGettingStarted({ done: ['details'] })).toBe(true);
    expect(showGettingStarted({ done: ['details'], dismissed: true })).toBe(false);
    expect(showGettingStarted({ done: ['details', 'clients', 'templates', 'helper', 'phone'] })).toBe(false);
  });

  it('turns a Philippine mobile number into E.164, or null when it is not one', () => {
    expect(toE164('+63 917 555 0101')).toBe('+639175550101');
    expect(toE164('0917-555-0101')).toBe('+639175550101');
    expect(toE164('9175550101')).toBe('+639175550101');
    expect(toE164('+639171234567')).toBe('+639171234567');
    expect(toE164('12345')).toBeNull();
    expect(toE164('')).toBeNull();
  });
});

describe('SettingsWriteSchema accepts what the wizard saves', () => {
  it('takes a mobile number, accreditation and onboarding progress', () => {
    const ok = SettingsWriteSchema.safeParse({
      practiceName: 'Reyes Tax Desk',
      operatorDisplayName: 'Ana Reyes',
      mobileE164: '+639175550101',
      accreditation: { number: 'BIR-TA-2024-009182', validUntil: '2027-12-31' },
      onboarding: { done: ['details'], dismissed: false },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects a bad mobile number, an unknown step and a bad date', () => {
    expect(SettingsWriteSchema.safeParse({ mobileE164: '12345' }).success).toBe(false);
    expect(SettingsWriteSchema.safeParse({ onboarding: { done: ['nope'] } }).success).toBe(false);
    expect(SettingsWriteSchema.safeParse({ accreditation: { number: 'X', validUntil: '31/12/2027' } }).success).toBe(false);
  });
});
