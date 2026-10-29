import { Bell, BellOff } from 'lucide-react';
import { useReminders } from '@/hooks/push';

const PRIMARY = 'bg-[var(--stamp)] text-[var(--on-stamp)] hover:bg-[var(--stamp-strong)]';
const OUTLINE = 'border border-[var(--rule-strong)] text-[var(--ink)] hover:bg-[var(--sheet-3)]';

const NOTES = {
  blocked: "Notifications are blocked for Ordinovix in this browser. Allow them in the browser's site settings, then try again.",
  'needs-install':
    'On iPhone, reminders need iOS 16.4 or later and Ordinovix on your Home Screen. Tap Share, then Add to Home Screen, then open Ordinovix from the Home Screen and turn reminders on there.',
  unsupported: 'This browser cannot show reminders. Use the latest Chrome, Edge, Safari or Firefox.',
  unavailable: 'Reminders work in the installed app. This page is running without its service worker.',
} as const;

/**
 * The reminders control for this device (Welcome step 5 and Settings, Notifications). Permission is asked only after the tap, and
 * a device that cannot take reminders says what it needs instead of failing.
 */
export function PushReminders({ tone = 'primary' }: { tone?: 'primary' | 'outline' }) {
  const { status, busy, error, turnOn, turnOff } = useReminders();
  const look = tone === 'primary' ? PRIMARY : OUTLINE;

  return (
    <div className="flex flex-col items-start sm:items-end gap-2 min-w-0 sm:max-w-[320px]">
      {status === 'on' ? (
        <div className="flex items-center gap-2">
          <span role="status" className="px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 bg-[var(--good-bg)] text-[var(--good-fg)] border border-[var(--good-bd)]">
            <Bell className="w-3.5 h-3.5" />
            <span>Reminders On</span>
          </span>
          <button
            type="button"
            onClick={() => void turnOff()}
            disabled={busy}
            className="min-h-[44px] px-3 py-1.5 rounded-md border border-[var(--rule-strong)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--sheet-3)] transition-colors flex items-center gap-1.5 disabled:opacity-60"
          >
            <BellOff className="w-3.5 h-3.5" />
            <span>Turn off</span>
          </button>
        </div>
      ) : status === 'checking' || status === 'off' ? (
        <button
          type="button"
          onClick={() => void turnOn()}
          disabled={busy || status === 'checking'}
          className={`min-h-[44px] px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60 ${look}`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Turn on reminders</span>
        </button>
      ) : (
        <p role="status" className="text-xs text-[var(--ink-2)] leading-relaxed text-left sm:text-right">
          {NOTES[status]}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-[var(--critical-fg)] text-left sm:text-right">
          {error}
        </p>
      )}
    </div>
  );
}
