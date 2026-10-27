import { useState } from 'react';
import { useSavePrefs, useSaveSettings } from '@/hooks/useData';
import { SaveBar, LABEL_CLASS } from './save-bar';
import type { OrgSettings, UserPrefs } from '@/domain/types';

interface SecuritySectionProps {
  settings: OrgSettings;
  prefs: UserPrefs;
  isOwner: boolean;
  onSaved: () => void;
  onSignOutEverywhere: () => void;
}

const LOCK_OPTIONS: Array<{ minutes: OrgSettings['idleLockMinutes']; label: string }> = [
  { minutes: 0, label: 'Off' },
  { minutes: 5, label: '5 min' },
  { minutes: 15, label: '15 min (Recommended)' },
  { minutes: 30, label: '30 min' },
];

/** The idle lock is a practice setting (owner saves it with settings.save); privacy mode on startup is per person (prefs.save). */
export function SecuritySection({ settings, prefs, isOwner, onSaved, onSignOutEverywhere }: SecuritySectionProps) {
  const saveSettings = useSaveSettings();
  const savePrefs = useSavePrefs();
  const [idleLock, setIdleLock] = useState<OrgSettings['idleLockMinutes']>(settings.idleLockMinutes);
  const [privacyOnStart, setPrivacyOnStart] = useState(prefs.privacyModeOnStart);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    try {
      if (isOwner && idleLock !== settings.idleLockMinutes) {
        await saveSettings.mutateAsync({ idleLockMinutes: idleLock });
      }
      await savePrefs.mutateAsync({ privacyModeOnStart: privacyOnStart });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-[var(--ink)]">Security & Session Privacy</h2>
        <p className="text-xs text-[var(--ink-3)] mt-0.5">Enforce idle lock timers and protect sensitive client taxpayer records.</p>
      </div>

      <div className="space-y-4">
        <div>
          <span className={LABEL_CLASS}>Idle Lock Timeout</span>
          <div className="grid grid-cols-4 gap-2">
            {LOCK_OPTIONS.map((lock) => (
              <button
                key={lock.minutes}
                type="button"
                disabled={!isOwner}
                onClick={() => setIdleLock(lock.minutes)}
                className={`p-2.5 rounded-md border text-center text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                  idleLock === lock.minutes
                    ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)] font-bold'
                    : 'border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-2)]'
                }`}
              >
                {lock.label}
              </button>
            ))}
          </div>
          {!isOwner && <p className="text-[11px] text-[var(--ink-3)] mt-1.5">The practice owner sets the idle lock for everyone.</p>}
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)]">
          <div>
            <div className="text-sm font-semibold text-[var(--ink)]">Privacy Mode on Startup</div>
            <div className="text-xs text-[var(--ink-3)]">Mask all Taxpayer Identification Numbers (TINs) and revenue figures by default.</div>
          </div>
          <input
            type="checkbox"
            aria-label="Privacy mode on startup"
            checked={privacyOnStart}
            onChange={(e) => setPrivacyOnStart(e.target.checked)}
            className="w-4 h-4 accent-[var(--stamp)] rounded cursor-pointer"
          />
        </div>

        <div className="p-4 rounded-lg bg-[var(--critical-bg)] border border-[var(--critical-bd)] text-[var(--critical-fg)] flex items-center justify-between">
          <div>
            <div className="text-sm font-bold">Sign Out Everywhere</div>
            <div className="text-xs opacity-90">Invalidates all cached browser tokens and active sessions.</div>
          </div>
          <button
            type="button"
            onClick={onSignOutEverywhere}
            className="px-3 py-1.5 rounded-md bg-[var(--critical-solid)] text-[var(--on-critical-solid)] text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Sign Out All
          </button>
        </div>
      </div>

      <SaveBar onSave={handleSave} saving={saveSettings.isPending || savePrefs.isPending} error={error} />
    </div>
  );
}
