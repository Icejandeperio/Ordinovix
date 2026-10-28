import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useSaveSettings } from '@/hooks/useData';
import { SaveBar, INPUT_CLASS, LABEL_CLASS } from './save-bar';
import type { Membership, OrgSettings, User } from '@/domain/types';

interface ProfileSectionProps {
  user: User;
  membership: Membership;
  settings: OrgSettings;
  isOwner: boolean;
  onSaved: () => void;
  onSignOut: () => void;
}

/** Operator profile. Display name and mobile number live in the practice settings; only the owner can save them. */
export function ProfileSection({ user, membership, settings, isOwner, onSaved, onSignOut }: ProfileSectionProps) {
  const save = useSaveSettings();
  // The owner edits the practice's operator name and mobile; a helper sees their own, read-only
  const [displayName, setDisplayName] = useState(isOwner ? settings.operatorDisplayName : user.displayName ?? user.name);
  const [phone, setPhone] = useState(isOwner ? settings.mobileE164 ?? '' : user.mobileE164 ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    save.mutate(
      { version: settings.version, operatorDisplayName: displayName.trim(), mobileE164: phone.trim() || undefined },
      { onSuccess: onSaved, onError: (err) => setError((err as Error).message) }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-[var(--ink)]">Operator Profile</h2>
        <p className="text-xs text-[var(--ink-3)] mt-0.5">Your personal credentials and display identity in client correspondence.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="profile-name" className={LABEL_CLASS}>Full Name</label>
          <input id="profile-name" type="text" value={user.name} readOnly className={INPUT_CLASS} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-display" className={LABEL_CLASS}>Display Name (in messages)</label>
            <input
              id="profile-display"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              readOnly={!isOwner}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="profile-initials" className={LABEL_CLASS}>Initials (Stamp)</label>
            <input id="profile-initials" type="text" value={user.initials} readOnly maxLength={3} className={`${INPUT_CLASS} uppercase font-mono`} />
          </div>
        </div>

        <div>
          <label htmlFor="profile-phone" className={LABEL_CLASS}>Mobile Number (PH)</label>
          <input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            readOnly={!isOwner}
            className={`${INPUT_CLASS} font-mono`}
          />
        </div>

        <div>
          <span className={LABEL_CLASS}>Role & Authority</span>
          <div className="p-3 rounded-md bg-[var(--sheet-2)] border border-[var(--rule)] text-xs text-[var(--ink-2)] flex items-center justify-between">
            <div>
              <span className="font-semibold text-[var(--ink)] uppercase">{membership.role}</span>
              <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
                {isOwner ? 'Full administrative authority and unmasked data view.' : 'Scoped strictly to assigned client matters.'}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--info-bg)] text-[var(--info-fg)] border border-[var(--info-bd)] uppercase">
              Active
            </span>
          </div>
        </div>
      </div>

      <SaveBar onSave={handleSave} saving={save.isPending} error={error} disabled={!isOwner}>
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-2 px-3.5 py-2 rounded-md border border-[var(--critical-bd)] bg-[var(--sheet)] hover:bg-[var(--critical-bg)] text-[var(--critical-fg)] font-medium text-xs sm:text-sm transition-colors cursor-pointer"
          title="Sign out of your active session"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out of session</span>
        </button>
      </SaveBar>
      {!isOwner && (
        <p className="text-[11px] text-[var(--ink-3)] -mt-3">Only the practice owner can change these details.</p>
      )}
    </div>
  );
}
