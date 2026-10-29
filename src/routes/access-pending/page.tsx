import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { authControls } from '@/data';
import { useSignOut } from '@/hooks/useData';
import { isMockData } from '@/lib/data-source';

export function AccessPendingPage() {
  // Mock builds show a made-up stranger; against the API the page shows the address the person actually signed in with
  const [email, setEmail] = useState<string | undefined>(isMockData ? 'maria.unauthorized@gmail.com' : undefined);
  const signOut = useSignOut();

  useEffect(() => {
    if (!isMockData) void authControls.signedInEmail().then(setEmail);
  }, []);

  // Against the API both ways out end the server session first; the mock just returns to sign-in
  const leave = (className: string, children: ReactNode) =>
    isMockData ? (
      <Link to="/sign-in" className={className}>
        {children}
      </Link>
    ) : (
      <button type="button" onClick={() => void signOut()} className={className}>
        {children}
      </button>
    );

  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-[var(--sheet)] border border-[var(--rule)] rounded-xl p-8 shadow-sm text-center space-y-6">
        <div className="w-12 h-12 rounded-full bg-[var(--warn-bg)] text-[var(--warn-fg)] border border-[var(--warn-bd)] flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-[var(--ink)]">
            Access Pending
          </h1>
          <p className="text-xs text-[var(--ink-2)] leading-relaxed">
            {email ? (
              <>You're signed in as <strong className="text-[var(--ink)] font-mono">{email}</strong>, but this account hasn't been added to Ordinovix.</>
            ) : (
              <>You're signed in, but this account hasn't been added to Ordinovix.</>
            )}
          </p>
          <p className="text-xs text-[var(--ink-3)] leading-relaxed">
            Ask the practice owner to add this email address in <em>Settings &rarr; Users & Access</em>.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          {leave(
            'w-full py-2.5 px-4 rounded-lg bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] transition-colors flex items-center justify-center gap-2',
            <>
              <ArrowLeft className="w-4 h-4" />
              <span>Use a different Google account</span>
            </>,
          )}
          {leave(
            'w-full py-2.5 px-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink-2)] hover:bg-[var(--sheet-2)] hover:text-[var(--ink)] text-xs font-medium transition-colors flex items-center justify-center gap-2',
            <>
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </>,
          )}
        </div>
      </div>
    </div>
  );
}
