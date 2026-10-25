import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

export function AccessPendingPage() {
  const simulatedEmail = 'maria.unauthorized@gmail.com';

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
            You're signed in as <strong className="text-[var(--ink)] font-mono">{simulatedEmail}</strong>, but this account hasn't been added to Ordinovix.
          </p>
          <p className="text-xs text-[var(--ink-3)] leading-relaxed">
            Ask the practice owner to add this email address in <em>Settings &rarr; Users & Access</em>.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Link
            to="/sign-in"
            className="w-full py-2.5 px-4 rounded-lg bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Use a different Google account</span>
          </Link>
          <Link
            to="/sign-in"
            className="w-full py-2.5 px-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink-2)] hover:bg-[var(--sheet-2)] hover:text-[var(--ink)] text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
