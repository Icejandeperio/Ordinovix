import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFollowUps, useMarkFollowUpSent, useEscalateFollowUp } from '@/hooks/useData';
import { MessageComposer } from '@/components/follow-ups/composer';
import { EscalateModal } from '@/components/follow-ups/follow-up-modals';
import { copyFormLabel } from '@/domain/labels';
import { formatDate } from '@/lib/format';
import {
  ArrowLeft,
  ArrowRight,
  Send,
  SkipForward,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Sparkles,
  Home,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

export function FollowUpsRunPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useFollowUps();
  const markSentMutation = useMarkFollowUpSent();

  // Filter to queue items that need action (due today or overdue)
  const queueItems = useMemo(() => {
    const items = data?.items || [];
    return items.filter((item) => item.state === 'due_today' || item.state === 'overdue');
  }, [data]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState({
    sent: 0,
    escalated: 0,
    skipped: 0,
  });
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEscalateOpen, setIsEscalateOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const currentItem = queueItems[currentIndex];

  const handleNext = () => {
    if (currentIndex + 1 < queueItems.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSkip = () => {
    setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
    toast.info('Follow-up skipped');
    handleNext();
  };

  const handleMarkSentSuccess = () => {
    setStats((s) => ({ ...s, sent: s.sent + 1 }));
    handleNext();
  };

  const handleEscalated = () => {
    setStats((s) => ({ ...s, escalated: s.escalated + 1 }));
    setIsEscalateOpen(false);
    handleNext();
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-sheet-3 rounded" />
        <div className="h-64 bg-sheet border border-rule rounded-panel" />
      </div>
    );
  }

  if (queueItems.length === 0 || isCompleted) {
    return (
      <div className="max-w-xl mx-auto p-6 sm:p-12 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-ink">Daily Chasing Queue Clear!</h1>
          <p className="text-sm text-ink-2">
            All document follow-ups due today have been reviewed and processed.
          </p>
        </div>

        {/* Summary counts */}
        <div className="grid grid-cols-3 gap-3 bg-sheet p-4 rounded-panel border border-rule text-left">
          <div>
            <div className="text-xs text-ink-3">Messages Sent</div>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {stats.sent}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-3">Escalated</div>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {stats.escalated}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-3">Skipped</div>
            <div className="text-2xl font-bold font-mono text-ink-2">{stats.skipped}</div>
          </div>
        </div>

        <button
          onClick={() => navigate('/follow-ups')}
          className="px-5 py-2.5 rounded-control bg-stamp text-on-stamp font-bold text-xs hover:bg-stamp-strong transition-all inline-flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Back to Follow-ups Directory
        </button>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / queueItems.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Top Walkthrough Stepper Header */}
      <div className="space-y-3 bg-sheet p-4 sm:p-5 rounded-panel border border-rule shadow-xs">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/follow-ups')}
            className="text-xs font-semibold text-ink-2 hover:text-ink flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Exit Queue
          </button>
          <div className="text-xs font-bold font-mono text-ink">
            Follow-up {currentIndex + 1} of {queueItems.length}
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-paper rounded-full h-2 overflow-hidden border border-rule">
          <div
            className="bg-stamp h-2 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Focus Card */}
      <div className="bg-sheet border border-rule rounded-panel shadow-sm overflow-hidden divide-y divide-rule">
        {/* Card Header */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-paper">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-chip bg-stamp-soft text-stamp border border-stamp/20">
                {currentItem.client.code}
              </span>
              <h2 className="text-lg font-bold text-ink">{currentItem.client.displayName}</h2>
            </div>
            <p className="text-xs text-ink-2 mt-0.5">
              {currentItem.task?.title || 'Tax Document Request'} · {currentItem.task?.period || 'Q3 2026'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-xs font-bold rounded-chip uppercase tracking-wide border ${
                currentItem.state === 'overdue'
                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
              }`}
            >
              {currentItem.state === 'overdue' ? 'Overdue' : 'Due Today'}
            </span>
            <span className="text-xs font-semibold text-ink-3">
              Attempt #{currentItem.followUp.attemptCount + 1}
            </span>
          </div>
        </div>

        {/* Outstanding items checklist */}
        <div className="p-5 space-y-3">
          <div className="text-xs font-bold text-ink flex items-center justify-between">
            <span>Outstanding Items Needed</span>
            <span className="text-ink-3 font-normal">
              {currentItem.lines.length} requirement(s)
            </span>
          </div>
          <div className="bg-paper p-3 rounded-control border border-rule space-y-2">
            {currentItem.lines.map((l, idx) => (
              <div key={l.id} className="flex items-start gap-2 text-xs">
                <span className="font-bold font-mono text-stamp">{idx + 1}.</span>
                <div className="flex-1">
                  <span className="font-semibold text-ink">{l.label}</span>
                  {l.copyForm && (
                    <span className="ml-2 text-[10px] uppercase font-bold text-ink-3 bg-sheet px-1.5 py-0.5 rounded border border-rule">
                      {copyFormLabel(l.copyForm)}
                    </span>
                  )}
                  {l.flagNote && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                      Issue: {l.flagNote}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact info & channels */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5 text-xs">
            <div className="font-bold text-ink">
              Contact: {currentItem.contact?.name || 'Primary Client Contact'}
            </div>
            <div className="text-ink-3">
              Preferred: <strong className="uppercase text-ink">{currentItem.followUp.channel}</strong> · Language: {currentItem.followUp.language.toUpperCase()}
            </div>
          </div>

          <button
            onClick={() => setIsComposerOpen(true)}
            className="px-4 py-2 text-xs font-bold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Open Message Composer
          </button>
        </div>
      </div>

      {/* Stepper Navigation Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="px-3 py-2 text-xs font-semibold text-ink-2 hover:text-ink disabled:opacity-30 disabled:hover:text-ink-2 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Previous
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEscalateOpen(true)}
            className="px-3 py-2 text-xs font-semibold rounded-control border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-1.5 transition-colors"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            Escalate
          </button>

          <button
            onClick={handleSkip}
            className="px-3 py-2 text-xs font-semibold rounded-control border border-rule bg-sheet text-ink hover:bg-sheet-2 flex items-center gap-1.5 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </button>

          <button
            onClick={() => setIsComposerOpen(true)}
            className="px-4 py-2 text-xs font-bold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Send & Next
          </button>
        </div>
      </div>

      {/* Embedded Modals */}
      {isComposerOpen && (
        <MessageComposer
          followUpView={currentItem}
          isOpen={isComposerOpen}
          onClose={() => setIsComposerOpen(false)}
          onSentSuccess={handleMarkSentSuccess}
        />
      )}

      {isEscalateOpen && (
        <EscalateModal
          followUpView={currentItem}
          isOpen={isEscalateOpen}
          onClose={() => setIsEscalateOpen(false)}
        />
      )}
    </div>
  );
}
