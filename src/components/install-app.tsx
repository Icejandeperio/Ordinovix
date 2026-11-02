import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { installMode, isStandalone } from '@/lib/install';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/**
 * "Install app" in the top bar (spec 19.3). Android and desktop: the browser's own prompt, from `beforeinstallprompt`. iPhone and
 * iPad: a card with the Share, Add to Home Screen steps. Nothing shows once the app is installed.
 */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      setCardOpen(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const mode = installMode({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: installed,
    hasPrompt: prompt !== null,
  });
  if (mode === 'installed' || mode === 'none') return null;

  const onClick = async () => {
    if (mode === 'ios') {
      setCardOpen((o) => !o);
      return;
    }
    const offer = prompt;
    setPrompt(null); // an offer can be used once
    await offer?.prompt();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void onClick()}
        aria-expanded={mode === 'ios' ? cardOpen : undefined}
        aria-label="Install app"
        title="Install Ordinovix on this device"
        className="flex items-center gap-1 min-h-11 min-w-11 justify-center px-2.5 rounded-control bg-sheet-2 border border-rule text-xs font-semibold text-ink hover:bg-sheet-3 transition-colors cursor-pointer lg:min-h-0 lg:min-w-0 lg:py-1"
      >
        <Download className="w-3.5 h-3.5 text-stamp" />
        <span className="hidden lg:inline">Install app</span>
      </button>

      {mode === 'ios' && cardOpen && (
        <div
          role="dialog"
          aria-label="Install Ordinovix on your iPhone"
          className="absolute right-0 top-full mt-1.5 w-72 max-w-[90vw] z-50 rounded-panel border border-rule bg-sheet shadow-lg p-3 space-y-2 text-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold text-ink">Install on iPhone or iPad</div>
            <button type="button" onClick={() => setCardOpen(false)} aria-label="Close" className="p-1 rounded-control text-ink-3 hover:text-ink cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-ink-2 leading-relaxed">
            <li>
              Tap <strong>Share</strong> <Share className="inline w-3.5 h-3.5 align-text-bottom" aria-hidden="true" /> in Safari.
            </li>
            <li>
              Tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong>, then open Ordinovix from your Home Screen.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
