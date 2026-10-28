import React, { useState, useEffect } from 'react';
import { useUpsertContact } from '@/hooks/useData';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PhoneInput, EmailInput } from '@/components/inputs/identity-inputs';
import { X, UserCheck, ShieldCheck } from 'lucide-react';
import type { Contact, Channel, Language } from '@/domain/types';

interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  contact?: Contact | null;
}

const ROLE_SUGGESTIONS = ['Managing partner', 'Accountant', 'Secretary', 'Bookkeeper', 'Operations manager'];

export function ContactFormModal({ open, onClose, clientId, contact }: ContactFormModalProps) {
  const upsertContact = useUpsertContact();
  const isEditing = Boolean(contact);

  const [name, setName] = useState('');
  const [title, setTitle] = useState<'Atty.' | 'Mr.' | 'Ms.' | ''>('');
  const [role, setRole] = useState('');
  const [phoneE164, setPhoneE164] = useState('');
  const [email, setEmail] = useState('');
  const [preferredChannel, setPreferredChannel] = useState<Channel>('viber');
  const [language, setLanguage] = useState<Language>('en');
  const [isSignatory, setIsSignatory] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contact) {
      setName(contact.name || '');
      setTitle(contact.title || '');
      setRole(contact.role || '');
      setPhoneE164(contact.phoneE164 || '');
      setEmail(contact.email || '');
      setPreferredChannel(contact.preferredChannel || 'viber');
      setLanguage(contact.language || 'en');
      setIsSignatory(Boolean(contact.isSignatory));
      setNotes(contact.notes || '');
    } else {
      setName('');
      setTitle('');
      setRole('');
      setPhoneE164('');
      setEmail('');
      setPreferredChannel('viber');
      setLanguage('en');
      setIsSignatory(false);
      setNotes('');
    }
    setError(null);
  }, [contact, open]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Contact name is required');
      return;
    }
    if (!phoneE164.trim() && !email.trim()) {
      setError('At least one of mobile number or email address is required');
      return;
    }

    upsertContact.mutate(
      {
        id: contact?.id,
        version: contact?.version,
        clientId,
        name: name.trim(),
        title: title ? title : undefined,
        role: role.trim() || undefined,
        phoneE164: phoneE164.trim() || undefined,
        email: email.trim().toLowerCase() || undefined,
        preferredChannel,
        language,
        isSignatory,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (err) => setError((err as Error).message),
      }
    );
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      maxWidth="max-w-lg"
      ariaLabel={isEditing ? 'Edit Client Contact' : 'Add Client Contact'}
      panelClassName="flex flex-col max-h-[90vh]"
    >
        {/* Header */}
        <div className="p-4 border-b border-rule flex items-center justify-between shrink-0 bg-sheet">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-stamp-soft text-stamp flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink font-sans">
                {isEditing ? 'Edit Contact Person' : 'Add Contact Person'}
              </h3>
              <p className="text-[11px] text-ink-3">Authorized representative for BIR filings and follow-ups</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-control bg-critical-bg border border-critical-bd text-critical text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-ink-2 mb-1">Title</label>
              <select
                value={title}
                onChange={(e) => setTitle(e.target.value as any)}
                className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <option value="">None</option>
                <option value="Atty.">Atty.</option>
                <option value="Mr.">Mr.</option>
                <option value="Ms.">Ms.</option>
              </select>
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-ink-2 mb-1">
                Full Name <span className="text-critical">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maria Corazon Salonga"
                className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1">Role / Designation</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Managing Partner"
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {ROLE_SUGGESTIONS.map((sug) => (
                <button
                  type="button"
                  key={sug}
                  onClick={() => setRole(sug)}
                  className="px-2 py-0.5 text-[10px] rounded-full border border-rule-strong bg-sheet text-ink-2 hover:bg-sheet-2 transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PhoneInput
              id="contact-mobile"
              label="Mobile Number"
              value={phoneE164}
              onChange={setPhoneE164}
            />

            <EmailInput
              id="contact-email"
              label="Email Address"
              value={email}
              onChange={setEmail}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1">Preferred Channel</label>
              <select
                value={preferredChannel}
                onChange={(e) => setPreferredChannel(e.target.value as Channel)}
                className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <option value="viber">Viber</option>
                <option value="messenger">Messenger</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="phone">Phone call</option>
                <option value="in_person">In person</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1">Language</label>
              <div className="flex items-center gap-1 bg-sheet-2 p-1 border border-rule rounded-control">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`flex-1 py-1 text-xs font-medium rounded ${
                    language === 'en' ? 'bg-sheet text-ink shadow-xs' : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('fil')}
                  className={`flex-1 py-1 text-xs font-medium rounded ${
                    language === 'fil' ? 'bg-sheet text-ink shadow-xs' : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  Filipino
                </button>
              </div>
            </div>
          </div>

          {/* Signs documents toggle */}
          <div className="p-3 bg-sheet-2 border border-rule rounded-control flex items-center justify-between">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-stamp shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-ink">Signatory Authority</p>
                <p className="text-[11px] text-ink-3">Authorized to sign BIR returns, SPAs, and official tax correspondence</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isSignatory}
                onChange={(e) => setIsSignatory(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-rule peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-stamp"></div>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Prefers morning messages on Viber; Secretary coordinates schedules"
              rows={2}
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-rule">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={upsertContact.isPending}>
              {isEditing ? 'Save Changes' : 'Add Contact'}
            </Button>
          </div>
        </form>
    </ModalDialog>
  );
}
