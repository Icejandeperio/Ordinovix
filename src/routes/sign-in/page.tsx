import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authControls, devControls } from '@/data';
import { safeNext } from '@/lib/auth';
import { isMockData } from '@/lib/data-source';

export function SignInPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [starting, setStarting] = useState(false);
  // A failed Google round trip comes back here as /sign-in?error=...
  const [failed, setFailed] = useState(params.has('error'));

  // Mock builds keep the persona switch; builds against the API start the real Google sign-in and follow the URL the server returns
  const handleGoogle = async () => {
    if (isMockData) {
      handlePersonaSelect('owner');
      return;
    }
    setStarting(true);
    setFailed(false);
    try {
      window.location.assign(await authControls.googleSignInUrl(next));
    } catch {
      setFailed(true);
      setStarting(false);
    }
  };

  const handlePersonaSelect = (role: 'owner' | 'helper') => {
    devControls.setPersona(role);
    navigate('/');
  };

  const handleSimulateUnauthorized = () => {
    navigate('/access-pending');
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-[var(--sheet)] border border-[var(--rule)] rounded-xl p-8 shadow-sm text-center space-y-6">
        {/* Logomark 48px */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--stamp)] text-[var(--on-stamp)] flex items-center justify-center font-bold font-mono text-xl shadow-inner">
            OX
          </div>
        </div>

        {/* Headings */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Ordinovix
          </h1>
          <p className="text-sm text-[var(--ink-2)] leading-snug">
            Client work, documents and BIR visits in one place.
          </p>
        </div>

        {/* Google Sign In Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => void handleGoogle()}
            disabled={starting}
            aria-busy={starting}
            className="w-full h-12 px-4 rounded-lg border border-[var(--rule-strong)] bg-[var(--sheet)] hover:bg-[var(--sheet-2)] text-[var(--ink)] text-sm font-semibold flex items-center justify-center gap-3 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
          >
            {/* Google "G" SVG */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
          {failed && (
            <div role="alert" className="mt-3 rounded-lg border border-[var(--critical-bd)] bg-[var(--critical-bg)] text-[var(--critical-fg)] p-3 text-xs text-left space-y-2">
              <p>We could not start Google sign-in. Check your connection and try again.</p>
              <button
                type="button"
                onClick={() => void handleGoogle()}
                className="min-h-[44px] px-4 rounded-lg border border-[var(--critical-bd)] bg-[var(--sheet)] text-[var(--ink)] text-xs font-semibold hover:bg-[var(--sheet-2)] focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-[var(--ink-3)]">
          Only people the owner has added can sign in.
        </p>

        {/* Mock Mode Switcher (mock builds only) */}
        {isMockData && (
        <div className="pt-2 border-t border-[var(--rule)] space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px bg-[var(--rule)] flex-1" />
            <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--ink-3)] px-1">
              mock mode only
            </span>
            <div className="h-px bg-[var(--rule)] flex-1" />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => handlePersonaSelect('owner')}
              className="w-full py-2.5 px-3 rounded-lg border border-[var(--stamp-soft)] bg-[var(--stamp-soft)] hover:bg-[var(--stamp)] hover:text-[var(--on-stamp)] text-[var(--stamp-ink)] text-xs font-semibold transition-colors"
            >
              Continue as Ana — Owner
            </button>
            <button
              type="button"
              onClick={() => handlePersonaSelect('helper')}
              className="w-full py-2.5 px-3 rounded-lg border border-[var(--rule)] bg-[var(--sheet-2)] hover:bg-[var(--sheet)] text-[var(--ink)] text-xs font-medium transition-colors"
            >
              Continue as Ben — Helper
            </button>
            <button
              type="button"
              onClick={handleSimulateUnauthorized}
              className="w-full py-2 px-3 text-[11px] text-[var(--ink-3)] hover:text-[var(--critical-fg)] hover:underline transition-colors"
            >
              Simulate unauthorized Google account
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
