import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Spec 19.3: when a new version of the app is waiting, say so and let the person choose when to reload.
 * The page never reloads by itself, so an open form is never lost.
 */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const update = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    // The service worker exists only in a production build
    if (!import.meta.env.PROD) return;
    let cancelled = false;
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return;
        update.current = registerSW({ onNeedRefresh: () => setReady(true) });
      })
      .catch(() => {
        // no service worker support: the app still works without one
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 bg-stamp-soft text-stamp-strong border-b border-rule px-4 py-1 text-xs font-semibold flex items-center justify-center gap-3 z-30"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      <span>A new version of Ordinovix is ready.</span>
      <button
        type="button"
        onClick={() => void update.current?.(true)}
        className="min-h-[44px] sm:min-h-0 px-3 py-1 rounded-control bg-stamp text-on-stamp hover:bg-[var(--stamp-strong)] transition-colors cursor-pointer"
      >
        Reload
      </button>
    </div>
  );
}
