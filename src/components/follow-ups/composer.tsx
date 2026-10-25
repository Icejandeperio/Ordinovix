import React, { useState, useEffect, useMemo } from 'react';
import type { FollowUpView, TaskLine, Channel, Language, MessageTemplate } from '@/domain/types';
import { useMessageTemplates, useMarkFollowUpSent, useContacts, useOrgSettings } from '@/hooks/useData';
import { copyFormLabel } from '@/domain/labels';
import { formatDate } from '@/lib/format';
import {
  interpolatePlaceholders,
  calculateSmsSegments,
  buildChannelIntent,
} from '@/lib/messaging';
import { DateField } from '@/components/inputs/date-field';
import { todayInManila, addDaysToDate } from '@/lib/dates';
import { toast } from 'sonner';
import {
  X,
  Copy,
  Check,
  Send,
  MessageSquare,
  Mail,
  Smartphone,
  Sparkles,
  Info,
  ExternalLink,
} from 'lucide-react';

interface MessageComposerProps {
  followUpView: FollowUpView;
  isOpen: boolean;
  onClose: () => void;
  onSentSuccess?: () => void;
}

export function MessageComposer({
  followUpView,
  isOpen,
  onClose,
  onSentSuccess,
}: MessageComposerProps) {
  const { followUp, client, task, lines, contact: initialContact } = followUpView;

  const { data: templates = [] } = useMessageTemplates();
  const { data: contacts = [] } = useContacts(client.id);
  const { data: settings } = useOrgSettings();
  const markSentMutation = useMarkFollowUpSent();

  // Contact state
  const [selectedContactId, setSelectedContactId] = useState<string>(
    initialContact?.id || (contacts[0]?.id ?? '')
  );

  const activeContact = useMemo(() => {
    return contacts.find((c) => c.id === selectedContactId) || initialContact || contacts[0];
  }, [contacts, selectedContactId, initialContact]);

  // Language state (defaults to contact's preferred language)
  const [language, setLanguage] = useState<Language>(
    activeContact?.language || followUp.language || 'en'
  );

  // Channel state
  const [channel, setChannel] = useState<Channel>(
    followUp.channel || activeContact?.preferredChannel || 'viber'
  );

  // Expected by date
  const defaultWait = settings?.followUpWaitDays ?? 3;
  const [expectedBy, setExpectedBy] = useState<string>(
    followUp.expectedBy || addDaysToDate(todayInManila(), defaultWait)
  );

  // Selected checklist lines
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>(
    lines.map((l) => l.id)
  );

  // Active message template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Auto-pick template matching purpose (reminder vs first_request) and language
  useEffect(() => {
    if (templates.length === 0) return;
    const defaultPurpose = followUp.attemptCount > 0 ? 'reminder' : 'first_request';
    const match =
      templates.find((t) => t.purpose === defaultPurpose && t.language === language && t.active) ||
      templates.find((t) => t.language === language && t.active) ||
      templates[0];
    if (match) {
      setSelectedTemplateId(match.id);
    }
  }, [templates, language, followUp.attemptCount]);

  // Interpolated message preview text
  const [messageText, setMessageText] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [hasInteractedWithShortcuts, setHasInteractedWithShortcuts] = useState<boolean>(false);

  // Recompute preview when template or variables change
  useEffect(() => {
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return;

    const chosenLines = lines.filter((l) => selectedLineIds.includes(l.id));

    const rendered = interpolatePlaceholders(tmpl.body, {
      contactName: activeContact?.name || client.displayName,
      clientName: client.displayName,
      taskTitle: task?.title || 'Tax Filing',
      period: task?.period || 'current period',
      lines: chosenLines,
      dueDate: expectedBy,
      deadlineDate: task?.dueDate,
      operatorName: settings?.operatorDisplayName || 'Santos Tax Services',
    });

    setMessageText(rendered);
  }, [selectedTemplateId, selectedLineIds, expectedBy, activeContact, client, task, lines, templates, settings]);

  // SMS math
  const smsCalculation = useMemo(() => {
    return calculateSmsSegments(messageText);
  }, [messageText]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setIsCopied(true);
      setHasInteractedWithShortcuts(true);
      toast.success('Message copied to clipboard');
      setTimeout(() => setIsCopied(false), 2500);
    } catch (e) {
      toast.error('Could not copy message');
    }
  };

  const handleShortcutClick = (targetChannel: Channel) => {
    setChannel(targetChannel);
    setHasInteractedWithShortcuts(true);

    const intentUri = buildChannelIntent(targetChannel, messageText, {
      phone: activeContact?.phoneE164,
      email: activeContact?.email,
    });

    if (intentUri) {
      window.open(intentUri, '_blank');
      toast.info(`Opening ${targetChannel.toUpperCase()} with pre-filled message`);
    } else {
      // Messenger or unsupported direct link
      handleCopy();
      toast.info(`Copied message. Paste directly into ${targetChannel}`);
    }
  };

  const handleMarkSent = async () => {
    try {
      await markSentMutation.mutateAsync({
        id: followUp.id,
        action: {
          channel,
          sentAt: `${todayInManila()}T${new Date().toLocaleTimeString('en-GB', { hour12: false })}+08:00`,
          expectedBy,
          message: messageText,
        },
      });
      toast.success(`Marked as sent via ${channel.toUpperCase()}`);
      if (onSentSuccess) {
        onSentSuccess();
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record follow-up attempt');
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex justify-end bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl h-full bg-paper flex flex-col shadow-2xl border-l border-rule overflow-hidden animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-label="Message Composer"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-rule bg-sheet flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-chip bg-stamp-soft text-stamp border border-stamp/20">
                {client.code}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-ink truncate">{client.displayName}</h2>
            </div>
            <p className="text-xs text-ink-2 mt-0.5">
              {task?.title || 'Document Request'} · {task?.period || 'Q3 2026'} (Attempt #{followUp.attemptCount + 1})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-control text-ink-3 hover:text-ink hover:bg-sheet-2 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Top Controls: Contact, Template, Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-sheet p-4 rounded-panel border border-rule">
            {/* Contact Combobox */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-ink">To Contact</label>
              <select
                value={selectedContactId}
                onChange={(e) => {
                  setSelectedContactId(e.target.value);
                  const newContact = contacts.find((c) => c.id === e.target.value);
                  if (newContact) {
                    setLanguage(newContact.language || 'en');
                    setChannel(newContact.preferredChannel || 'viber');
                  }
                }}
                className="w-full text-xs bg-paper border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.title ? `(${c.title})` : ''} · {c.preferredChannel.toUpperCase()}
                  </option>
                ))}
                {contacts.length === 0 && (
                  <option value="">{activeContact?.name || client.displayName}</option>
                )}
              </select>
            </div>

            {/* Language Toggle */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-ink">Language</label>
              <div className="flex rounded-control border border-rule overflow-hidden p-0.5 bg-paper">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`flex-1 text-xs py-1 font-semibold rounded-xs transition-colors ${
                    language === 'en' ? 'bg-stamp text-on-stamp' : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('fil')}
                  className={`flex-1 text-xs py-1 font-semibold rounded-xs transition-colors ${
                    language === 'fil' ? 'bg-stamp text-on-stamp' : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  Filipino
                </button>
              </div>
            </div>

            {/* Template Selector */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-ink">Message Template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full text-xs bg-paper border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
              >
                {templates
                  .filter((t) => t.language === language)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.purpose.replace(/_/g, ' ')})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Items checklist picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink">Requested Lines to Include in Message</label>
              <span className="text-[11px] text-ink-3">
                {selectedLineIds.length} of {lines.length} items selected
              </span>
            </div>
            <div className="space-y-1.5 bg-sheet p-3 rounded-panel border border-rule">
              {lines.map((line) => {
                const checked = selectedLineIds.includes(line.id);
                return (
                  <label
                    key={line.id}
                    className={`flex items-start gap-2.5 p-2 rounded-control border text-xs cursor-pointer transition-colors ${
                      checked
                        ? 'border-stamp/40 bg-stamp-soft/30 text-ink'
                        : 'border-transparent text-ink-2 hover:bg-sheet-2'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLineIds([...selectedLineIds, line.id]);
                        } else {
                          setSelectedLineIds(selectedLineIds.filter((id) => id !== line.id));
                        }
                      }}
                      className="mt-0.5 rounded text-stamp focus:ring-stamp"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-ink">{line.label}</span>
                      {line.copyForm && (
                        <span className="ml-2 text-[10px] uppercase font-bold text-ink-3 bg-sheet px-1.5 py-0.5 rounded border border-rule">
                          {copyFormLabel(line.copyForm)}
                        </span>
                      )}
                      {line.flagNote && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                          Note: {line.flagNote}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Expected by date */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink">Send By / Expected By</label>
            <div className="max-w-xs">
              <DateField value={expectedBy} onChange={(val) => setExpectedBy(val || '')} />
            </div>
            <p className="text-[11px] text-ink-3">
              Default wait is {defaultWait} days. If not answered by this date, follow-up will return to Due Today.
            </p>
          </div>

          {/* Editable Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-stamp" />
                Message Preview (Editable)
              </label>
              <div className="text-[11px] font-mono text-ink-3">
                {smsCalculation.charCount} characters ·{' '}
                <span className={smsCalculation.segmentCount > 1 ? 'font-bold text-ink' : ''}>
                  {smsCalculation.segmentCount} SMS
                </span>
                {!smsCalculation.isGsm7 && (
                  <span className="ml-1 text-amber-700 dark:text-amber-400 font-sans">
                    (Unicode, 70/67 limit)
                  </span>
                )}
              </div>
            </div>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={8}
              className="w-full text-xs font-sans p-3 bg-sheet border border-rule rounded-panel text-ink leading-relaxed focus:outline-none focus:border-stamp resize-y shadow-inner"
              placeholder="Preview message..."
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-rule bg-sheet space-y-3">
          {/* Shortcuts Row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-ink-3 mr-1">Direct:</span>
              <button
                type="button"
                onClick={() => handleShortcutClick('viber')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-control border transition-colors flex items-center gap-1.5 ${
                  channel === 'viber'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-paper text-ink border-rule hover:bg-sheet-2'
                }`}
              >
                Viber
              </button>
              <button
                type="button"
                onClick={() => handleShortcutClick('sms')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-control border transition-colors flex items-center gap-1.5 ${
                  channel === 'sms'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-paper text-ink border-rule hover:bg-sheet-2'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                SMS
              </button>
              <button
                type="button"
                onClick={() => handleShortcutClick('email')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-control border transition-colors flex items-center gap-1.5 ${
                  channel === 'email'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-paper text-ink border-rule hover:bg-sheet-2'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </button>
              <button
                type="button"
                onClick={() => handleShortcutClick('messenger')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-control border transition-colors flex items-center gap-1.5 ${
                  channel === 'messenger'
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-paper text-ink border-rule hover:bg-sheet-2'
                }`}
              >
                Messenger
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className={`px-3 py-1.5 text-xs font-semibold rounded-control border transition-colors flex items-center gap-1.5 ${
                isCopied
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-paper text-ink border-rule hover:bg-sheet-2'
              }`}
            >
              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {isCopied ? 'Copied' : 'Copy message'}
            </button>
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-ink-3">
              Channel: <span className="font-bold uppercase text-ink">{channel}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-semibold text-ink-2 hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={markSentMutation.isPending}
                onClick={handleMarkSent}
                className={`px-4 py-2 text-xs font-bold rounded-control transition-all flex items-center gap-2 shadow-xs ${
                  hasInteractedWithShortcuts || isCopied
                    ? 'bg-stamp text-on-stamp hover:bg-stamp-strong ring-2 ring-stamp/40'
                    : 'bg-stamp text-on-stamp hover:bg-stamp-strong'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                {markSentMutation.isPending ? 'Recording…' : 'Mark as sent'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
