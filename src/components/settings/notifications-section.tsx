import { useState } from 'react';
import { useSavePrefs } from '@/hooks/useData';
import { SaveBar } from './save-bar';
import { PushReminders } from '@/components/push-reminders';
import type { NotificationType, OrgSettings, UserPrefs } from '@/domain/types';

interface NotificationsSectionProps {
  settings: OrgSettings;
  prefs: UserPrefs;
  onSaved: () => void;
}

/** "07:00" as "7:00 AM". */
function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Which alerts this person wants (prefs.pushTypes). The quiet hours and digest time are practice settings. */
export function NotificationsSection({ settings, prefs, onSaved }: NotificationsSectionProps) {
  const save = useSavePrefs();
  const [types, setTypes] = useState<NotificationType[]>(prefs.pushTypes);
  const [error, setError] = useState<string | null>(null);

  const alerts: Array<{ type: NotificationType; label: string }> = [
    { type: 'due_soon_blocked', label: `Deadlines due within ${settings.dueSoonDays} days` },
    { type: 'authorization_expiring', label: `Authorizations expiring in ${settings.authWarnDays} days` },
    { type: 'received_needs_review', label: 'Client uploaded a missing document' },
    { type: 'visit_ready', label: 'Visit trip readiness updates' },
    { type: 'daily_digest', label: `Daily ${clockLabel(settings.digestTime)} dispatch summary` },
  ];

  const toggle = (type: NotificationType) =>
    setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));

  const handleSave = () => {
    setError(null);
    save.mutate({ pushTypes: types }, { onSuccess: onSaved, onError: (err) => setError((err as Error).message) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-[var(--ink)]">Notification Preferences</h2>
        <p className="text-xs text-[var(--ink-3)] mt-0.5">Control browser notifications, alert frequencies, and quiet hours.</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-bold text-[var(--ink)]">Browser Push Alerts</div>
            <div className="text-xs text-[var(--ink-3)]">Receive critical deadline alerts even when the tab is closed.</div>
          </div>
          <PushReminders tone="outline" />
        </div>

        <div className="space-y-3">
          {alerts.map((item) => (
            <label key={item.type} className="flex items-center justify-between p-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] hover:bg-[var(--sheet-2)] cursor-pointer">
              <span className="text-sm text-[var(--ink)]">{item.label}</span>
              <input
                type="checkbox"
                checked={types.includes(item.type)}
                onChange={() => toggle(item.type)}
                className="w-4 h-4 accent-[var(--stamp)] rounded"
              />
            </label>
          ))}
        </div>

        <div className="p-3 rounded-md bg-[var(--sheet-2)] border border-[var(--rule)]">
          <div className="text-xs font-bold text-[var(--ink)] mb-1">Quiet Hours</div>
          <div className="text-xs text-[var(--ink-3)]">
            No notification sounds or badges between {clockLabel(settings.quietHours.start)} and {clockLabel(settings.quietHours.end)} (Asia/Manila).
          </div>
        </div>
      </div>

      <SaveBar onSave={handleSave} saving={save.isPending} error={error} />
    </div>
  );
}
