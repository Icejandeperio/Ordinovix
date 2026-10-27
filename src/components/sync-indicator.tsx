import { useState, useSyncExternalStore } from 'react';
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { devControls, offlineQueue } from '@/data';

/**
 * Spec 11 top bar: "All changes saved", "Saving…", or "Offline — 3 changes waiting". Opening it lists the queued
 * writes; a write the server rejected stays there with Retry and Discard.
 */
export function SyncIndicator() {
  const snap = useSyncExternalStore(offlineQueue.subscribe, offlineQueue.getSnapshot);
  const [open, setOpen] = useState(false);
  const waiting = snap.pending + snap.failed;
  const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || devControls.getOffline();

  const label = snap.syncing
    ? 'Saving…'
    : snap.failed > 0
      ? `${snap.failed} ${snap.failed === 1 ? 'change needs' : 'changes need'} attention`
      : snap.pending > 0
        ? `${offline ? 'Offline — ' : ''}${snap.pending} ${snap.pending === 1 ? 'change' : 'changes'} waiting`
        : offline
          ? 'Offline'
          : 'All changes saved';

  const Icon = snap.syncing ? RefreshCw : snap.failed > 0 ? TriangleAlert : waiting > 0 || offline ? CloudOff : Cloud;
  const tone = snap.failed > 0 ? 'text-critical' : waiting > 0 ? 'text-warn-fg' : 'text-ink-3';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`p-2 rounded-control text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer hover:bg-sheet-2 ${tone}`}
        title={label}
      >
        <Icon className={`w-4 h-4 ${snap.syncing ? 'animate-spin' : ''}`} />
        <span role="status" aria-live="polite" className={waiting > 0 || snap.syncing ? 'inline' : 'hidden lg:inline'}>
          {label}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Waiting changes"
          className="absolute right-0 top-full mt-1.5 w-80 max-w-[90vw] z-50 rounded-panel border border-rule bg-sheet shadow-lg p-3 space-y-2"
        >
          <div className="text-xs font-bold text-ink">Waiting changes</div>
          {snap.items.length === 0 ? (
            <p className="text-xs text-ink-3">Nothing is waiting. Everything is saved.</p>
          ) : (
            <ul className="space-y-2">
              {snap.items.map((item) => (
                <li key={item.id} className="rounded-control border border-rule bg-sheet-2 p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{item.label}</span>
                    <span className={item.status === 'failed' ? 'font-semibold text-critical' : 'text-ink-3'}>
                      {item.status === 'failed' ? 'Failed' : 'Waiting for connection'}
                    </span>
                  </div>
                  {item.error && <p className="text-critical">{item.error}</p>}
                  {item.status === 'failed' && (
                    <div className="flex gap-3 pt-0.5">
                      <button type="button" onClick={() => void offlineQueue.retry(item.id)} className="font-semibold text-stamp hover:underline cursor-pointer">
                        Retry
                      </button>
                      <button type="button" onClick={() => void offlineQueue.discard(item.id)} className="font-semibold text-ink-3 hover:text-ink hover:underline cursor-pointer">
                        Discard
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
